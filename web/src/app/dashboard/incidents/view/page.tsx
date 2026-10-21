"use client";

import { clsx } from "clsx";
import {
  CircleAlert,
  CircleCheck,
  CircleDot,
  Radio,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Panel } from "@/components/dashboard/Panels";
import { IncidentRow } from "@/components/ui/IncidentRow";
import { QueryValue } from "@/components/ui/QueryValue";
import { Skeleton } from "@/components/ui/Skeleton";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { Tooltip } from "@/components/ui/Tooltip";
import { routes } from "@/config/routes";
import {
  NEXT_STEPS,
  failureCause,
  incidentSeconds,
  reconstructIncident,
  useIncidentContext,
  useIncidentController,
} from "@/controllers/incidents";
import { durationLabel, whenLabel } from "@/controllers/shell";
import type { CheckResult, Incident, MonitorInsight } from "@/models";
import { ApiError } from "@/models";

/** Absolute UTC time — the timeline needs exact moments, not "3h ago". */
function exact(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/** Counts up every second while the incident is open. */
function LiveDuration({ incident }: { incident: Incident }) {
  const [now, setNow] = useState<number | null>(null);
  const active = incident.status === "active";
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const t0 = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(t0);
      window.clearInterval(t);
    };
  }, [active]);
  const seconds = active
    ? now === null
      ? null
      : Math.max(0, Math.floor((now - Date.parse(incident.started_at)) / 1000))
    : (incident.duration_seconds ?? 0);
  if (seconds === null) return <span>—</span>;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <span className="tabular-nums">
      {h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`}
    </span>
  );
}

interface TimelineEvent {
  key: string;
  icon: LucideIcon;
  tone: "ok" | "crit" | "warn" | "info";
  title: string;
  at: string | null;
  detail: string;
}

const TONE: Record<TimelineEvent["tone"], string> = {
  ok: "text-ok-text bg-ok/15",
  crit: "text-crit-text bg-crit/15",
  warn: "text-warn-text bg-warn/15",
  info: "text-brand-text bg-brand/15",
};

function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col px-4 py-4">
      {events.map((e, i) => {
        const Icon = e.icon;
        return (
          <li key={e.key} className="relative flex gap-3 pb-5 last:pb-0">
            {i < events.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[13px] top-7 h-[calc(100%-24px)] w-px bg-border"
              />
            )}
            <span
              className={clsx(
                "relative flex size-7 shrink-0 items-center justify-center rounded-full",
                TONE[e.tone],
              )}
            >
              <Icon aria-hidden="true" className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="text-[13px] font-semibold">{e.title}</span>
                {e.at && (
                  <span className="font-data text-[11.5px] tabular-nums text-text-2">
                    {exact(e.at)}
                  </span>
                )}
              </div>
              <p className="break-words text-[12.5px] leading-[1.45] text-text-2">
                {e.detail}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** One tick per check across the window — the outage reads as a red run. */
function CheckStrip({ checks }: { checks: CheckResult[] }) {
  return (
    <div
      className="flex h-8 items-stretch gap-px"
      role="img"
      aria-label={`${checks.length} checks, ${checks.filter((c) => !c.up).length} failed`}
    >
      {checks.map((c) => (
        <Tooltip
          key={c.id}
          grow
          content={[
            { label: exact(c.checked_at), value: c.up ? "Up" : "Failed" },
            {
              label: "Response",
              value: c.status_code
                ? `${c.status_code} · ${c.response_time_ms} ms`
                : "no response",
            },
          ]}
        >
          <span
            className={clsx(
              "block min-w-0 flex-1 rounded-[2px]",
              c.up ? "bg-ok/70" : "bg-crit",
            )}
          />
        </Tooltip>
      ))}
    </div>
  );
}

function InsightCard({
  insight,
  error,
  loading,
}: {
  insight: MonitorInsight | null;
  error: Error | null;
  loading: boolean;
}) {
  const tint: Record<string, string> = {
    low: "text-ok-text",
    medium: "text-warn-text",
    high: "text-crit-text",
    critical: "text-crit-text",
  };
  const sentence = (t: string) =>
    t ? t[0].toUpperCase() + t.slice(1) + (/[.!?]$/.test(t) ? "" : ".") : t;
  return (
    <Panel title="AI insight · this monitor now" testId="incident-insight">
      <div className="flex flex-col gap-2 px-4 py-4 text-[13px]">
        {loading ? (
          <Skeleton kind="line" />
        ) : error ? (
          <p className="text-text-2">
            {error instanceof ApiError && error.code === "unavailable"
              ? "The insight service isn't connected."
              : "Insight unavailable."}
          </p>
        ) : !insight ? (
          <p className="text-text-2">No insight yet.</p>
        ) : (
          <>
            <p>
              <span
                className={clsx(
                  "font-semibold uppercase",
                  tint[insight.severity],
                )}
              >
                {insight.severity}
              </span>{" "}
              <span className="text-text-2">
                · risk {insight.risk_score}/100
                {insight.anomaly_detected && " · anomaly detected"}
              </span>
            </p>
            <p className="leading-[1.5]">
              {sentence(insight.human_readable || insight.summary)}
            </p>
            <p className="text-text-2">
              <span className="font-medium text-text">Recommended: </span>
              {sentence(insight.recommended_action)}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

/**
 * /dashboard/incidents/view?id= — one outage, reconstructed: what happened
 * and when (from the monitor's raw checks), how fast it was detected, what
 * the checks looked like around it, likely next steps for its root cause,
 * the monitor's current AI insight and its other incidents.
 */
export default function IncidentPage() {
  const id = useSearchParams().get("id") ?? "";
  const { data: incident, loading, updatedAt } = useIncidentController(id);
  const ctx = useIncidentContext(incident?.monitor_id ?? null);
  const now = updatedAt ?? 0;

  const rec = useMemo(
    () =>
      incident
        ? reconstructIncident(
            incident,
            ctx.history.data?.recent_checks ?? [],
            now,
          )
        : null,
    [incident, ctx.history.data, now],
  );

  if (loading && !incident) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 160 }} />
      </div>
    );
  }

  if (!incident || !rec) {
    return (
      <div className="flex flex-col gap-2 px-6 py-5">
        <h1 className="text-[20px] font-semibold">Incident not found</h1>
        <Link
          href="/dashboard/incidents"
          className="text-[13px] text-brand-text hover:underline"
        >
          Back to incidents
        </Link>
      </div>
    );
  }

  const active = incident.status === "active";
  const cause = failureCause(incident.failure_reason);
  const monitor = ctx.monitor.data;
  const others = (ctx.related.data ?? []).filter((i) => i.id !== incident.id);
  const resolvedOthers = others.filter((i) => i.duration_seconds !== null);
  const mttr = resolvedOthers.length
    ? Math.round(
        resolvedOthers.reduce((s, i) => s + (i.duration_seconds ?? 0), 0) /
          resolvedOthers.length,
      )
    : null;

  const events: TimelineEvent[] = [];
  if (rec.lastSuccess) {
    events.push({
      key: "last-ok",
      icon: CircleCheck,
      tone: "ok",
      title: "Last successful check",
      at: rec.lastSuccess.checked_at,
      detail: `${rec.lastSuccess.status_code} in ${rec.lastSuccess.response_time_ms} ms — everything normal.`,
    });
  }
  if (rec.firstFailure) {
    events.push({
      key: "first-fail",
      icon: CircleDot,
      tone: "warn",
      title: "First failed check",
      at: rec.firstFailure.checked_at,
      detail: rec.firstFailure.status_code
        ? `Responded ${rec.firstFailure.status_code}; retried twice before it counted as a failure.`
        : "No response; retried twice before it counted as a failure.",
    });
  }
  events.push({
    key: "opened",
    icon: CircleAlert,
    tone: "crit",
    title: "Failure threshold reached — incident opened",
    at: incident.started_at,
    detail: `${monitor ? `${monitor.failure_threshold} consecutive failed checks` : "Consecutive failed checks"} turned the monitor down. Reason: ${incident.failure_reason || "unknown"}`,
  });
  if (active) {
    events.push({
      key: "ongoing",
      icon: Radio,
      tone: "crit",
      title: "Still down",
      at: null,
      detail: `Checks keep running${monitor ? ` every ${monitor.interval_seconds}s` : ""}; the first success will resolve this automatically.`,
    });
  } else {
    events.push({
      key: "resolved",
      icon: CircleCheck,
      tone: "ok",
      title: "Recovered — incident resolved",
      at: incident.resolved_at,
      detail: rec.recovery
        ? `First successful check: ${rec.recovery.status_code} in ${rec.recovery.response_time_ms} ms. Total downtime ${durationLabel(incident.duration_seconds ?? 0)}.`
        : `Resolved by the next successful check after ${durationLabel(incident.duration_seconds ?? 0)}.`,
    });
  }

  const responseSeries = [
    {
      name: "response_ms",
      tags: {},
      points: rec.windowChecks.map((c) => ({
        ts: c.checked_at,
        value: c.up ? c.response_time_ms : null,
      })),
    },
  ];

  return (
    <div
      className="flex flex-col gap-5 px-6 py-5"
      data-testid="incident-detail"
    >
      {/* header */}
      <header className="flex flex-col gap-3">
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard/incidents" className="hover:text-text">
            Incidents /
          </Link>
        </nav>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={clsx(
                  "inline-flex h-6 items-center rounded-(--radius) px-2 text-[11.5px] font-semibold",
                  active ? "bg-crit text-on-brand" : "bg-ok/15 text-ok-text",
                )}
              >
                {active ? "OPEN" : "RESOLVED"}
              </span>
              <h1 className="text-[24px] font-semibold">{incident.title}</h1>
            </div>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-text-2">
              {incident.monitor_name ? (
                <Link
                  href={routes.monitor(incident.monitor_id)}
                  className="font-medium text-brand-text hover:underline"
                >
                  {incident.monitor_name}
                </Link>
              ) : (
                <span>Deleted monitor</span>
              )}
              {monitor && (
                <span className="font-data">· GET {monitor.target}</span>
              )}
              <span>· started {whenLabel(incident.started_at)}</span>
            </p>
          </div>
          <div
            className={clsx(
              "flex flex-col items-end rounded-(--radius) border px-4 py-2.5",
              active ? "border-crit/40 bg-crit/10" : "border-border bg-bg-elev",
            )}
          >
            <span className="text-[11px] uppercase tracking-wide text-text-2">
              {active ? "Down for" : "Total downtime"}
            </span>
            <span
              className={clsx(
                "font-data text-[26px] leading-tight",
                active ? "text-crit-text" : "text-text",
              )}
              data-testid="incident-duration"
            >
              <LiveDuration incident={incident} />
            </span>
          </div>
        </div>
      </header>

      {/* key numbers */}
      <section
        aria-label="Incident at a glance"
        className="grid grid-cols-2 gap-3 xl:grid-cols-4"
      >
        <QueryValue
          className="w-full"
          label="Root cause"
          value={cause}
          threshold={active ? "crit" : "none"}
        />
        <QueryValue
          className="w-full"
          label="Time to detect"
          value={
            rec.detectSeconds === null ? "—" : durationLabel(rec.detectSeconds)
          }
        />
        <QueryValue
          className="w-full"
          label="Failed checks"
          value={rec.covered ? `${rec.failedChecks} / ${rec.totalChecks}` : "—"}
          threshold={rec.covered && rec.failedChecks > 0 ? "warn" : "none"}
        />
        <QueryValue
          className="w-full"
          label={active ? "Open for" : "Duration"}
          value={durationLabel(incidentSeconds(incident, now))}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          title="What happened"
          aside="reconstructed from the monitor's checks"
          testId="incident-timeline"
        >
          <Timeline events={events} />
          {!rec.covered && (
            <p className="border-t border-border px-4 py-3 text-[12px] text-text-2">
              This incident is older than the last 500 checks, so the
              check-by-check steps before it aren&apos;t available.
            </p>
          )}
        </Panel>
        <div className="flex min-w-0 flex-col gap-5">
          <Panel title={`Next steps · ${cause}`} testId="next-steps">
            <ol className="flex flex-col gap-2.5 px-4 py-4">
              {NEXT_STEPS[cause].map((step, i) => (
                <li
                  key={step}
                  className="flex gap-2.5 text-[13px] leading-[1.45]"
                >
                  <span className="font-data flex size-5 shrink-0 items-center justify-center rounded-full bg-brand/15 text-[11px] font-semibold text-brand-text">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </Panel>
          {incident.monitor_name && (
            <InsightCard
              insight={ctx.insight.data}
              error={ctx.insight.error}
              loading={ctx.insight.loading && !ctx.insight.data}
            />
          )}
        </div>
      </div>

      {/* the checks around the outage */}
      {rec.windowChecks.length > 1 && (
        <Panel
          title="Checks around the incident"
          aside={`${rec.windowChecks.length} checks · ${active ? "from 10 min before it began until now" : "10 min either side"} · hover a tick`}
          testId="incident-checks"
        >
          <div className="flex flex-col gap-4 px-4 py-4">
            <CheckStrip checks={rec.windowChecks} />
            <div className="flex justify-between text-[11px] text-text-2">
              <span className="font-data">
                {exact(rec.windowChecks[0].checked_at)}
              </span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-ok/70" /> up
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-crit" /> failed
                </span>
              </span>
              <span className="font-data">
                {exact(
                  rec.windowChecks[rec.windowChecks.length - 1].checked_at,
                )}
              </span>
            </div>
          </div>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        {rec.windowChecks.some((c) => c.up) ? (
          <TimeseriesPanel
            title="Response time around the incident — gaps are failed checks"
            unit="ms"
            series={responseSeries}
            height={300}
            withLegend={false}
            className="min-w-0"
          />
        ) : (
          <Panel title="Response time around the incident">
            <p className="px-4 py-6 text-[13px] leading-[1.5] text-text-2">
              {rec.windowChecks.length > 0
                ? `Every one of the ${rec.windowChecks.length} checks in this window failed, so there is no response time to plot — the server never answered.`
                : "No check data for this window."}
            </p>
          </Panel>
        )}
        <Panel title="Failure details" testId="failure-details">
          <dl className="flex flex-col px-4 py-2 text-[13px]">
            {[
              [
                "Error",
                <span key="e" className="font-data break-words">
                  {incident.failure_reason || "—"}
                </span>,
              ],
              ["Root cause", cause],
              ["Started", exact(incident.started_at)],
              [
                "Resolved",
                incident.resolved_at ? exact(incident.resolved_at) : "not yet",
              ],
              ...(monitor
                ? [
                    ["Check interval", `${monitor.interval_seconds}s`],
                    ["Timeout", `${monitor.timeout_seconds}s`],
                    ["Failures to open", String(monitor.failure_threshold)],
                  ]
                : []),
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className="grid grid-cols-[130px_minmax(0,1fr)] gap-3 border-b border-border py-2.5 last:border-b-0"
              >
                <dt className="text-text-2">{label}</dt>
                <dd className="min-w-0">{value}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>

      <Panel
        title={`Other incidents on ${incident.monitor_name ?? "this monitor"}`}
        aside={
          others.length
            ? `${others.length} more${mttr !== null ? ` · typical fix ${durationLabel(mttr)}` : ""}`
            : undefined
        }
        testId="related-incidents"
      >
        {others.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-text-2">
            This is the only incident on this monitor.
          </p>
        ) : (
          <div className="flex flex-col">
            {others.slice(0, 6).map((i) => (
              <IncidentRow
                key={i.id}
                incident={i}
                href={routes.incident(i.id)}
                startedLabel={whenLabel(i.started_at)}
                durationLabel={
                  i.duration_seconds === null
                    ? null
                    : durationLabel(i.duration_seconds)
                }
                className="last:border-b-0"
              />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
