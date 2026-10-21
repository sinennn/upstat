"use client";

import { clsx } from "clsx";
import Link from "next/link";
import { Panel } from "@/components/dashboard/Panels";
import { Tooltip } from "@/components/ui/Tooltip";
import { routes } from "@/config/routes";
import {
  failureCause,
  type CauseShare,
  type ErrorBudget,
  type FailureCause,
  type TimelineRow,
} from "@/controllers/incidents";
import { durationLabel, whenLabel } from "@/controllers/shell";
import type { Incident } from "@/models";

const CAUSE_COLOR: Record<FailureCause, string> = {
  DNS: "var(--color-series-1)",
  Timeout: "var(--color-series-2)",
  "Connection refused": "var(--color-series-3)",
  TLS: "var(--color-series-4)",
  "HTTP 5xx": "var(--color-series-5)",
  "HTTP 4xx": "var(--color-series-6)",
  Other: "var(--color-series-8)",
};

const DAY_MS = 86_400_000;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const dayLabel = (ms: number) => {
  const d = new Date(ms);
  return `${MONTHS.at(d.getUTCMonth())} ${d.getUTCDate()}`;
};

/* ------------------------------------------------------------------ */
/* Outage timeline                                                     */
/* ------------------------------------------------------------------ */

/**
 * A row per monitor across the last 7 days: green track = up, each red span
 * one incident (pulsing while still open). Hover a span for its details.
 */
