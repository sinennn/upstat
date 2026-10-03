/**
 * Incidents — the backend's `Incident` message. Incidents are opened and
 * resolved only by the check worker (a monitor crossing its failure
 * threshold, then its next successful check); there is no API to declare,
 * edit or annotate one.
 */

export type IncidentStatus = "active" | "resolved";

export interface Incident {
  id: string;
  monitor_id: string;
  /** Resolved from the caller's monitors; null if the monitor was deleted. */
  monitor_name: string | null;
  /** `<monitor name> is down`. */
  title: string;
  /** The failing check's error, e.g. `503 Service Unavailable`. */
  failure_reason: string;
  status: IncidentStatus;
  started_at: string;
  resolved_at: string | null;
  /** Set on resolve. */
  duration_seconds: number | null;
}
