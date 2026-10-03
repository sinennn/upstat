"use client";

import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";
import { IncidentRow } from "@/components/ui/IncidentRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPageComponentRow } from "@/components/ui/StatusPageComponentRow";
import { StatusPageHeader } from "@/components/ui/StatusPageHeader";
import type { RequestState } from "@/controllers/use-request";
import { monitorPillStatus, monitorStatusLabel } from "@/controllers/monitors";
import { durationLabel, whenLabel } from "@/controllers/shell";
import type { StatusPage } from "@/models";

/**
 * Public status page body — what GetStatusPage returns: every monitor of
 * the owner with its 90-day strip, the 24h aggregate uptime, open
 * incidents and up to 50 resolved ones. Unauthenticated, so it never links
 * into the dashboard and never shows monitor targets.
 */
export function StatusPageView({ state }: { state: RequestState<StatusPage> }) {
  const { data: page, loading, error } = state;

  if (loading) {
    return (
      <main className="mx-auto flex w-full max-w-[960px] flex-col gap-4 px-6 py-10">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 220 }} />
      </main>
    );
  }

  if (error || !page) {
    return (
      <main className="font-ui flex min-h-screen flex-col items-center justify-center gap-4 bg-bg px-6 text-text">
        <p className="font-data text-[13px] text-text-2">404</p>
        <h1 className="text-[24px] font-semibold">Status page not found</h1>
        <p className="max-w-[420px] text-center text-[13px] leading-[1.45] text-text-2">
          No status page exists at this address.
        </p>
        <Link
          href="/"
          className="rounded-(--radius) bg-brand px-4 py-2 text-[13px] font-medium text-on-brand transition-colors duration-[var(--duration-fast)] hover:bg-brand-deep"
        >
          Go to upstat.cuesoft.io
        </Link>
      </main>
    );
  }

  return (
    <main
      data-testid="status-page"
      className="mx-auto flex w-full max-w-[960px] flex-col gap-6 px-6 py-10"
    >
      <header className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-[24px] font-semibold">
          <BrandMark glyphClassName="size-6" />
          {page.name} status
        </h1>
        <p className="text-[13px] leading-[1.45] text-text-2">
          {page.uptime_pct === null
            ? "No checks in the last 24 hours."
            : `${page.uptime_pct.toFixed(2)}% uptime over the last 24 hours · ${page.successful_checks.toLocaleString()} of ${page.total_checks.toLocaleString()} checks passed`}
        </p>
      </header>

      <StatusPageHeader
        overall={page.overall}
        lastUpdated={page.updated_at}
        updatedFormat="relative"
        updatedPlacement="banner"
      />

      {page.active_incidents.length > 0 && (
        <section aria-labelledby="active-heading" className="flex flex-col">
          <h2 id="active-heading" className="mb-2 text-[16px] font-semibold">
            Ongoing incidents
          </h2>
          {page.active_incidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              showReason={false}
              startedLabel={whenLabel(incident.started_at)}
              durationLabel={null}
            />
          ))}
        </section>
      )}

      <section aria-labelledby="components-heading">
        <h2 id="components-heading" className="mb-2 text-[16px] font-semibold">
          Services
        </h2>
        {page.components.length === 0 ? (
          <p className="text-[13px] text-text-2">No services are monitored.</p>
        ) : (
          <ul aria-label="Services" className="flex flex-col gap-2">
            {page.components.map((component) => (
              <li key={component.monitor_id}>
                <StatusPageComponentRow
                  name={component.name}
                  status={monitorPillStatus(component.status)}
                  statusLabel={monitorStatusLabel(component.status)}
                  days={component.days}
                  uptimePct={component.uptime_pct}
                  layout="inline"
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="past-heading" className="flex flex-col">
        <h2 id="past-heading" className="mb-2 text-[16px] font-semibold">
          Past incidents
        </h2>
        {page.past_incidents.length === 0 ? (
          <p className="text-[13px] leading-[1.45] text-text-2">
            No resolved incidents.
          </p>
        ) : (
          page.past_incidents.map((incident) => (
            <IncidentRow
              key={incident.id}
              incident={incident}
              showReason={false}
              startedLabel={whenLabel(incident.started_at)}
              durationLabel={
                incident.duration_seconds === null
                  ? null
                  : durationLabel(incident.duration_seconds)
              }
            />
          ))
        )}
      </section>

      <footer className="border-t border-border pt-4 text-[12px] text-text-2">
        Powered by upstat
      </footer>
    </main>
  );
}
