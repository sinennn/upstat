/**
 * Deterministic illustration data for the marketing page's demo panels —
 * rendered client-side, never fetched, and not backed by any API.
 */

import type { Series } from "@/models/chart";
import type { UptimeDay } from "@/models";

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** FNV-1a string hash → uint32 seed. */
export function hashSeed(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (ms: number) =>
  new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

export interface OutageWindow {
  start: number;
  end: number;
}

const QUANTILES = [
  { name: "p50", factor: 1 },
  { name: "p95", factor: 2.8 },
  { name: "p99", factor: 6.5 },
];

/**
 * p50/p95/p99 response time over [from, to]: a daily cycle, light noise,
 * and an ~8× spike ramped in/out over the outage window.
 */
export function latencySeries(
  fromMs: number,
  toMs: number,
  stepMs: number,
  outage: OutageWindow,
): Series[] {
  return QUANTILES.map(({ name, factor }) => {
    const points = [];
    for (let t = fromMs; t <= toMs; t += stepMs) {
      const dayFrac = (t % DAY) / DAY;
      const cycle = 1 + 0.45 * Math.sin((dayFrac - 0.3) * 2 * Math.PI);
      const r = mulberry32(hashSeed(`${name}:${t}`));
      let v = 120 * factor * (0.9 + 0.2 * cycle) * (1 + (r() * 2 - 1) * 0.08);
      if (t >= outage.start && t <= outage.end) {
        const ramp = Math.min(
          1,
          (t - outage.start) / (5 * MINUTE),
          (outage.end - t) / (5 * MINUTE),
        );
        v *= 1 + 7 * ramp;
      }
      points.push({ ts: iso(t), value: Math.round(v * 100) / 100 });
    }
    return { name, tags: {}, points };
  });
}

/** 90 daily buckets ending at `now`, with one 22-minute dent 23 days ago. */
export function heartbeatDays(now: number): UptimeDay[] {
  const days: UptimeDay[] = [];
  for (let i = 89; i >= 0; i--) {
    const date = iso(now - i * DAY).slice(0, 10);
    if (i === 23) {
      days.push({ date, uptime_pct: 98.47, down_minutes: 22 });
      continue;
    }
    days.push({ date, uptime_pct: 100, down_minutes: 0 });
  }
  return days;
}
