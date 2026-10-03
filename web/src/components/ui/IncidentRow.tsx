"use client";

import { clsx } from "clsx";
import Link from "next/link";
import type { Incident } from "@/models";

export interface IncidentRowProps {
  incident: Incident;
  /** Render the monitor name (lists spanning several monitors). */
  showMonitor?: boolean;
  /**
   * Show the failing check's error. Off on public surfaces: the backend's
   * reason is the raw Go error, which embeds the monitor's URL.
   */
  showReason?: boolean;
  /** Link target; omit on public surfaces. */
  href?: string;
  /** Pre-formatted times (the caller owns locale/relative formatting). */
  startedLabel: string;
  durationLabel: string | null;
  className?: string;
}

/**
 * IncidentRow — one backend incident: open/resolved chip, title, the
 * failing check's reason, when it started and how long it lasted.
 */
export function IncidentRow({
  incident,
  showMonitor = false,
  showReason = true,
  href,
  startedLabel,
  durationLabel,
  className,
}: IncidentRowProps) {
  const active = incident.status === "active";
  const body = (
    <>
      <span
        className={clsx(
          "inline-flex h-5 w-[72px] shrink-0 items-center justify-center rounded-(--radius) text-[11px] font-semibold",
          active ? "bg-crit text-on-brand" : "bg-ok/15 text-ok-text",
        )}
      >
        {active ? "OPEN" : "RESOLVED"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[13px] font-medium text-text">
          {incident.title}
          {showMonitor && incident.monitor_name === null && (
            <span className="text-text-2"> · deleted monitor</span>
          )}
        </span>
        {showReason && incident.failure_reason && (
          <span className="font-data truncate text-[12px] text-text-2">
            {incident.failure_reason}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-0.5 text-[12px] tabular-nums text-text-2">
        <span>{startedLabel}</span>
        <span>{durationLabel ?? (active ? "ongoing" : "")}</span>
      </span>
    </>
  );
  const rowClass = clsx(
    "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left",
    href &&
      "transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev",
    className,
  );
  return href ? (
    <Link
      href={href}
      className={rowClass}
      data-testid={`incident-${incident.id}`}
    >
      {body}
    </Link>
  ) : (
    <div className={rowClass} data-testid={`incident-${incident.id}`}>
      {body}
    </div>
  );
}
