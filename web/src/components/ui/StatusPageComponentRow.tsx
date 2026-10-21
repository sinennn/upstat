"use client";

import { clsx } from "clsx";
import type { UptimeDay } from "@/models";
import { StatusPill, type StatusPillStatus } from "./StatusPill";
import { Tooltip } from "./Tooltip";

export interface StatusPageComponentRowProps {
  name: string;
  status: StatusPillStatus;
  /** Pill copy override (defaults to the status name). */
  statusLabel?: string;
  /** 90-day strip (UptimeCard technique, §8.2). */
  days: UptimeDay[];
  uptimePct: number | null;
  /** `inline` renders the landing v2 embed row (135:471): bordered card,
   *  name · pill · 2px bars · pct on one line; default keeps the stacked
   *  public-status-page layout (B7). */
  layout?: "stacked" | "inline";
  /** inline only: stretch the 90 bars across the row (dashboard boards). */
  fill?: boolean;
  className?: string;
}

function barTint(day: UptimeDay): string {
  if (day.uptime_pct === null) return "bg-nodata/50";
  if (day.uptime_pct >= 99.9) return "bg-ok";
  if (day.uptime_pct >= 98) return "bg-warn";
  return "bg-crit";
}

/** StatusPageComponentRow — name + StatusPill + 90-day bars + uptime % (B7). */
export function StatusPageComponentRow({
  name,
  status,
  statusLabel,
  days,
  uptimePct,
  layout = "stacked",
  fill = false,
  className,
}: StatusPageComponentRowProps) {
  if (layout === "inline") {
    return (
      <div
        className={clsx(
          "font-ui flex items-center gap-3 rounded-(--radius) border border-border px-3 py-1.5",
          // narrow screens: the strip drops to its own full-width line
          fill && "flex-wrap sm:flex-nowrap",
          className,
        )}
      >
        <span className="w-24 truncate text-[13px] font-medium text-text">
          {name}
        </span>
        <StatusPill
          status={status}
          label={statusLabel}
          className={fill ? "w-[76px] shrink-0" : undefined}
        />
        {/* overflow-x-auto: the fixed-width bars scroll on narrow viewports */}
        <div
          className={clsx(
            "flex items-stretch gap-px",
            fill
              ? "order-last h-5 min-w-0 basis-full sm:order-none sm:ml-2 sm:basis-0 sm:flex-1"
              : "ml-auto h-4 overflow-x-auto",
          )}
          role="img"
          aria-label={`${name} 90-day uptime`}
        >
          {days.map((day) => (
            <Tooltip
              key={day.date}
              grow={fill}
              content={[
                {
                  label: day.date,
                  value:
                    day.uptime_pct === null ? "no data" : `${day.uptime_pct}%`,
                },
              ]}
            >
              <span
                className={clsx(
                  "block rounded-[1px]",
                  fill ? "h-5 min-w-0 flex-1" : "h-4 w-[2px]",
                  barTint(day),
                )}
              />
            </Tooltip>
          ))}
        </div>
        <span className="font-data text-[11px] tabular-nums text-text-2">
          {uptimePct === null ? "no data" : `${uptimePct.toFixed(2)}%`}
        </span>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "font-ui flex flex-col gap-1.5 border-b border-border py-3",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-text">{name}</span>
        <StatusPill status={status} label={statusLabel} />
      </div>
      {/* overflow-x-auto: 90 fixed-width bars scroll on narrow viewports */}
      <div
        className="flex h-6 items-stretch gap-px overflow-x-auto"
        role="img"
        aria-label={`${name} 90-day uptime`}
      >
        {days.map((day) => (
          <Tooltip
            key={day.date}
            content={[
              {
                label: day.date,
                value:
                  day.uptime_pct === null ? "no data" : `${day.uptime_pct}%`,
              },
            ]}
          >
            <span
              className={clsx("block h-6 w-1 rounded-[1px]", barTint(day))}
            />
          </Tooltip>
        ))}
      </div>
      <span className="font-data text-[11px] tabular-nums text-text-2">
        {uptimePct === null
          ? "no data"
          : `${uptimePct.toFixed(3)}% over 90 days`}
      </span>
    </div>
  );
}
