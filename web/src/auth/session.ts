import type { AuthUser } from "./provider";

/**
 * Gateway session store — the bearer credential the Go backend issues after
 * `UserService/GoogleAuth` and validates on every authenticated RPC
 * (`util.AuthenticateInterceptor`, HS256 JWT).
 *
 * This is deliberately NOT an auth system: it is the storage half of the
 * `AuthProvider` seam, shared by the provider that *mints* the session
 * (auth/gateway.ts) and the transport that *spends* it
 * (models/repositories/grpc/transport.ts). Keeping it in one place means the
 * token never has to travel through controllers or views.
 *
 * sessionStorage (not localStorage) — the credential dies with the tab/
 * webview, matching the fleet session standard and keeping the Tauri desktop
 * build from persisting a token to disk.
 */

const SESSION_KEY = "upstat.gateway-session";

export interface GatewaySession {
  token: string;
  user: AuthUser;
}

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function readGatewaySession(): GatewaySession | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GatewaySession;
    if (!parsed?.token || !parsed?.user) return null;
    return parsed;
  } catch {
    // a corrupt entry is treated as "signed out", never a crash
    return null;
  }
}

export function writeGatewaySession(session: GatewaySession): void {
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearGatewaySession(): void {
  storage()?.removeItem(SESSION_KEY);
}

/** Bearer token for repository calls; null when signed out. */
export function getSessionToken(): string | null {
  return readGatewaySession()?.token ?? null;
}
