import type { Metadata } from "next";
import { HomeView } from "@/components/home/HomeView";
import { DesktopEntry } from "@/components/desktop/DesktopEntry";
import { env } from "@/config/env";

/**
 * / — the public landing. In the desktop app there is no marketing page:
 * it goes straight to the dashboard (which redirects to /signin without a
 * session).
 */

const TITLE = "Upstat — know the moment your site goes down";
const DESCRIPTION =
  "Open-source uptime monitoring: HTTP checks with retries, automatic incidents, public status pages and AI risk insight.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "https://upstat.cuesoft.io",
    siteName: "Upstat",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function Home() {
  return env.desktop ? <DesktopEntry /> : <HomeView />;
}
