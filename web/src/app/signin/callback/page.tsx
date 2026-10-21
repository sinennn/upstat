"use client";

import { CircleAlert, Zap } from "lucide-react";
import { useGoogleCallbackController } from "@/controllers/auth";

/**
 * /signin/callback — the Google sign-in popup's redirect target. It hands
 * the ID token back to the /signin tab and closes; it is never navigated to
 * directly.
 */
export default function SignInCallbackPage() {
  const { failed } = useGoogleCallbackController();

  return (
    <div
      data-testid="signin-callback"
      className="font-ui flex min-h-screen items-center justify-center bg-bg px-5 text-text"
    >
      <main className="flex w-full max-w-[360px] flex-col items-center gap-4 rounded-[14px] border border-border bg-bg-elev px-8 py-10 text-center">
        {failed ? (
          <CircleAlert aria-hidden="true" className="size-10 text-crit-text" />
        ) : (
          <span className="relative flex size-12 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-brand/20 motion-reduce:animate-none" />
            <Zap
              aria-hidden="true"
              fill="currentColor"
              strokeWidth={0}
              className="relative size-8 text-brand"
            />
          </span>
        )}
        <h1 className="text-[18px] font-semibold">
          {failed ? "Sign-in was not completed" : "Signing you in…"}
        </h1>
        <p
          role={failed ? "alert" : undefined}
          className="text-[13px] leading-[1.5] text-text-2"
        >
          {failed
            ? "Close this window and try again."
            : "This window will close on its own."}
        </p>
      </main>
    </div>
  );
}
