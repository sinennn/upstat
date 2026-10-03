"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { getAuthProvider } from "@/auth";
import type { ProfilePatch } from "@/models";
import { accountRepo } from "@/models/repositories";
import { useCurrentUser } from "./shell";

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

  return { user, saving, save, deleteAccount };
}
