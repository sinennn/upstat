"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { IncidentRow } from "@/components/ui/IncidentRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIncidentsController } from "@/controllers/incidents";
import { durationLabel, whenLabel } from "@/controllers/shell";
import type { IncidentStatus } from "@/models";

type Filter = "all" | IncidentStatus;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Open" },
  { key: "resolved", label: "Resolved" },
];

/**
 * /dashboard/incidents — ListIncidents across the caller's monitors (the
 * 100 most recent). Incidents open and resolve automatically; there is
 * nothing to declare or edit.
 */
export default function IncidentsPage() {
  const { data, loading, error } = useIncidentsController();
  const [filter, setFilter] = useState<Filter>("all");
  const incidents = (data ?? []).filter(
    (i) => filter === "all" || i.status === filter,
  );

  return (
    <div data-testid="incidents" className="flex flex-col gap-5 px-6 py-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-[20px] font-semibold">Incidents</h1>
        <p className="text-[13px] leading-[1.45] text-text-2">
          Opened when a monitor reaches its failure threshold; resolved by its
          next successful check.
        </p>
      </header>

      <div role="tablist" aria-label="Filter incidents" className="flex gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={clsx(
              "rounded-(--radius) px-3 py-1 text-[13px] transition-colors duration-[var(--duration-fast)]",
              filter === f.key
                ? "bg-brand/15 font-medium text-brand-text"
                : "text-text-2 hover:bg-bg-elev hover:text-text",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} kind="line" />
          ))}
        </div>
      ) : error ? (
        <p role="alert" className="text-[13px] text-crit-text">
          Couldn&apos;t load incidents: {error.message}
        </p>
      ) : incidents.length === 0 ? (
        <p className="rounded-(--radius) border border-border bg-bg-elev p-6 text-[13px] text-text-2">
          {filter === "active" ? "No open incidents." : "No incidents."}
        </p>
      ) : (
        <section aria-label="Incident list" className="flex flex-col">
          {incidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              showMonitor
              href={`/dashboard/incidents/${incident.id}`}
              startedLabel={whenLabel(incident.started_at)}
              durationLabel={
                incident.duration_seconds === null
                  ? null
                  : durationLabel(incident.duration_seconds)
              }
            />
          ))}
        </section>
      )}
    </div>
  );
}
