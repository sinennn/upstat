"use client";

import { clsx } from "clsx";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";

export interface AuthFieldProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "id"
> {
  label: string;
  icon: LucideIcon;
  /** Inline error under the field; also marks it invalid. */
  error?: string | null;
  /** Hint under the field when there is no error. */
  hint?: React.ReactNode;
}

/**
 * Auth-screen text field: 44px tall, leading icon, label above, inline
 * error below. Password fields get a show/hide toggle.
 */
export function AuthField({
  label,
  icon: Icon,
  error,
  hint,
  type = "text",
  className,
  ...rest
}: AuthFieldProps) {
  const id = useId();
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[13px] font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <Icon
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-2"
        />
        <input
          id={id}
          type={isPassword && reveal ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={clsx(
            "font-ui h-11 w-full rounded-[8px] border bg-bg pl-9 text-[14px] text-text",
            isPassword ? "pr-10" : "pr-3",
            "placeholder:text-text-2/70",
            "transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-standard",
            "focus:outline-none",
            error
              ? "border-crit ring-1 ring-crit"
              : "border-border hover:border-text-2/60 focus:border-brand focus:ring-2 focus:ring-brand/25",
          )}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setReveal((v) => !v)}
            aria-label={reveal ? "Hide password" : "Show password"}
            aria-pressed={reveal}
            className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[6px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev hover:text-text"
          >
            {reveal ? (
              <EyeOff aria-hidden="true" className="size-4" />
            ) : (
              <Eye aria-hidden="true" className="size-4" />
            )}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-[12px] text-crit-text">
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="text-[12px] text-text-2">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

/** 0–4 from length and character variety — a nudge, not a policy. */
export function passwordScore(pw: string): number {
  if (!pw) return 0;
  let score = pw.length >= 8 ? 1 : 0;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  return Math.max(score, 1);
}

const STRENGTH = ["", "Weak", "Fair", "Good", "Strong"];
const BAR = ["", "bg-crit", "bg-warn", "bg-ok", "bg-ok"];

export function PasswordStrength({ password }: { password: string }) {
  const score = passwordScore(password);
  if (!password) return <span>At least 8 characters.</span>;
  return (
    <span className="flex items-center gap-2" aria-live="polite">
      <span className="flex flex-1 gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={clsx(
              "h-1 flex-1 rounded-full",
              i <= score ? BAR[score] : "bg-border",
            )}
          />
        ))}
      </span>
      <span className="w-12 text-right">{STRENGTH[score]}</span>
    </span>
  );
}
