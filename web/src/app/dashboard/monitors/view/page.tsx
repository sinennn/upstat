"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { IncidentRow } from "@/components/ui/IncidentRow";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { QueryValue } from "@/components/ui/QueryValue";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { useToast } from "@/components/ui/Toast";
import { UptimeCard } from "@/components/ui/UptimeCard";
import {
  monitorPillStatus,
  monitorStatusLabel,
  useMonitorController,
} from "@/controllers/monitors";
import { durationLabel, whenLabel } from "@/controllers/shell";
import type { CheckResult, Monitor, MonitorInsight } from "@/models";
import { ApiError } from "@/models";
import { routes } from "@/config/routes";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] uppercase tracking-wide text-text-2">
        {label}
      </dt>
      <dd className="font-data text-[13px] tabular-nums text-text">{value}</dd>
    </div>
  );
}

function statusSentence(m: Monitor): string {
  switch (m.status) {
    case "up":
      return "Passing its checks.";
    case "down":
      return `Down after ${m.consecutive_failures} consecutive failed checks — an incident is open.`;
    case "nodata":
      return `${m.consecutive_failures} of ${m.failure_threshold} consecutive failures — it goes down at ${m.failure_threshold}.`;
    case "pending":
      return "Not checked yet — the first check runs within one interval.";
    case "paused":
      return "Paused — no checks run until it is resumed.";
  }
}

/** `latest response time…` → `Latest response time…` (the insight service writes lowercase). */
function sentence(text: string): string {
  const t = text.trim();
  return t
    ? t[0].toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".")
    : t;
}

/** Nearest-rank percentile over successful checks. */
function percentile(sorted: number[], p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)];
}

function checkStats(checks: CheckResult[]) {
  const ok = checks.filter((c) => c.up).map((c) => c.response_time_ms);
  const sorted = [...ok].sort((a, b) => a - b);
  return {
    total: checks.length,
    passRate: checks.length ? (ok.length / checks.length) * 100 : null,
    avg: ok.length
      ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length)
      : null,
    p50: sorted.length ? percentile(sorted, 0.5) : null,
    p95: sorted.length ? percentile(sorted, 0.95) : null,
  };
}

const SEVERITY_TINT: Record<string, string> = {
  low: "text-ok-text",
  medium: "text-warn-text",
  high: "text-crit-text",
  critical: "text-crit-text",
};

function InsightPanel({
  loading,
  error,
  insight,
}: {
  loading: boolean;
  error: Error | null;
  insight: MonitorInsight | null;
}) {
  return (
    <section
      aria-labelledby="insight-heading"
      className="flex flex-col gap-2 rounded-(--radius) border border-border bg-bg-elev p-4"
      data-testid="monitor-insight"
    >
      <h2 id="insight-heading" className="text-[16px] font-semibold">
        Insight
      </h2>
      {loading ? (
        <Skeleton kind="line" />
      ) : error ? (
        <p className="text-[13px] leading-[1.45] text-text-2">
          {error instanceof ApiError && error.code === "unavailable"
            ? "The insight service isn't connected to this backend."
            : `Insight unavailable: ${error.message}`}
        </p>
      ) : !insight ? (
        <p className="text-[13px] text-text-2">
          No insight for this monitor yet.
        </p>
      ) : (
        <>
          <p className="text-[13px]">
            <span
              className={`font-semibold uppercase ${SEVERITY_TINT[insight.severity] ?? "text-text"}`}
            >
              {insight.severity}
            </span>{" "}
            <span className="text-text-2">
              · risk {insight.risk_score}/100
              {insight.anomaly_detected && " · anomaly detected"}
            </span>
          </p>
          <p className="text-[13px] leading-[1.45] text-text">
            {sentence(insight.human_readable || insight.summary)}
          </p>
          {insight.recommended_action && (
            <p className="text-[13px] leading-[1.45] text-text-2">
              <span className="font-medium text-text">Recommended: </span>
              {sentence(insight.recommended_action)}
            </p>
          )}
          {insight.generated_at && (
            <p className="text-[12px] text-text-2">
              Generated {whenLabel(insight.generated_at)}
            </p>
          )}
        </>
      )}
    </section>
  );
}

