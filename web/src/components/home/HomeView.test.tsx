import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/design/ThemeProvider";
import { HomeView } from "./HomeView";
import { FAQ_ITEMS } from "./content";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

const renderHome = () =>
  render(
    <ThemeProvider>
      <HomeView />
    </ThemeProvider>,
  );

// the full landing render is heavy; under a parallel suite it can exceed
// the 5s default on slower machines
describe("HomeView", { timeout: 20_000 }, () => {
  it("renders every section", () => {
    renderHome();
    expect(
      screen.getByRole("heading", { level: 1, name: /Know the moment/ }),
    ).toBeInTheDocument();
    for (const id of [
      "how-it-works",
      "features",
      "showcase",
      "architecture",
      "self-host",
      "faq",
    ]) {
      expect(document.getElementById(id), id).not.toBeNull();
    }
    expect(
      screen.getByLabelText("Upstat dashboard preview"),
    ).toBeInTheDocument();
  });

  it("describes only what the product does — no removed pillars", () => {
    const { container } = renderHome();
    const text = container.textContent ?? "";
    for (const gone of ["OpenTelemetry", "RUM", "SLO", "traces", "Logs"]) {
      expect(text, gone).not.toContain(gone);
    }
  });

  it("Get started routes to /signin", async () => {
    renderHome();
    await userEvent.click(screen.getByTestId("hero-get-started"));
    expect(push).toHaveBeenCalledWith("/signin");
  });

  it("links the live demo status page", () => {
    renderHome();
    expect(
      screen.getByRole("link", { name: /See a live status page/ }),
    ).toHaveAttribute("href", "/status/demo");
  });

  it("FAQ is single-open", async () => {
    renderHome();
    const [first, second] = FAQ_ITEMS;
    expect(screen.getByText(first.answer)).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: second.question }),
    );
    expect(screen.getByText(second.answer)).toBeVisible();
    expect(screen.queryByText(first.answer)).toBeNull();
  });
});
