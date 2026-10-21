"use client";

import Link from "next/link";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { MonitorRow } from "@/components/ui/MonitorRow";
import { QueryValue } from "@/components/ui/QueryValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { Sparkline } from "@/components/ui/Sparkline";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import {
  RecentIncidentsPanel,
  UptimeBoard,
} from "@/components/dashboard/Panels";
import { useToast } from "@/components/ui/Toast";
import {
  fleetResponseSeries,
  monitorPillStatus,
  monitorStatusLabel,
  useMonitorsController,
  useOverviewController,
} from "@/controllers/monitors";
import { ageLabel, useCurrentUser } from "@/controllers/shell";
import type { CheckResult, Monitor, MonitorStatus } from "@/models";
import { routes } from "@/config/routes";

const COUNT_ORDER: { status: MonitorStatus; label: string }[] = [
  { status: "down", label: "down" },
  { status: "nodata", label: "failing" },
  { status: "up", label: "up" },
  { status: "pending", label: "pending" },
  { status: "paused", label: "paused" },
];

function lastCheckLabel(m: Monitor): string {
  if (!m.last_checked_at) return "—";
  const age = `${ageLabel(m.last_checked_at)} ago`;
  // status 0 = the request never got a response (timeout, DNS, refused)
  return m.last_status_code === 0
    ? `${age} · no response`
    : `${age} · ${m.last_response_time_ms} ms`;
}

function trendFor(checks: CheckResult[] | undefined) {
  if (!checks || checks.length < 2) return undefined;
  const points = [...checks]
    .reverse()
    .map((c) => ({ value: c.response_time_ms, ok: c.up }));
  const failed = points.filter((p) => !p.ok).length;
  return (
    <Sparkline
      points={points}
      label={`Last ${points.length} checks${failed ? `, ${failed} failed` : ", all passed"}`}
    />
  );
}

/**
 * /dashboard — the caller's monitors (ListMonitors), refreshed live:
 * headline tiles, then status, target, a recent-checks sparkline, last
 * check, cadence and the mute switch. Down and failing monitors sort first.
 */
export default function MonitorsPage() {
  const user = useCurrentUser();
  const { data, loading, error, update, checks, updatedAt } =
    useMonitorsController();
  const overview = useOverviewController(user?.id ?? null);
  const toast = useToast();

  const monitors = [...(data ?? [])].sort(
    (a, b) =>
      COUNT_ORDER.findIndex((o) => o.status === a.status) -
        COUNT_ORDER.findIndex((o) => o.status === b.status) ||
      a.name.localeCompare(b.name),
  );
  const counts = COUNT_ORDER.map((o) => ({
    ...o,
    n: monitors.filter((m) => m.status === o.status).length,
  })).filter((c) => c.n > 0);

  const active = monitors.filter((m) => m.active);
  const up = active.filter((m) => m.status === "up").length;
  const down = active.filter((m) => m.status === "down").length;
  const latencies = active
    .filter((m) => m.status === "up" && m.last_response_time_ms !== null)
    .map((m) => m.last_response_time_ms as number);
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;
  const uptime = overview.status?.uptime_pct ?? null;
  const checks24h = overview.status?.total_checks ?? null;
  // anchored to when the data arrived, so re-renders don't shift the window
  const fleet = fleetResponseSeries(monitors, checks, updatedAt ?? 0);

  return (
    <div data-testid="monitors" className="flex flex-col gap-5 px-6 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[20px] font-semibold">Monitors</h1>
            {data && <LiveIndicator updatedAt={updatedAt} />}
          </div>
          {counts.length > 0 && (
            <p className="text-[13px] text-text-2" data-testid="monitor-counts">
              {counts.map((c) => `${c.n} ${c.label}`).join(" · ")}
            </p>
          )}
        </div>
        <Link
          href="/dashboard/monitors/new"
          className="rounded-(--radius) bg-brand px-3 py-1.5 text-[13px] font-medium text-on-brand transition-colors duration-[var(--duration-fast)] hover:bg-brand-deep"
        >
          New monitor
        </Link>
      </header>

      {monitors.length > 0 && (
        <section
          aria-label="Overview"
          className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
          data-testid="overview"
        >
          <QueryValue
            className="w-full"
            label="Monitors up"
            value={`${up}/${active.length}`}
            threshold={down > 0 ? "crit" : active.length ? "ok" : "none"}
          />
          <QueryValue
            className="w-full"
            label="Uptime · last 24h"
            value={uptime === null ? "—" : `${uptime.toFixed(2)}%`}
            threshold={
              uptime === null
                ? "none"
                : uptime >= 99
                  ? "ok"
                  : uptime >= 95
                    ? "warn"
                    : "crit"
            }
          />
          <QueryValue
            className="w-full"
            label="Checks · last 24h"
            value={checks24h === null ? "—" : checks24h.toLocaleString()}
          />
          <QueryValue
            className="w-full"
            label="Avg response"
            value={avgLatency === null ? "—" : `${avgLatency} ms`}
          />
          <QueryValue
            className="w-full"
            label="Open incidents"
            value={
              overview.incidentsLoaded ? String(overview.openIncidents) : "—"
            }
            threshold={overview.openIncidents > 0 ? "crit" : "none"}
          />
        </section>
      )}

      {monitors.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <TimeseriesPanel
              title="Response time — last 30 minutes, per monitor"
              unit="ms"
              series={fleet}
              loading={!data}
              height={260}
              className="min-w-0"
            />
            <RecentIncidentsPanel
              incidents={overview.incidents}
              loaded={overview.incidentsLoaded}
            />
          </div>
          <UptimeBoard components={overview.status?.components ?? []} />
          <h2 className="-mb-2 text-[16px] font-semibold">All monitors</h2>
        </>
      )}

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} kind="line" />
          ))}
        </div>
      ) : error && !data ? (
        <p role="alert" className="text-[13px] text-crit-text">
          Couldn&apos;t load monitors: {error.message}
        </p>
      ) : monitors.length === 0 ? (
        <section
          aria-label="No monitors"
          className="flex flex-col items-start gap-3 rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] leading-[1.45] text-text-2"
        >
          <p>
            No monitors yet. A monitor sends an HTTP GET to a URL on a fixed
            interval; enough consecutive failures open an incident.
          </p>
          <Link
            href="/dashboard/monitors/new"
            className="font-medium text-brand-text hover:underline"
          >
            Create your first monitor →
          </Link>
        </section>
      ) : (
        <section aria-label="Monitor list" className="flex flex-col">
          {monitors.map((m) => (
            <MonitorRow
              key={m.id}
              status={monitorPillStatus(m.status)}
              statusLabel={monitorStatusLabel(m.status)}
              name={m.name}
              target={m.target}
              lastCheck={lastCheckLabel(m)}
              cadence={`every ${m.interval_seconds}s`}
              trend={trendFor(checks[m.id])}
              muted={m.muted}
              onMutedChange={async (muted) => {
                try {
                  await update(m.id, { muted });
                  toast({
                    kind: "info",
                    title: muted ? `${m.name} muted` : `${m.name} unmuted`,
                    body: muted
                      ? "Checks continue; notifications are suppressed."
                      : undefined,
                  });
                } catch (e) {
                  toast({
                    kind: "crit",
                    title: "Couldn't update the monitor",
                    body: e instanceof Error ? e.message : undefined,
                  });
                }
              }}
              href={routes.monitor(m.id)}
            />
          ))}
        </section>
      )}
    </div>
  );
}
