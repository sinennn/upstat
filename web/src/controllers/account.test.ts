import { describe, expect, it } from "vitest";
import type { Incident, Monitor } from "@/models";
import { accountSummary, sessionTimes } from "./account";

const NOW = Date.parse("2026-10-04T12:00:00Z");

describe("accountSummary", () => {
  it("counts monitors by state and daily checks of active ones", () => {
    const monitors = [
      { status: "up", active: true, muted: false, interval_seconds: 60 },
      { status: "down", active: true, muted: true, interval_seconds: 30 },
      { status: "paused", active: false, muted: false, interval_seconds: 60 },
    ] as Monitor[];
    const incidents = [
      {
        status: "resolved",
        started_at: new Date(NOW - 3_600_000).toISOString(),
        duration_seconds: 120,
      },
      {
        status: "active",
        started_at: new Date(NOW - 60_000).toISOString(),
        duration_seconds: null,
      },
    ] as Incident[];
    expect(accountSummary(monitors, incidents, NOW)).toEqual({
      monitors: 3,
      up: 1,
      down: 1,
      paused: 1,
      muted: 1,
      checksPerDay: 1440 + 2880,
      incidents30d: 2,
      openIncidents: 1,
      mttrSeconds: 120,
    });
  });
});

describe("sessionTimes", () => {
  it("reads iat/exp from a JWT payload", () => {
    const payload = btoa(JSON.stringify({ iat: 1000, exp: 8200 }));
    expect(sessionTimes(`h.${payload}.s`)).toEqual({
      issuedAt: 1_000_000,
      expiresAt: 8_200_000,
    });
  });

  it("is null for opaque tokens", () => {
    expect(sessionTimes("fake-token-abc")).toBeNull();
    expect(sessionTimes(null)).toBeNull();
  });
});
