import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Status — Upstat",
  description: "Live service status, uptime history and incident reports.",
};

/** Placeholder for the desktop static export (see status/[slug]). */
export function generateStaticParams() {
  return [{ ownerId: "_" }];
}

export default function OwnerStatusLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div data-theme="light" className="font-ui min-h-screen bg-bg text-text">
      {children}
    </div>
  );
}
