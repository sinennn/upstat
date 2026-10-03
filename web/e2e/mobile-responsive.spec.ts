import { expect, test, type Page, type TestInfo } from "@playwright/test";

/**
 * Mobile responsiveness sweep ([Directive 2026-07-19]): home, the public
 * status page and EVERY /dashboard route render inside the 390px viewport —
 * the document never side-scrolls, <main> never pans, and wide tables
 * scroll inside their own containers. 768 gets a sanity pass. Screenshots
 * land per route in both themes (test-results/).
 */

const MOBILE = { width: 390, height: 844 };
const TABLET = { width: 768, height: 1024 };

// Pinch-zoom stays available (2026-07-21 a11y audit blocker: the root
// viewport export shipped maximumScale:1 — axe meta-viewport on 18/18
// route-loads; siblings' viewport export is the fleet pattern).
test("viewport meta never disables pinch-zoom", async ({ page }) => {
  await page.goto("/");
  const content = await page
    .locator('meta[name="viewport"]')
    .getAttribute("content");
  expect(content).toContain("width=device-width");
  expect(content).not.toMatch(/maximum-scale/i);
  expect(content).not.toMatch(/user-scalable\s*=\s*(no|0)/i);
});

/**
 * Every app route. Ids are the TEST_MODE fake backend's deterministic seed
 * (fake-backend.ts): the "Website" monitor and its resolved incident.
 */
const ROUTES = [
  "/",
  "/signin",
  "/status/upstat",
  "/dashboard",
  "/dashboard/monitors/new",
  "/dashboard/monitors/65f0a1b20000000000000002",
  "/dashboard/monitors/65f0a1b20000000000000002/edit",
  "/dashboard/incidents",
  "/dashboard/incidents/65f0a1b20000000000000003",
  "/dashboard/settings",
];

interface OverflowReport {
  vw: number;
  htmlScrollWidth: number;
  bodyScrollWidth: number;
  mainPan: { scrollWidth: number; clientWidth: number } | null;
  offenders: string[];
}

/**
 * In-page audit: document scroll width, <main> pan, and elements that
 * extend past the viewport WITHOUT an overflow-x scroll container ancestor
 * (those are the sanctioned pattern for wide charts/tables/maps).
 */
function auditOverflow(): OverflowReport {
  const vw = window.innerWidth;
  const doc = document.documentElement;
  const out: OverflowReport = {
    vw,
    htmlScrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    mainPan: null,
    offenders: [],
  };
  const main = document.querySelector("main");
  if (main && main.scrollWidth > main.clientWidth + 1) {
    out.mainPan = {
      scrollWidth: main.scrollWidth,
      clientWidth: main.clientWidth,
    };
  }
  const hasHScrollAncestor = (el: Element): boolean => {
    let node = el.parentElement;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      if (
        (style.overflowX === "auto" || style.overflowX === "scroll") &&
        node.tagName !== "MAIN"
      ) {
        return true;
      }
      node = node.parentElement;
    }
    return false;
  };
  const describe = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && parts.length < 4) {
      let part = node.tagName.toLowerCase();
      if (node.id) part += `#${node.id}`;
      else if (typeof node.className === "string" && node.className) {
        part +=
          "." +
          node.className.split(/\s+/).filter(Boolean).slice(0, 3).join(".");
      }
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(" > ");
  };
  const reported: Element[] = [];
  for (const el of document.querySelectorAll("body *")) {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;
    if (rect.right <= vw + 1 && rect.left >= -1) continue;
    if (reported.some((a) => a.contains(el))) continue;
    if (hasHScrollAncestor(el)) continue;
    reported.push(el);
    out.offenders.push(
      `[${Math.round(rect.left)},${Math.round(rect.right)}] ${describe(el)}`,
    );
    if (out.offenders.length >= 8) break;
  }
  return out;
}

async function open(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded" });
  // charts/lists render client-side from the fake backend — give them a beat
  await page.waitForTimeout(1_200);
}

