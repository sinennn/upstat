/**
 * Monitors — the `proto.MonitorService` read/write model, field-for-field
 * with `api/common/internal/proto/user.proto`.
 *
 * Every monitor is an HTTP GET check (`checker_service.go`): up when the
 * response is 2xx/3xx, retried 3× 500ms apart before a failure counts.
 * `failure_threshold` consecutive failures flip it `down` and open an
 * incident; the next success resolves it.
 */

/**
 * UI status, derived from the backend's `unknown | up | down` plus
 * `active` and `last_checked_at` (grpc/mappers.ts):
 * paused = inactive · pending = never checked · nodata = checked, no verdict.
 */
export type MonitorStatus = "up" | "down" | "pending" | "nodata" | "paused";

/**
 * The backend stores `type` as a free-form label and checks every type the
 * same way (HTTP GET), so this is a label set, not behavior.
 */
export type MonitorType = "website" | "api" | "server" | "blog";

export const MONITOR_TYPES: readonly MonitorType[] = [
  "website",
  "api",
  "server",
  "blog",
];

/** CreateMonitor defaults applied server-side when a field is 0/unset. */
export const MONITOR_DEFAULTS = {
  interval_seconds: 60,
  timeout_seconds: 10,
  failure_threshold: 3,
} as const;

export interface Monitor {
  id: string;
  name: string;
  target: string;
  type: MonitorType;
  active: boolean;
  status: MonitorStatus;
  /** Suppresses notifications only — checks and incidents still happen. */
  muted: boolean;
  interval_seconds: number;
  timeout_seconds: number;
  failure_threshold: number;
  consecutive_failures: number;
  last_checked_at: string | null;
  last_response_time_ms: number | null;
  last_status_code: number | null;
  created_at: string;
  updated_at: string;
}

/** CreateMonitorRequest. Omitted numbers take MONITOR_DEFAULTS. */
export interface MonitorInput {
  name: string;
  type: MonitorType;
  target: string;
  interval_seconds?: number;
  timeout_seconds?: number;
  failure_threshold?: number;
}

/** UpdateMonitorRequest — patch: only present fields change. */
export type MonitorPatch = Partial<
  Pick<
    Monitor,
    | "name"
    | "type"
    | "target"
    | "active"
    | "muted"
    | "interval_seconds"
    | "timeout_seconds"
    | "failure_threshold"
  >
>;

/** MonitorCheck — one persisted check result. */
export interface CheckResult {
  id: string;
  monitor_id: string;
  up: boolean;
  /** 0 when the request never got a response (DNS, timeout, refused). */
  status_code: number;
  response_time_ms: number;
  checked_at: string;
}

/** MonitorUptimeDay — one UTC day of the 90-day strip. */
export interface UptimeDay {
  date: string;
  /** null = no checks that day. */
  uptime_pct: number | null;
  /** Failed checks × check interval — interval resolution, not exact. */
  down_minutes: number;
}

/** GetMonitorHistoryResponse. */
export interface MonitorHistory {
  monitor_id: string;
  days: UptimeDay[];
  /** Newest-first, up to 100. */
  recent_checks: CheckResult[];
  uptime_90d_pct: number | null;
}

/**
 * MonitorInsight — produced by the observability service and relayed by
 * `GetMonitorInsight`; the RPC fails `unavailable` when that service is not
 * connected.
 */
export interface MonitorInsight {
  monitor_id: string;
  risk_score: number;
  anomaly_detected: boolean;
  severity: string;
  summary: string;
  recommended_action: string;
  human_readable: string;
  generated_at: string;
}
