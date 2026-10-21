"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MonitorForm } from "@/components/monitors/MonitorForm";
import { useToast } from "@/components/ui/Toast";
import { useMonitorMutations } from "@/controllers/monitors";
import { routes } from "@/config/routes";

/** CreateMonitor. */
export default function NewMonitorPage() {
  const router = useRouter();
  const toast = useToast();
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
          toast({
            kind: "ok",
            title: `${m.name} created`,
            body: `First check within ${m.interval_seconds}s.`,
          });
          router.push(routes.monitor(m.id));
        }}
      />
    </div>
  );
}
