"use client";

import { useCallback } from "react";
import { monitorsRepo, incidentsRepo } from "@/models/repositories";
import type {
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

/** /dashboard — the caller's monitors + pause/mute/delete. */
export function useMonitorsController() {
  const state = useRequest(() => monitorsRepo.list(), []);

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

  return { ...state, update, remove };
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

/** /dashboard/monitors/[id] — everything the backend has for one monitor. */
export function useMonitorController(id: string) {
  const monitor = useRequest(() => monitorsRepo.get(id), [id]);
  const history = useRequest(() => monitorsRepo.history(id), [id]);
  const incidents = useRequest(() => incidentsRepo.list(id), [id]);
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
