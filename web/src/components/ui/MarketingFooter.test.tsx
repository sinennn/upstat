import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MarketingFooter } from "./MarketingFooter";

/** The footer column/link set. */
const CANON: Record<string, [string, string][]> = {
  Product: [
    ["Features", "/#features"],
    ["How it works", "/#how-it-works"],
    ["Live status page", "/status/demo"],
    ["Sign in", "/signin"],
  ],
  Docs: [
    ["Docs", "https://cuesoft.gitbook.io/upstat"],
    ["Architecture", "/#architecture"],
    [
      "gRPC reference",
      "https://github.com/cuesoftinc/upstat/blob/main/api/common/docs/grpc-api.md",
    ],
    ["Self-host", "/#self-host"],
  ],
  Community: [
    ["GitHub", "https://github.com/cuesoftinc/upstat"],
    ["Discord", "https://discord.gg/CDfZxxrxbb"],
    ["CueLABS™", "https://cuelabs.cuesoft.io"],
  ],
  Legal: [
    ["Privacy", "https://privacy.cuesoft.io"],
    ["Terms", "https://terms.cuesoft.io"],
  ],
};

describe("MarketingFooter (parity canon, SKILL.md 2026-07-19)", () => {
  it("renders the brand block and every canonical column link", () => {
    render(<MarketingFooter />);
    // bolt + lowercase wordmark and the master 290:2 tagline
    expect(screen.getByText("upstat")).toBeInTheDocument();
    expect(
      screen.getByText("Uptime monitoring, incidents and status pages."),
    ).toBeInTheDocument();
    for (const [heading, links] of Object.entries(CANON)) {
      const column = screen.getByRole("navigation", { name: heading });
      for (const [label, href] of links) {
        expect(
          within(column).getByRole("link", { name: label }),
        ).toHaveAttribute("href", href);
      }
    }
  });

  it("legal bar: verbatim copyright with linked marks", () => {
    render(<MarketingFooter />);
    const bar = screen.getByText(/CueLABS™ Division/).closest("p")!;
    expect(bar).toHaveTextContent(
      "© Cuesoft Inc. 2026. Upstat. CueLABS™ Division. MIT License.",
    );
    expect(
      within(bar).getByRole("link", { name: "Cuesoft Inc." }),
    ).toHaveAttribute("href", "https://cuesoft.io");
    expect(
      within(bar).getByRole("link", { name: "CueLABS™ Division" }),
    ).toHaveAttribute("href", "https://cuelabs.cuesoft.io");
    expect(
      within(bar).getByRole("link", { name: "MIT License" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/cuesoftinc/upstat/blob/main/LICENSE",
    );
  });

  it("legal bar: language selector (English-only, real control) + security affordance", () => {
    render(<MarketingFooter />);
    const language = screen.getByRole("combobox", { name: "Language" });
    expect(language).toHaveValue("en");
    expect(within(language).getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute(
      "href",
      "https://github.com/cuesoftinc/upstat/blob/main/SECURITY.md",
    );
  });
});
