import { afterEach, describe, expect, it, vi } from "vitest";

const openUrl = vi.fn();
const sendNotification = vi.fn();
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl }));
vi.mock("@tauri-apps/plugin-notification", () => ({
  isPermissionGranted: async () => true,
  requestPermission: async () => "granted",
  sendNotification,
}));

const inShell = () =>
  Object.defineProperty(window, "__TAURI_INTERNALS__", {
    value: {},
    configurable: true,
  });

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__;
  vi.restoreAllMocks();
  openUrl.mockReset();
  sendNotification.mockReset();
});

describe("desktop bridge", () => {
  it("on the web: opens a new tab and never notifies natively", async () => {
    const { isDesktopShell, notifyNative, openExternal } =
      await import("./bridge");
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    expect(isDesktopShell()).toBe(false);
    await openExternal("https://example.com");
    expect(open).toHaveBeenCalledWith(
      "https://example.com",
      "_blank",
      "noopener,noreferrer",
    );
    await notifyNative("API is down");
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("in the Tauri shell: system browser + OS notification", async () => {
    inShell();
    const { isDesktopShell, notifyNative, openExternal } =
      await import("./bridge");
    expect(isDesktopShell()).toBe(true);
    await openExternal("https://example.com");
    expect(openUrl).toHaveBeenCalledWith("https://example.com");
    await notifyNative("API is down", "503");
    expect(sendNotification).toHaveBeenCalledWith({
      title: "API is down",
      body: "503",
    });
  });
});
