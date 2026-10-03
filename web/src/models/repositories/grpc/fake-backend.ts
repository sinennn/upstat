import type * as grpcWeb from "grpc-web";
import * as pb from "@/proto/user_pb";
import { withFields } from "@/proto/upstat-message";

/**
 * TEST_MODE backend — an in-memory stand-in for `api/common`'s
 * `UserService` + `MonitorService`, so the whole app above the wire
 * (repositories, mappers, controllers, views) runs identically with and
 * without a real backend.
 *
 * Each method mirrors its Go handler: the same validation messages and
 * gRPC codes, the same defaults, owner scoping, and the
 * `AuthenticateInterceptor` allowlist. The check worker is simulated
 * lazily: before any read, every active monitor that is due gets checked
 * (an HTTP check "fails" when its target's host contains `down`, `fail` or
 * `invalid`), driving the same consecutive-failure → incident → resolve
 * state machine as `monitor_worker_service.go`.
 *
 * State persists in sessionStorage so full page loads keep it.
 */

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

interface UserRow {
  id: string;
  name: string;
  email: string;
  /** "" for Google-created users — they cannot password-sign-in. */
  password: string;
}

interface MonitorRow {
  id: string;
  ownerId: string;
  name: string;
  type: string;
  target: string;
  active: boolean;
  muted: boolean;
  status: "unknown" | "up" | "down";
  interval: number;
  timeout: number;
  threshold: number;
  consecutiveFailures: number;
  lastCheckedAt: number | null;
  lastResponseTimeMs: number;
  lastStatusCode: number;
  createdAt: number;
  updatedAt: number;
  /** Seeded outage: checks fail until this time (ms). */
  failingUntil?: number;
}

/** [checkedAt ms, up 1|0, response ms, status code, error] */
type CheckRow = [number, 0 | 1, number, number, string];

interface IncidentRow {
  id: string;
  monitorId: string;
  title: string;
  failureReason: string;
  status: "active" | "resolved";
  startedAt: number;
  resolvedAt: number | null;
  durationSeconds: number;
}

interface StatusPageRow {
  slug: string;
  ownerId: string;
  name: string;
}

interface State {
  seq: number;
  users: UserRow[];
  monitors: MonitorRow[];
  checks: Record<string, CheckRow[]>;
  incidents: IncidentRow[];
  statusPages: StatusPageRow[];
}

const STORAGE_KEY = "upstat.fake-backend";
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** The seeded account (email sign-in and the TEST_MODE Google button). */
export const FAKE_USER = {
  name: "Ibukun",
  email: "ibukun@cuesoft.io",
  password: "upstat-test",
} as const;

/** Seeded public status page slug. */
export const FAKE_STATUS_SLUG = "upstat";

let state: State | null = null;

/** ObjectID-shaped (24 hex chars), unique per state. */
function nextId(s: State): string {
  s.seq += 1;
  return `65f0a1b2${s.seq.toString(16).padStart(16, "0")}`;
}

