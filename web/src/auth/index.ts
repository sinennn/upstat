import { GatewayAuthProvider } from "./gateway";
import type { AuthProvider } from "./provider";

export type { AuthProvider, AuthUser } from "./provider";

let provider: AuthProvider | null = null;

/**
 * The one auth provider. TEST_MODE needs no separate implementation: the
 * transport swaps in the fake backend, and the Google button skips the
 * Google popup (see GatewayAuthProvider).
 */
export function getAuthProvider(): AuthProvider {
  if (!provider) provider = new GatewayAuthProvider();
  return provider;
}
