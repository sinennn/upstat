"use client";

import { clsx } from "clsx";
import { CircleAlert, Lock, Mail, User } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AuthField, PasswordStrength } from "@/components/auth/AuthField";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { BrandMark } from "@/components/ui/BrandMark";
import { ExternalLink } from "@/components/ui/ExternalLink";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";
import { env } from "@/config/env";
import { useAuthController, type AuthMode } from "@/controllers/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  password?: string;
}

function validate(
  mode: AuthMode,
  name: string,
  email: string,
  password: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (mode === "signup" && !name.trim()) errors.name = "Enter your name.";
  if (!email.trim()) errors.email = "Enter your email.";
  else if (!EMAIL_RE.test(email.trim()))
    errors.email = "That doesn't look like an email address.";
  if (!password) errors.password = "Enter your password.";
  else if (mode === "signup" && password.length < 8)
    errors.password = "Use at least 8 characters.";
  return errors;
}

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-4 animate-spin rounded-full border-2 border-on-brand/40 border-t-on-brand motion-reduce:animate-none"
    />
  );
}

/**
 * /signin — every way in the backend supports: Google (GoogleAuth, a popup
 * on the web, the system browser on desktop), email + password (GetUser),
 * and email sign-up (CreateUser, then sign-in).
 */
export default function SignInPage() {
  const {
    mode,
    switchMode,
    signInWithGoogle,
    signInWithPassword,
    signUp,
    pending,
    loading,
    error,
  } = useAuthController();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const signup = mode === "signup";
  const googleAvailable = env.testMode || Boolean(env.googleClientId);

  function changeMode(next: AuthMode) {
    setFieldErrors({});
    switchMode(next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const errors = validate(mode, name, email, password);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    void (signup
      ? signUp(name.trim(), email.trim(), password)
      : signInWithPassword(email.trim(), password));
  }

  return (
    <AuthLayout>
      <div
        data-testid="signin-screen"
        className="flex w-full max-w-[400px] flex-col gap-7"
      >
        <div className="flex flex-col gap-5">
          <BrandMark
            wordmark
            className="gap-2.5 text-[22px] lg:hidden"
            glyphClassName="size-6"
          />
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[26px] font-semibold tracking-tight">
              {signup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-[14px] text-text-2">
              {signup
                ? "Start monitoring your first site in under a minute."
                : "Sign in to see how your services are doing."}
            </p>
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Sign in or create an account"
          className="grid grid-cols-2 rounded-[10px] border border-border bg-bg-elev p-1"
        >
          {(
            [
              ["signin", "Sign in"],
              ["signup", "Create account"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              onClick={() => changeMode(key)}
              className={clsx(
                "flex h-9 items-center justify-center rounded-[7px] text-[13px] font-medium transition-colors duration-[var(--duration-fast)]",
                mode === key
                  ? "bg-bg text-text shadow-sm"
                  : "text-text-2 hover:text-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {googleAvailable && (
          <div className="flex flex-col gap-5">
            <GoogleAuthButton
              size="lg"
              onClick={() => void signInWithGoogle()}
              loading={pending === "google"}
              disabled={loading}
            />
            {pending === "google" && env.desktop && (
              <p className="-mt-2 text-center text-[12px] text-text-2">
                Finish signing in in your browser — we&apos;ll bring you back.
              </p>
            )}
            <div
              aria-hidden="true"
              className="flex items-center gap-3 text-[12px] text-text-2"
            >
              <span className="h-px flex-1 bg-border" />
              or continue with email
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
        )}

        <form
          onSubmit={submit}
          noValidate
          className="flex flex-col gap-4"
          aria-label={signup ? "Create account" : "Sign in with email"}
        >
          {signup && (
            <AuthField
              label="Name"
              icon={User}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="Ada Lovelace"
              error={fieldErrors.name}
            />
          )}
          <AuthField
            label="Email"
            icon={Mail}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@company.com"
            error={fieldErrors.email}
          />
          <AuthField
            label="Password"
            icon={Lock}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? "Create a password" : "Your password"}
            error={fieldErrors.password}
            hint={signup ? <PasswordStrength password={password} /> : undefined}
          />

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-[8px] border border-crit/40 bg-crit/10 px-3 py-2.5 text-[13px] leading-[1.45] text-text"
            >
              <CircleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-crit-text"
              />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-brand text-[14px] font-semibold text-on-brand transition-colors duration-[var(--duration-fast)] hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending === "email" && <Spinner />}
            {pending === "email"
              ? signup
                ? "Creating account…"
                : "Signing in…"
              : signup
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <p className="text-center text-[13px] text-text-2">
          {signup ? "Already have an account? " : "New to Upstat? "}
          <button
            type="button"
            onClick={() => changeMode(signup ? "signin" : "signup")}
            className="font-medium text-brand-text hover:underline"
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p className="text-center text-[12px] leading-[1.5] text-text-2">
          By continuing you agree to the{" "}
          <ExternalLink
            href="https://terms.cuesoft.io"
            className="underline underline-offset-2 hover:text-text"
          >
            Terms
          </ExternalLink>{" "}
          and{" "}
          <ExternalLink
            href="https://privacy.cuesoft.io"
            className="underline underline-offset-2 hover:text-text"
          >
            Privacy Policy
          </ExternalLink>
          .
        </p>
      </div>
    </AuthLayout>
  );
}
