"use client";

import { useCallback } from "react";
import { incidentsRepo, monitorsRepo, statusRepo } from "@/models/repositories";
import type { Series } from "@/models/chart";
import type {
  CheckResult,
  Monitor,
  MonitorInput,
  MonitorPatch,
  MonitorStatus,
} from "@/models";
import type { StatusPillStatus } from "@/components/ui/StatusPill";
import { useRequest } from "./use-request";

/**
 * Monitor state → StatusPill tint. `nodata` (checked, failing, below the
 * failure threshold) is a warning: the next failures open an incident.
 */
export function monitorPillStatus(status: MonitorStatus): StatusPillStatus {
  switch (status) {
    case "up":
      return "ok";
    case "down":
      return "crit";
    case "nodata":
      return "warn";
    case "paused":
      return "paused";
    case "pending":
      return "pending";
  }
}

/** Pill copy — `nodata` reads as what it means for a check. */
export function monitorStatusLabel(status: MonitorStatus): string {
  switch (status) {
    case "up":
      return "UP";
    case "down":
      return "DOWN";
    case "nodata":
      return "FAILING";
    case "paused":
      return "PAUSED";
    case "pending":
      return "PENDING";
  }
}

/**
 * Client-side mirror of the backend's monitor validation
 * (monitor_service.go) so the form can say what is wrong before the
 * round-trip. The backend remains the authority.
 */
export function validateMonitor(input: MonitorInput): string | null {
  if (!input.name.trim() || !input.target.trim() || !input.type) {
    return "Name, type and target are required.";
  }
  const interval = input.interval_seconds || 60;
  const timeout = input.timeout_seconds || 10;
  if (timeout >= interval) {
    return "Timeout must be below the check interval.";
  }
  try {
    const url = new URL(input.target);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Target must be an http:// or https:// URL — every check is an HTTP GET.";
    }
  } catch {
    return "Target must be a full URL, e.g. https://example.com/health.";
  }
  return null;
}

/** What a schedule means in practice — shown live beside the form. */
export function scheduleSummary(
  intervalSeconds: number,
  timeoutSeconds: number,
  threshold: number,
) {
  const interval = Math.max(1, intervalSeconds);
  const checksPerDay = Math.floor(86_400 / interval);
  return {
    checksPerDay,
    requestsPerMonth: checksPerDay * 30,
    // an outage starting just after a check waits one full interval for the
    // first failure, then threshold-1 more; each failure can take the timeout
    detectWorstSeconds: threshold * interval + timeoutSeconds,
    detectBestSeconds: (threshold - 1) * interval + timeoutSeconds,
  };
}

export interface MonitorChange {
  field: string;
  from: string;
  to: string;
}

/** Field-by-field diff between the saved monitor and the form draft. */
export function monitorChanges(
  saved: Monitor,
  draft: MonitorInput,
): MonitorChange[] {
  const rows: [string, string | number, string | number | undefined][] = [
    ["Name", saved.name, draft.name],
    ["Type", saved.type, draft.type],
    ["URL", saved.target, draft.target],
    [
      "Interval",
      `${saved.interval_seconds}s`,
      draft.interval_seconds && `${draft.interval_seconds}s`,
    ],
    [
      "Timeout",
      `${saved.timeout_seconds}s`,
      draft.timeout_seconds && `${draft.timeout_seconds}s`,
    ],
    ["Failures to down", saved.failure_threshold, draft.failure_threshold],
  ];
  return rows
    .filter(
      ([, from, to]) =>
        to !== undefined && to !== "" && String(to) !== String(from),
    )
    .map(([field, from, to]) => ({
      field,
      from: String(from),
      to: String(to),
    }));
}

/** Dashboard refresh cadence — the fastest check interval is ~10s. */
export const LIVE_REFRESH_MS = 10_000;

