"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIncidentController } from "@/controllers/incidents";
import { durationLabel, whenLabel } from "@/controllers/shell";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-3 border-b border-border py-2.5 text-[13px]">
      <dt className="text-text-2">{label}</dt>
      <dd className="min-w-0 text-text">{children}</dd>
    </div>
  );
}

/** /dashboard/incidents/[id] — every field the backend records. */
export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: incident, loading } = useIncidentController(id);

  if (loading && !incident) {
    return (
      <div className="flex flex-col gap-4 px-6 py-5">
        <Skeleton kind="line" className="w-64" />
        <Skeleton kind="panel-axis" style={{ height: 160 }} />
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="flex flex-col gap-2 px-6 py-5">
        <h1 className="text-[20px] font-semibold">Incident not found</h1>
        <Link
          href="/dashboard/incidents"
          className="text-[13px] text-brand-text hover:underline"
        >
          Back to incidents
        </Link>
      </div>
    );
  }

  const active = incident.status === "active";

  return (
    <div
      className="flex max-w-[760px] flex-col gap-5 px-6 py-5"
      data-testid="incident-detail"
    >
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard/incidents" className="hover:text-text">
            Incidents /
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <span
            className={
              active
                ? "inline-flex h-5 items-center rounded-(--radius) bg-crit px-1.5 text-[11px] font-semibold text-on-brand"
                : "inline-flex h-5 items-center rounded-(--radius) bg-ok/15 px-1.5 text-[11px] font-semibold text-ok-text"
            }
          >
            {active ? "OPEN" : "RESOLVED"}
          </span>
          <h1 className="text-[24px] font-semibold">{incident.title}</h1>
        </div>
        <p className="text-[13px] text-text-2">
          {active
            ? "Resolves automatically on the monitor's next successful check."
            : `Resolved after ${durationLabel(incident.duration_seconds ?? 0)}.`}
        </p>
      </header>

      <dl>
        <Row label="Monitor">
          {incident.monitor_name ? (
            <Link
              href={`/dashboard/monitors/${incident.monitor_id}`}
              className="text-brand-text hover:underline"
            >
              {incident.monitor_name}
            </Link>
          ) : (
            <span className="text-text-2">Deleted monitor</span>
          )}
        </Row>
        <Row label="Failure reason">
          <span className="font-data break-words">
            {incident.failure_reason || "—"}
          </span>
        </Row>
        <Row label="Started">{whenLabel(incident.started_at)}</Row>
        <Row label="Resolved">
          {incident.resolved_at ? whenLabel(incident.resolved_at) : "—"}
        </Row>
        <Row label="Duration">
          {incident.duration_seconds === null
            ? "ongoing"
            : durationLabel(incident.duration_seconds)}
        </Row>
      </dl>
    </div>
  );
}
