import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { buildHomeDemoData, useHomeDemoData } from "./home";

const NOW = Date.parse("2026-07-19T21:42:00Z");

describe("landing demo data", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("is deterministic within a 5-minute bucket (except the live 'updated' stamp)", () => {
    const { updatedAt: a, ...first } = buildHomeDemoData(NOW);
    const { updatedAt: b, ...later } = buildHomeDemoData(NOW + 90_000);
    expect(first).toEqual(later);
    expect(Date.parse(b) - Date.parse(a)).toBe(90_000);
  });

  it("keeps p50 ≤ p95 ≤ p99 at every point", () => {
    const [p50, p95, p99] = buildHomeDemoData(NOW).latency;
    p50.points.forEach((pt, i) => {
      expect(pt.value!).toBeLessThanOrEqual(p95.points[i].value!);
      expect(p95.points[i].value!).toBeLessThanOrEqual(p99.points[i].value!);
    });
  });

  it("derives the headline uptime from the 90-day strip", () => {
    const { days, uptimePct } = buildHomeDemoData(NOW);
    expect(days).toHaveLength(90);
    const mean =
      days.reduce((s, d) => s + (d.uptime_pct ?? 0), 0) / days.length;
    expect(uptimePct).toBeCloseTo(mean, 2);
  });

  it("shows one down monitor whose trend ends in failures", () => {
    const down = buildHomeDemoData(NOW).monitors.filter(
      (m) => m.status === "down",
    );
    expect(down).toHaveLength(1);
    expect(down[0].trend.at(-1)!.ok).toBe(false);
  });

  it("first render is clock-independent (static prerender === hydration)", () => {
    const firstRenderAt = (epoch: string) => {
      vi.useFakeTimers();
      vi.setSystemTime(Date.parse(epoch));
      const { result, unmount } = renderHook(() => useHomeDemoData());
      const data = result.current;
      unmount();
      vi.useRealTimers();
      return data;
    };
    expect(firstRenderAt("2026-07-10T08:00:00Z")).toEqual(
      firstRenderAt("2026-07-19T21:42:00Z"),
    );
  });
});
