"use client";

import { useState, type FormEvent } from "react";
import { useAuthController } from "@/controllers/auth";
import { BrandMark } from "@/components/ui/BrandMark";
import { Button } from "@/components/ui/Button";
import { GoogleAuthButton } from "@/components/ui/GoogleAuthButton";
import { Input } from "@/components/ui/Input";

/**
 * /signin — the one auth route. Every sign-in the backend supports:
 * Google (GoogleAuth), email + password (GetUser), and creating an email
 * account (CreateUser, then signing in).
 */
export default function SignInPage() {
  const {
    mode,
    switchMode,
    signInWithGoogle,
    signInWithPassword,
    signUp,
    loading,
    error,
  } = useAuthController();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const signup = mode === "signup";

  function submit(e: FormEvent) {
    e.preventDefault();
    if ((signup && !name.trim()) || !email.trim() || !password) {
      setFormError(
        signup
          ? "Name, email and password are all required."
          : "Enter your email and password.",
      );
      return;
    }
    setFormError(null);
    void (signup
      ? signUp(name.trim(), email.trim(), password)
      : signInWithPassword(email.trim(), password));
  }

  const message = formError ?? error;

  return (
    <div
      data-testid="signin-screen"
      className="font-ui flex min-h-screen items-center justify-center bg-bg px-[var(--space-4)] py-10 text-text"
    >
      <main className="flex w-full max-w-[360px] flex-col items-center gap-[var(--space-6)] text-center">
        <header className="flex flex-col items-center gap-[var(--space-3)]">
          <BrandMark
            wordmark
            className="gap-2.5 text-[26px]"
            glyphClassName="size-7"
          />
          <h1 className="text-[14px] font-normal leading-[1.45] text-text-2">
            {signup ? "Create your account" : "Sign in to your account"}
          </h1>
        </header>

        <GoogleAuthButton
          onClick={() => void signInWithGoogle()}
          disabled={loading}
          className="w-full max-w-[280px]"
        />

        <div
          aria-hidden="true"
          className="flex w-full max-w-[280px] items-center gap-3 text-[12px] text-text-2"
        >
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <form
          onSubmit={submit}
          noValidate
          className="flex w-full max-w-[280px] flex-col gap-3 text-left"
          aria-label={signup ? "Create account" : "Sign in with email"}
        >
          {signup && (
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Name
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Email
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Password
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={signup ? "new-password" : "current-password"}
            />
          </label>
          <Button type="submit" disabled={loading} className="mt-1 w-full">
            {loading
              ? signup
                ? "Creating account…"
                : "Signing in…"
              : signup
                ? "Create account"
                : "Sign in"}
          </Button>
        </form>

        {message && (
          <p role="alert" className="text-[13px] leading-[1.45] text-crit">
            {message}
          </p>
        )}

        <p className="text-[13px] text-text-2">
          {signup ? "Already have an account? " : "New to Upstat? "}
          <button
            type="button"
            onClick={() => {
              setFormError(null);
              switchMode(signup ? "signin" : "signup");
            }}
            className="font-medium text-brand-text hover:underline"
          >
            {signup ? "Sign in" : "Create an account"}
          </button>
        </p>

        <p className="text-[13px] leading-[1.45] text-text-2">
          By continuing you agree to the{" "}
          <a
            href="https://terms.cuesoft.io"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href="https://privacy.cuesoft.io"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
          >
            Privacy Policy
          </a>
          .
        </p>
      </main>
    </div>
  );
}
