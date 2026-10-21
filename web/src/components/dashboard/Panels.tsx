"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { IncidentRow } from "@/components/ui/IncidentRow";
import { StatusPageComponentRow } from "@/components/ui/StatusPageComponentRow";
import { routes } from "@/config/routes";
import { monitorPillStatus, monitorStatusLabel } from "@/controllers/monitors";
import { durationLabel, whenLabel } from "@/controllers/shell";
import type { Incident, StatusPageComponent } from "@/models";

/** A titled card that matches the chart panels' chrome. */
export function Panel({
  title,
  aside,
  children,
  testId,
  className = "",
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      className={`flex min-w-0 flex-col overflow-hidden rounded-(--radius) border border-border bg-bg-elev ${className}`}
    >
      <header className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {aside && <div className="text-[12px] text-text-2">{aside}</div>}
      </header>
      {children}
    </section>
  );
}

/** The latest incidents across every monitor. */
export function RecentIncidentsPanel({
  incidents,
  loaded,
}: {
  incidents: Incident[];
  loaded: boolean;
}) {
  const latest = incidents.slice(0, 5);
  return (
    <Panel
      title="Recent incidents"
      testId="recent-incidents"
      aside={
        <Link
          href="/dashboard/incidents"
          className="text-brand-text hover:underline"
        >
          View all →
        </Link>
      }
    >
      {!loaded ? null : latest.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-text-2">
          No incidents yet — every check has stayed under its failure threshold.
        </p>
      ) : (
        <div className="flex flex-col">
          {latest.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              showMonitor
              showReason={false}
              href={routes.incident(incident.id)}
              startedLabel={whenLabel(incident.started_at)}
              durationLabel={
                incident.duration_seconds === null
                  ? null
                  : durationLabel(incident.duration_seconds)
              }
              className="last:border-b-0"
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

/** Every monitor's 90-day strip — GetStatusPage's per-monitor series. */
export function UptimeBoard({
  components,
}: {
  components: StatusPageComponent[];
}) {
  if (components.length === 0) return null;
  return (
    <Panel
      title="Uptime — last 90 days"
      testId="uptime-board"
      aside="one bar per day · hover a bar for its date"
    >
      <ul className="flex flex-col gap-2 p-3">
        {components.map((c) => (
          <li key={c.monitor_id}>
            <StatusPageComponentRow
              name={c.name}
              status={monitorPillStatus(c.status)}
              statusLabel={monitorStatusLabel(c.status)}
              days={c.days}
              uptimePct={c.uptime_pct}
              layout="inline"
              fill
            />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
