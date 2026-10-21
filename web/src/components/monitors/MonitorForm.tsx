"use client";

import { clsx } from "clsx";
import {
  Braces,
  Clock,
  Globe,
  Lock,
  Newspaper,
  Server,
  ShieldAlert,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { durationLabel } from "@/controllers/shell";
import { scheduleSummary, validateMonitor } from "@/controllers/monitors";
import {
  MONITOR_DEFAULTS,
  MONITOR_TYPES,
  type Monitor,
  type MonitorInput,
  type MonitorType,
} from "@/models";

const TYPES: Record<MonitorType, { label: string; icon: LucideIcon }> = {
  website: { label: "Website", icon: Globe },
  api: { label: "API", icon: Braces },
  server: { label: "Server", icon: Server },
  blog: { label: "Blog", icon: Newspaper },
};

const INTERVAL_PRESETS = [
  { s: 30, label: "30s" },
  { s: 60, label: "1m" },
  { s: 300, label: "5m" },
  { s: 900, label: "15m" },
];

export interface MonitorFormProps {
  /** Edit mode: prefill from the monitor. */
  initial?: Monitor;
  submitLabel: string;
  onSubmit: (input: MonitorInput) => Promise<void>;
  onCancel: () => void;
  /** Right-hand column, rendered from the live draft (≥xl beside the form). */
  aside?: (draft: MonitorInput) => ReactNode;
  /** Shown in the sticky footer, e.g. "2 unsaved changes". */
  status?: (draft: MonitorInput) => ReactNode;
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        {label}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-[12px] leading-[1.45] text-text-2">
          {hint}
        </p>
      )}
    </div>
  );
}

function Section({
  step,
  icon: Icon,
  title,
  description,
  children,
}: {
  step: number;
  icon: LucideIcon;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex flex-col rounded-(--radius) border border-border bg-bg-elev"
    >
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand-text">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[15px] font-semibold">
            <span className="font-data mr-1.5 text-text-2">{step}.</span>
            {title}
          </h2>
          <p className="text-[12.5px] leading-[1.45] text-text-2">
            {description}
          </p>
        </div>
      </header>
      <div className="flex flex-col gap-5 px-5 py-5">{children}</div>
    </section>
  );
}

