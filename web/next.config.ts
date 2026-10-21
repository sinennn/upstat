import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * One config file for the whole stack: also read the repo-root .env (the
 * one docker compose uses), so NEXT_PUBLIC_GOOGLE_CLIENT_ID etc. reach
 * `npm run dev` and the desktop build. Variables already in the
 * environment (CI, TEST_MODE runs, compose build args) win.
 *
 * Parsed by hand on purpose: Next's own `loadEnvConfig` caches its first
 * call (web/), so calling it again for the root silently loads nothing.
 */
function loadRootEnv(file: string): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
loadRootEnv(path.resolve(__dirname, "..", ".env"));

// DESKTOP=1 → a static export (`out/`) for the Tauri shell to load from
// disk; otherwise the standalone server build the Docker image runs.
const desktop = process.env.DESKTOP === "1";

const nextConfig: NextConfig = {
  output: desktop ? "export" : "standalone",
  // The dev indicator's default bottom-LEFT position sits exactly on the
  // expandable rail's foot toggle ([Directive 2026-07-19]) — it intercepts
  // pointer events over the collapsed-rail chevron (dev + e2e). Bottom-right
  // is empty app chrome.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
