"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MonitorForm } from "@/components/monitors/MonitorForm";
import { useMonitorMutations } from "@/controllers/monitors";

/** CreateMonitor. */
export default function NewMonitorPage() {
  const router = useRouter();
  const { create } = useMonitorMutations();

  return (
    <div className="flex flex-col gap-5 px-6 py-5">
      <header>
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard" className="hover:text-text">
            Monitors /
          </Link>
        </nav>
        <h1 className="mt-1 text-[20px] font-semibold">New monitor</h1>
      </header>
      <MonitorForm
        submitLabel="Create monitor"
        onCancel={() => router.push("/dashboard")}
        onSubmit={async (input) => {
          const m = await create(input);
          router.push(`/dashboard/monitors/${m.id}`);
        }}
      />
    </div>
  );
}
