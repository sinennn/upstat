"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearGatewaySession } from "@/auth/session";
import { ApiError } from "@/models";

export interface RequestState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | Error | null;
  /** Re-runs the fetch (controllers call this after mutations). */
  reload: () => Promise<void>;
  /** When data last arrived (ms epoch); null before the first load. */
  updatedAt: number | null;
}

export interface RequestOptions {
  /**
   * Re-fetch in the background every N ms while the tab is visible. A
   * background refresh never flips `loading` and never replaces good data
   * with an error — a blip mid-demo keeps the last known state on screen.
   */
  refreshMs?: number;
}

/**
 * Shared async-load primitive for controllers. Views never fetch — they
 * consume controller state built on this. `deps` re-triggers the load when
 * its (serialized) value changes.
 */
export function useRequest<T>(
  fn: () => Promise<T>,
  deps: unknown[] = [],
  options: RequestOptions = {},
): RequestState<T> {
  const [data, setData] = useState<T | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const seq = useRef(0);

  // Latest fetcher without re-creating the callback per render
  // (ref updated in an effect — no ref writes during render).
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const depsKey = JSON.stringify(deps);

  const run = useCallback(async (background: boolean) => {
    const id = ++seq.current;
    if (!background) {
      setLoading(true);
      setError(null);
    }
    try {
      const result = await fnRef.current();
      if (seq.current === id) {
        setData(result);
        setError(null);
        setUpdatedAt(Date.now());
      }
    } catch (e) {
      // the backend rejected the session (expired/invalid JWT): it is no
      // longer usable anywhere, so drop it and start over at sign-in
      if (e instanceof ApiError && e.status === 401) {
        clearGatewaySession();
        window.location.assign("/signin");
        return;
      }
      if (seq.current === id && !background) setError(e as Error);
    } finally {
      if (seq.current === id && !background) setLoading(false);
    }
  }, []);

  const reload = useCallback(() => run(false), [run]);

  useEffect(() => {
    // Deferred a tick: keeps setState out of the synchronous effect body
    // (no cascading renders) and guarantees fnRef is current.
    const t = setTimeout(() => {
      void reload();
    }, 0);
    return () => clearTimeout(t);
    // depsKey re-runs the load when the caller's inputs change
  }, [reload, depsKey]);

  const { refreshMs } = options;
  useEffect(() => {
    if (!refreshMs) return;
    const t = window.setInterval(() => {
      if (!document.hidden) void run(true);
    }, refreshMs);
    return () => window.clearInterval(t);
  }, [run, refreshMs, depsKey]);

  return { data, loading, error, reload, updatedAt };
}