/** Deterministic PRNG so seeded history is stable across reloads. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seed(now: number): State {
  const s: State = {
    seq: 0,
    users: [],
    monitors: [],
    checks: {},
    incidents: [],
    statusPages: [],
  };
  const owner: UserRow = { id: nextId(s), ...FAKE_USER };
  s.users.push(owner);
  s.statusPages.push({
    slug: FAKE_STATUS_SLUG,
    ownerId: owner.id,
    name: "Upstat",
  });

  const monitor = (
    name: string,
    target: string,
    type: string,
    opts: Partial<MonitorRow> = {},
  ): MonitorRow => {
    const m: MonitorRow = {
      id: nextId(s),
      ownerId: owner.id,
      name,
      type,
      target,
      active: true,
      muted: false,
      status: "unknown",
      interval: 60,
      timeout: 10,
      threshold: 3,
      consecutiveFailures: 0,
      lastCheckedAt: null,
      lastResponseTimeMs: 0,
      lastStatusCode: 0,
      createdAt: now - 90 * DAY,
      updatedAt: now - 90 * DAY,
      ...opts,
    };
    s.monitors.push(m);
    return m;
  };

  // Hourly history for 90 days with a couple of short outages, then the
  // live check cadence for the last 100 minutes.
  const history = (
    m: MonitorRow,
    baseMs: number,
    outages: { start: number; hours: number; reason: string }[],
  ) => {
    const rand = mulberry32(m.id.charCodeAt(23) * 7919);
    const rows: CheckRow[] = [];
    const push = (ts: number) => {
      const outage = outages.find(
        (o) => ts >= now - o.start && ts < now - o.start + o.hours * HOUR,
      );
      const rt = Math.round(baseMs * (0.8 + rand() * 0.5));
      rows.push(
        outage ? [ts, 0, rt, 503, outage.reason] : [ts, 1, rt, 200, ""],
      );
    };
    for (let ts = now - 90 * DAY; ts < now - 100 * MINUTE; ts += HOUR) push(ts);
    for (let ts = now - 100 * MINUTE; ts <= now - MINUTE; ts += MINUTE)
      push(ts);
    s.checks[m.id] = rows;
    const last = rows[rows.length - 1];
    m.lastCheckedAt = last[0];
    m.lastResponseTimeMs = last[2];
    m.lastStatusCode = last[3];
    m.status = last[1] ? "up" : "down";
    for (const o of outages) {
      const startedAt = now - o.start;
      const ongoing = startedAt + o.hours * HOUR > now;
      s.incidents.push({
        id: nextId(s),
        monitorId: m.id,
        title: `${m.name} is down`,
        failureReason: o.reason,
        status: ongoing ? "active" : "resolved",
        startedAt,
        resolvedAt: ongoing ? null : startedAt + o.hours * HOUR,
        durationSeconds: ongoing ? 0 : o.hours * 3600,
      });
      if (ongoing) {
        m.consecutiveFailures = Math.round(o.start / MINUTE);
        m.failingUntil = startedAt + o.hours * HOUR;
      }
    }
  };

  history(monitor("Website", "https://upstat.cuesoft.io", "website"), 140, [
    { start: 41 * DAY, hours: 2, reason: "503 Service Unavailable" },
  ]);
  history(monitor("API", "https://api.upstat.cuesoft.io/health", "api"), 95, [
    { start: 12 * DAY, hours: 1, reason: "503 Service Unavailable" },
    {
      start: 25 * MINUTE,
      hours: 1,
      reason:
        'Get "https://api.upstat.cuesoft.io/health": context deadline exceeded',
    },
  ]);
  history(
    monitor("Docs", "https://docs.upstat.cuesoft.io", "website", {
      active: false,
    }),
    210,
    [],
  );
  monitor("Blog", "https://blog.cuesoft.io", "blog", {
    createdAt: now - 5 * MINUTE,
    updatedAt: now - 5 * MINUTE,
    // created but the worker has not reached it yet
    interval: 300,
  });
  return s;
}

function load(): State {
  if (state) return state;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw) as State;
  } catch {
    // corrupt or unavailable storage → reseed
  }
  if (!state) state = seed(Date.now());
  return state;
}

function save(s: State): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // quota/private mode — state still lives for this page
  }
}

/** Test hook: drop all state (next call reseeds). */
export function resetFakeBackend(): void {
  state = null;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/* ------------------------------------------------------------------ */
/* Simulated check worker (monitor_worker_service.go)                  */
/* ------------------------------------------------------------------ */

function failingTarget(m: MonitorRow, at: number): string | null {
  const target = m.target;
  if (m.failingUntil && at < m.failingUntil) {
    return `Get "${target}": context deadline exceeded`;
  }
  let host = "";
  try {
    host = new URL(target).hostname;
  } catch {
    return `parse "${target}": invalid URI for request`;
  }
  return /down|fail|invalid/.test(host)
    ? `Get "${target}": dial tcp: lookup ${host}: no such host`
    : null;
}

function runWorker(s: State, now: number): void {
  for (const m of s.monitors) {
    if (!m.active) continue;
    // never-checked monitors are first claimed one interval after creation
    let due = (m.lastCheckedAt ?? m.createdAt) + m.interval * 1000;
    let runs = 0;
    while (due <= now && runs < 200) {
      runs += 1;
      const failure = failingTarget(m, due);
      const rt = failure ? 0 : 80 + ((due / 1000) % 60);
      const row: CheckRow = failure
        ? [due, 0, rt, 0, failure]
        : [due, 1, Math.round(rt), 200, ""];
      (s.checks[m.id] ??= []).push(row);
      m.lastCheckedAt = due;
      m.lastResponseTimeMs = row[2];
      m.lastStatusCode = row[3];
      if (!failure) {
        m.consecutiveFailures = 0;
        m.status = "up";
        for (const i of s.incidents) {
          if (i.monitorId === m.id && i.status === "active") {
            i.status = "resolved";
            i.resolvedAt = due;
            i.durationSeconds = Math.round((due - i.startedAt) / 1000);
          }
        }
      } else {
        m.consecutiveFailures += 1;
        if (m.consecutiveFailures >= m.threshold) {
          m.status = "down";
          const open = s.incidents.some(
            (i) => i.monitorId === m.id && i.status === "active",
          );
          if (!open) {
            s.incidents.push({
              id: nextId(s),
              monitorId: m.id,
              title: `${m.name} is down`,
              failureReason: failure,
              status: "active",
              startedAt: due,
              resolvedAt: null,
              durationSeconds: 0,
            });
          }
        }
      }
      due += m.interval * 1000;
    }
    // a long-idle tab skips ahead instead of replaying every missed tick
    if (runs === 200 && due <= now) m.lastCheckedAt = now;
  }
}

/* ------------------------------------------------------------------ */
/* Interceptor + errors                                                */
/* ------------------------------------------------------------------ */

const CODE = {
  INVALID_ARGUMENT: 3,
  NOT_FOUND: 5,
  ALREADY_EXISTS: 6,
  PERMISSION_DENIED: 7,
  UNAUTHENTICATED: 16,
} as const;

/** Shaped like grpc-web's RpcError — transport.ts maps it. */
class FakeRpcError extends Error {
  constructor(
    readonly code: number,
    message: string,
  ) {
    super(message);
  }
}

const TOKEN_PREFIX = "fake-session.";

function tokenFor(user: UserRow): string {
  return `${TOKEN_PREFIX}${user.id}`;
}

/** AuthenticateInterceptor — returns the caller's user id. */
function authenticate(s: State, md: grpcWeb.Metadata | undefined): string {
  const header = md?.authorization;
  if (!header) {
    throw new FakeRpcError(
      CODE.UNAUTHENTICATED,
      "missing authorization header",
    );
  }
  if (!header.startsWith("Bearer ")) {
    throw new FakeRpcError(
      CODE.UNAUTHENTICATED,
      "invalid authorization header",
    );
  }
  const token = header.slice("Bearer ".length);
  const id = token.startsWith(TOKEN_PREFIX)
    ? token.slice(TOKEN_PREFIX.length)
    : "";
  if (!s.users.some((u) => u.id === id)) {
    throw new FakeRpcError(CODE.UNAUTHENTICATED, "invalid token");
  }
  return id;
}

/** Runs one RPC against the shared state, persisting any mutation. */
async function rpc<T>(fn: (s: State, now: number) => T): Promise<T> {
  const s = load();
  const now = Date.now();
  runWorker(s, now);
  try {
    return fn(s, now);
  } finally {
    save(s);
  }
}

/* ------------------------------------------------------------------ */
/* Message builders (the Go handlers' *Response helpers)               */
/* ------------------------------------------------------------------ */

const iso = (ms: number) =>
  new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

function userMessage(u: UserRow, token: string): pb.GetUserResponse {
  return withFields(new pb.GetUserResponse(), {
    1: u.id,
    2: u.name,
    3: u.email,
    4: token,
    5: "success",
  });
}

function monitorMessage(m: MonitorRow): pb.Monitor {
  return withFields(new pb.Monitor(), {
    1: m.id,
    2: m.ownerId,
    3: m.name,
    4: m.type,
    5: m.target,
    6: iso(m.createdAt),
    7: iso(m.updatedAt),
    8: m.active,
    9: m.status,
    10: m.interval,
    11: m.timeout,
    12: m.threshold,
    13: m.consecutiveFailures,
    14: m.lastCheckedAt === null ? "" : iso(m.lastCheckedAt),
    15: m.lastResponseTimeMs,
    16: m.lastStatusCode,
    17: m.muted,
  });
}

function incidentMessage(i: IncidentRow): pb.Incident {
  return withFields(new pb.Incident(), {
    1: i.id,
    2: i.monitorId,
    3: i.title,
    4: i.failureReason,
    5: i.status,
    6: iso(i.startedAt),
    7: i.resolvedAt === null ? "" : iso(i.resolvedAt),
    8: i.durationSeconds,
  });
}

function checkMessage(monitorId: string, c: CheckRow): pb.MonitorCheck {
  return withFields(new pb.MonitorCheck(), {
    1: monitorId,
    2: c[1] === 1,
    3: c[2],
    4: c[3],
    5: iso(c[0]),
  });
}

function recentChecks(s: State, monitorId: string, limit: number) {
  return (s.checks[monitorId] ?? [])
    .slice(-limit)
    .reverse()
    .map((c) => checkMessage(monitorId, c));
}

/** uptimeDays(): one bucket per UTC day, oldest first. */
function uptimeDays(
  s: State,
  m: MonitorRow,
  days: number,
  now: number,
): pb.MonitorUptimeDay[] {
  const byDay = new Map<string, { total: number; ok: number }>();
  for (const c of s.checks[m.id] ?? []) {
    const key = iso(c[0]).slice(0, 10);
    const agg = byDay.get(key) ?? { total: 0, ok: 0 };
    agg.total += 1;
    agg.ok += c[1];
    byDay.set(key, agg);
  }
  const out: pb.MonitorUptimeDay[] = [];
  for (let d = days - 1; d >= 0; d -= 1) {
    const key = iso(now - d * DAY).slice(0, 10);
    const agg = byDay.get(key);
    out.push(
      withFields(new pb.MonitorUptimeDay(), {
        1: !!agg,
        2: key,
        3: agg ? (agg.ok / agg.total) * 100 : 0,
        4: agg ? Math.round(((agg.total - agg.ok) * m.interval) / 60) : 0,
      }),
    );
  }
  return out;
}

function countSince(s: State, monitorId: string, since: number) {
  let total = 0;
  let ok = 0;
  for (const c of s.checks[monitorId] ?? []) {
    if (c[0] < since) continue;
    total += 1;
    ok += c[1];
  }
  return { total, ok };
}

function p95Since(s: State, monitorId: string, since: number): number {
  const rts = (s.checks[monitorId] ?? [])
    .filter((c) => c[0] >= since)
    .map((c) => c[2])
    .sort((a, b) => a - b);
  if (rts.length === 0) return 0;
  const v = rts[Math.min(rts.length - 1, Math.ceil(rts.length * 0.95) - 1)];
  return Math.round(v / 10) * 10;
}

function ownMonitor(s: State, id: string, ownerId: string): MonitorRow {
  const m = s.monitors.find((x) => x.id === id && x.ownerId === ownerId);
  if (!m) throw new FakeRpcError(CODE.NOT_FOUND, "monitor not found");
  return m;
}

/* ------------------------------------------------------------------ */
/* UserService                                                         */
/* ------------------------------------------------------------------ */

export const fakeUserClient = {
  getUser: (req: pb.GetUserRequest) =>
    rpc((s) => {
      if (req.getPassword() === "") {
        throw new FakeRpcError(
          CODE.PERMISSION_DENIED,
          "authentication required",
        );
      }
      const u = s.users.find((x) => x.email === req.getEmail());
      if (!u) throw new FakeRpcError(CODE.NOT_FOUND, "user not found");
      if (u.password === "" || u.password !== req.getPassword()) {
        throw new FakeRpcError(
          CODE.UNAUTHENTICATED,
          "invalid login credentials",
        );
      }
      return userMessage(u, tokenFor(u));
    }),

  /** TEST_MODE has no Google: any ID token signs in as FAKE_USER. */
  googleAuth: (req: pb.GoogleAuthRequest) =>
    rpc((s) => {
      if (req.getIdToken() === "") {
        throw new FakeRpcError(CODE.UNAUTHENTICATED, "id token is required");
      }
      let u = s.users.find((x) => x.email === FAKE_USER.email);
      if (!u) {
        u = {
          id: nextId(s),
          name: FAKE_USER.name,
          email: FAKE_USER.email,
          password: "",
        };
        s.users.push(u);
      }
      return userMessage(u, tokenFor(u));
    }),

  createUser: (req: pb.CreateUserRequest) =>
    rpc((s) => {
      if (!req.getName() || !req.getEmail() || !req.getPassword()) {
        throw new FakeRpcError(
          CODE.INVALID_ARGUMENT,
          "name, email, and password are required",
        );
      }
      if (s.users.some((x) => x.email === req.getEmail())) {
        throw new FakeRpcError(CODE.ALREADY_EXISTS, "email already exists");
      }
      s.users.push({
        id: nextId(s),
        name: req.getName(),
        email: req.getEmail(),
        password: req.getPassword(),
      });
      return withFields(new pb.CreateUserResponse(), {
        1: "user created successfully",
        2: "success",
      });
    }),

  updateUser: (req: pb.UpdateUserRequest, md?: grpcWeb.Metadata) =>
    rpc((s) => {
      authenticate(s, md);
      if (!req.getId()) {
        throw new FakeRpcError(CODE.INVALID_ARGUMENT, "id is required");
      }
      const u = s.users.find((x) => x.id === req.getId());
      if (u) {
        if (req.getName()) u.name = req.getName();
        if (req.getEmail()) u.email = req.getEmail();
        if (req.getPassword()) u.password = req.getPassword();
      }
      return withFields(new pb.UpdateUserResponse(), {
        1: "user updated successfully",
        2: "success",
      });
    }),

  deleteUser: (req: pb.DeleteUserRequest, md?: grpcWeb.Metadata) =>
    rpc((s) => {
      authenticate(s, md);
      if (!req.getId()) {
        throw new FakeRpcError(CODE.INVALID_ARGUMENT, "id is required");
      }
      // like the backend: the user row only — their monitors are not removed
      s.users = s.users.filter((x) => x.id !== req.getId());
      return withFields(new pb.DeleteUserResponse(), {
        1: "user deleted successfully",
        2: "success",
      });
    }),
};

/* ------------------------------------------------------------------ */
/* MonitorService                                                      */
/* ------------------------------------------------------------------ */

function monitorResponse(m: MonitorRow): pb.MonitorResponse {
  return withFields(new pb.MonitorResponse(), {
    1: monitorMessage(m),
    2: "success",
  });
}

export const fakeMonitorClient = {
  createMonitor: (req: pb.CreateMonitorRequest, md?: grpcWeb.Metadata) =>
    rpc((s, now) => {
      const ownerId = authenticate(s, md);
      if (!req.getName() || !req.getType() || !req.getTarget()) {
        throw new FakeRpcError(
          CODE.INVALID_ARGUMENT,
          "name, type and target required",
        );
      }
      const interval =
        req.getIntervalSeconds() > 0 ? req.getIntervalSeconds() : 60;
      const timeout =
        req.getTimeoutSeconds() > 0 ? req.getTimeoutSeconds() : 10;
      const threshold =
        req.getFailureThreshold() > 0 ? req.getFailureThreshold() : 3;
      if (timeout >= interval) {
        throw new FakeRpcError(
          CODE.INVALID_ARGUMENT,
          "timeout must be below the check interval",
        );
      }
      const m: MonitorRow = {
        id: nextId(s),
        ownerId,
        name: req.getName(),
        type: req.getType(),
        target: req.getTarget(),
        active: true,
        muted: false,
        status: "unknown",
        interval,
        timeout,
        threshold,
        consecutiveFailures: 0,
        lastCheckedAt: null,
        lastResponseTimeMs: 0,
        lastStatusCode: 0,
        createdAt: now,
        updatedAt: now,
      };
      s.monitors.push(m);
      return monitorResponse(m);
    }),

  updateMonitor: (req: pb.UpdateMonitorRequest, md?: grpcWeb.Metadata) =>
    rpc((s, now) => {
      const ownerId = authenticate(s, md);
      if (!req.getId()) {
        throw new FakeRpcError(CODE.INVALID_ARGUMENT, "id is required");
      }
      const m = ownMonitor(s, req.getId(), ownerId);
      const next = { ...m };
      if (req.getName()) next.name = req.getName();
      if (req.getType()) next.type = req.getType();
      if (req.getTarget()) next.target = req.getTarget();
      const active = req.getActive();
      if (active !== undefined) next.active = active;
      const muted = req.getMuted();
      if (muted !== undefined) next.muted = muted;
      const interval = req.getIntervalSeconds();
      if (interval !== undefined) next.interval = interval;
      const timeout = req.getTimeoutSeconds();
      if (timeout !== undefined) next.timeout = timeout;
      const threshold = req.getFailureThreshold();
      if (threshold !== undefined) next.threshold = threshold;
      if (next.timeout >= next.interval) {
        throw new FakeRpcError(
          CODE.INVALID_ARGUMENT,
          "timeout must be below the check interval",
        );
      }
      // resuming starts the cadence from now, not from the pause point
      if (!m.active && next.active)
        next.lastCheckedAt = now - next.interval * 1000 + 1000;
      Object.assign(m, next, { updatedAt: now });
      return monitorResponse(m);
    }),

  getMonitor: (req: pb.GetMonitorRequest, md?: grpcWeb.Metadata) =>
    rpc((s) => {
      const ownerId = authenticate(s, md);
      if (!req.getId()) {
        throw new FakeRpcError(
          CODE.INVALID_ARGUMENT,
          "please pass a monitor id",
        );
      }
      return monitorResponse(ownMonitor(s, req.getId(), ownerId));
    }),

  listMonitors: (_req: pb.ListMonitorsRequest, md?: grpcWeb.Metadata) =>
    rpc((s) => {
      const ownerId = authenticate(s, md);
      return withFields(new pb.ListMonitorsResponse(), {
        1: s.monitors.filter((m) => m.ownerId === ownerId).map(monitorMessage),
      });
    }),

  deleteMonitor: (req: pb.DeleteMonitorRequest, md?: grpcWeb.Metadata) =>
    rpc((s) => {
      const ownerId = authenticate(s, md);
      if (!req.getId()) {
        throw new FakeRpcError(CODE.INVALID_ARGUMENT, "monitor ID is required");
      }
      const before = s.monitors.length;
      s.monitors = s.monitors.filter(
        (m) => !(m.id === req.getId() && m.ownerId === ownerId),
      );
      if (s.monitors.length === before) {
        throw new FakeRpcError(
          CODE.NOT_FOUND,
          "monitor was not found; nothing was deleted",
        );
      }
      return withFields(new pb.DeleteMonitorResponse(), {
        1: "Monitor Deleted",
        2: "success",
      });
    }),

  /** Unauthenticated (allowlisted). */
  getStatusPage: (req: pb.GetStatusPageRequest) =>
    rpc((s, now) => {
      let ownerId = req.getOwnerId();
      let pageName = "";
      if (!ownerId && req.getSlug()) {
        const page = s.statusPages.find((p) => p.slug === req.getSlug());
        if (!page)
          throw new FakeRpcError(CODE.NOT_FOUND, "status page not found");
        ownerId = page.ownerId;
        pageName = page.name;
      }
      if (!ownerId) {
        throw new FakeRpcError(
          CODE.INVALID_ARGUMENT,
          "owner_id or slug is required",
        );
      }
      const monitors = s.monitors.filter((m) => m.ownerId === ownerId);
      const ids = new Set(monitors.map((m) => m.id));
      const mine = s.incidents.filter((i) => ids.has(i.monitorId));
      const byStartDesc = (a: IncidentRow, b: IncidentRow) =>
        b.startedAt - a.startedAt;
      let total = 0;
      let ok = 0;
      for (const m of monitors) {
        const c = countSince(s, m.id, now - DAY);
        total += c.total;
        ok += c.ok;
      }
      const since = now - 90 * DAY;
      const components = monitors.map((m) => {
        const c = countSince(s, m.id, since);
        return withFields(new pb.StatusPageComponent(), {
          1: m.id,
          2: m.name,
          3: m.status,
          4: c.total > 0,
          5: c.total > 0 ? (c.ok / c.total) * 100 : 0,
          6: m.lastResponseTimeMs,
          7: uptimeDays(s, m, 90, now),
          8: p95Since(s, m.id, since),
          9: m.lastCheckedAt === null ? "" : iso(m.lastCheckedAt),
        });
      });
      return withFields(new pb.GetStatusPageResponse(), {
        1: monitors.map(monitorMessage),
        2: mine
          .filter((i) => i.status === "active")
          .sort(byStartDesc)
          .map(incidentMessage),
        3: mine
          .filter((i) => i.status === "resolved")
          .sort(byStartDesc)
          .slice(0, 50)
          .map(incidentMessage),
        4: total > 0 ? (ok / total) * 100 : 0,
        5: total,
        6: ok,
        7: pageName || req.getSlug(),
        8: components,
      });
    }),

  /** Unauthenticated (allowlisted) and not owner-scoped, like the backend. */
  getRecentChecks: (req: pb.GetRecentChecksRequest) =>
    rpc((s) => {
      if (!req.getMonitorId()) {
        throw new FakeRpcError(CODE.INVALID_ARGUMENT, "monitor_id is required");
      }
      const limit = req.getLimit() > 0 ? req.getLimit() : 50;
      return withFields(new pb.GetRecentChecksResponse(), {
        1: recentChecks(s, req.getMonitorId(), limit),
      });
    }),

  getMonitorHistory: (
    req: pb.GetMonitorHistoryRequest,
    md?: grpcWeb.Metadata,
  ) =>
    rpc((s, now) => {
      const ownerId = authenticate(s, md);
      if (!req.getMonitorId()) {
        throw new FakeRpcError(CODE.INVALID_ARGUMENT, "monitor_id is required");
      }
      const m = ownMonitor(s, req.getMonitorId(), ownerId);
      const days = Math.min(req.getDays() > 0 ? req.getDays() : 90, 90);
      const limit = Math.min(req.getLimit() > 0 ? req.getLimit() : 100, 500);
      const c = countSince(s, m.id, now - days * DAY);
      return withFields(new pb.GetMonitorHistoryResponse(), {
        1: recentChecks(s, m.id, limit),
        2: uptimeDays(s, m, days, now),
        3: c.total > 0 ? (c.ok / c.total) * 100 : 0,
        4: c.total > 0,
      });
    }),

  /**
   * The real RPC relays to the observability service (and fails
   * `unavailable` without it). The fake scores from recent checks with the
   * same severity bands as severity_classifier.py.
   */
  getMonitorInsight: (
    req: pb.GetMonitorInsightRequest,
    md?: grpcWeb.Metadata,
  ) =>
    rpc((s, now) => {
      authenticate(s, md);
      if (!req.getMonitorId()) {
        throw new FakeRpcError(CODE.INVALID_ARGUMENT, "monitor_id is required");
      }
      const m = s.monitors.find((x) => x.id === req.getMonitorId());
      const c = m ? countSince(s, m.id, now - DAY) : { total: 0, ok: 0 };
      const active = s.incidents.some(
        (i) => i.monitorId === m?.id && i.status === "active",
      );
      const failRate = c.total > 0 ? 1 - c.ok / c.total : 0;
      const risk = Math.min(
        100,
        Math.round(failRate * 400) + (active ? 50 : 0),
      );
      const severity = active
        ? "critical"
        : risk >= 90
          ? "critical"
          : risk >= 65
            ? "high"
            : risk >= 40
              ? "medium"
              : "low";
      const name = m?.name ?? "This monitor";
      const summary = active
        ? `${name} has an open incident and is failing its checks.`
        : `${name} passed ${c.ok} of ${c.total} checks in the last 24 hours.`;
      return withFields(new pb.GetMonitorInsightResponse(), {
        1: withFields(new pb.MonitorInsight(), {
          1: req.getMonitorId(),
          2: m?.name ?? "",
          3: risk,
          4: active || failRate > 0.05,
          5: severity,
          6: summary,
          7: active
            ? "Check the target directly and review recent deploys."
            : "No action needed.",
          8: summary,
          9: iso(now),
        }),
      });
    }),

  listIncidents: (req: pb.ListIncidentsRequest, md?: grpcWeb.Metadata) =>
    rpc((s) => {
      const ownerId = authenticate(s, md);
      let ids: Set<string>;
      if (req.getMonitorId()) {
        ownMonitor(s, req.getMonitorId(), ownerId);
        ids = new Set([req.getMonitorId()]);
      } else {
        ids = new Set(
          s.monitors.filter((m) => m.ownerId === ownerId).map((m) => m.id),
        );
      }
      return withFields(new pb.ListIncidentsResponse(), {
        1: s.incidents
          .filter((i) => ids.has(i.monitorId))
          .sort((a, b) => b.startedAt - a.startedAt)
          .slice(0, 100)
          .map(incidentMessage),
      });
    }),
};
