"use client";

import { useParams } from "next/navigation";
import { StatusPageView } from "@/components/status/StatusPageView";
import { useOwnerStatusPageController } from "@/controllers/status";

/**
 * Public status page by owner id — GetStatusPage's other lookup. Every
 * account has one, with no setup; the slug route needs a StatusPage record
 * that only exists in the database.
 */
export default function OwnerStatusPage() {
  const { ownerId } = useParams<{ ownerId: string }>();
  return <StatusPageView state={useOwnerStatusPageController(ownerId)} />;
}
