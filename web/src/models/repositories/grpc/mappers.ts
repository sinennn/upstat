import type * as pb from "@/proto/user_pb";
import type {
  CheckResult,
  Incident,
  Monitor,
  MonitorHistory,
  MonitorInsight,
  MonitorStatus,
  MonitorType,
  StatusPage,
  StatusPageComponent,
  StatusPageOverall,
  UptimeDay,
  User,
} from "../..";
import { MONITOR_TYPES } from "../../monitors";

/**
 * proto → model mappers. The only translation the UI adds on top of the
 * backend is turning proto3 zero values into null and deriving the
 * display-only monitor states; everything else is a rename.
 */

/** proto3 encodes an unset string as "". */
function optionalString(v: string): string | null {
  return v === "" ? null : v;
}

/** proto3 encodes an unset number as 0. */
function optionalNumber(v: number): number | null {
  return v === 0 ? null : v;
}

/**
 * Backend status (`unknown` | `up` | `down`) + `active` → MonitorStatus:
 * inactive → paused; `unknown` before the first check → pending;
 * `unknown` after one (checks failing below the threshold) → nodata.
 */
export function monitorStatusFrom(
  status: string,
  active: boolean,
  lastCheckedAt: string,
): MonitorStatus {
  if (!active) return "paused";
  if (status === "up") return "up";
  if (status === "down") return "down";
  return lastCheckedAt === "" ? "pending" : "nodata";
}

function monitorTypeFrom(type: string): MonitorType {
  return (MONITOR_TYPES as readonly string[]).includes(type)
    ? (type as MonitorType)
    : "website";
}

export function userFrom(u: pb.GetUserResponse): User {
  return { id: u.getId(), name: u.getName(), email: u.getEmail() };
}

export function monitorFrom(m: pb.Monitor): Monitor {
  const lastCheckedAt = m.getLastCheckedAt();
  const checked = lastCheckedAt !== "";
  return {
    id: m.getId(),
    name: m.getName(),
    target: m.getTarget(),
    type: monitorTypeFrom(m.getType()),
    active: m.getActive(),
    status: monitorStatusFrom(m.getStatus(), m.getActive(), lastCheckedAt),
    muted: m.getMuted(),
    interval_seconds: m.getIntervalSeconds(),
    timeout_seconds: m.getTimeoutSeconds(),
    failure_threshold: m.getFailureThreshold(),
    consecutive_failures: m.getConsecutiveFailures(),
    last_checked_at: optionalString(lastCheckedAt),
    last_response_time_ms: checked ? m.getLastResponseTimeMs() : null,
    last_status_code: checked ? m.getLastStatusCode() : null,
    created_at: m.getCreatedAt(),
    updated_at: m.getUpdatedAt(),
  };
}

export function checkFrom(c: pb.MonitorCheck): CheckResult {
  return {
    // checks carry no id on the wire; (monitor, timestamp) is unique
    id: `${c.getMonitorId()}:${c.getCheckedAt()}`,
    monitor_id: c.getMonitorId(),
    up: c.getSuccess(),
    status_code: c.getStatusCode(),
    response_time_ms: c.getResponseTime(),
    checked_at: c.getCheckedAt(),
  };
}

export function uptimeDayFrom(d: pb.MonitorUptimeDay): UptimeDay {
  return {
    date: d.getDate(),
    uptime_pct: d.getHasData() ? d.getUptimePct() : null,
    down_minutes: d.getDownMinutes(),
  };
}

export function historyFrom(
  monitorId: string,
  r: pb.GetMonitorHistoryResponse,
): MonitorHistory {
  return {
    monitor_id: monitorId,
    days: r.getDaysList().map(uptimeDayFrom),
    recent_checks: r.getRecentChecksList().map(checkFrom),
    uptime_90d_pct: r.getHasUptime() ? r.getOverallUptimePct() : null,
  };
}

export function insightFrom(i: pb.MonitorInsight): MonitorInsight {
  return {
    monitor_id: i.getMonitorId(),
    risk_score: i.getRiskScore(),
    anomaly_detected: i.getAnomalyDetected(),
    severity: i.getSeverity(),
    summary: i.getSummary(),
    recommended_action: i.getRecommendedAction(),
    human_readable: i.getHumanReadable(),
    generated_at: i.getGeneratedAt(),
  };
}

/** @param monitorNames monitor id → name (the wire carries only the id). */
export function incidentFrom(
  i: pb.Incident,
  monitorNames: ReadonlyMap<string, string> = new Map(),
): Incident {
  const resolved = i.getStatus() === "resolved";
  return {
    id: i.getId(),
    monitor_id: i.getMonitorId(),
    monitor_name: monitorNames.get(i.getMonitorId()) ?? null,
    title: i.getTitle(),
    failure_reason: i.getFailureReason(),
    status: resolved ? "resolved" : "active",
    started_at: i.getStartedAt(),
    resolved_at: optionalString(i.getResolvedAt()),
    duration_seconds: resolved ? i.getDurationSeconds() : null,
  };
}

export function statusComponentFrom(
  c: pb.StatusPageComponent,
): StatusPageComponent {
  return {
    monitor_id: c.getMonitorId(),
    name: c.getName(),
    // components carry no `active` flag; a paused monitor reads by its
    // last stored status, exactly as the backend publishes it
    status: monitorStatusFrom(c.getStatus(), true, c.getLastCheckAt()),
    days: c.getDaysList().map(uptimeDayFrom),
    uptime_pct: c.getHasUptime() ? c.getUptimePct() : null,
    p95_ms: optionalNumber(c.getP95Ms()),
    last_check_at: optionalString(c.getLastCheckAt()),
  };
}

/**
 * The backend reports no overall verdict, so it is derived from what it
 * does report: down components, then open incidents.
 */
export function overallFrom(
  components: StatusPageComponent[],
  activeIncidents: number,
): StatusPageOverall {
  const down = components.filter((c) => c.status === "down").length;
  if (down > 0 && down === components.length) return "major_outage";
  if (down > 0) return "partial_outage";
  if (activeIncidents > 0) return "degraded";
  return "operational";
}

export function statusPageFrom(
  fallbackName: string,
  r: pb.GetStatusPageResponse,
  now: Date = new Date(),
): StatusPage {
  const components = r.getComponentsList().map(statusComponentFrom);
  const names = new Map(components.map((c) => [c.monitor_id, c.name]));
  const active = r.getActiveIncidentsList().map((i) => incidentFrom(i, names));
  const lastCheck = components
    .map((c) => c.last_check_at)
    .filter((ts): ts is string => ts !== null)
    .sort()
    .at(-1);
  const total = r.getTotalChecks();
  return {
    name: r.getPageName() || fallbackName,
    overall: overallFrom(components, active.length),
    updated_at: lastCheck ?? now.toISOString(),
    uptime_pct: total > 0 ? r.getUptimePercentage() : null,
    total_checks: total,
    successful_checks: r.getSuccessfulChecks(),
    components,
    active_incidents: active,
    past_incidents: r
      .getHistoricalIncidentsList()
      .map((i) => incidentFrom(i, names)),
  };
}
