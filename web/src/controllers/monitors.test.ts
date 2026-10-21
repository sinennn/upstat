import { describe, expect, it } from "vitest";
import type { Monitor } from "@/models";
import { monitorChanges, scheduleSummary } from "./monitors";

describe("scheduleSummary", () => {
  it("derives checks per day and detection window", () => {
    expect(scheduleSummary(60, 10, 3)).toEqual({
      checksPerDay: 1440,
      requestsPerMonth: 43_200,
      detectWorstSeconds: 190,
      detectBestSeconds: 130,
    });
  });
});

describe("monitorChanges", () => {
  const saved = {
    name: "Website",
    type: "website",
    target: "https://example.com",
    interval_seconds: 60,
    timeout_seconds: 10,
    failure_threshold: 3,
  } as Monitor;

  it("lists only fields that differ", () => {
    expect(
      monitorChanges(saved, {
        name: "Website",
        type: "api",
        target: "https://example.com",
        interval_seconds: 30,
        timeout_seconds: 10,
        failure_threshold: 3,
      }),
    ).toEqual([
      { field: "Type", from: "website", to: "api" },
      { field: "Interval", from: "60s", to: "30s" },
    ]);
  });

  it("treats blank numbers as unchanged", () => {
    expect(
      monitorChanges(saved, {
        name: "Website",
        type: "website",
        target: "https://example.com",
      }),
    ).toEqual([]);
  });
});
