import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { House } from "lucide-react";
import { NavRail, NavRailItem, NAV_PILLARS, NAV_SECTIONS } from "./NavRail";

describe("NavRail", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("renders the app sections with the active one marked", () => {
    render(<NavRail activeKey="incidents" />);
    expect(NAV_PILLARS.map((p) => p.key)).toEqual([
      "monitors",
      "incidents",
      "settings",
    ]);
    for (const pillar of NAV_PILLARS) {
      expect(
        screen.getByRole("button", { name: pillar.label }),
      ).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Incidents" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("navigates on click", async () => {
    const onNavigate = vi.fn();
    render(<NavRail activeKey="monitors" onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: "Monitors" }));
    expect(onNavigate).toHaveBeenCalledWith("monitors");
  });

  it("renders real <a> links when hrefFor maps routes (2026-07-21 a11y audit)", () => {
    // Nav destinations are links, not buttons: middle-click/new-tab and
    // AT link navigation work; active semantics stay on the anchor.
    render(
      <NavRail
        activeKey="incidents"
        hrefFor={(key) => `/dashboard/${key}`}
        onNavigate={vi.fn()}
      />,
    );
    for (const pillar of NAV_PILLARS) {
      expect(screen.getByRole("link", { name: pillar.label })).toHaveAttribute(
        "href",
        `/dashboard/${pillar.key}`,
      );
    }
    expect(screen.getByRole("link", { name: "Incidents" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByRole("button", { name: "Incidents" })).toBeNull();
  });

  /* [Directive 2026-07-19] expandable rail — design.md §2 */

  it("sections cover every item exactly once", () => {
    expect(NAV_SECTIONS.map((s) => s.title)).toEqual([null, "Account"]);
    expect(NAV_SECTIONS.flatMap((s) => s.keys)).toEqual(
      NAV_PILLARS.map((p) => p.key),
    );
  });

  it("foot renders the chevron square + signed-in avatar (master 284:2)", () => {
    render(<NavRail activeKey="monitors" userName="Ibukun Dairo" />);
    expect(screen.getByTestId("rail-toggle")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Signed in as Ibukun Dairo"),
    ).toBeInTheDocument();
    // the old text foot is gone
    expect(screen.queryByText("Collapse")).toBeNull();
  });

  it("foot toggle expands the rail: aria-expanded, labels + group headers", async () => {
    render(<NavRail activeKey="monitors" />);
    const toggle = screen.getByTestId("rail-toggle");
    // jsdom matchMedia is non-matching → collapsed default (viewport <1280)
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Account")).toBeNull();

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Account")).toBeInTheDocument();
    // labels render inline (visible text, not just the aria-label)
    expect(screen.getByText("Incidents")).toBeInTheDocument();
  });

  it("persists the expansion choice under nav.rail.expanded", async () => {
    const { unmount } = render(<NavRail activeKey="monitors" />);
    await userEvent.click(screen.getByTestId("rail-toggle"));
    expect(window.localStorage.getItem("nav.rail.expanded")).toBe("1");
    unmount();

    render(<NavRail activeKey="monitors" />);
    // stored choice resolves a tick after mount (deferred effect)
    await waitFor(() =>
      expect(screen.getByTestId("rail-toggle")).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
  });

  it("honors a stored collapsed choice over the viewport default", () => {
    window.localStorage.setItem("nav.rail.expanded", "0");
    render(<NavRail activeKey="monitors" />);
    expect(screen.getByTestId("rail-toggle")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

describe("NavRailItem", () => {
  it("shows the flyout label on hover", async () => {
    render(<NavRailItem icon={House} label="Home" />);
    expect(screen.queryByRole("tooltip")).toBeNull();
    await userEvent.hover(screen.getByRole("button", { name: "Home" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Home");
  });

  it("expanded rows carry the inline label and never the flyout", async () => {
    render(<NavRailItem icon={House} label="Home" expanded />);
    expect(screen.getByText("Home")).toBeInTheDocument();
    await userEvent.hover(screen.getByRole("button", { name: "Home" }));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });
});
