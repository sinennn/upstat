"use client";

/**
 * App-shell controller — the signed-in user (and the redirect to /signin
 * without one), sign-out, and the active-incident banner.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { notifyNative } from "@/desktop/bridge";
import { getAuthProvider, type AuthUser } from "@/auth";
import { incidentsRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

export function ageLabel(iso: string, now = Date.now()): string {
  const min = Math.max(Math.round((now - Date.parse(iso)) / 60_000), 0);
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Recent → `25m ago`; older than a day → `2 Oct, 14:05 UTC`. */
export function whenLabel(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  if (now - ms < 24 * 3_600_000) return `${ageLabel(iso, now)} ago`;
  return new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
}

/** `2700` → `45m`, `5400` → `1h 30m`. */
export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h < 24) return m === 0 ? `${h}h` : `${h}h ${m}m`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh === 0 ? `${d}d` : `${d}d ${rh}h`;
}

/**
 * The session lives in browser storage, so it is read post-mount (SSR and
 * hydration render without it). `undefined` = not read yet.
 */
export function useCurrentUser(): AuthUser | null | undefined {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  useEffect(() => {
    const t = window.setTimeout(() => {
      setUser(getAuthProvider().currentUser());
    }, 0);
    return () => window.clearTimeout(t);
  }, []);
  return user;
}

export function useShellController() {
  const router = useRouter();
  const user = useCurrentUser();

  // every /dashboard RPC needs the session — without one, sign in first
  useEffect(() => {
    if (user === null) router.replace("/signin");
  }, [user, router]);

  const incidents = useRequest(
    // null (not []) before the session is read, so the alert baseline
    // below is only ever taken from a real incident list
    () => (user ? incidentsRepo.list() : Promise.resolve(null)),
    [user?.id ?? null],
    { refreshMs: 10_000 },
  );
  const active = (incidents.data ?? []).filter((i) => i.status === "active");

  // Announce incidents opening/resolving between polls, on whatever page
  // is open. The first load only establishes the baseline.
  const toast = useToast();
  const seen = useRef<Map<string, string> | null>(null);
  useEffect(() => {
    const list = incidents.data;
    if (!list) return;
    const prev = seen.current;
    seen.current = new Map(list.map((i) => [i.id, i.status]));
    if (!prev) return;
    for (const i of list) {
      const was = prev.get(i.id);
      const name = i.monitor_name ?? "A monitor";
      // in-page toast everywhere; a native OS notification in the desktop
      // app (it fires even when the window is in the background)
      if (i.status === "active" && was === undefined) {
        const title = `${name} is down`;
        toast({ kind: "crit", title, body: i.failure_reason });
        void notifyNative(title, i.failure_reason);
      } else if (i.status === "resolved" && was === "active") {
        const title = `${name} recovered`;
        const body =
          i.duration_seconds === null
            ? undefined
            : `Down for ${durationLabel(i.duration_seconds)}.`;
        toast({ kind: "ok", title, body });
        void notifyNative(title, body);
      }
    }
  }, [incidents.data, toast]);

  // the tab title carries the outage count — visible from any tab
  useEffect(() => {
    const base = document.title.replace(/^\(\d+ down\) /, "");
    document.title =
      active.length > 0 ? `(${active.length} down) ${base}` : base;
  }, [active.length]);

  const signOut = useCallback(async () => {
    await getAuthProvider().signOut();
    router.push("/signin");
  }, [router]);

  return { user, activeIncidents: active, signOut };
}
