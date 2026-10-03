# Monitor Worker Extraction — Design

> **Status:** decided 2026-08-17 — extract the worker into its own **Go**
> binary and fix the coordination bug there.
> **Diagram:** [`monitor-service.excalidraw`](../monitor-service.excalidraw)
>
> One new deployable, zero new infrastructure, zero new languages. MongoDB
> remains the only coordination substrate.

---

## 1 · The decision, and what it deleted

The first draft of this proposal costed the worker as a separate Node service.
Staying in Go removes most of that plan rather than translating it:

| First draft (Node service) | Now (Go binary) |
| --- | --- |
| Port the check loop to TypeScript | **Nothing moves.** New entrypoint over the same packages |
| Latency-semantics parity risk (`client.Do` vs `fetch`) | Gone — same `net/http` client, byte for byte |
| TLS root-store divergence → false incidents | Gone — same runtime, same trust store |
| Node event-loop / unhandled-rejection hazards | Gone |
| Shadow mode + a week of diffing | Not needed — behaviour is identical by construction |
| Parity harness in CI | Not needed |
| Schema duplicated in two languages; drift detector | Gone — one `internal/model`, compiler-enforced |
| "Direct Mongo or gRPC?" (§7 of the draft) | Moot — same `internal/repository` package |
| Second toolchain to staff and maintain | Gone |

What survives is the part that was always the real work: **the lease**, two
latent bugs in it (§5), and the packaging.

## 2 · The problem, stated precisely

The finding was: the monitor check worker runs embedded in every replica of
`api/common` with no coordination, so scaling past one instance checks every
monitor N times and can open N incidents for one outage.

That is a **coordination** defect. Extraction does not fix it — an
uncoordinated fleet of worker binaries duplicates checks exactly as an
uncoordinated fleet of API replicas does. Two separate changes:

| Problem | Fix | Status |
| --- | --- | --- |
| Duplicate checks / duplicate incidents | Atomic lease on the `Monitor` document | **Already written**, uncommitted on `main` |
| Worker lifecycle coupled to API scaling | Own binary, own deployment | This proposal |

