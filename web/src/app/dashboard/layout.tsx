import { DashboardShell } from "./shell";

/**
 * /dashboard — monitors, incidents and account settings, all backed by
 * the Go backend. The shell carries the NavRail + TopBar chrome and the
 * redirect to /signin when there is no session.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardShell>{children}</DashboardShell>;
}
