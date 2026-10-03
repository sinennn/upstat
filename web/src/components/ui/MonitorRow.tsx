"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { StatusPill, type StatusPillStatus } from "./StatusPill";
import { Switch } from "./Switch";

export interface MonitorRowProps {
  status: StatusPillStatus;
  /** Pill copy (UP / DOWN / FAILING / PAUSED / PENDING). */
  statusLabel?: string;
  name: string;
  /** The checked URL, mono. */
  target: string;
  /** e.g. `2m ago · 182 ms`; `—` before the first check. */
  lastCheck: string;
  /** e.g. `every 60s`. */
  cadence: string;
  muted: boolean;
  onMutedChange?: (muted: boolean) => void;
  href: string;
  className?: string;
}

/**
 * MonitorRow — one monitor in the list: status, name + target, last check,
 * cadence, and the mute switch (mute suppresses notifications only).
 */
export function MonitorRow({
  status,
  statusLabel,
  name,
  target,
  lastCheck,
  cadence,
  muted,
  onMutedChange,
  href,
  className,
}: MonitorRowProps) {
  return (
    <div
      data-status={status}
      className={clsx(
        "font-ui flex min-h-12 items-center gap-3 border-b border-border px-3 py-2",
        "transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev",
        className,
      )}
    >
      <StatusPill
        status={status}
        label={statusLabel}
        className="w-[92px] shrink-0"
      />
      <Link href={href} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[13px] font-medium text-text">
            {name}
          </span>
          <span className="font-data truncate text-[12px] text-text-2">
            {target}
          </span>
        </span>
        <span className="hidden w-36 shrink-0 text-right text-[12px] tabular-nums text-text-2 sm:block">
          {lastCheck}
        </span>
        <span className="hidden w-20 shrink-0 text-right text-[12px] tabular-nums text-text-2 md:block">
          {cadence}
        </span>
      </Link>
      <span className="flex shrink-0 items-center gap-2 text-[12px] text-text-2">
        <span className="hidden lg:inline">Mute</span>
        <Switch
          checked={muted}
          onCheckedChange={onMutedChange}
          aria-label={`Mute ${name}`}
        />
      </span>
    </div>
  );
}
