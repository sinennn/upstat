"use client";

import { useParams } from "next/navigation";
import { StatusPageView } from "@/components/status/StatusPageView";
import { useStatusPageController } from "@/controllers/status";

/** Public status page by slug (a StatusPage record on the backend). */
export default function StatusPage() {
  const { slug } = useParams<{ slug: string }>();
  return <StatusPageView state={useStatusPageController(slug)} />;
}
