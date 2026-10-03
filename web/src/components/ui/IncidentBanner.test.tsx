import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { IncidentBanner } from "./IncidentBanner";

describe("IncidentBanner", () => {
  it("shows the open incident and its age", () => {
    render(<IncidentBanner title="API is down" age="25m" />);
    expect(screen.getByText("DOWN")).toBeInTheDocument();
    expect(screen.getByText("API is down")).toBeInTheDocument();
    expect(screen.getByText("open 25m")).toBeInTheDocument();
  });

  it("is one click target", () => {
    const onClick = vi.fn();
    render(<IncidentBanner title="API is down" age="25m" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
