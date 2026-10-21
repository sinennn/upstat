import { expect, test } from "@playwright/test";

/** The public landing — every section describes what the product does. */

test("renders every section with the product story", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: /Know the moment/ }),
  ).toBeVisible();
  for (const id of [
    "how-it-works",
    "features",
    "showcase",
    "architecture",
    "self-host",
    "faq",
  ]) {
    await expect(page.locator(`#${id}`), id).toBeAttached();
  }
  await expect(page.getByLabel("Upstat dashboard preview")).toBeVisible();
  // the architecture diagram names the real stack
  const arch = page.locator("#architecture");
  for (const part of [
    "Envoy",
    "MongoDB",
    "Insight service",
    "API + check worker",
  ]) {
    await expect(arch.getByText(part, { exact: true })).toBeVisible();
  }
});

test("nav links the sections, the live status page and the app", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Marketing" });
  for (const [label, href] of [
    ["Features", "/#features"],
    ["How it works", "/#how-it-works"],
    ["Architecture", "/#architecture"],
    ["Live status", "/status/demo"],
  ]) {
    await expect(nav.getByRole("link", { name: label })).toHaveAttribute(
      "href",
      href,
    );
  }
  await expect(nav.getByRole("link", { name: "Sign in" })).toHaveAttribute(
    "href",
    "/signin",
  );
});

test("Get started hands off to /signin", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("hero-get-started").click();
  await page.waitForURL("**/signin");
});

test("the live status link opens the demo status page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /See a live status page/ }).click();
  await page.waitForURL("**/status/demo");
  // first visit compiles the route on the dev server
  await expect(page.getByTestId("status-page")).toBeVisible({
    timeout: 20_000,
  });
});

test("theme toggle cycles light → dark → system and persists (upstat.theme)", async ({
  page,
}) => {
  // Deterministic OS scheme for the system-resolution assertions.
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const html = page.locator("html");
  // Fresh visit = the dark design default (key absent — theme contract).
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(
    await page.evaluate(() => window.localStorage.getItem("upstat.theme")),
  ).toBeNull();

  // dark(default) → system. The initial attr is applied pre-hydration
  // (init script), so retry the click until React's handler is attached —
  // detected via storage (the attribute stays dark under the dark OS).
  const toggle = page.getByTestId("theme-toggle");
  await expect(async () => {
    await toggle.click();
    expect(
      await page.evaluate(() => window.localStorage.getItem("upstat.theme")),
    ).toBe("system");
  }).toPass({ timeout: 15_000 });
  await expect(html).toHaveAttribute("data-theme", "dark"); // OS is dark

  // system → light (explicit choice).
  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(
    await page.evaluate(() => window.localStorage.getItem("upstat.theme")),
  ).toBe("light");
  // persists across reload — applied pre-paint by the init script
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");

  // light → dark (explicit choice ignores the OS)
  await expect(async () => {
    await toggle.click();
    await expect(html).toHaveAttribute("data-theme", "dark", {
      timeout: 1_000,
    });
  }).toPass({ timeout: 15_000 });
  expect(
    await page.evaluate(() => window.localStorage.getItem("upstat.theme")),
  ).toBe("dark");

  // dark → system: stored explicitly (key absent = the dark design
  // default); resolved follows the OS and tracks a live flip without a
  // reload.
  await toggle.click();
  expect(
    await page.evaluate(() => window.localStorage.getItem("upstat.theme")),
  ).toBe("system");
  await expect(html).toHaveAttribute("data-theme", "dark"); // OS is dark
  await page.emulateMedia({ colorScheme: "light" });
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(html).toHaveAttribute("data-theme", "dark");
});

test("FAQ is a single-open accordion", async ({ page }) => {
  await page.goto("/");
  const faq = page.locator("#faq");
  const first = faq.getByRole("button", {
    name: "How often are my sites checked?",
  });
  const second = faq.getByRole("button", { name: "What counts as down?" });
  await expect(first).toHaveAttribute("aria-expanded", "true");
  await second.click();
  await expect(second).toHaveAttribute("aria-expanded", "true");
  await expect(first).toHaveAttribute("aria-expanded", "false");
});

test("mobile nav is a menu-button disclosure at 390w", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Marketing" });
  const menu = nav.getByRole("button", { name: "Menu" });
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(
    nav.locator("#marketing-menu").getByRole("link", { name: "Live status" }),
  ).toBeVisible();
});

test("hero and section headings use the type scale", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/");
  const style = (name: RegExp | string, level: number) =>
    page.getByRole("heading", { level, name }).evaluate((el) => {
      const s = getComputedStyle(el);
      return [s.fontFamily, s.fontWeight, s.fontSize];
    });
  const [family, weight, size] = await style(/Know the moment/, 1);
  expect(family).toMatch(/^Inter\b/);
  expect(weight).toBe("600");
  expect(size).toBe("52px");
  const [, h2Weight, h2Size] = await style("How it's built", 2);
  expect(h2Weight).toBe("600");
  expect(h2Size).toBe("28px");
});
