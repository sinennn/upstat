"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Panel } from "@/components/dashboard/Panels";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { QueryValue } from "@/components/ui/QueryValue";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  ErrorBudgets,
  DurationDistribution,
  IncidentLog,
  OutageTimeline,
  RootCauses,
} from "@/components/dashboard/IncidentInsights";
import {
  causeBreakdown,
  downtimeByMonitor,
  durationHistogram,
  errorBudgets,
  incidentStats,
  incidentsPerDay,
  outageTimeline,
  useIncidentsController,
  useMonitorsForIncidents,
} from "@/controllers/incidents";
import { durationLabel } from "@/controllers/shell";
import type { IncidentStatus } from "@/models";

type Filter = "all" | IncidentStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Open" },
  { key: "resolved", label: "Resolved" },
];

/**
 * /dashboard/incidents — ListIncidents across the caller's monitors (the
 * 100 most recent). Incidents open and resolve automatically; there is
 * nothing to declare or edit.
 */
export default function IncidentsPage() {
  const { data, loading, error, updatedAt } = useIncidentsController();
  const [filter, setFilter] = useState<Filter>("all");
  const incidents = (data ?? []).filter(
    (i) => filter === "all" || i.status === filter,
  );
  // "now" = when this data arrived: stable across re-renders
  const now = updatedAt ?? 0;
  const stats = incidentStats(data ?? [], now);
  const perDay = incidentsPerDay(data ?? [], now);
  const ranking = downtimeByMonitor(data ?? [], now);
  const worst = ranking[0]?.seconds ?? 0;
  const monitorsState = useMonitorsForIncidents();
  const monitors = monitorsState.data ?? [];
  // render the analytics only once both requests are in — until then hold
  // their space, so the incident log doesn't jump down after first paint
  const ready = data !== null && monitorsState.data !== null;
  const timeline = outageTimeline(data ?? [], monitors, now);
  const causes = causeBreakdown(data ?? [], now);
  const budgets = errorBudgets(monitors, data ?? [], now);
  const durations = durationHistogram(data ?? [], now);

  return (
    <div data-testid="incidents" className="flex flex-col gap-5 px-6 py-5">
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[20px] font-semibold">Incidents</h1>
          {data && <LiveIndicator updatedAt={updatedAt} />}
        </div>
        <p className="text-[13px] leading-[1.45] text-text-2">
          Opened when a monitor reaches its failure threshold; resolved by its
          next successful check.
        </p>
      </header>

      {!ready && !error && (
        <div className="flex flex-col gap-5" aria-hidden="true">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} kind="panel-axis" style={{ height: 82 }} />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Skeleton kind="panel-axis" style={{ height: 306 }} />
            <Skeleton kind="panel-axis" style={{ height: 306 }} />
          </div>
          <Skeleton kind="panel-axis" style={{ height: 268 }} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} kind="panel-axis" style={{ height: 300 }} />
            ))}
          </div>
        </div>
      )}

      {ready && data.length > 0 && (
        <>
          <section
            aria-label="Reliability · last 30 days"
            className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
            data-testid="incident-stats"
          >
            <QueryValue
              className="w-full"
              label="Open now"
              value={String(stats.open)}
              threshold={stats.open > 0 ? "crit" : "ok"}
            />
            <QueryValue
              className="w-full"
              label="Incidents · 30 days"
              value={String(stats.inWindow)}
            />
            <QueryValue
              className="w-full"
              label="MTTR · mean time to resolve"
              value={
                stats.mttrSeconds === null
                  ? "—"
                  : durationLabel(stats.mttrSeconds)
              }
            />
            <QueryValue
              className="w-full"
              label="Longest outage"
              value={
                stats.longestSeconds === null
                  ? "—"
                  : durationLabel(stats.longestSeconds)
              }
            />
            <QueryValue
              className="w-full"
              label="Total downtime · 30 days"
              value={durationLabel(stats.downtimeSeconds)}
              threshold={stats.downtimeSeconds > 0 ? "warn" : "ok"}
            />
          </section>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <TimeseriesPanel
              title="Incidents per day — last 30 days"
              series={perDay}
              mode="bars"
              timeFormat="date"
              unit=""
              height={240}
              withLegend={false}
              className="min-w-0"
            />
            <Panel
              title="Downtime by monitor"
              aside="last 30 days"
              testId="downtime-ranking"
            >
              {ranking.length === 0 ? (
                <p className="px-4 py-6 text-[13px] text-text-2">
                  No downtime in the last 30 days.
                </p>
              ) : (
                <ul className="flex flex-col gap-3 px-4 py-4">
                  {ranking.slice(0, 6).map((row) => (
                    <li key={row.monitorId} className="flex flex-col gap-1.5">
                      <div className="flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="truncate font-medium">{row.name}</span>
                        <span className="font-data shrink-0 text-[12px] tabular-nums text-text-2">
                          {durationLabel(row.seconds)} · {row.incidents}{" "}
                          {row.incidents === 1 ? "incident" : "incidents"}
                        </span>
                      </div>
                      <span className="h-2 overflow-hidden rounded-full bg-bg">
                        <span
                          className="block h-full rounded-full bg-crit/70"
                          style={{
                            width: `${Math.max(3, (row.seconds / Math.max(worst, 1)) * 100)}%`,
                          }}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>

          <OutageTimeline rows={timeline} now={now} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <RootCauses causes={causes} />
            <ErrorBudgets budgets={budgets} />
            <DurationDistribution buckets={durations} />
          </div>
        </>
      )}

      <section
        aria-label="Incident log"
        className="flex min-w-0 flex-col overflow-hidden rounded-(--radius) border border-border bg-bg-elev"
      >
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-baseline gap-2">
            <h2 className="text-[15px] font-semibold">Incident log</h2>
            <span className="text-[12px] text-text-2">
              {incidents.length} shown · newest first
            </span>
          </div>
          <div
            role="tablist"
            aria-label="Filter incidents"
            className="flex gap-1"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={clsx(
                  "rounded-(--radius) px-3 py-1 text-[13px] transition-colors duration-[var(--duration-fast)]",
                  filter === f.key
                    ? "bg-brand/15 font-medium text-brand-text"
                    : "text-text-2 hover:bg-bg hover:text-text",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </header>
        {loading && !data ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} kind="line" />
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="px-4 py-6 text-[13px] text-crit-text">
            Couldn&apos;t load incidents: {error.message}
          </p>
        ) : incidents.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-text-2">
            {filter === "active" ? "No open incidents." : "No incidents."}
          </p>
        ) : (
          <IncidentLog incidents={incidents} now={now} />
        )}
      </section>
    </div>
  );
}
