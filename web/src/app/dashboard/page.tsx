"use client";

import Link from "next/link";
import { MonitorRow } from "@/components/ui/MonitorRow";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  monitorPillStatus,
  monitorStatusLabel,
  useMonitorsController,
} from "@/controllers/monitors";
import { ageLabel } from "@/controllers/shell";
import type { Monitor, MonitorStatus } from "@/models";

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

/**
 * /dashboard — the caller's monitors (ListMonitors): status, target, last
 * check, cadence and the mute switch. Down and failing monitors sort first.
 */
export default function MonitorsPage() {
  const { data, loading, error, update } = useMonitorsController();
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

  return (
    <div data-testid="monitors" className="flex flex-col gap-5 px-6 py-5">
      <header className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-[20px] font-semibold">Monitors</h1>
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

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} kind="line" />
          ))}
        </div>
      ) : error ? (
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
              muted={m.muted}
              onMutedChange={(muted) => void update(m.id, { muted })}
              href={`/dashboard/monitors/${m.id}`}
            />
          ))}
        </section>
      )}
    </div>
  );
}
