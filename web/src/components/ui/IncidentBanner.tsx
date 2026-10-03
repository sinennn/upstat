"use client";

import { clsx } from "clsx";

export interface IncidentBannerProps {
  title: string;
  /** Human age, e.g. `3h`. */
  age: string;
  onClick?: () => void;
  className?: string;
}

/**
 * IncidentBanner — the chrome strip shown on every dashboard page while a
 * monitor has an open incident. Incidents carry no severity: an open one
 * always means a monitor is down.
 */
export function IncidentBanner({
  title,
  age,
  onClick,
  className,
}: IncidentBannerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "font-ui flex w-full items-center gap-3 border-b px-4 py-2 text-left",
        "border-crit/40 bg-crit/10 transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-crit/15",
        className,
      )}
    >
      <span className="font-ui inline-flex h-5 shrink-0 items-center rounded-(--radius) bg-crit px-1.5 text-[11px] font-semibold text-on-brand">
        DOWN
      </span>
      <span className="min-w-0 shrink truncate text-[13px] font-medium text-text">
        {title}
      </span>
      <span className="shrink-0 text-[12px] tabular-nums text-text-2">
        open {age}
      </span>
      <span className="min-w-0 flex-1" />
      <span className="shrink-0 text-[13px] font-medium text-brand-text">
        View incident →
      </span>
    </button>
  );
}
