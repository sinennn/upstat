/**
 * Illustration-only shapes for the marketing page's demo cards. Nothing in
 * the app or the backend produces these.
 */

export type AlertSignal = "uptime" | "metric" | "log" | "trace" | "slo_burn";

export type AlertRuleState = "ok" | "warn" | "alert" | "nodata";

export interface AlertRule {
  id: string;
  name: string;
  signal: AlertSignal;
  query_string: string;
  thresholds: { warn: number | null; crit: number; window: string };
  state: AlertRuleState;
  last_triggered_at: string | null;
}

export type KeyKind = "ingestion_token" | "property_key";
export type KeyScope = "otlp" | "rum" | "statsd" | "all";
export type KeyStatus = "active" | "rotation_grace" | "revoked";

export interface ApiKey {
  id: string;
  kind: KeyKind;
  name: string;
  scope: KeyScope;
  key_masked: string;
  status: KeyStatus;
  created_at: string;
  rejected_count: number;
}
