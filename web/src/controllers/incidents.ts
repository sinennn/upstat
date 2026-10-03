"use client";

import { incidentsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/** /dashboard/incidents — every incident on the caller's monitors. */
export function useIncidentsController() {
  return useRequest(() => incidentsRepo.list(), []);
}

/** /dashboard/incidents/[id]. */
export function useIncidentController(id: string) {
  return useRequest(() => incidentsRepo.get(id), [id]);
}
