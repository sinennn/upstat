"use client";

/**
 * /dashboard shell — NavRail (Monitors · Incidents · Settings), the TopBar
 * (account + sign out) and the banner while any incident is open. Renders
 * nothing until the session is read; without one it redirects to /signin.
 */

import { usePathname, useRouter } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { IncidentBanner } from "@/components/ui/IncidentBanner";
import { NavRail } from "@/components/ui/NavRail";
import SkipLink from "@/components/ui/SkipLink";
import { TopBar } from "@/components/ui/TopBar";
import { ageLabel, useShellController } from "@/controllers/shell";

/** NavRail key → route. */
export const SECTION_ROUTES: Record<string, string> = {
  monitors: "/dashboard",
  incidents: "/dashboard/incidents",
  settings: "/dashboard/settings",
};

function activeKeyFor(pathname: string): string {
  if (pathname.startsWith("/dashboard/incidents")) return "incidents";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  return "monitors";
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const shell = useShellController();

  // hold the frame empty until the session is known (and while the
  // redirect to /signin happens) — no flash of a signed-out dashboard
  if (!shell.user) {
    return <div className="font-ui h-dvh bg-bg" aria-busy="true" />;
  }

  const open = shell.activeIncidents;
  const first = open[0];

  return (
    <div className="font-ui flex h-dvh bg-bg text-text">
      <SkipLink />
      <NavRail
        activeKey={activeKeyFor(pathname)}
        hrefFor={(key) => SECTION_ROUTES[key] ?? "/dashboard"}
        userName={shell.user.name}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          email={shell.user.email}
          onSignOut={() => void shell.signOut()}
        />

        {first && (
          <IncidentBanner
            title={
              open.length === 1
                ? first.title
                : `${open.length} monitors are down`
            }
            age={ageLabel(first.started_at)}
            onClick={() =>
              router.push(
                open.length === 1
                  ? `/dashboard/incidents/${first.id}`
                  : "/dashboard/incidents",
              )
            }
          />
        )}

        <main
          id="main"
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto"
        >
          <Suspense fallback={null}>{children}</Suspense>
        </main>
      </div>
    </div>
  );
}