/** /dashboard — the caller's monitors, live, with per-row sparklines. */
export function useMonitorsController() {
  const state = useRequest(() => monitorsRepo.list(), [], {
    refreshMs: LIVE_REFRESH_MS,
  });

  // last 60 checks per monitor (GetRecentChecks), refreshed with the list —
  // enough to cover the 30-minute fleet chart at a 30 s interval
  const ids = (state.data ?? []).map((m) => m.id).join(",");
  const checks = useRequest(
    async () => {
      if (!ids) return {} as Record<string, CheckResult[]>;
      const list = ids.split(",");
      const results = await Promise.all(
        list.map((id) => monitorsRepo.recentChecks(id, 60).catch(() => [])),
      );
      return Object.fromEntries(list.map((id, i) => [id, results[i]]));
    },
    [ids],
    { refreshMs: LIVE_REFRESH_MS },
  );

  const update = useCallback(
    async (id: string, patch: MonitorPatch) => {
      await monitorsRepo.update(id, patch);
      await state.reload();
    },
    [state],
  );

  const remove = useCallback(
    async (id: string) => {
      await monitorsRepo.remove(id);
      await state.reload();
    },
    [state],
  );

  return { ...state, checks: checks.data ?? {}, update, remove };
}

/**
 * Headline numbers for the dashboard. The 24h uptime and check counts are
 * GetStatusPage's own aggregate for this owner — the same figures the
 * public page shows.
 */
export function useOverviewController(ownerId: string | null) {
  const status = useRequest(
    () => (ownerId ? statusRepo.byOwner(ownerId) : Promise.resolve(null)),
    [ownerId],
    { refreshMs: 30_000 },
  );
  const incidents = useRequest(() => incidentsRepo.list(), [], {
    refreshMs: LIVE_REFRESH_MS,
  });
  return {
    status: status.data,
    incidents: incidents.data ?? [],
    openIncidents: (incidents.data ?? []).filter((i) => i.status === "active")
      .length,
    incidentsLoaded: incidents.data !== null,
  };
}

/** Create / edit form submissions. */
export function useMonitorMutations() {
  const create = useCallback(
    (input: MonitorInput): Promise<Monitor> => monitorsRepo.create(input),
    [],
  );
  const update = useCallback(
    (id: string, patch: MonitorPatch): Promise<Monitor> =>
      monitorsRepo.update(id, patch),
    [],
  );
  return { create, update };
}

/** /dashboard/monitors/view?id= — everything the backend has for one monitor. */
export function useMonitorController(id: string) {
  const live = { refreshMs: LIVE_REFRESH_MS };
  const monitor = useRequest(() => monitorsRepo.get(id), [id], live);
  const history = useRequest(() => monitorsRepo.history(id), [id], live);
  const incidents = useRequest(() => incidentsRepo.list(id), [id], live);
  // insight relays to the observability service; it failing must not
  // take the page down, so its error stays local to the panel
  const insight = useRequest(() => monitorsRepo.insight(id), [id]);

  const update = useCallback(
    async (patch: MonitorPatch) => {
      await monitorsRepo.update(id, patch);
      await monitor.reload();
    },
    [id, monitor],
  );

  const remove = useCallback(() => monitorsRepo.remove(id), [id]);

  return { monitor, history, incidents, insight, update, remove };
}

/**
 * Fleet response time: one series per monitor on a shared grid of 1-minute
 * buckets over the last `minutes`, each point the mean latency of that
 * monitor's successful checks in the bucket. A bucket with no successful
 * check is a gap (null) — nothing is interpolated.
 */
export function fleetResponseSeries(
  monitors: Monitor[],
  checks: Record<string, CheckResult[]>,
  now: number,
  minutes = 30,
): Series[] {
  const bucketMs = 60_000;
  const end = now - (now % bucketMs);
  const start = end - (minutes - 1) * bucketMs;
  return monitors
    .filter((m) => m.active && (checks[m.id]?.length ?? 0) > 0)
    .map((m) => {
      const sums = new Array<number>(minutes).fill(0);
      const counts = new Array<number>(minutes).fill(0);
      for (const c of checks[m.id] ?? []) {
        if (!c.up) continue;
        const t = Date.parse(c.checked_at);
        const i = Math.floor((t - start) / bucketMs);
        if (i < 0 || i >= minutes) continue;
        sums[i] += c.response_time_ms;
        counts[i] += 1;
      }
      return {
        name: m.name,
        tags: {},
        points: sums.map((sum, i) => ({
          ts: new Date(start + i * bucketMs).toISOString(),
          value: counts[i] ? Math.round(sum / counts[i]) : null,
        })),
      };
    })
    .filter((s) => s.points.some((p) => p.value !== null));
}
