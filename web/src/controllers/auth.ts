"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthProvider } from "@/auth";
import { reportGoogleCallback } from "@/auth/google-callback";
import { ApiError } from "@/models";

export type AuthMode = "signin" | "signup";

/**
 * Human copy for the backend's auth rejections. The messages come from
 * user_service.go; they are rephrased only where the raw text would
 * confuse (e.g. GetUser's "user not found" on a sign-in form).
 */
export function authErrorCopy(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "not_found":
      case "unauthenticated":
        return "Incorrect email or password.";
      case "already_exists":
        return "An account with this email already exists. Sign in instead.";
      case "bad_shape":
        return "Name, email and password are all required.";
      case "unavailable":
        return "Can't reach the Upstat backend. Try again in a moment.";
    }
    return e.message;
  }
  if (e instanceof Error) {
    if (e.message === "popup_blocked")
      return "Your browser blocked the Google window. Allow pop-ups and try again.";
    if (e.message === "sign_in_timeout" || e.message === "access_denied")
      return "Google sign-in was not completed.";
    if (e.message === "state_mismatch")
      return "That sign-in reply didn't match this attempt. Please try again.";
    return e.message;
  }
  return "Sign-in failed. Please try again.";
}

/**
 * /signin — Google, email + password sign-in, and email sign-up
 * (UserService GoogleAuth / GetUser / CreateUser).
 */
export function useAuthController() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("signin");
  // which method is in flight, so only its button shows progress
  const [pending, setPending] = useState<"google" | "email" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (method: "google" | "email", attempt: () => Promise<unknown>) => {
      setPending(method);
      setError(null);
      try {
        await attempt();
        router.push("/dashboard");
      } catch (e) {
        setError(authErrorCopy(e));
        setPending(null);
      }
    },
    [router],
  );

  const signInWithGoogle = useCallback(
    () => run("google", () => getAuthProvider().signInWithGoogle()),
    [run],
  );

  const signInWithPassword = useCallback(
    (email: string, password: string) =>
      run("email", () => getAuthProvider().signInWithPassword(email, password)),
    [run],
  );

  const signUp = useCallback(
    (name: string, email: string, password: string) =>
      run("email", () => getAuthProvider().signUp(name, email, password)),
    [run],
  );

  const switchMode = useCallback((next: AuthMode) => {
    setMode(next);
    setError(null);
  }, []);

  return {
    mode,
    switchMode,
    signInWithGoogle,
    signInWithPassword,
    signUp,
    pending,
    loading: pending !== null,
    error,
  };
}

/**
 * /signin/callback — the Google popup lands here, reports the ID token to
 * the signing-in tab, and closes itself. `failed` keeps the window open
 * with copy when Google returned an error.
 */
export function useGoogleCallbackController() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const message = reportGoogleCallback(window.location.hash);
      if (message.error) setFailed(true);
      else window.close();
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  return { failed };
}
