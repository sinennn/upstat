"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { validateMonitor } from "@/controllers/monitors";
import {
  MONITOR_DEFAULTS,
  MONITOR_TYPES,
  type Monitor,
  type MonitorInput,
  type MonitorType,
} from "@/models";

const TYPE_LABELS: Record<MonitorType, string> = {
  website: "Website",
  api: "API",
  server: "Server",
  blog: "Blog",
};

export interface MonitorFormProps {
  /** Edit mode: prefill from the monitor. */
  initial?: Monitor;
  submitLabel: string;
  onSubmit: (input: MonitorInput) => Promise<void>;
  onCancel: () => void;
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    const input: MonitorInput = {
      name: name.trim(),
      type,
      target: target.trim(),
      interval_seconds: parseSeconds(interval),
      timeout_seconds: parseSeconds(timeout),
      failure_threshold: parseSeconds(threshold),
    };
    const invalid = validateMonitor(input);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Saving failed.");
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void submit(e)}
      noValidate
      className="flex max-w-[560px] flex-col gap-5"
      data-testid="monitor-form"
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

      <Field
        id="monitor-target"
        label="URL"
        hint="Checked with an HTTP GET. 2xx and 3xx responses count as up; anything else, or no response within the timeout, counts as a failure. Failed checks are retried twice before counting."
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

      <Field
        id="monitor-type"
        label="Type"
        hint="A label for your list — every type is checked the same way."
      >
        <Select
          aria-label="Type"
          value={type}
          onValueChange={(v) => setType(v as MonitorType)}
          options={MONITOR_TYPES.map((t) => ({
            value: t,
            label: TYPE_LABELS[t],
          }))}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field id="monitor-interval" label="Check every (s)">
          <Input
            id="monitor-interval"
            type="number"
            min={1}
            value={interval}
            onChange={(e) => setIntervalSecs(e.target.value)}
            placeholder={String(MONITOR_DEFAULTS.interval_seconds)}
          />
        </Field>
        <Field id="monitor-timeout" label="Timeout (s)">
          <Input
            id="monitor-timeout"
            type="number"
            min={1}
            value={timeout}
            onChange={(e) => setTimeoutSecs(e.target.value)}
            placeholder={String(MONITOR_DEFAULTS.timeout_seconds)}
          />
        </Field>
        <Field id="monitor-threshold" label="Failures before down">
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
      <p className="-mt-2 text-[12px] leading-[1.45] text-text-2">
        Blank fields use the defaults shown. The timeout must be shorter than
        the interval. After this many consecutive failed checks the monitor goes
        down and an incident opens; the next successful check resolves it.
      </p>

      {error && (
        <p role="alert" className="text-[13px] text-crit-text">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </Button>
        <Button type="button" kind="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
