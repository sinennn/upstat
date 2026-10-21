import { describe, expect, it } from "vitest";
import type { CheckResult, Incident, Monitor } from "@/models";
import {
  causeBreakdown,
  downtimeByMonitor,
  durationHistogram,
  errorBudgets,
  failureCause,
  incidentStats,
  incidentsPerDay,
  outageTimeline,
  reconstructIncident,
} from "./incidents";
import { fleetResponseSeries } from "./monitors";

const NOW = Date.parse("2026-10-04T12:00:30Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const MIN = 60_000;
const DAY = 86_400_000;

function incident(over: Partial<Incident>): Incident {
  return {
    id: "i",
    monitor_id: "m1",
    monitor_name: "API",
    title: "API is down",
    failure_reason: "503",
    status: "resolved",
    started_at: iso(DAY),
    resolved_at: iso(DAY - 600_000),
    duration_seconds: 600,
    ...over,
  };
}

describe("incident analytics", () => {
  const list = [
    incident({
      id: "a",
      status: "active",
      duration_seconds: null,
      resolved_at: null,
      started_at: iso(30 * MIN),
    }),
    incident({ id: "b", duration_seconds: 600 }),
    incident({
      id: "c",
      monitor_id: "m2",
      monitor_name: "Web",
      duration_seconds: 1800,
      started_at: iso(3 * DAY),
    }),
    incident({ id: "old", duration_seconds: 99999, started_at: iso(40 * DAY) }),
  ];

  it("MTTR averages resolved incidents in the window only", () => {
    const s = incidentStats(list, NOW);
    expect(s.open).toBe(1);
    expect(s.inWindow).toBe(3);
    expect(s.mttrSeconds).toBe(1200); // (600 + 1800) / 2
  });

  it("ongoing incidents count their downtime up to now", () => {
    const s = incidentStats(list, NOW);
    expect(s.longestSeconds).toBe(1800);
    expect(s.downtimeSeconds).toBe(1800 + 600 + 1800); // 30 min ongoing
  });

  it("buckets incidents per UTC day, newest day last", () => {
    const [series] = incidentsPerDay(list, NOW);
    expect(series.points).toHaveLength(30);
    expect(series.points.at(-1)!.value).toBe(1); // started 30 min ago
    expect(series.points.at(-2)!.value).toBe(1); // yesterday, not today
    expect(series.points.at(-4)!.value).toBe(1); // three days ago
    expect(series.points.reduce((s, p) => s + (p.value ?? 0), 0)).toBe(3);
  });

  it("ranks monitors by downtime, worst first", () => {
    const rows = downtimeByMonitor(list, NOW);
    expect(rows.map((r) => [r.name, r.seconds, r.incidents])).toEqual([
      ["API", 2400, 2],
      ["Web", 1800, 1],
    ]);
  });
});

describe("fleet response series", () => {
  const monitor = (id: string, active = true) =>
    ({ id, name: id, active }) as Monitor;
  const check = (
    id: string,
    msAgo: number,
    ms: number,
    up = true,
  ): CheckResult => ({
    id: `${id}${msAgo}`,
    monitor_id: id,
    up,
    status_code: up ? 200 : 0,
    response_time_ms: ms,
    checked_at: iso(msAgo),
  });

  it("averages successful checks per minute and leaves gaps", () => {
    const [s] = fleetResponseSeries(
      [monitor("a")],
      {
        a: [
          check("a", 10_000, 100),
          check("a", 20_000, 200),
          check("a", 2 * MIN, 999, false),
        ],
      },
      NOW,
    );
    expect(s.points).toHaveLength(30);
    expect(s.points.at(-1)!.value).toBe(150);
    // the failed check's minute is a gap, not a zero
    expect(s.points.at(-3)!.value).toBeNull();
  });

  it("skips paused monitors and monitors with no data", () => {
    const series = fleetResponseSeries(
      [monitor("a", false), monitor("b")],
      { a: [check("a", 10_000, 100)], b: [] },
      NOW,
    );
    expect(series).toEqual([]);
  });
});

describe("root causes, durations, timeline, budgets", () => {
  it("classifies the Go client's real error strings", () => {
    const cases: [string, string][] = [
      [
        'Get "https://x.invalid": dial tcp: lookup x.invalid on 127.0.0.11:53: no such host',
        "DNS",
      ],
      [
        'Get "https://example.com": dial tcp: lookup example.com on 127.0.0.11:53: server misbehaving',
        "DNS",
      ],
      ['Get "https://api.example.com": context deadline exceeded', "Timeout"],
      [
        "dial tcp 10.0.0.1:443: connect: connection refused",
        "Connection refused",
      ],
      [
        "tls: failed to verify certificate: x509: certificate has expired",
        "TLS",
      ],
      ["503 Service Unavailable", "HTTP 5xx"],
      ["404 Not Found", "HTTP 4xx"],
      ["received unhealthy status code", "HTTP 5xx"],
      ["monitor check failed", "Other"],
    ];
    for (const [reason, cause] of cases) {
      expect(failureCause(reason), reason).toBe(cause);
    }
  });

  const list = [
    incident({
      id: "dns",
      failure_reason: "lookup a: no such host",
      duration_seconds: 30,
      started_at: iso(2 * DAY),
    }),
    incident({
      id: "t1",
      failure_reason: "context deadline exceeded",
      duration_seconds: 600,
      started_at: iso(DAY),
    }),
    incident({
      id: "t2",
      monitor_id: "m2",
      monitor_name: "Web",
      failure_reason: "context deadline exceeded",
      duration_seconds: 7200,
      started_at: iso(3 * DAY),
    }),
  ];

  it("ranks causes by frequency", () => {
    expect(causeBreakdown(list, NOW).map((c) => [c.cause, c.count])).toEqual([
      ["Timeout", 2],
      ["DNS", 1],
    ]);
  });

  it("buckets durations", () => {
    const h = durationHistogram(list, NOW);
    expect(h.find((b) => b.label === "< 1 min")!.count).toBe(1);
    expect(h.find((b) => b.label === "5–15 min")!.count).toBe(1);
    expect(h.find((b) => b.label === "1–4 h")!.count).toBe(1);
  });

  it("draws a timeline row per active monitor, spans clipped to the window", () => {
    const rows = outageTimeline(
      [
        incident({
          id: "old",
          started_at: iso(9 * DAY),
          resolved_at: iso(6 * DAY),
          duration_seconds: 3 * 86_400,
        }),
      ],
      [
        { id: "m1", name: "API", active: true },
        { id: "m3", name: "Quiet", active: true },
      ],
      NOW,
    );
    expect(rows.map((r) => r.name)).toEqual(["API", "Quiet"]);
    const [span] = rows[0].spans;
    expect(span.from).toBe(0); // started before the 7-day window
    expect(span.to).toBeCloseTo(1 / 7, 5); // ended 6 days ago
  });

  it("spends a 99.9% budget of 43.2 minutes per 30 days", () => {
    const budgets = errorBudgets(
      [
        { id: "m1", name: "API", active: true },
        { id: "m2", name: "Web", active: true },
      ],
      list,
      NOW,
    );
    expect(budgets[0]).toMatchObject({ name: "Web", remainingPct: 0 }); // 2h used
    const api = budgets.find((b) => b.name === "API")!;
    expect(api.allowedSeconds).toBe(2592);
    expect(api.usedSeconds).toBe(630);
    expect(api.remainingPct).toBeCloseTo(75.7, 1);
  });
});

describe("reconstructIncident", () => {
  const at = (msAgo: number, up: boolean, ms = 100): CheckResult => ({
    id: String(msAgo),
    monitor_id: "m1",
    up,
    status_code: up ? 200 : 0,
    response_time_ms: up ? ms : 5,
    checked_at: iso(msAgo),
  });
  // 10 s checks: ok, ok, FAIL, FAIL, FAIL (threshold → open), FAIL, ok (recovery)
  const checks = [
    at(70_000, true),
    at(60_000, true),
    at(50_000, false),
    at(40_000, false),
    at(30_000, false),
    at(20_000, false),
    at(10_000, true),
  ];
  const resolved = incident({
    started_at: iso(30_000),
    resolved_at: iso(10_000),
    duration_seconds: 20,
  });

  it("finds the last good check, first failure, detection time and recovery", () => {
    const r = reconstructIncident(resolved, [...checks].reverse(), NOW);
    expect(r.covered).toBe(true);
    expect(r.lastSuccess?.checked_at).toBe(iso(60_000));
    expect(r.firstFailure?.checked_at).toBe(iso(50_000));
    expect(r.detectSeconds).toBe(20); // 3 strikes at 10 s
    expect(r.recovery?.checked_at).toBe(iso(10_000));
    expect([r.failedChecks, r.totalChecks]).toEqual([4, 5]);
  });

  it("says when the checks don't reach back far enough", () => {
    const r = reconstructIncident(resolved, checks.slice(4), NOW);
    expect(r.covered).toBe(false);
    expect(r.detectSeconds).toBeNull();
    expect(r.firstFailure).toBeNull();
  });

  it("an open incident has no recovery and counts up to now", () => {
    const open = incident({
      status: "active",
      started_at: iso(30_000),
      resolved_at: null,
      duration_seconds: null,
    });
    const r = reconstructIncident(open, checks.slice(0, 6), NOW);
    expect(r.recovery).toBeNull();
    expect(r.failedChecks).toBe(4);
  });
});