`MonitorRepository.ClaimMonitor` plus `lockedBy`/`lockedUntil` on `Monitor`
([`monitor_repository.go:236`](../api/common/internal/repository/monitor_repository.go#L236))
already solve the first row.

**Ship the lease first, as its own commit.** It closes the incident on the
current single-binary deployment, and it is what makes the extraction a
non-event: with the lease in place, a server replica and a worker replica can
run their loops simultaneously without double-firing, so the cutover has no
flag-flip moment where checks stop or double.

## 3 · Shape: a second entrypoint, not a second service

```
api/common/
  cmd/
    server/main.go              gRPC + HTTP        ← exists
    worker/main.go              background loops   ← new, ~60 lines
    make_service_token/         (precedent: cmd/ is already multi-binary)
  internal/
    service/     monitor_worker_service.go, notification_service.go,
                 rollup_service.go, checker_service.go   ← unchanged, shared
    repository/  monitor_repository.go, …                ← unchanged, shared
    model/       monitor_model.go, …                     ← unchanged, shared
```

No file moves. No package is copied. `cmd/worker/main.go` is the same eight
lines of goroutine wiring that `cmd/server/main.go` lines 38–45 already does,
minus the gRPC server, plus a health listener (§7).

Because both binaries compile from one `internal/`, the write-ownership
contract that a polyglot design would need as a *document* is here enforced by
the *type system* — there is exactly one `UpdateAfterCheck`, one set of bson
tags, one lease implementation. That is the whole reason this option is cheap.

## 4 · Which loops move: all three, at once

`cmd/server` currently starts three goroutines
([`main.go:38-45`](../api/common/cmd/server/main.go#L38-L45)). All three are
already safe to run on N replicas:

| Loop | Coordination | Safe on N replicas? |
| --- | --- | --- |
| `MonitorWorker` | lease on `Monitor` (`ClaimMonitor`) | yes — one claimer per monitor per tick |
| `NotificationWorker` | lease on `notification_outbox` (`Claim`) | yes — same pattern |
| `RollupWorker` | none needed — recompute is idempotent | yes — redundant work, never conflicting writes |

The polyglot plan staged these across three separate migrations because each
carried its own parity risk. With no parity risk, **move all three in one
change.** The end state — `api-common` serving requests with zero background
loops — arrives in a single step instead of three.

Add `WORKER_LOOPS` (default `monitor,notification,rollup`) so splitting them
into separately-scaled deployments later is a values change, not a code change.

## 5 · Fix these while you are in there

Both are real defects in the lease design, independent of packaging.

### 5.1 · Lease TTL is silently coupled to a hardcoded timeout

A check can take `3 attempts × timeoutSeconds + 2 × 500ms`. Against the 60 s
`LeaseDuration` that is 31 s today — but *only* because `CreateMonitor`
hardcodes `TimeoutSeconds: 10`
([`monitor_service.go:72`](../api/common/internal/service/monitor_service.go#L72)).
The proto already carries `timeout_seconds`. The day that field becomes
user-editable, a 30 s timeout produces a 91 s check that outlives its own
lease, a second worker claims a monitor still being checked, and the duplicate
-incident bug returns — through the mechanism that was supposed to prevent it.

**Fix:** derive the lease from the monitor
(`maxAttempts × (timeout + retryDelay) + slack`), or heartbeat it mid-check.
Do not leave two unrelated constants load-bearing against each other.

### 5.2 · Claim churn is O(N × M)

Every replica lists **all** active monitors, then races to claim each one:
`N × M` claim writes per tick, of which `(N−1) × M` are wasted. Fine at today's
monitor count; it grows with the product, and extraction is precisely the
change that will let you raise N.

**Fix:** push the due-filter into the query (`active`, `lastCheckedAt +
intervalSeconds <= now`, lease free) and pop monitors with `FindOneAndUpdate`
in a loop instead of list-then-race. Same lease semantics, one round-trip per
monitor actually checked, write load flat in replica count.

## 6 · The coordination contract

Unchanged, and still the load-bearing piece:

```go
filter := bson.M{
    "_id": monitorID,
    "$or": bson.A{
        bson.M{"lockedUntil": bson.M{"$exists": false}},
        bson.M{"lockedUntil": nil},
        bson.M{"lockedUntil": bson.M{"$lt": now}},
    },
}
update := bson.M{"$set": bson.M{
    "lockedBy":    workerID,
    "lockedUntil": now.Add(leaseDuration),
}}
```

- Exactly one worker wins per monitor per tick; losers skip at the cost of one
  round-trip.
- A worker that dies mid-check loses its lease by expiry; the next tick
  reclaims. No cleanup path, no orphan detection, no membership tracking.
- On success the lease is released early — `UpdateAfterCheck` clears
  `lockedBy`/`lockedUntil` in the same `$set` as the result, so the release
  cannot be lost separately from the write.

MongoDB is the arbiter, so *which process* holds the loop is irrelevant to
correctness. That is what makes §8 a two-step rollout with no coordination
window.

## 7 · Packaging and deployment

**One image, two binaries.** Build both in the existing Dockerfile and select
with the container command. A shared image digest guarantees the server and
the worker are running provably identical `internal/` code — which matters,
because they share a schema.

```dockerfile
RUN CGO_ENABLED=0 go build -o upstat ./cmd/server
RUN CGO_ENABLED=0 go build -o upstat-worker ./cmd/worker
```

**Helm needs one small change.** [`templates/deployment.yaml`](../deploy/helm/templates/deployment.yaml)
has no `command:` support, and it unconditionally emits `containerPort:
{{ $svc.port }}` plus a probe. A worker entry therefore needs:

```yaml
# templates/deployment.yaml, in the container spec
{{- with $svc.command }}
command: {{ toYaml . | nindent 12 }}
{{- end }}
```

```yaml
# values.yaml
  monitor-worker:
    image: cuesoft/upstat-api-common:latest   # same image as api-common
    command: ["/app/upstat-worker"]
    port: 8090
    healthPath: /health
    readyPath: /ready
    env: { MONGO_URI: …, MONGO_DB: Upstat, WORKER_LOOPS: "monitor,notification,rollup" }
```

**Give the worker a health listener.** It keeps the existing chart shape
(which always emits a port and a probe) working with no further template
changes, and it buys a better liveness signal than a TCP socket: track
`lastTickAt` and fail `/health` when `now - lastTickAt > 3 × PollInterval`. A
wedged loop — a Mongo call hanging, a goroutine deadlocked — then gets
restarted by the kubelet instead of sitting silently not checking anything.
This is the one capability the current in-process design cannot have, because
the API's health endpoint answers `200` whether or not the loop is alive.

The worker exposes **no public API** — health probes only, and no `Service`
needs to point at it.

`docker-compose.yml` gets the mirror of the above: same `build:`/`image:`, a
`command:` override, `depends_on: mongo (healthy)`.

## 8 · Cutover — two steps

| Step | Action | Rollback |
| --- | --- | --- |
| **1 · Land the lease** | Commit `ClaimMonitor` as it stands. The current deployment becomes safe at any replica count. Closes the reported bug on its own. | Normal revert |
| **2 · Split the binary** | Add `cmd/worker`, gate the server's goroutines behind `ENABLE_BACKGROUND_WORKERS` (default `true`), deploy the worker, then set the flag `false` on `api-common`. | Flip the flag back |

There is no window where checks stop or double: during step 2 both processes
may run their loops, and the lease arbitrates exactly as it does between two
API replicas today. Once soaked, delete the flag and the goroutine block from
`cmd/server/main.go`.

## 9 · Testing

The uncommitted work already adds `main_test.go`, `monitor_repository_test.go`,
`notification_repository_test.go`, `rollup_repository_test.go` and
`metric_alert_test.go`. Extraction adds little:

- **Lease contention test** — two workers, one monitor, one tick: exactly one
  claim wins, the loser is a no-op, an expired lease is reclaimable. This is
  the test that actually guards the reported bug; it belongs next to
  `monitor_repository_test.go`.
- **Lease-vs-timeout test** — a check that runs longer than its lease must not
  be claimable by a second worker (guards §5.1 after the fix).
- **Entrypoint smoke test** — `cmd/worker` starts, ticks, and shuts down on
  SIGTERM. Cheap, and catches wiring regressions.

No parity harness, no shadow collection, no cross-language fixtures.

## 10 · Open decisions

**(a) Separately scaled worker deployments, or one?** Recommend one deployment
running all three loops, with `WORKER_LOOPS` as the escape hatch. Splitting
before there is a measured reason buys three deployments to operate and no
throughput.

**(b) `command:` in the chart, or a `ROLE` env var?** Recommend the `command:`
addition above — three lines, generally useful, and keeps the two programs
genuinely separate. The zero-diff alternative is a single binary that branches
on `ROLE=server|worker`, which avoids touching the chart at all but conflates
two programs in one entrypoint. Worth knowing it exists if the chart is frozen.

**(c) Does the worker keep the `api-common` image name?** Recommend yes — same
image, different command. Two image tags that must be kept in lockstep is a
version-skew bug waiting to happen when the schema changes.

## 11 · Rejected alternatives

| Option | Why not |
| --- | --- |
| Rewrite the worker as a Node service | The original proposal. Buys the same operational independence as a Go binary while adding a parity surface (HTTP-client timing, TLS trust stores), a duplicated schema in a second language, and a second toolchain. See §1. |
| Message broker / work queue | Nothing in the repo runs one; the collection already works as the queue. Rejected in the V2 review, unchanged. |
| Consistent-hash partitioning of monitors across workers | Needs membership tracking and rebalancing to earn its complexity. The lease gives correct single-execution today with none of that. Revisit when claim contention shows in Mongo write metrics. |
| Redis or a second datastore for locks | Same guarantee Mongo already provides, plus an operational dependency. |
| Leader election — one designated worker replica | Makes the fleet a single point of failure and caps throughput at one process. The lease scales horizontally instead. |
| Leave it in-process, lease only | Legitimate, and strictly cheaper — the lease alone closes the bug. Rejected because it leaves check-pool tuning, crash blast radius, and deploy cadence welded to the API, and provides no way to health-check the loop itself (§7). |