async function assertNoOverflow(page: Page, route: string) {
  const report = await page.evaluate(auditOverflow);
  expect(
    report.htmlScrollWidth,
    `${route}: document must not side-scroll`,
  ).toBeLessThanOrEqual(report.vw);
  expect(
    report.bodyScrollWidth,
    `${route}: body must not side-scroll`,
  ).toBeLessThanOrEqual(report.vw);
  expect(
    report.mainPan,
    `${route}: <main> must not pan horizontally`,
  ).toBeNull();
  expect(
    report.offenders,
    `${route}: wide elements must live inside horizontal-scroll containers`,
  ).toEqual([]);
}

/** The dashboard needs a session; signing in once keeps it for the tab. */
async function signIn(page: Page) {
  await page.goto("/signin");
  await page.getByRole("button", { name: /continue with google/i }).click();
  await page.waitForURL("**/dashboard");
}

function slug(route: string): string {
  return route === "/" ? "home" : route.slice(1).replace(/\//g, "-");
}

async function shoot(
  page: Page,
  testInfo: TestInfo,
  route: string,
  theme: "dark" | "light",
) {
  await page.screenshot({
    path: testInfo.outputPath(`${slug(route)}--${theme}.png`),
    fullPage: !route.startsWith("/dashboard"),
  });
}

test.describe("390 — every route fits the mobile viewport", () => {
  test("dark theme sweep + screenshots", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.setViewportSize(MOBILE);
    await signIn(page);
    for (const route of ROUTES) {
      await open(page, route);
      await assertNoOverflow(page, route);
      await shoot(page, testInfo, route, "dark");
    }
  });

  test("light theme sweep + screenshots", async ({ page }, testInfo) => {
    test.setTimeout(240_000);
    await page.addInitScript(() =>
      window.localStorage.setItem("upstat.theme", "light"),
    );
    await page.setViewportSize(MOBILE);
    await signIn(page);
    for (const route of ROUTES) {
      await open(page, route);
      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      await assertNoOverflow(page, route);
      await shoot(page, testInfo, route, "light");
    }
  });
});

test("768 — sanity sweep, no route side-scrolls", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize(TABLET);
  await signIn(page);
  for (const route of ROUTES) {
    await open(page, route);
    await assertNoOverflow(page, route);
  }
});

// [Directive 2026-07-19] with the rail EXPANDED (240px), every dashboard
// route's content column must reflow cleanly at 1280 and 1440 — charts,
// tables, widget grids and filter bars adapt; nothing overflows.
test.describe("expanded rail — dashboard content reflows", () => {
  const DASH_ROUTES = ROUTES.filter((r) => r.startsWith("/dashboard"));

  for (const width of [1280, 1440]) {
    test(`${width} sweep with the rail expanded`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(240_000);
      await page.addInitScript(() =>
        window.localStorage.setItem("nav.rail.expanded", "1"),
      );
      await page.setViewportSize({ width, height: 900 });
      await signIn(page);
      for (const route of DASH_ROUTES) {
        await open(page, route);
        await expect(
          page.getByRole("navigation", { name: "Product navigation" }),
        ).toHaveAttribute("data-expanded", "true");
        await assertNoOverflow(page, `${route} @${width} rail-expanded`);
      }
      // densest layouts, both rail states, for the visual record
      for (const route of [
        "/dashboard",
        "/dashboard/monitors/65f0a1b20000000000000002",
      ]) {
        await open(page, route);
        await page.screenshot({
          path: testInfo.outputPath(`${slug(route)}--${width}-expanded.png`),
        });
        await page.getByTestId("rail-toggle").click();
        await page.waitForTimeout(350);
        await page.screenshot({
          path: testInfo.outputPath(`${slug(route)}--${width}-collapsed.png`),
        });
        // restore for the next route (the desktop toggle persists)
        await page.getByTestId("rail-toggle").click();
        await page.waitForTimeout(350);
      }
    });
  }
});
