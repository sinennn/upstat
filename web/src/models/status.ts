/**
 * Public status page — `GetStatusPage`, unauthenticated. Resolved by the
 * page's public slug (a StatusPage record) or directly by owner id; it
 * lists every monitor the owner has, with no builder or ordering.
 */

import type { Incident } from "./incidents";
import type { MonitorStatus, UptimeDay } from "./monitors";

export type StatusPageOverall =
  "operational" | "degraded" | "partial_outage" | "major_outage";

export interface StatusPageComponent {
  monitor_id: string;
  name: string;
  status: MonitorStatus;
  days: UptimeDay[];
  uptime_pct: number | null;
  /** p95 over the same 90-day window, 10ms buckets. */
  p95_ms: number | null;
  last_check_at: string | null;
}

export interface StatusPage {
  /** Page name from the StatusPage record (falls back to the slug). */
  name: string;
  overall: StatusPageOverall;
  updated_at: string;
  /** Aggregate over the last 24h, across every monitor. */
  uptime_pct: number | null;
  total_checks: number;
  successful_checks: number;
  components: StatusPageComponent[];
  active_incidents: Incident[];
  /** Up to 50, newest first. */
  past_incidents: Incident[];
}
