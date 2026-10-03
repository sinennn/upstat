import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/design/ThemeProvider";
import { TopBar } from "./TopBar";

function renderBar(props: Parameters<typeof TopBar>[0]) {
  return render(
    <ThemeProvider>
      <TopBar {...props} />
    </ThemeProvider>,
  );
}

describe("TopBar", () => {
  it("shows the signed-in account", () => {
    renderBar({ email: "ibukun@cuesoft.io" });
    expect(screen.getByText("ibukun@cuesoft.io")).toBeInTheDocument();
  });

  it("signs out", async () => {
    const onSignOut = vi.fn();
    renderBar({ email: "ibukun@cuesoft.io", onSignOut });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
