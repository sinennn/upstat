import { expect, test, type Page } from "@playwright/test";

/**
 * The app end to end against the TEST_MODE fake backend (fake-backend.ts),
 * which mirrors api/common's UserService + MonitorService. Seed: the user
 * ibukun@cuesoft.io / upstat-test with Website (up), API (down, open
 * incident), Docs (paused) and Blog (pending), and the public status page
 * slug `upstat`.
 */

const EMAIL = "ibukun@cuesoft.io";
const PASSWORD = "upstat-test";

async function signInWithPassword(page: Page) {
  await page.goto("/signin");
  await page.getByLabel("Email", { exact: true }).fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("monitors")).toBeVisible();
}

test.describe("sign-in", () => {
  test("offers Google, email sign-in and sign-up — nothing else", async ({
    page,
  }) => {
    await page.goto("/signin");
    const screen = page.getByTestId("signin-screen");
    await expect(
      screen.getByRole("button", { name: /continue with google/i }),
    ).toBeVisible();
    await expect(screen.getByLabel("Email", { exact: true })).toBeVisible();
    await expect(screen.getByLabel("Password", { exact: true })).toBeVisible();
    await screen.getByRole("button", { name: "Create an account" }).click();
    await expect(screen.getByLabel("Name", { exact: true })).toBeVisible();
  });

  test("email + password signs in", async ({ page }) => {
    await signInWithPassword(page);
    await expect(page.getByText(EMAIL)).toBeVisible();
  });

  test("a wrong password is rejected with the backend's verdict", async ({
    page,
  }) => {
    await page.goto("/signin");
    await page.getByLabel("Email", { exact: true }).fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill("wrong");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Incorrect email or password.",
    );
    await expect(page).toHaveURL(/\/signin$/);
  });

  test("sign-up creates the account and signs in", async ({ page }) => {
    await page.goto("/signin");
    await page.getByRole("button", { name: "Create an account" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Kemi");
    await page.getByLabel("Email", { exact: true }).fill("kemi@example.com");
    await page.getByLabel("Password", { exact: true }).fill("s3cret-pass");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("**/dashboard");
    // a new account has no monitors
    await expect(page.getByLabel("No monitors")).toBeVisible();
  });

  test("Google signs in (TEST_MODE skips the Google popup)", async ({
    page,
  }) => {
    await page.goto("/signin");
    await page.getByRole("button", { name: /continue with google/i }).click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByTestId("monitors")).toBeVisible();
  });

  test("the dashboard redirects to /signin without a session", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
  });

  test("sign out returns to /signin and drops the session", async ({
    page,
  }) => {
    await signInWithPassword(page);
    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/signin");
    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
  });

  test("/login is not a route — stale links 404", async ({ page }) => {
    const response = await page.goto("/login");
    expect(response!.status()).toBe(404);
  });

  test("signin column stays constrained at desktop width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/signin");
    const box = await page
      .getByTestId("signin-screen")
      .locator("main")
      .boundingBox();
    expect(box!.width).toBeLessThanOrEqual(380);
  });
});

