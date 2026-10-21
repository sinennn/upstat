import { env } from "@/config/env";
import { isDesktopShell, loopbackSignIn } from "@/desktop/bridge";
import { authRepo } from "@/models/repositories/grpc/repos";
import type { GatewaySession } from "./session";
import {
  GOOGLE_CALLBACK_MESSAGE,
  parseGoogleCallback,
  type GoogleCallbackMessage,
} from "./google-callback";
import type { AuthProvider, AuthUser } from "./provider";
import {
  clearGatewaySession,
  readGatewaySession,
  writeGatewaySession,
} from "./session";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALLBACK_PATH = "/signin/callback";
const SIGN_IN_TIMEOUT_MS = 2 * 60 * 1000;

/** Google's OIDC implicit-flow URL — the ID token comes back in the fragment. */
function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: env.googleClientId,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: randomToken(),
    state,
    prompt: "select_account",
  });
  return `${GOOGLE_AUTH_URL}?${params}`;
}

function randomToken(): string {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Auth against the Go gateway (UserService). Email sign-in/up are plain
 * RPCs; Google is:
 *
 *   CTA → Google OAuth popup (response_type=id_token) → /signin/callback
 *   posts the ID token back → UserService/GoogleAuth verifies it
 *   (audience = GOOGLE_CLIENT_ID) and issues the session JWT → session.ts
 *
 * A popup rather than a redirect keeps the AuthProvider contract —
 * `signInWithGoogle()` resolves once the session exists — and needs no
 * third-party script. The popup is opened synchronously inside the click
 * so browsers do not block it.
 */
export class GatewayAuthProvider implements AuthProvider {
  private adopt(session: GatewaySession): AuthUser {
    writeGatewaySession(session);
    return session.user;
  }

  signInWithGoogle(): Promise<AuthUser> {
    // TEST_MODE: the fake backend accepts any ID token — no Google popup
    if (env.testMode) {
      return authRepo.google("test-mode").then((s) => this.adopt(s));
    }
    if (!env.googleClientId) {
      return Promise.reject(
        new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured"),
      );
    }

    if (isDesktopShell()) return this.signInWithGoogleDesktop();

    const state = randomToken();
    const popup = window.open(
      googleAuthUrl(`${window.location.origin}${CALLBACK_PATH}`, state),
      "upstat-google-signin",
      "popup,width=480,height=640",
    );
    if (!popup) {
      return Promise.reject(new Error("popup_blocked"));
    }

    return new Promise<string>((resolve, reject) => {
      // BroadcastChannel, not window.opener: Google's pages set
      // Cross-Origin-Opener-Policy, which can sever the opener link (and
      // make `popup.closed` unreliable). Same-origin channels survive that.
      const channel = new BroadcastChannel(GOOGLE_CALLBACK_MESSAGE);
      const cleanup = () => {
        channel.close();
        window.clearTimeout(timeout);
      };
      channel.onmessage = (event: MessageEvent) => {
        const data = event.data as Partial<GoogleCallbackMessage> | null;
        if (data?.type !== GOOGLE_CALLBACK_MESSAGE) return;
        if (data.state !== state) return; // another tab's sign-in
        cleanup();
        if (data.error || !data.idToken)
          reject(new Error(data.error || "sign_in_failed"));
        else resolve(data.idToken);
      };
      // a popup closed without finishing never reports back — give up
      // rather than leave the CTA spinning forever
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error("sign_in_timeout"));
      }, SIGN_IN_TIMEOUT_MS);
    }).then(async (idToken) => this.adopt(await authRepo.google(idToken)));
  }

  /**
   * Desktop: Google can't redirect to the app's tauri:// origin, so the app
   * listens on http://localhost:<port>/callback and opens Google in the
   * system browser (RFC 8252 loopback). Same client ID and backend call as
   * the web flow.
   */
  private async signInWithGoogleDesktop(): Promise<AuthUser> {
    const state = randomToken();
    const port = env.desktopOAuthPort;
    const fragment = await loopbackSignIn(
      googleAuthUrl(`http://localhost:${port}/callback`, state),
      port,
    );
    const reply = parseGoogleCallback(`#${fragment}`);
    if (reply.state !== state) throw new Error("state_mismatch");
    if (reply.error || !reply.idToken) {
      throw new Error(reply.error || "sign_in_failed");
    }
    return this.adopt(await authRepo.google(reply.idToken));
  }

  async signInWithPassword(email: string, password: string): Promise<AuthUser> {
    return this.adopt(await authRepo.password(email, password));
  }

  /** CreateUser issues no token, so sign-up is create-then-sign-in. */
  async signUp(
    name: string,
    email: string,
    password: string,
  ): Promise<AuthUser> {
    await authRepo.register(name, email, password);
    return this.signInWithPassword(email, password);
  }

  async signOut(): Promise<void> {
    // the gateway JWT is stateless — dropping it is the whole sign-out
    clearGatewaySession();
  }

  currentUser(): AuthUser | null {
    return readGatewaySession()?.user ?? null;
  }

  setCurrentUser(user: AuthUser): void {
    const session = readGatewaySession();
    if (session) writeGatewaySession({ ...session, user });
  }
}
