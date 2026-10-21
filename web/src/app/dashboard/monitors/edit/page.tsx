"use client";

import { ArrowRight, BellOff, Mail, Pause, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { MonitorForm } from "@/components/monitors/MonitorForm";
import { Button } from "@/components/ui/Button";
import { LiveIndicator } from "@/components/ui/LiveIndicator";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusPill } from "@/components/ui/StatusPill";
import { Switch } from "@/components/ui/Switch";
import { useToast } from "@/components/ui/Toast";
import { UptimeCard } from "@/components/ui/UptimeCard";
import {
  monitorChanges,
  monitorPillStatus,
  monitorStatusLabel,
  useMonitorController,
} from "@/controllers/monitors";
import { useCurrentUser, whenLabel } from "@/controllers/shell";
import type { Monitor, MonitorInput } from "@/models";
import { routes } from "@/config/routes";

function Card({
  title,
  aside,
  tone = "default",
  children,
  testId,
}: {
  title: string;
  aside?: ReactNode;
  tone?: "default" | "danger";
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section
      aria-label={title}
      data-testid={testId}
      className={
        tone === "danger"
          ? "flex flex-col rounded-(--radius) border border-crit/40 bg-crit/5"
          : "flex flex-col rounded-(--radius) border border-border bg-bg-elev"
      }
    >
      <header
        className={`flex items-baseline justify-between gap-3 border-b px-4 py-3 ${tone === "danger" ? "border-crit/30" : "border-border"}`}
      >
        <h2
          className={`text-[15px] font-semibold ${tone === "danger" ? "text-crit-text" : ""}`}
        >
          {title}
        </h2>
        {aside && <div className="text-[12px] text-text-2">{aside}</div>}
      </header>
      <div className="flex flex-col gap-3 px-4 py-4">{children}</div>
    </section>
  );
}

