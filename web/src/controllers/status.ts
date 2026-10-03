"use client";

import { statusRepo } from "@/models/repositories";
import { useRequest } from "./use-request";

/** /status/[slug] — public, unauthenticated. */
export function useStatusPageController(slug: string) {
  return useRequest(() => statusRepo.bySlug(slug), [slug]);
}

/** /status/owner/[ownerId] — every account's page, addressed by user id. */
export function useOwnerStatusPageController(ownerId: string) {
  return useRequest(() => statusRepo.byOwner(ownerId), [ownerId]);
}
