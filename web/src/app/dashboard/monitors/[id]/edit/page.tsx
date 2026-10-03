"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MonitorForm } from "@/components/monitors/MonitorForm";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  useMonitorController,
  useMonitorMutations,
} from "@/controllers/monitors";

/** UpdateMonitor — sends only what changed. */
export default function EditMonitorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { monitor } = useMonitorController(id);
  const { update } = useMonitorMutations();
  const m = monitor.data;

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <header>
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard" className="hover:text-text">
            Monitors /
          </Link>{" "}
          {m && (
            <Link
              href={`/dashboard/monitors/${id}`}
              className="hover:text-text"
            >
              {m.name} /
            </Link>
          )}
        </nav>
        <h1 className="mt-1 text-[20px] font-semibold">Edit monitor</h1>
      </header>
      {monitor.loading && !m ? (
        <Skeleton kind="panel-axis" style={{ height: 320 }} />
      ) : !m ? (
        <p className="text-[13px] text-text-2">
          This monitor no longer exists.
        </p>
      ) : (
        <MonitorForm
          initial={m}
          submitLabel="Save changes"
          onCancel={() => router.push(`/dashboard/monitors/${id}`)}
          onSubmit={async (input) => {
            await update(id, {
              ...(input.name !== m.name && { name: input.name }),
              ...(input.type !== m.type && { type: input.type }),
              ...(input.target !== m.target && { target: input.target }),
              interval_seconds: input.interval_seconds ?? m.interval_seconds,
              timeout_seconds: input.timeout_seconds ?? m.timeout_seconds,
              failure_threshold: input.failure_threshold ?? m.failure_threshold,
            });
            router.push(`/dashboard/monitors/${id}`);
          }}
        />
      )}
    </div>
  );
}
