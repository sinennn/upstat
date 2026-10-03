import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MonitorRow } from "./MonitorRow";

describe("MonitorRow", () => {
  const props = {
    status: "ok" as const,
    statusLabel: "UP",
    name: "Website",
    target: "https://upstat.cuesoft.io",
    lastCheck: "2m ago · 182 ms",
    cadence: "every 60s",
    muted: false,
    href: "/dashboard/monitors/m1",
  };

  it("links to the monitor and shows its target", () => {
    render(<MonitorRow {...props} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/dashboard/monitors/m1",
    );
    expect(screen.getByText("https://upstat.cuesoft.io")).toBeInTheDocument();
    expect(screen.getByText("UP")).toBeInTheDocument();
  });

  it("toggles mute", async () => {
    const onMuted = vi.fn();
    render(<MonitorRow {...props} onMutedChange={onMuted} />);
    await userEvent.click(screen.getByRole("switch", { name: "Mute Website" }));
    expect(onMuted).toHaveBeenCalledWith(true);
  });
});
