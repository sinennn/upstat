"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { getAuthProvider } from "@/auth";
import { getSessionToken } from "@/auth/session";
import type { Incident, Monitor, ProfilePatch } from "@/models";
import {
  accountRepo,
  incidentsRepo,
  monitorsRepo,
} from "@/models/repositories";
import { incidentStats } from "./incidents";
import { useCurrentUser } from "./shell";
import { useRequest } from "./use-request";

/** What the account owns, for the profile header tiles. */
export function accountSummary(
  monitors: Monitor[],
  incidents: Incident[],
  now: number,
) {
  const active = monitors.filter((m) => m.active);
  const stats = incidentStats(incidents, now);
  return {
    monitors: monitors.length,
    up: monitors.filter((m) => m.status === "up").length,
    down: monitors.filter((m) => m.status === "down").length,
    paused: monitors.length - active.length,
    muted: monitors.filter((m) => m.muted).length,
    checksPerDay: active.reduce(
      (n, m) => n + Math.floor(86_400 / Math.max(1, m.interval_seconds)),
      0,
    ),
    incidents30d: stats.inWindow,
    openIncidents: stats.open,
    mttrSeconds: stats.mttrSeconds,
  };
}

/** Issued/expiry times from the session JWT; null for opaque tokens. */
export function sessionTimes(
  token: string | null,
): { issuedAt: number | null; expiresAt: number } | null {
  const part = token?.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(
      atob(part.replace(/-/g, "+").replace(/_/g, "/")),
    ) as { exp?: number; iat?: number };
    if (typeof json.exp !== "number") return null;
    return {
      issuedAt: typeof json.iat === "number" ? json.iat * 1000 : null,
      expiresAt: json.exp * 1000,
    };
  } catch {
    return null;
  }
}

/**
 * /dashboard/settings — UserService UpdateUser / DeleteUser for the
 * signed-in user. UpdateUser returns no user, so the stored session user is
 * patched locally on success.
 */
export function useAccountController() {
  const router = useRouter();
  const user = useCurrentUser();
  const [saving, setSaving] = useState(false);

  const save = useCallback(
    async (patch: ProfilePatch) => {
      if (!user) return;
      setSaving(true);
      try {
        await accountRepo.update(user.id, patch);
        getAuthProvider().setCurrentUser({
          ...user,
          name: patch.name || user.name,
          email: patch.email || user.email,
        });
      } finally {
        setSaving(false);
      }
    },
    [user],
  );

  const deleteAccount = useCallback(async () => {
    if (!user) return;
    await accountRepo.remove(user.id);
    await getAuthProvider().signOut();
    router.push("/signin");
  }, [user, router]);

  const monitors = useRequest(() => monitorsRepo.list(), [], {
    refreshMs: 30_000,
  });
  const incidents = useRequest(() => incidentsRepo.list(), [], {
    refreshMs: 30_000,
  });
  const session = user ? sessionTimes(getSessionToken()) : null;

  const signOut = useCallback(async () => {
    await getAuthProvider().signOut();
    router.push("/signin");
  }, [router]);

  return {
    user,
    saving,
    save,
    deleteAccount,
    signOut,
    monitors,
    incidents,
    session,
  };
}
