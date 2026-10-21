"use client";

import { useEffect, useState } from "react";

/**
 * "● Live · updated 4s ago" — a pulsing dot plus the age of the last
 * successful refresh, ticking every second.
 */
export function LiveIndicator({ updatedAt }: { updatedAt: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const age =
    updatedAt === null
      ? null
      : Math.max(0, Math.round((now - updatedAt) / 1000));
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-text-2"
      data-testid="live-indicator"
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-2 rounded-full bg-ok" />
      </span>
      Live
      {age !== null && <span>· updated {age}s ago</span>}
    </span>
  );
}