/** The request the worker will send, as a terminal-style preview. */
function RequestPreview({
  target,
  timeout,
}: {
  target: string;
  timeout: number;
}) {
  let url: URL | null = null;
  try {
    url = new URL(target.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") url = null;
  } catch {
    url = null;
  }

  return (
    <div
      className="font-data overflow-hidden rounded-[8px] border border-border bg-bg text-[12px] leading-[1.6]"
      data-testid="request-preview"
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-1.5 text-[11px] text-text-2">
        <span>request preview</span>
        {url &&
          (url.protocol === "https:" ? (
            <span className="flex items-center gap-1 text-ok-text">
              <Lock aria-hidden="true" className="size-3" /> TLS
            </span>
          ) : (
            <span className="flex items-center gap-1 text-warn-text">
              <ShieldAlert aria-hidden="true" className="size-3" /> plain HTTP
            </span>
          ))}
      </div>
      {url ? (
        <pre className="overflow-x-auto px-3 py-2 text-text">
          <span className="text-brand-text">GET</span>{" "}
          {url.pathname + url.search} HTTP/1.1{"\n"}
          <span className="text-text-2">Host:</span> {url.host}
          {"\n"}
          <span className="text-text-2">User-Agent:</span> Upstat-Monitor
          {"\n\n"}
          <span className="text-text-2">
            # 2xx/3xx within {timeout}s → up · else retried twice, then a
            failure
          </span>
        </pre>
      ) : (
        <p className="px-3 py-2 text-text-2">
          Enter a full http(s) URL to preview the check.
        </p>
      )}
    </div>
  );
}

/** threshold failed checks → incident; the visual for "Failures before down". */
function DetectionTimeline({
  interval,
  timeout,
  threshold,
}: {
  interval: number;
  timeout: number;
  threshold: number;
}) {
  const sum = scheduleSummary(interval, timeout, threshold);
  const shown = Math.min(threshold, 8);
  return (
    <div
      className="flex flex-col gap-4 rounded-[8px] border border-border bg-bg p-4"
      data-testid="detection-timeline"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] font-medium uppercase tracking-wide text-text-2">
          If it goes down
        </span>
        <span className="font-data text-[12px] tabular-nums text-text-2">
          detected in {durationLabel(sum.detectBestSeconds)}–
          {durationLabel(sum.detectWorstSeconds)}
        </span>
      </div>
      <ol className="flex items-start" aria-label="Detection timeline">
        {Array.from({ length: shown }, (_, i) => (
          <li
            key={i}
            className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
          >
            <div className="flex w-full items-center">
              <span
                className={clsx(
                  "h-px flex-1",
                  i === 0 ? "bg-transparent" : "bg-crit/40",
                )}
              />
              <span className="flex size-6 items-center justify-center rounded-full border border-crit/50 bg-crit/15 text-[10px] font-semibold text-crit-text">
                ✕
              </span>
              <span className="h-px flex-1 bg-crit/40" />
            </div>
            <span className="font-data text-[10.5px] tabular-nums text-text-2">
              +{durationLabel(i * interval)}
            </span>
          </li>
        ))}
        <li className="flex min-w-0 flex-[1.4] flex-col items-center gap-1.5">
          <div className="flex w-full items-center">
            <span className="h-px flex-1 bg-crit/40" />
            <span className="rounded-full bg-crit px-2 py-1 text-[10.5px] font-semibold text-white">
              DOWN
            </span>
            <span className="h-px flex-1 bg-transparent" />
          </div>
          <span className="text-center text-[10.5px] leading-tight text-text-2">
            incident + email
          </span>
        </li>
      </ol>
      {threshold > shown && (
        <p className="-mt-2 text-[11px] text-text-2">
          …{threshold - shown} more failures not drawn
        </p>
      )}
      <dl className="grid grid-cols-3 gap-3 border-t border-border pt-3">
        {[
          ["Checks / day", sum.checksPerDay.toLocaleString("en-US")],
          ["Requests / month", sum.requestsPerMonth.toLocaleString("en-US")],
          ["Recovery", "next passing check"],
        ].map(([k, v]) => (
          <div key={k} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-[10.5px] uppercase tracking-wide text-text-2">
              {k}
            </dt>
            <dd className="font-data truncate text-[13px] tabular-nums text-text">
              {v}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** Empty string → undefined (backend default); otherwise the integer. */
function parseSeconds(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/**
 * Create / edit a monitor — exactly the fields CreateMonitorRequest and
 * UpdateMonitorRequest carry. Blank numbers take the backend defaults.
 */
export function MonitorForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
  aside,
  status,
}: MonitorFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState<MonitorType>(initial?.type ?? "website");
  const [target, setTarget] = useState(initial?.target ?? "");
  const [interval, setIntervalSecs] = useState(
    initial ? String(initial.interval_seconds) : "",
  );
  const [timeout, setTimeoutSecs] = useState(
    initial ? String(initial.timeout_seconds) : "",
  );
  const [threshold, setThreshold] = useState(
    initial ? String(initial.failure_threshold) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const draft: MonitorInput = {
    name: name.trim(),
    type,
    target: target.trim(),
    interval_seconds: parseSeconds(interval),
    timeout_seconds: parseSeconds(timeout),
    failure_threshold: parseSeconds(threshold),
  };
  const effective = {
    interval: draft.interval_seconds || MONITOR_DEFAULTS.interval_seconds,
    timeout: draft.timeout_seconds || MONITOR_DEFAULTS.timeout_seconds,
    threshold: draft.failure_threshold || MONITOR_DEFAULTS.failure_threshold,
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    const invalid = validateMonitor(draft);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed.");
      setSubmitting(false);
    }
  }

  const form = (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex min-w-0 flex-col gap-5"
      data-testid="monitor-form"
    >
      <Section
        step={1}
        icon={Tag}
        title="Identity"
        description="How this monitor appears in your list, alerts and status page."
      >
        <Field id="monitor-name" label="Name">
          <Input
            id="monitor-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Website"
            autoComplete="off"
          />
        </Field>
        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
          <legend className="mb-1.5 text-[13px] font-medium text-text">
            Type
          </legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MONITOR_TYPES.map((t) => {
              const { label, icon: Icon } = TYPES[t];
              const on = t === type;
              return (
                <label
                  key={t}
                  className={clsx(
                    "flex cursor-pointer items-center gap-2 rounded-[8px] border px-3 py-2.5 text-[13px] transition-colors duration-[var(--duration-fast)]",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand",
                    on
                      ? "border-brand bg-brand/10 font-medium text-text"
                      : "border-border bg-bg text-text-2 hover:border-text-2/60 hover:text-text",
                  )}
                >
                  <input
                    type="radio"
                    name="monitor-type"
                    value={t}
                    checked={on}
                    onChange={() => setType(t)}
                    className="sr-only"
                  />
                  <Icon
                    aria-hidden="true"
                    className={clsx("size-4", on && "text-brand-text")}
                  />
                  {label}
                </label>
              );
            })}
          </div>
          <p className="text-[12px] text-text-2">
            A label for your list — every type is checked the same way.
          </p>
        </fieldset>
      </Section>

      <Section
        step={2}
        icon={Globe}
        title="Endpoint"
        description="The URL the worker fleet requests on every check."
      >
        <Field
          id="monitor-target"
          label="URL"
          hint="2xx and 3xx responses count as up; anything else, or no response within the timeout, counts as a failure."
        >
          <Input
            id="monitor-target"
            mono
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="https://example.com/health"
            inputMode="url"
            autoComplete="off"
            aria-describedby="monitor-target-hint"
          />
        </Field>
        <RequestPreview target={target} timeout={effective.timeout} />
      </Section>

      <Section
        step={3}
        icon={Clock}
        title="Schedule & alerting"
        description="How often to check, how long to wait, and how many failures make an outage."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field
            id="monitor-interval"
            label="Check every (s)"
            hint={
              <span className="flex flex-wrap gap-1.5">
                {INTERVAL_PRESETS.map((p) => (
                  <button
                    key={p.s}
                    type="button"
                    onClick={() => setIntervalSecs(String(p.s))}
                    aria-label={`Set interval to ${p.label}`}
                    className={clsx(
                      "font-data rounded-full border px-2 py-0.5 text-[11px] transition-colors duration-[var(--duration-fast)]",
                      effective.interval === p.s
                        ? "border-brand bg-brand/10 text-brand-text"
                        : "border-border text-text-2 hover:text-text",
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </span>
            }
          >
            <Input
              id="monitor-interval"
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setIntervalSecs(e.target.value)}
              placeholder={String(MONITOR_DEFAULTS.interval_seconds)}
            />
          </Field>
          <Field
            id="monitor-timeout"
            label="Timeout (s)"
            hint="Must be below the interval."
          >
            <Input
              id="monitor-timeout"
              type="number"
              min={1}
              value={timeout}
              onChange={(e) => setTimeoutSecs(e.target.value)}
              placeholder={String(MONITOR_DEFAULTS.timeout_seconds)}
            />
          </Field>
          <Field
            id="monitor-threshold"
            label="Failures before down"
            hint="Consecutive failed checks."
          >
            <Input
              id="monitor-threshold"
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={String(MONITOR_DEFAULTS.failure_threshold)}
            />
          </Field>
        </div>
        <DetectionTimeline {...effective} />
        <p className="text-[12px] leading-[1.45] text-text-2">
          Blank fields use the defaults shown. After this many consecutive
          failed checks the monitor goes down and an incident opens; the next
          successful check resolves it.
        </p>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-(--radius) border border-border bg-bg/90 px-4 py-3 backdrop-blur">
        {error ? (
          <p role="alert" className="min-w-0 flex-1 text-[13px] text-crit-text">
            {error}
          </p>
        ) : (
          <div className="min-w-0 flex-1 text-[12.5px] text-text-2">
            {status?.(draft)}
          </div>
        )}
        <Button type="button" kind="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );

  if (!aside) return <div className="max-w-[760px]">{form}</div>;

  return (
    <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,1fr)]">
      {form}
      <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-4">
        {aside(draft)}
      </aside>
    </div>
  );
}
