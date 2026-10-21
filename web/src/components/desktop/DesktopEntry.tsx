"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/ui/BrandMark";

/**
 * The desktop app's `/` — a brief branded splash that hands straight to
 * the dashboard (which sends signed-out users to /signin).
 */
export function DesktopEntry() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <div className="font-ui flex min-h-screen items-center justify-center bg-bg text-text">
      <BrandMark
        wordmark
        className="gap-2.5 text-[26px]"
        glyphClassName="size-7"
      />
    </div>
  );
}
