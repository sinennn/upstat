/**
 * Desktop bridge — native capabilities when the app runs inside the Tauri
 * shell (web/src-tauri), browser fallbacks otherwise. Plugins are imported
 * lazily so the web bundle never loads Tauri code.
 */

/** True inside the Tauri webview. */
export function isDesktopShell(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Opens a URL in the system browser (desktop) or a new tab (web). */
export async function openExternal(url: string): Promise<void> {
  if (isDesktopShell()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Google sign-in from the desktop app (loopback flow, src-tauri/src/oauth.rs):
 * start the local listener, open Google in the system browser, and resolve
 * with the redirect's URL fragment once the browser hands it back.
 */
export async function loopbackSignIn(
  authUrl: string,
  port: number,
  timeoutSecs = 180,
): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("oauth_listen", { port });
  const reply = invoke<string>("oauth_wait", { timeoutSecs });
  await openExternal(authUrl);
  return reply;
}

let permission: Promise<boolean> | null = null;

/**
 * A native OS notification — desktop only (the web app already shows
 * in-page toasts). Asks for permission once; silently does nothing if it
 * is refused.
 */
export async function notifyNative(
  title: string,
  body?: string,
): Promise<void> {
  if (!isDesktopShell()) return;
  const n = await import("@tauri-apps/plugin-notification");
  permission ??= (async () =>
    (await n.isPermissionGranted()) ||
    (await n.requestPermission()) === "granted")();
  if (await permission) n.sendNotification({ title, body });
}
