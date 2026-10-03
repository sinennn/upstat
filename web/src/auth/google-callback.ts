/**
 * The /signin/callback ↔ GatewayAuthProvider contract. Kept apart from
 * gateway.ts so the callback page does not bundle the gRPC client.
 */

/** BroadcastChannel name and message type. */
export const GOOGLE_CALLBACK_MESSAGE = "upstat.google-auth";

export interface GoogleCallbackMessage {
  type: typeof GOOGLE_CALLBACK_MESSAGE;
  state: string | null;
  idToken: string | null;
  error: string | null;
}

/**
 * Parses Google's implicit-flow redirect fragment
 * (`#id_token=…&state=…` or `#error=access_denied&state=…`).
 */
export function parseGoogleCallback(hash: string): GoogleCallbackMessage {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const idToken = params.get("id_token");
  return {
    type: GOOGLE_CALLBACK_MESSAGE,
    state: params.get("state"),
    idToken,
    error: params.get("error") ?? (idToken ? null : "missing_id_token"),
  };
}

/** Hands the result to the signing-in tab; returns what was sent. */
export function reportGoogleCallback(hash: string): GoogleCallbackMessage {
  const message = parseGoogleCallback(hash);
  const channel = new BroadcastChannel(GOOGLE_CALLBACK_MESSAGE);
  channel.postMessage(message);
  channel.close();
  return message;
}
