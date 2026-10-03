import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AlertRule } from "./demo-types";
import { AlertRuleCard } from "./AlertRuleCard";

const RULE: AlertRule = {
  id: "rule_1",
  name: "Checkout p95 latency",
  signal: "metric",
  query_string: "metric:http.request.duration_ms service:checkout | p95()",
  thresholds: { warn: 800, crit: 1500, window: "5m" },
  state: "alert",
  last_triggered_at: "2026-07-18T09:00:00Z",
};

describe("AlertRuleCard", () => {
  it("shows the mono query + thresholds", () => {
    const { container } = render(<AlertRuleCard rule={RULE} />);
    expect(screen.getByText(RULE.query_string)).toBeInTheDocument();
    // Figma 69:520 threshold line: `warn > 800 · crit > 1500 · for 5m`
    expect(
      screen.getByText(/warn > 800 · crit > 1500 · for 5m/),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-signal='metric']")).not.toBeNull();
  });
});
