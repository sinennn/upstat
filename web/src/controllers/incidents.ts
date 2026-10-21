"use client";

import type { CheckResult, Incident, MonitorInsight } from "@/models";
import type { Series } from "@/models/chart";
import { incidentsRepo, monitorsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/** /dashboard/incidents — every incident on the caller's monitors. */
export function useIncidentsController() {
  return useRequest(() => incidentsRepo.list(), [], { refreshMs: 10_000 });
}

/** The monitors list, for the timeline rows and error budgets. */
export function useMonitorsForIncidents() {
  return useRequest(() => monitorsRepo.list(), [], { refreshMs: 30_000 });
}

/** /dashboard/incidents/view?id=. */
export function useIncidentController(id: string) {
  return useRequest(() => incidentsRepo.get(id), [id], { refreshMs: 10_000 });
}

/**
 * Everything around one incident: its monitor, the last 500 checks (enough
 * to reconstruct recent outages), the monitor's other incidents and its
 * current AI insight. A deleted monitor leaves only the incident itself.
 */
export function useIncidentContext(monitorId: string | null) {
  const live = { refreshMs: 10_000 };
  const key = [monitorId];
  const monitor = useRequest(
    () => (monitorId ? monitorsRepo.get(monitorId) : Promise.resolve(null)),
    key,
    live,
  );
  const history = useRequest(
    () =>
      monitorId ? monitorsRepo.history(monitorId, 500) : Promise.resolve(null),
    key,
    live,
  );
  const related = useRequest(
    () =>
      monitorId
        ? incidentsRepo.list(monitorId)
        : Promise.resolve([] as Incident[]),
    key,
    live,
  );
  const insight = useRequest<MonitorInsight | null>(
    () => (monitorId ? monitorsRepo.insight(monitorId) : Promise.resolve(null)),
    key,
  );
  return { monitor, history, related, insight };
}

const DAY_MS = 86_400_000;

/** Seconds an incident has lasted so far (ongoing ones count up to now). */
export function incidentSeconds(i: Incident, now: number): number {
  if (i.duration_seconds !== null) return i.duration_seconds;
  return Math.max(0, Math.round((now - Date.parse(i.started_at)) / 1000));
}

export interface IncidentStats {
  open: number;
  /** Incidents that started inside the window. */
  inWindow: number;
  /** Mean time to resolve over resolved incidents in the window (s). */
  mttrSeconds: number | null;
  longestSeconds: number | null;
  downtimeSeconds: number;
}

/** Headline numbers over the incidents that started in the last `days`. */
export function incidentStats(
  incidents: Incident[],
  now: number,
  days = 30,
): IncidentStats {
  const since = now - days * DAY_MS;
  const recent = incidents.filter((i) => Date.parse(i.started_at) >= since);
  const resolved = recent.filter((i) => i.duration_seconds !== null);
  const durations = recent.map((i) => incidentSeconds(i, now));
  return {
    open: incidents.filter((i) => i.status === "active").length,
    inWindow: recent.length,
    mttrSeconds: resolved.length
      ? Math.round(
          resolved.reduce((s, i) => s + (i.duration_seconds ?? 0), 0) /
            resolved.length,
        )
      : null,
    longestSeconds: durations.length ? Math.max(...durations) : null,
    downtimeSeconds: durations.reduce((a, b) => a + b, 0),
  };
}

/** Incidents started per UTC day, oldest first, for the last `days`. */
export function incidentsPerDay(
  incidents: Incident[],
  now: number,
  days = 30,
): Series[] {
  const today = now - (now % DAY_MS);
  const counts = new Array<number>(days).fill(0);
  for (const i of incidents) {
    const started = Date.parse(i.started_at);
    if (started > now) continue;
    // whole calendar days between the incident's UTC day and today's
    const daysAgo = Math.round(
      (today - (started - (started % DAY_MS))) / DAY_MS,
    );
    const idx = days - 1 - daysAgo;
    if (idx >= 0 && idx < days) counts[idx] += 1;
  }
  return [
    {
      name: "incidents",
      tags: {},
      points: counts.map((value, idx) => ({
        ts: new Date(today - (days - 1 - idx) * DAY_MS).toISOString(),
        value,
      })),
    },
  ];
}

export interface MonitorDowntime {
  monitorId: string;
  name: string;
  seconds: number;
  incidents: number;
}

/** Total downtime per monitor in the window, worst first. */
export function downtimeByMonitor(
  incidents: Incident[],
  now: number,
  days = 30,
): MonitorDowntime[] {
  const since = now - days * DAY_MS;
  const byMonitor = new Map<string, MonitorDowntime>();
  for (const i of incidents) {
    if (Date.parse(i.started_at) < since) continue;
    const row = byMonitor.get(i.monitor_id) ?? {
      monitorId: i.monitor_id,
      name: i.monitor_name ?? "Deleted monitor",
      seconds: 0,
      incidents: 0,
    };
    row.seconds += incidentSeconds(i, now);
    row.incidents += 1;
    byMonitor.set(i.monitor_id, row);
  }
  return [...byMonitor.values()].sort((a, b) => b.seconds - a.seconds);
}

/* ------------------------------------------------------------------ */
/* Deeper analytics for the incidents page                             */
/* ------------------------------------------------------------------ */

export type FailureCause =
  | "DNS"
  | "Timeout"
  | "Connection refused"
  | "TLS"
  | "HTTP 5xx"
  | "HTTP 4xx"
  | "Other";

/**
 * Classifies the backend's failure reason — the Go HTTP client's error text
 * or the response status line — into a root-cause family.
 */
export function failureCause(reason: string): FailureCause {
  const r = reason.toLowerCase();
  if (/no such host|server misbehaving|lookup /.test(r)) return "DNS";
  if (/deadline exceeded|timeout|timed out/.test(r)) return "Timeout";
  if (/connection refused|connection reset/.test(r))
    return "Connection refused";
  if (/x509|certificate|tls/.test(r)) return "TLS";
  const code = r.match(/^\s*(\d{3})\b/);
  if (code?.[1].startsWith("5")) return "HTTP 5xx";
  if (code?.[1].startsWith("4")) return "HTTP 4xx";
  if (/unhealthy status code/.test(r)) return "HTTP 5xx";
  return "Other";
}

export interface CauseShare {
  cause: FailureCause;
  count: number;
  seconds: number;
}

/** Incidents per root cause in the window, most frequent first. */
export function causeBreakdown(
  incidents: Incident[],
  now: number,
  days = 30,
): CauseShare[] {
  const since = now - days * DAY_MS;
  const byCause = new Map<FailureCause, CauseShare>();
  for (const i of incidents) {
    if (Date.parse(i.started_at) < since) continue;
    const cause = failureCause(i.failure_reason);
    const row = byCause.get(cause) ?? { cause, count: 0, seconds: 0 };
    row.count += 1;
    row.seconds += incidentSeconds(i, now);
    byCause.set(cause, row);
  }
  return [...byCause.values()].sort(
    (a, b) => b.count - a.count || b.seconds - a.seconds,
  );
}

export const DURATION_BUCKETS = [
  { label: "< 1 min", max: 60 },
  { label: "1–5 min", max: 300 },
  { label: "5–15 min", max: 900 },
  { label: "15–60 min", max: 3600 },
  { label: "1–4 h", max: 14_400 },
  { label: "> 4 h", max: Infinity },
] as const;

/** How long incidents in the window lasted, bucketed. */
export function durationHistogram(
  incidents: Incident[],
  now: number,
  days = 30,
): { label: string; count: number }[] {
  const since = now - days * DAY_MS;
  const counts = DURATION_BUCKETS.map(() => 0);
  for (const i of incidents) {
    if (Date.parse(i.started_at) < since) continue;
    const secs = incidentSeconds(i, now);
    counts[DURATION_BUCKETS.findIndex((b) => secs < b.max)] += 1;
  }
  return DURATION_BUCKETS.map((b, idx) => ({
    label: b.label,
    count: counts[idx],
  }));
}

export interface OutageSpan {
  incident: Incident;
  /** 0–1 positions inside the window. */
  from: number;
  to: number;
  ongoing: boolean;
}

export interface TimelineRow {
  monitorId: string;
  name: string;
  spans: OutageSpan[];
}

/**
 * One row per active monitor (plus deleted monitors that had incidents),
 * each incident drawn as a span over the last `days`, clipped to the window.
 */
export function outageTimeline(
  incidents: Incident[],
  monitors: { id: string; name: string; active: boolean }[],
  now: number,
  days = 7,
): TimelineRow[] {
  const start = now - days * DAY_MS;
  const span = now - start;
  const rows = new Map<string, TimelineRow>();
  for (const m of monitors) {
    if (m.active) rows.set(m.id, { monitorId: m.id, name: m.name, spans: [] });
  }
  for (const i of incidents) {
    const s = Date.parse(i.started_at);
    const e = i.resolved_at ? Date.parse(i.resolved_at) : now;
    if (e < start || s > now) continue;
    const row = rows.get(i.monitor_id) ?? {
      monitorId: i.monitor_id,
      name: i.monitor_name ?? "Deleted monitor",
      spans: [],
    };
    row.spans.push({
      incident: i,
      from: Math.max(0, (s - start) / span),
      to: Math.min(1, (e - start) / span),
      ongoing: i.status === "active",
    });
    rows.set(i.monitor_id, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.spans.length - a.spans.length || a.name.localeCompare(b.name),
  );
}

export interface ErrorBudget {
  monitorId: string;
  name: string;
  /** Downtime the target allows over the window (s). */
  allowedSeconds: number;
  usedSeconds: number;
  /** Share of the budget left, 0–100 (negative = overspent, clamped at 0). */
  remainingPct: number;
  availabilityPct: number;
}

/**
 * Error budget per active monitor against an availability target (SRE
 * practice): a 99.9% target over 30 days allows 43.2 minutes of downtime.
 * Downtime here is incident time — from the failure threshold to recovery.
 */
export function errorBudgets(
  monitors: { id: string; name: string; active: boolean }[],
  incidents: Incident[],
  now: number,
  target = 0.999,
  days = 30,
): ErrorBudget[] {
  const windowSeconds = days * 86_400;
  const allowed = windowSeconds * (1 - target);
  const used = new Map(
    downtimeByMonitor(incidents, now, days).map((r) => [
      r.monitorId,
      r.seconds,
    ]),
  );
  return monitors
    .filter((m) => m.active)
    .map((m) => {
      const u = used.get(m.id) ?? 0;
      return {
        monitorId: m.id,
        name: m.name,
        allowedSeconds: Math.round(allowed),
        usedSeconds: u,
        remainingPct: Math.max(0, Math.round((1 - u / allowed) * 1000) / 10),
        availabilityPct: Math.round((1 - u / windowSeconds) * 100_000) / 1000,
      };
    })
    .sort(
      (a, b) =>
        a.remainingPct - b.remainingPct || b.usedSeconds - a.usedSeconds,
    );
}

/* ------------------------------------------------------------------ */
/* One incident, reconstructed from its checks                          */
/* ------------------------------------------------------------------ */

export interface IncidentReconstruction {
  /** The fetched checks reach back to before the outage began. */
  covered: boolean;
  /** Checks in [first failure − pad, end + pad], oldest first. */
  windowChecks: CheckResult[];
  lastSuccess: CheckResult | null;
  firstFailure: CheckResult | null;
  recovery: CheckResult | null;
  failedChecks: number;
  totalChecks: number;
  /** First failed check → incident opened (s). */
  detectSeconds: number | null;
}

/**
 * Rebuilds an outage from raw checks: the last good check, the first
 * failure, how long detection took (the failure threshold × interval), how
 * many checks failed, and the check that recovered it.
 */
export function reconstructIncident(
  incident: Incident,
  checks: CheckResult[],
  now: number,
  padMs = 10 * 60_000,
): IncidentReconstruction {
  const sorted = [...checks].sort(
    (a, b) => Date.parse(a.checked_at) - Date.parse(b.checked_at),
  );
  const started = Date.parse(incident.started_at);
  const end = incident.resolved_at ? Date.parse(incident.resolved_at) : now;

  let lastSuccess: CheckResult | null = null;
  for (const c of sorted) {
    if (Date.parse(c.checked_at) >= started) break;
    if (c.up) lastSuccess = c;
  }
  const firstFailure =
    sorted.find(
      (c) =>
        !c.up &&
        Date.parse(c.checked_at) <= started + 1000 &&
        (!lastSuccess ||
          Date.parse(c.checked_at) > Date.parse(lastSuccess.checked_at)),
    ) ?? null;
  const recovery = incident.resolved_at
    ? (sorted.find((c) => c.up && Date.parse(c.checked_at) >= end - 1000) ??
      null)
    : null;

  const from = firstFailure ? Date.parse(firstFailure.checked_at) : started;
  const during = sorted.filter((c) => {
    const t = Date.parse(c.checked_at);
    return t >= from && t <= end;
  });
  // covered = we can see checks from before the outage, not just its tail
  const covered =
    sorted.length > 0 && Date.parse(sorted[0].checked_at) < started;
  return {
    covered,
    windowChecks: sorted.filter((c) => {
      const t = Date.parse(c.checked_at);
      return t >= from - padMs && t <= end + padMs;
    }),
    lastSuccess,
    firstFailure: covered ? firstFailure : null,
    recovery,
    failedChecks: during.filter((c) => !c.up).length,
    totalChecks: during.length,
    detectSeconds:
      covered && firstFailure
        ? Math.max(
            0,
            Math.round((started - Date.parse(firstFailure.checked_at)) / 1000),
          )
        : null,
  };
}

/** Where to look first, by root cause — practical triage, not guesses. */
export const NEXT_STEPS: Record<FailureCause, string[]> = {
  DNS: [
    "Resolve the hostname from another network (dig or nslookup) to rule out a local resolver.",
    "Check the domain's DNS records and that the domain hasn't expired.",
    "If DNS changed recently, wait out the TTL or roll back the record.",
  ],
  Timeout: [
    "Open the URL directly and time it; compare with the monitor's timeout.",
    "Check server load, slow database queries and upstream dependencies.",
    "If the endpoint is legitimately slow, raise the timeout (it must stay below the interval).",
  ],
  "Connection refused": [
    "Confirm the service process is running and listening on the expected port.",
    "Check firewalls, security groups and load-balancer target health.",
    "Look for a recent deploy or restart that left the service down.",
  ],
  TLS: [
    "Check the certificate's expiry date and that it covers this hostname.",
    "Verify the full certificate chain is served (intermediate certificates included).",
    "Renew or reissue the certificate, then confirm with an SSL checker.",
  ],
  "HTTP 5xx": [
    "Read the application's error logs around the start time.",
    "Check recent deploys and roll back if the failures began with one.",
    "Check the health of the database and other upstream services.",
  ],
  "HTTP 4xx": [
    "Confirm the monitored URL is still correct (moved or renamed routes return 404).",
    "Check whether the endpoint now requires authentication or blocks this client.",
    "Update the monitor's URL if the route changed on purpose.",
  ],
  Other: [
    "Open the URL directly and compare with the recorded error.",
    "Check the service's logs and recent changes around the start time.",
  ],
};