function PendingChanges({
  saved,
  draft,
}: {
  saved: Monitor;
  draft: MonitorInput;
}) {
  const changes = monitorChanges(saved, draft);
  return (
    <Card
      title="Pending changes"
      aside={changes.length ? `${changes.length} unsaved` : "none"}
      testId="pending-changes"
    >
      {changes.length === 0 ? (
        <p className="text-[13px] text-text-2">
          Edit a field and the diff shows up here before you save.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {changes.map((c) => (
            <li key={c.field} className="flex flex-col gap-1">
              <span className="text-[11px] uppercase tracking-wide text-text-2">
                {c.field}
              </span>
              <span className="font-data flex min-w-0 items-center gap-2 text-[12.5px]">
                <span className="truncate rounded-[4px] bg-crit/10 px-1.5 py-0.5 text-crit-text line-through decoration-crit/50">
                  {c.from}
                </span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-3 shrink-0 text-text-2"
                />
                <span className="truncate rounded-[4px] bg-ok/10 px-1.5 py-0.5 text-ok-text">
                  {c.to}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-border pt-3 text-[12px] leading-[1.45] text-text-2">
        Saved changes apply from the monitor&apos;s next check — no restart, any
        worker replica picks them up.
      </p>
    </Card>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[10.5px] uppercase tracking-wide text-text-2">
        {label}
      </dt>
      <dd className="font-data truncate text-[13px] tabular-nums text-text">
        {value}
      </dd>
    </div>
  );
}

/**
 * /dashboard/monitors/edit?id= — UpdateMonitor (sends only what changed)
 * beside a live diff, current health, alert routing and a danger zone.
 */
export default function EditMonitorPage() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const toast = useToast();
  const user = useCurrentUser();
  const { monitor, history, update, remove } = useMonitorController(id);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const m = monitor.data;
  const h = history.data;

  async function act(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    try {
      await fn();
      toast({ kind: "ok", title: done });
    } catch (e) {
      toast({
        kind: "crit",
        title: e instanceof Error ? e.message : "That didn't work.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-6 py-5" data-testid="monitor-edit">
      <header className="flex flex-col gap-2">
        <nav aria-label="Breadcrumb" className="text-[12px] text-text-2">
          <Link href="/dashboard" className="hover:text-text">
            Monitors /
          </Link>{" "}
          {m && (
            <Link href={routes.monitor(id)} className="hover:text-text">
              {m.name} /
            </Link>
          )}
        </nav>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[24px] font-semibold">Edit monitor</h1>
          {m && (
            <>
              <StatusPill
                status={monitorPillStatus(m.status)}
                label={monitorStatusLabel(m.status)}
              />
              <LiveIndicator updatedAt={monitor.updatedAt} />
            </>
          )}
        </div>
        {m && (
          <p className="font-data truncate text-[13px] text-text-2">
            {m.name} · GET {m.target}
          </p>
        )}
      </header>

      {monitor.loading && !m ? (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
          <Skeleton kind="panel-axis" style={{ height: 520 }} />
          <Skeleton kind="panel-axis" style={{ height: 320 }} />
        </div>
      ) : !m ? (
        <p className="text-[13px] text-text-2">
          This monitor no longer exists.
        </p>
      ) : (
        <MonitorForm
          initial={m}
          submitLabel="Save changes"
          onCancel={() => router.push(routes.monitor(id))}
          status={(draft) => {
            const n = monitorChanges(m, draft).length;
            return n === 0
              ? "No unsaved changes"
              : `${n} unsaved change${n === 1 ? "" : "s"}`;
          }}
          onSubmit={async (input) => {
            await update({
              ...(input.name !== m.name && { name: input.name }),
              ...(input.type !== m.type && { type: input.type }),
              ...(input.target !== m.target && { target: input.target }),
              interval_seconds: input.interval_seconds ?? m.interval_seconds,
              timeout_seconds: input.timeout_seconds ?? m.timeout_seconds,
              failure_threshold: input.failure_threshold ?? m.failure_threshold,
            });
            toast({ kind: "ok", title: "Changes saved" });
            router.push(routes.monitor(id));
          }}
          aside={(draft) => (
            <>
              <PendingChanges saved={m} draft={draft} />

              <Card title="Current health" testId="current-health">
                {h ? (
                  <UptimeCard
                    name="Last 90 days"
                    days={h.days}
                    uptimePct={h.uptime_90d_pct}
                    status={monitorPillStatus(m.status)}
                    fill
                    className="w-full"
                  />
                ) : (
                  <Skeleton kind="panel-axis" style={{ height: 96 }} />
                )}
                <dl className="grid grid-cols-3 gap-3">
                  <Fact
                    label="Last check"
                    value={
                      m.last_checked_at ? whenLabel(m.last_checked_at) : "never"
                    }
                  />
                  <Fact
                    label="Status code"
                    value={
                      m.last_status_code ? String(m.last_status_code) : "—"
                    }
                  />
                  <Fact
                    label="Response"
                    value={
                      m.last_response_time_ms === null || !m.last_status_code
                        ? "—"
                        : `${m.last_response_time_ms} ms`
                    }
                  />
                </dl>
              </Card>

              <Card title="Alerts & state" aside="applies immediately">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-text">
                    <Mail aria-hidden="true" className="size-4" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-0.5 text-[13px]">
                    <span className="font-medium">
                      Email on downtime & recovery
                    </span>
                    <span className="truncate text-text-2">
                      {m.muted
                        ? "Muted — no emails are sent"
                        : user?.email
                          ? `Sent to ${user.email}`
                          : "Sent to the account owner"}
                    </span>
                  </div>
                </div>
                <label className="flex items-center gap-3 rounded-[8px] border border-border bg-bg px-3 py-2.5 text-[13px]">
                  <BellOff aria-hidden="true" className="size-4 text-text-2" />
                  <span className="flex-1">Mute notifications</span>
                  <Switch
                    checked={m.muted}
                    disabled={busy}
                    aria-label="Mute notifications"
                    onCheckedChange={(muted) =>
                      void act(
                        () => update({ muted }),
                        muted ? "Notifications muted" : "Notifications unmuted",
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-3 rounded-[8px] border border-border bg-bg px-3 py-2.5 text-[13px]">
                  <Pause aria-hidden="true" className="size-4 text-text-2" />
                  <span className="flex-1">Pause checks</span>
                  <Switch
                    checked={!m.active}
                    disabled={busy}
                    aria-label="Pause checks"
                    onCheckedChange={(paused) =>
                      void act(
                        () => update({ active: !paused }),
                        paused ? `${m.name} paused` : `${m.name} resumed`,
                      )
                    }
                  />
                </label>
              </Card>

              <Card title="Danger zone" tone="danger">
                <p className="text-[13px] leading-[1.45] text-text-2">
                  Deleting stops checks immediately. Its history and incidents
                  go with it.
                </p>
                <Button
                  kind="destructive"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                  className="w-fit"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                  Delete monitor
                </Button>
              </Card>
            </>
          )}
        />
      )}

      {m && (
        <Modal
          open={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          title={`Delete ${m.name}?`}
          variant="sm"
          footer={
            <>
              <Button kind="quiet" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                kind="destructive"
                disabled={busy}
                onClick={() =>
                  void act(async () => {
                    await remove();
                    router.push("/dashboard");
                  }, `${m.name} deleted`)
                }
              >
                Delete monitor
              </Button>
            </>
          }
        >
          <p className="text-[13px] leading-[1.45] text-text-2">
            Checks stop immediately. This can&apos;t be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