test.describe("monitors", () => {
  test("lists the seeded monitors with their states, down first", async ({
    page,
  }) => {
    await signInWithPassword(page);
    const list = page.getByLabel("Monitor list");
    await expect(list.getByRole("link")).toHaveCount(4);
    await expect(list.getByRole("link").first()).toContainText("API");
    await expect(page.getByTestId("monitor-counts")).toContainText("1 down");
    await expect(page.getByTestId("monitor-counts")).toContainText("1 paused");
    // the open incident shows in the chrome banner
    await expect(page.getByText("API is down")).toBeVisible();
  });

  test("create → detail → edit → pause → delete", async ({ page }) => {
    await signInWithPassword(page);
    await page.getByRole("link", { name: "New monitor" }).click();
    await page.waitForURL("**/dashboard/monitors/new");

    // the backend rule surfaces before the round-trip
    await page.getByLabel("Name", { exact: true }).fill("Example");
    await page.getByLabel("URL").fill("https://example.com/health");
    await page.getByLabel("Check every (s)").fill("10");
    await page.getByLabel("Timeout (s)").fill("10");
    await page.getByRole("button", { name: "Create monitor" }).click();
    await expect(page.locator("main").getByRole("alert")).toHaveText(
      "Timeout must be below the check interval.",
    );

    await page.getByLabel("Check every (s)").fill("");
    await page.getByLabel("Timeout (s)").fill("");
    await page.getByRole("button", { name: "Create monitor" }).click();
    await page.waitForURL(/\/dashboard\/monitors\/[0-9a-f]{24}$/);
    const detail = page.getByTestId("monitor-detail");
    await expect(detail.getByRole("heading", { level: 1 })).toHaveText(
      "Example",
    );
    // backend defaults applied: 60s / 10s / 3
    await expect(detail).toContainText("60s");
    await expect(detail).toContainText("10s");
    await expect(
      detail.getByText("PENDING", { exact: true }).first(),
    ).toBeVisible();

    await detail.getByRole("link", { name: "Edit" }).click();
    await page.getByLabel("Name", { exact: true }).fill("Example API");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByTestId("monitor-detail").getByRole("heading", { level: 1 }),
    ).toHaveText("Example API");

    await page.getByRole("button", { name: "Pause" }).click();
    await expect(
      page.getByText("PAUSED", { exact: true }).first(),
    ).toBeVisible();
    await page.getByRole("button", { name: "Resume" }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete monitor" })
      .click();
    await page.waitForURL("**/dashboard");
    await expect(page.getByText("Example API")).toHaveCount(0);
  });

  test("detail shows history, checks, incidents and insight", async ({
    page,
  }) => {
    await signInWithPassword(page);
    await page
      .getByLabel("Monitor list")
      .getByRole("link", { name: /API/ })
      .click();
    const detail = page.getByTestId("monitor-detail");
    await expect(detail.getByText("DOWN", { exact: true })).toBeVisible();
    await expect(detail.getByText("Last 90 days")).toBeVisible();
    await expect(detail.getByRole("table")).toBeVisible();
    await expect(detail.getByText("API is down").first()).toBeVisible();
    await expect(page.getByTestId("monitor-insight")).toContainText(
      "CRITICAL",
      {
        ignoreCase: true,
      },
    );
  });

  test("mute toggles from the list", async ({ page }) => {
    await signInWithPassword(page);
    const toggle = page.getByRole("switch", { name: "Mute Website" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await page.reload();
    await expect(
      page.getByRole("switch", { name: "Mute Website" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("incidents", () => {
  test("list filters open/resolved and opens the detail", async ({ page }) => {
    await signInWithPassword(page);
    await page
      .getByRole("navigation", { name: "Product navigation" })
      .getByRole("link", { name: "Incidents" })
      .click();
    await page.waitForURL("**/dashboard/incidents");
    const list = page.getByLabel("Incident list");
    await expect(list.getByRole("link")).toHaveCount(3);

    await page.getByRole("tab", { name: "Open" }).click();
    await expect(list.getByRole("link")).toHaveCount(1);
    await list.getByRole("link").first().click();

    const detail = page.getByTestId("incident-detail");
    await expect(detail.getByText("OPEN", { exact: true })).toBeVisible();
    await expect(detail).toContainText("context deadline exceeded");
    await detail.getByRole("link", { name: "API" }).click();
    await page.waitForURL(/\/dashboard\/monitors\//);
  });
});

test.describe("settings", () => {
  test("profile update sticks; status page link is the owner page", async ({
    page,
  }) => {
    await signInWithPassword(page);
    await page.goto("/dashboard/settings");
    const name = page.getByLabel("Name", { exact: true });
    await expect(name).toHaveValue("Ibukun");
    await name.fill("Ibukun D.");
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page.getByText("Profile saved.")).toBeVisible();
    await expect(page.getByTestId("status-page-link")).toHaveAttribute(
      "href",
      /^\/status\/owner\/[0-9a-f]{24}$/,
    );
  });

  test("a new password works for email sign-in", async ({ page }) => {
    await signInWithPassword(page);
    await page.goto("/dashboard/settings");
    await page.getByLabel("New password", { exact: true }).fill("changed-pass");
    await page.getByLabel("Confirm new password").fill("changed-pass");
    await page.getByRole("button", { name: "Update password" }).click();
    await expect(page.getByText(/Password updated/)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL("**/signin");
    await page.getByLabel("Email", { exact: true }).fill(EMAIL);
    await page.getByLabel("Password", { exact: true }).fill("changed-pass");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL("**/dashboard");
  });
});

test.describe("public status page", () => {
  test("by slug: services, 24h uptime and incidents, no sign-in", async ({
    page,
  }) => {
    await page.goto("/status/upstat");
    const status = page.getByTestId("status-page");
    await expect(status.getByRole("heading", { level: 1 })).toContainText(
      "Upstat status",
    );
    await expect(
      status.getByLabel("Services").getByRole("listitem"),
    ).toHaveCount(4);
    await expect(status.getByText("Ongoing incidents")).toBeVisible();
    await expect(status).toContainText("uptime over the last 24 hours");
    // never exposes monitor targets
    await expect(status).not.toContainText("https://");
  });

  test("an unknown slug is a not-found page", async ({ page }) => {
    await page.goto("/status/nope");
    await expect(
      page.getByRole("heading", { name: "Status page not found" }),
    ).toBeVisible();
  });
});
