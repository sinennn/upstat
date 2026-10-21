import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@/design/ThemeProvider";
import { MarketingNav, NAV_LINKS } from "./MarketingNav";

const renderNav = (props: Parameters<typeof MarketingNav>[0] = {}) =>
  render(
    <ThemeProvider>
      <MarketingNav {...props} />
    </ThemeProvider>,
  );

describe("MarketingNav", () => {
  it("links the landing sections, the live status page and GitHub", () => {
    renderNav();
    expect(NAV_LINKS.map((l) => l.label)).toEqual([
      "Features",
      "How it works",
      "Architecture",
      "Live status",
      "GitHub",
    ]);
    expect(screen.getByRole("link", { name: "Live status" })).toHaveAttribute(
      "href",
      "/status/demo",
    );
    expect(
      screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/cuesoftinc/upstat");
  });

  it("carries the theme toggle, Sign in and the Get started CTA", () => {
    renderNav();
    expect(screen.getByTestId("theme-toggle")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/signin",
    );
    // compact below md + standard on md+
    expect(screen.getAllByRole("button", { name: "Get started" })).toHaveLength(
      2,
    );
  });

  it("shows the runtime star count only when provided", () => {
    const { unmount } = renderNav({ starCount: 1284 });
    expect(
      screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" }),
    ).toHaveTextContent("1,284");
    unmount();
    renderNav();
    expect(
      screen.getByRole("link", { name: "Star cuesoftinc/upstat on GitHub" }),
    ).toHaveTextContent(/^Star$/);
  });

  it("the mobile menu is a disclosure", () => {
    renderNav();
    const menu = screen.getByRole("button", { name: "Menu" });
    expect(menu).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(menu);
    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById("marketing-menu")).not.toBeNull();
  });
});