export function OutageTimeline({
  rows,
  now,
  days = 7,
}: {
  rows: TimelineRow[];
  now: number;
  days?: number;
}) {
  const start = now - days * DAY_MS;
  // day boundaries (UTC midnights) inside the window, as 0–1 positions
  const ticks: { pos: number; label: string }[] = [];
  for (let t = start - (start % DAY_MS) + DAY_MS; t < now; t += DAY_MS) {
    ticks.push({ pos: (t - start) / (now - start), label: dayLabel(t) });
  }
  const outages = rows.reduce((n, r) => n + r.spans.length, 0);

  return (
    <Panel
      title={`Outage timeline — last ${days} days`}
      aside={`${outages} ${outages === 1 ? "outage" : "outages"} · hover a bar for details`}
      testId="outage-timeline"
    >
      <div className="flex flex-col gap-2 px-4 pb-3 pt-4">
        {rows.map((row) => (
          <div key={row.monitorId} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-[13px] font-medium">
              {row.name}
            </span>
            <div
              className="relative h-7 min-w-0 flex-1 overflow-hidden rounded-[6px] bg-ok/15"
              role="img"
              aria-label={`${row.name}: ${row.spans.length} outages in the last ${days} days`}
            >
              {ticks.map((t) => (
                <span
                  key={t.label}
                  aria-hidden="true"
                  className="absolute inset-y-0 w-px bg-bg/70"
                  style={{ left: `${t.pos * 100}%` }}
                />
              ))}
              {row.spans.map((s) => (
                <div
                  key={s.incident.id}
                  className="absolute inset-y-1 flex"
                  style={{
                    left: `${s.from * 100}%`,
                    width: `max(4px, ${(s.to - s.from) * 100}%)`,
                  }}
                >
                  <Tooltip
                    grow
                    content={[
                      {
                        label: "Started",
                        value: whenLabel(s.incident.started_at),
                      },
                      {
                        label: s.ongoing ? "Open for" : "Lasted",
                        value: durationLabel(
                          s.incident.duration_seconds ??
                            Math.round(
                              (now - Date.parse(s.incident.started_at)) / 1000,
                            ),
                        ),
                      },
                      {
                        label: "Cause",
                        value: failureCause(s.incident.failure_reason),
                      },
                    ]}
                  >
                    <Link
                      href={routes.incident(s.incident.id)}
                      aria-label={`${s.incident.title}, ${whenLabel(s.incident.started_at)}`}
                      className={clsx(
                        "block w-full rounded-[3px] bg-crit hover:brightness-125",
                        s.ongoing && "animate-pulse motion-reduce:animate-none",
                      )}
                    />
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        ))}
        <div
          className="relative ml-[124px] h-4 text-[11px] text-text-2"
          aria-hidden="true"
        >
          {ticks.map((t) => (
            <span
              key={t.label}
              className={clsx(
                "font-data absolute whitespace-nowrap tabular-nums",
                t.pos > 0.94 ? "-translate-x-full" : "-translate-x-1/2",
              )}
              style={{ left: `${t.pos * 100}%` }}
            >
              {t.label}
            </span>
          ))}
        </div>
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Root causes                                                         */
/* ------------------------------------------------------------------ */

export function RootCauses({ causes }: { causes: CauseShare[] }) {
  const total = causes.reduce((n, c) => n + c.count, 0);
  return (
    <Panel title="Root causes" aside="last 30 days" testId="root-causes">
      {total === 0 ? (
        <p className="px-4 py-6 text-[13px] text-text-2">
          No incidents to classify.
        </p>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">
          {/* one stacked bar = the whole mix */}
          <div
            className="flex h-3 overflow-hidden rounded-full"
            aria-hidden="true"
          >
            {causes.map((c) => (
              <span
                key={c.cause}
                style={{
                  width: `${(c.count / total) * 100}%`,
                  background: CAUSE_COLOR[c.cause],
                }}
              />
            ))}
          </div>
          <ul className="flex flex-col gap-2.5">
            {causes.map((c) => (
              <li
                key={c.cause}
                className="flex items-center gap-2.5 text-[13px]"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-[3px]"
                  style={{ background: CAUSE_COLOR[c.cause] }}
                />
                <span className="flex-1 font-medium">{c.cause}</span>
                <span className="font-data text-[12px] tabular-nums text-text-2">
                  {c.count} · {Math.round((c.count / total) * 100)}% ·{" "}
                  {durationLabel(c.seconds)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] leading-[1.45] text-text-2">
            Classified from each incident&apos;s recorded error — DNS lookups,
            timeouts, refused connections, TLS and HTTP status failures.
          </p>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Error budgets                                                       */
/* ------------------------------------------------------------------ */

export function ErrorBudgets({ budgets }: { budgets: ErrorBudget[] }) {
  const allowed = budgets[0]?.allowedSeconds ?? 0;
  return (
    <Panel
      title="Error budget · 99.9% target"
      aside={`${durationLabel(allowed)} allowed / 30 days`}
      testId="error-budgets"
    >
      {budgets.length === 0 ? (
        <p className="px-4 py-6 text-[13px] text-text-2">No active monitors.</p>
      ) : (
        <ul className="flex flex-col gap-3 px-4 py-4">
          {budgets.slice(0, 6).map((b) => {
            const tone =
              b.remainingPct > 50
                ? "bg-ok"
                : b.remainingPct > 20
                  ? "bg-warn"
                  : "bg-crit";
            return (
              <li key={b.monitorId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate font-medium">{b.name}</span>
                  <span className="font-data shrink-0 text-[12px] tabular-nums text-text-2">
                    {b.availabilityPct.toFixed(3)}% ·{" "}
                    <span
                      className={
                        b.remainingPct === 0 ? "text-crit-text" : "text-text"
                      }
                    >
                      {b.remainingPct === 0
                        ? `exhausted · ${durationLabel(b.usedSeconds)} used`
                        : `${b.remainingPct.toFixed(0)}% left`}
                    </span>
                  </span>
                </div>
                <span className="h-2 overflow-hidden rounded-full bg-bg">
                  <span
                    className={clsx(
                      "block h-full rounded-full",
                      b.remainingPct === 0 ? "bg-crit/45" : tone,
                    )}
                    style={{
                      width: `${b.remainingPct === 0 ? 100 : b.remainingPct}%`,
                    }}
                  />
                </span>
              </li>
            );
          })}
          <p className="text-[12px] leading-[1.45] text-text-2">
            Budget used = incident time, from the failure threshold to recovery.
          </p>
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Duration distribution                                               */
/* ------------------------------------------------------------------ */

export function DurationDistribution({
  buckets,
}: {
  buckets: { label: string; count: number }[];
}) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const total = buckets.reduce((n, b) => n + b.count, 0);
  return (
    <Panel
      title="How long outages last"
      aside="last 30 days"
      testId="duration-distribution"
    >
      {total === 0 ? (
        <p className="px-4 py-6 text-[13px] text-text-2">No incidents yet.</p>
      ) : (
        <div className="flex h-full flex-col px-4 pb-3 pt-4">
          <div className="flex h-40 items-end gap-2">
            {buckets.map((b) => (
              <div
                key={b.label}
                className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              >
                <span className="font-data text-[11px] tabular-nums text-text-2">
                  {b.count || ""}
                </span>
                <span
                  className="w-full rounded-t-[4px] bg-[var(--color-series-1)]"
                  style={{
                    height: `${(b.count / max) * 100}%`,
                    minHeight: b.count ? 4 : 0,
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex gap-2 border-t border-border pt-1.5">
            {buckets.map((b) => (
              <span
                key={b.label}
                className="flex-1 text-center text-[10.5px] leading-tight text-text-2"
              >
                {b.label}
              </span>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/* Incident log                                                        */
/* ------------------------------------------------------------------ */

export function IncidentLog({
  incidents,
  now,
}: {
  incidents: Incident[];
  now: number;
}) {
  return (
    <section aria-label="Incident list" className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-[13px]">
        <thead className="text-left text-[12px] text-text-2">
          <tr className="border-b border-border">
            <th className="w-[92px] px-4 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 font-medium">Incident</th>
            <th className="px-3 py-2.5 font-medium">Cause</th>
            <th className="px-3 py-2.5 text-right font-medium">Started</th>
            <th className="px-4 py-2.5 text-right font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {incidents.map((i) => {
            const active = i.status === "active";
            const cause = failureCause(i.failure_reason);
            return (
              <tr
                key={i.id}
                data-testid={`incident-${i.id}`}
                className="border-b border-border transition-colors duration-[var(--duration-fast)] last:border-b-0 hover:bg-bg"
              >
                <td className="px-4 py-3 align-top">
                  <span
                    data-chip
                    className={clsx(
                      "inline-flex h-5 w-[72px] items-center justify-center rounded-(--radius) text-[11px] font-semibold",
                      active
                        ? "bg-crit text-on-brand"
                        : "bg-ok/15 text-ok-text",
                    )}
                  >
                    {active ? "OPEN" : "RESOLVED"}
                  </span>
                </td>
                <td className="min-w-0 px-3 py-3 align-top">
                  <Link
                    href={routes.incident(i.id)}
                    className="font-medium text-text hover:underline"
                  >
                    {i.title}
                  </Link>
                  <p className="font-data mt-0.5 max-w-[420px] truncate text-[12px] text-text-2">
                    {i.failure_reason || "—"}
                  </p>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11.5px]">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: CAUSE_COLOR[cause] }}
                    />
                    {cause}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right align-top text-[12px] tabular-nums text-text-2">
                  {whenLabel(i.started_at)}
                </td>
                <td
                  className={clsx(
                    "font-data whitespace-nowrap px-4 py-3 text-right align-top text-[12px] tabular-nums",
                    active ? "text-crit-text" : "text-text",
                  )}
                >
                  {active
                    ? `${durationLabel(Math.round((now - Date.parse(i.started_at)) / 1000))} · ongoing`
                    : durationLabel(i.duration_seconds ?? 0)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