/**
 * /dashboard/monitors/view?id= — GetMonitor + GetMonitorHistory (90-day strip,
 * recent checks) + ListIncidents(monitor) + GetMonitorInsight, with
 * pause/resume, mute, edit and delete.
 */
export default function MonitorDetailPage() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { monitor, history, incidents, insight, update, remove } =
    useMonitorController(id);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const m = monitor.data;
  const h = history.data;

  const responseSeries = useMemo(() => {
    const checks = [...(h?.recent_checks ?? [])].reverse();
    return [
      {
        name: "response_ms",
        tags: {},
        points: checks.map((c) => ({
          ts: c.checked_at,
          value: c.up ? c.response_time_ms : null,
        })),
      },
    ];
  }, [h?.recent_checks]);

  const toast = useToast();
  const stats = useMemo(
    () => checkStats(h?.recent_checks ?? []),
    [h?.recent_checks],
  );

  async function act(fn: () => Promise<unknown>, done?: string) {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      if (done) toast({ kind: "ok", title: done });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  }

  if (monitor.loading && !m) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 120 }} />
        <Skeleton kind="panel-axis" style={{ height: 220 }} />
      </div>
    );
  }

  if (!m) {
    return (
      <div className="flex flex-col gap-2 px-6 py-5">
        <h1 className="text-[20px] font-semibold">Monitor not found</h1>
        <p className="text-[13px] text-text-2">
          It may have been deleted.{" "}
          <Link href="/dashboard" className="text-brand-text hover:underline">
            Back to monitors
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="monitor-detail">
      <header className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard" className="hover:text-text">
            Monitors /
          </Link>
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-semibold">{m.name}</h1>
          <StatusPill
            status={monitorPillStatus(m.status)}
            label={monitorStatusLabel(m.status)}
          />
          <LiveIndicator updatedAt={monitor.updatedAt} />
          <span className="flex-1" />
          <label className="flex items-center gap-2 text-[13px] text-text-2">
            Mute notifications
            <Switch
              checked={m.muted}
              disabled={busy}
              onCheckedChange={(muted) =>
                void act(
                  () => update({ muted }),
                  muted ? "Notifications muted" : "Notifications unmuted",
                )
              }
              aria-label="Mute notifications"
            />
          </label>
          <Button
            kind="quiet"
            disabled={busy}
            onClick={() =>
              void act(
                () => update({ active: !m.active }),
                m.active
                  ? `${m.name} paused — no checks will run`
                  : `${m.name} resumed`,
              )
            }
          >
            {m.active ? "Pause" : "Resume"}
          </Button>
          <Link
            href={routes.editMonitor(m.id)}
            className="rounded-(--radius) border border-border px-3 py-1.5 text-[13px] font-medium text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev"
          >
            Edit
          </Link>
          <Button
            kind="destructive"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        </div>
        <p className="text-[13px] text-text-2">{statusSentence(m)}</p>
        {actionError && (
          <p role="alert" className="text-[13px] text-crit-text">
            {actionError}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-(--radius) border border-border p-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="col-span-2 flex flex-col gap-0.5 sm:col-span-3 lg:col-span-6">
            <dt className="text-[11px] uppercase tracking-wide text-text-2">
              URL
            </dt>
            <dd className="font-data truncate text-[13px] text-text">
              GET {m.target}
            </dd>
          </div>
          <Fact label="Type" value={m.type} />
          <Fact label="Interval" value={`${m.interval_seconds}s`} />
          <Fact label="Timeout" value={`${m.timeout_seconds}s`} />
          <Fact label="Failures to down" value={String(m.failure_threshold)} />
          <Fact
            label="Last check"
            value={
              m.last_checked_at
                ? `${whenLabel(m.last_checked_at)}${m.last_status_code ? ` · ${m.last_status_code}` : " · no response"}`
                : "never"
            }
          />
          <Fact
            label="Last response"
            value={
              m.last_response_time_ms === null
                ? "—"
                : m.last_status_code === 0
                  ? "no response"
                  : `${m.last_response_time_ms} ms`
            }
          />
        </dl>
      </header>

      {/* KPIs over the recent checks */}
      {stats.total > 0 && (
        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          aria-label={`Last ${stats.total} checks`}
          data-testid="check-stats"
        >
          <QueryValue
            className="w-full"
            label={`Passed · last ${stats.total}`}
            value={
              stats.passRate === null ? "—" : `${stats.passRate.toFixed(0)}%`
            }
            threshold={
              stats.passRate === null
                ? "none"
                : stats.passRate >= 99
                  ? "ok"
                  : stats.passRate >= 90
                    ? "warn"
                    : "crit"
            }
          />
          <QueryValue
            className="w-full"
            label="Avg response"
            value={stats.avg === null ? "—" : `${stats.avg} ms`}
          />
          <QueryValue
            className="w-full"
            label="p50"
            value={stats.p50 === null ? "—" : `${stats.p50} ms`}
          />
          <QueryValue
            className="w-full"
            label="p95"
            value={stats.p95 === null ? "—" : `${stats.p95} ms`}
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {history.loading && !h ? (
          <Skeleton kind="panel-axis" style={{ height: 96 }} />
        ) : h ? (
          <UptimeCard
            name="Last 90 days"
            days={h.days}
            uptimePct={h.uptime_90d_pct}
            status={monitorPillStatus(m.status)}
            fill
            className="w-full"
          />
        ) : (
          <div />
        )}
        <InsightPanel
          loading={insight.loading && !insight.data}
          error={insight.error}
          insight={insight.data}
        />
      </div>

      {/* response time takes the width; recent checks sit beside it */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <TimeseriesPanel
          title="Response time — last 100 checks"
          unit="ms"
          series={responseSeries}
          loading={history.loading && !h}
          height={300}
          withLegend={false}
          className="min-w-0"
        />

        <section
          aria-labelledby="checks-heading"
          className="flex min-w-0 flex-col overflow-hidden rounded-(--radius) border border-border bg-bg-elev"
          data-testid="recent-checks"
        >
          <header className="flex items-baseline justify-between border-b border-border px-4 py-3">
            <h2 id="checks-heading" className="text-[15px] font-semibold">
              Recent checks
            </h2>
            {(h?.recent_checks ?? []).length > 0 && (
              <span className="text-[12px] text-text-2">
                latest {Math.min(50, h?.recent_checks.length ?? 0)}
              </span>
            )}
          </header>
          {(h?.recent_checks ?? []).length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-text-2">No checks yet.</p>
          ) : (
            <div className="max-h-[340px] flex-1 overflow-y-auto">
              <table className="w-full text-[12px] tabular-nums">
                <thead className="sticky top-0 bg-bg-elev text-left text-text-2">
                  <tr>
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Result</th>
                    <th className="px-3 py-2 text-right font-medium">Status</th>
                    <th className="px-3 py-2 text-right font-medium">
                      Response
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(h?.recent_checks ?? []).slice(0, 50).map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-3 py-1.5 text-text-2">
                        {whenLabel(c.checked_at)}
                      </td>
                      <td
                        className={
                          c.up
                            ? "px-3 py-1.5 text-ok-text"
                            : "px-3 py-1.5 text-crit-text"
                        }
                      >
                        {c.up ? "Up" : "Failed"}
                      </td>
                      <td className="font-data px-3 py-1.5 text-right">
                        {c.status_code || "—"}
                      </td>
                      <td className="font-data px-3 py-1.5 text-right">
                        {c.response_time_ms} ms
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="incidents-heading" className="flex flex-col">
        <h2 id="incidents-heading" className="mb-2 text-[16px] font-semibold">
          Incidents
        </h2>
        {incidents.loading && !incidents.data ? (
          <Skeleton kind="line" />
        ) : (incidents.data ?? []).length === 0 ? (
          <p className="text-[13px] text-text-2">
            No incidents on this monitor.
          </p>
        ) : (
          (incidents.data ?? []).map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              href={routes.incident(incident.id)}
              startedLabel={whenLabel(incident.started_at)}
              durationLabel={
                incident.duration_seconds === null
                  ? null
                  : durationLabel(incident.duration_seconds)
              }
            />
          ))
        )}
      </section>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${m.name}?`}
        variant="sm"
        footer={
          <>
            <Button kind="quiet" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              kind="destructive"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  await remove();
                  router.push("/dashboard");
                }, `${m.name} deleted`)
              }
            >
              Delete monitor
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-[1.45] text-text-2">
          Checks stop immediately. This can&apos;t be undone.
        </p>
      </Modal>
    </div>
  );
}
