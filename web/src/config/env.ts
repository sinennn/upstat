/**
 * Build-time public config (NEXT_PUBLIC_* are inlined at build time).
 */
export const env = {
  /** gRPC-Web endpoint (Envoy) in front of api/common. */
  envoyUrl: process.env.NEXT_PUBLIC_ENVOY_URL || "http://localhost:2002",
  /**
   * TEST_MODE (`NEXT_PUBLIC_TEST_MODE=1`): the gRPC transport talks to the
   * in-memory fake backend (models/repositories/grpc/fake-backend.ts) instead
   * of Envoy, and the Google button signs in without a Google popup. Used by
   * unit/e2e runs and for UI work without a backend.
   */
  testMode: process.env.NEXT_PUBLIC_TEST_MODE === "1",
  /**
   * Google OAuth web client id for the sign-in popup (auth/gateway.ts).
   * Must equal the backend's GOOGLE_CLIENT_ID — the gateway checks the ID
   * token's audience against it. Unused in TEST_MODE.
   */
  googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  /**
   * Desktop build (`npm run build:desktop`, NEXT_PUBLIC_DESKTOP=1): a static
   * export loaded by the Tauri shell (web/src-tauri). No landing page;
   * Google sign-in uses the system browser + a loopback redirect; public
   * pages open in the system browser at `webUrl`.
   */
  desktop: process.env.NEXT_PUBLIC_DESKTOP === "1",
  /**
   * Desktop Google sign-in redirects to http://localhost:<port>/callback,
   * served by the app itself (src-tauri/src/oauth.rs). Register that exact
   * URI on the Google OAuth client.
   */
  desktopOAuthPort: Number(process.env.NEXT_PUBLIC_DESKTOP_OAUTH_PORT || 2004),
  /** Where the hosted web app lives — the desktop app links out to it. */
  webUrl: process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:2003",
} as const;
