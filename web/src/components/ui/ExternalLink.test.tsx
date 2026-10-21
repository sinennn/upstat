import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const openExternal = vi.fn();
let shell = false;
vi.mock("@/desktop/bridge", () => ({
  isDesktopShell: () => shell,
  openExternal: (url: string) => openExternal(url),
}));

import { ExternalLink } from "./ExternalLink";

afterEach(() => {
  shell = false;
  openExternal.mockReset();
});

describe("ExternalLink", () => {
  it("is a plain new-tab link on the web", () => {
    render(<ExternalLink href="https://example.com">Docs</ExternalLink>);
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link).toHaveAttribute("target", "_blank");
    fireEvent.click(link);
    expect(openExternal).not.toHaveBeenCalled();
  });

  it("hands off to the system browser in the desktop app", () => {
    shell = true;
    render(<ExternalLink href="https://example.com">Docs</ExternalLink>);
    fireEvent.click(screen.getByRole("link", { name: "Docs" }));
    expect(openExternal).toHaveBeenCalledWith("https://example.com");
  });
});
