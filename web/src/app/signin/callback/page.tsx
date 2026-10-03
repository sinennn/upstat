"use client";

import { useGoogleCallbackController } from "@/controllers/auth";
import { BrandMark } from "@/components/ui/BrandMark";

/**
 * /signin/callback — the Google sign-in popup's redirect target. It hands
 * the ID token back to the /signin tab and closes; it is never navigated to
 * directly. Same frame as /signin so the popup never flashes unbranded.
 */
export default function SignInCallbackPage() {
  const { failed } = useGoogleCallbackController();

  return (
    <div
      data-testid="signin-callback"
      className="font-ui flex min-h-screen items-center justify-center bg-bg px-[var(--space-4)] text-text"
    >
      <main className="flex w-full max-w-[360px] flex-col items-center gap-[var(--space-6)] text-center">
        <BrandMark
          wordmark
          className="gap-2.5 text-[26px]"
          glyphClassName="size-7"
        />
        {failed ? (
          <p role="alert" className="text-[13px] leading-[1.45] text-crit">
            Sign-in was not completed. Close this window and try again.
          </p>
        ) : (
          <p className="text-[13px] leading-[1.45] text-text-2">
            Signing you in…
          </p>
        )}
      </main>
    </div>
  );
}
