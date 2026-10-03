"use client";

/**
 * Home (Part A) controller — pages.md A1–A16, web-implementation.md W2.
 *
 * Demo panels feed from the mock seed generators (design.md §8.3 synthetic
 * dataset, U0-3) — deterministic, computed client-side via this controller;
 * the A4 decision descopes any live embedded demo org. Views stay
 * render-only.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { UptimeDay } from "@/models";
import type { Series } from "@/models/chart";
import type { IncidentHistoryUpdate } from "@/components/home/IncidentHistoryEntry";
import type { AlertRule } from "@/components/home/demo-types";
import { githubRepo } from "@/models/repositories";
import {
  HOUR,
  MINUTE,
  hashSeed,
  heartbeatDays as buildHeartbeatDays,
  latencySeries as buildLatencySeries,
  mulberry32,
  type OutageWindow,
} from "./home-demo";

/* ------------------------------------------------------------------ */
/* Demo dataset (deterministic, from the §8.3 synthetic generators)     */
/* ------------------------------------------------------------------ */

const DEMO_STEP_MS = 5 * MINUTE;

export interface UptimeDemo {
  name: string;
  days: UptimeDay[];
  uptimePct: number;
  p95Ms: number;
}

export interface StatusRowDemo {
  name: string;
  days: UptimeDay[];
  uptimePct: number;
}

export interface HomeDemoData {
  /** Hero + demo-band panel: p50/p95/p99 latency, api-common, last 4h. */
  latencySeries: Series[];
  latencyQuery: string;
  heartbeat: UptimeDemo;
  heartbeatAllUp: UptimeDemo;
  availabilitySparkline: number[];
  latencySparkline: number[];
  visitorsSparkline: number[];
  lcpSparkline: number[];
  alertRule: AlertRule;
  incidentUpdate: IncidentHistoryUpdate;
  statusRows: StatusRowDemo[];
  /** RFC3339 — 2 minutes ago, for the "Last updated 2m ago" embeds. */
  statusUpdatedAt: string;
}

function meanUptime(days: UptimeDay[]): number {
  const vals = days
    .map((d) => d.uptime_pct)
    .filter((v): v is number => v !== null);
  if (vals.length === 0) return 0;
  return (
    Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
  );
}

function sparkline(
  key: string,
  n: number,
  base: number,
  amp: number,
): number[] {
  const r = mulberry32(hashSeed(key));
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < n; i++) {
    v = base + (r() * 2 - 1) * amp + Math.sin(i / 3) * amp * 0.6;
    out.push(Math.round(v * 100) / 100);
  }
  return out;
}

/** Pure builder — exported for unit tests (deterministic for a given now). */
export function buildHomeDemoData(now: number): HomeDemoData {
  const snapped = now - (now % DEMO_STEP_MS);
  // a brief latency incident 2h ago on the demo service — honest p95
  // shapes per design.md §8.3 (the 12-minute window keeps the spike a
  // peak, not a plateau: the generator ramps over 5m on each side)
  const outage: OutageWindow = {
    start: snapped - 126 * MINUTE,
    end: snapped - 114 * MINUTE,
  };
  const latencySeries = buildLatencySeries(
    snapped - 4 * HOUR,
    snapped,
    DEMO_STEP_MS,
    outage,
  );

  const heartbeatDays = buildHeartbeatDays(snapped);
  const heartbeat: UptimeDemo = {
    name: "api.cuesoft.io heartbeat",
    days: heartbeatDays,
    uptimePct: meanUptime(heartbeatDays),
    p95Ms: 142,
  };

  // all-up variant for the demo band (§8.2 UptimeCard all-up)
  const allUpDays: UptimeDay[] = heartbeatDays.map((d) => ({
    date: d.date,
    uptime_pct: 100,
    down_minutes: 0,
  }));
  const heartbeatAllUp: UptimeDemo = {
    name: "api.cuesoft.io heartbeat",
    days: allUpDays,
    uptimePct: 100,
    p95Ms: 96,
  };

  const p95Tail = latencySeries[1].points.slice(-24).map((p) => p.value ?? 0);

  const statusDays = (blipDay: number, blipPct: number): UptimeDay[] =>
    allUpDays.map((d, i) =>
      i === blipDay ? { ...d, uptime_pct: blipPct, down_minutes: 8 } : d,
    );
  const apiDays = statusDays(31, 99.3);
  const dashDays = statusDays(57, 98.9);

  return {
    latencySeries,
    latencyQuery: "p95:trace.http.request{env:prod} by service",
    heartbeat,
    heartbeatAllUp,
    availabilitySparkline: sparkline("home:availability", 24, 99.95, 0.04),
    latencySparkline: p95Tail,
    visitorsSparkline: sparkline("home:visitors", 24, 48, 6),
    lcpSparkline: sparkline("home:lcp", 24, 2.4, 0.3),
    alertRule: {
      id: "rule_demo_home",
      name: "Error log spike",
      signal: "log",
      query_string: 'logs("status:error service:web").rollup(count, 5m)',
      thresholds: { warn: null, crit: 50, window: "5m" },
      state: "alert",
      last_triggered_at: null,
    },
    incidentUpdate: {
      ts: "2026-07-16T13:21:00Z",
      phase: "monitoring",
      body: "A fix has been deployed; monitoring recovery.",
    },
    statusRows: [
      { name: "API", days: apiDays, uptimePct: meanUptime(apiDays) },
      { name: "Dashboard", days: dashDays, uptimePct: meanUptime(dashDays) },
    ],
    // real now (not the 5m snap) — the relative label reads "2m ago" exactly
    statusUpdatedAt: new Date(now - 2 * MINUTE)
      .toISOString()
      .replace(/\.\d{3}Z$/, "Z"),
  };
}

/**
 * Pinned demo epoch for the FIRST render. The home page is statically
 * prerendered at build time — seeding the demo with `Date.now()` bakes
 * build-time chart axis labels into the HTML, and hydration (a different
 * 5m bucket) then throws React #418 (text mismatch). First render is
 * deterministic on both sides; a post-mount effect rebuilds with real now.
 */
const DEMO_EPOCH_MS = Date.parse("2026-07-18T09:00:00Z");

export function useHomeDemoData(): HomeDemoData {
  const [data, setData] = useState(() => buildHomeDemoData(DEMO_EPOCH_MS));
  // real clock after hydration — "Last updated 2m ago" stays honest.
  // Deferred a tick (use-request pattern): setState stays out of the
  // synchronous effect body.
  useEffect(() => {
    const t = window.setTimeout(
      () => setData(buildHomeDemoData(Date.now())),
      0,
    );
    return () => window.clearTimeout(t);
  }, []);
  return data;
}

/* ------------------------------------------------------------------ */
/* Hero crosshair loop (A2 — 8s loop over the demo panel)              */
/* ------------------------------------------------------------------ */

export function useCrosshairLoop(
  periodMs = 8000,
  /** Quantization steps — the panel's point count, so state only changes
   *  when the crosshair moves a bucket (a 60fps setState stream starves
   *  React's navigation transitions). */
  steps = 48,
  active = true,
): number | null {
  const [cursor, setCursor] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let last = -1;
    const start = performance.now();
    const tick = (t: number) => {
      if (!document.hidden) {
        const frac = ((t - start) % periodMs) / periodMs;
        const q = Math.round(frac * steps) / steps;
        if (q !== last) {
          last = q;
          setCursor(q);
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [periodMs, steps, active]);

  return cursor;
}

/* ------------------------------------------------------------------ */
/* GitHub stars (A13/A1 — runtime only, badge stays neutral otherwise)  */
/* ------------------------------------------------------------------ */

export function useGithubStars(): number | null {
  const [stars, setStars] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void githubRepo.stars().then((n) => {
      if (!cancelled) setStars(n);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return stars;
}

/* ------------------------------------------------------------------ */
/* Navigation                                                          */
/* ------------------------------------------------------------------ */

export function useHomeController() {
  const router = useRouter();
  const stars = useGithubStars();
  const demo = useHomeDemoData();
  // halt the demo loop the moment a navigation starts — a running rAF
  // state loop starves the router transition
  const [navigating, setNavigating] = useState(false);
  const heroCursor = useCrosshairLoop(
    8000,
    Math.max((demo.latencySeries[0]?.points.length ?? 49) - 1, 1),
    !navigating,
  );

  const onSignIn = useCallback(() => {
    setNavigating(true);
    router.push("/signin");
  }, [router]);

  const onTryCloud = useCallback(() => {
    setNavigating(true);
    router.push("/signin");
  }, [router]);

  const onSelfHost = useCallback(() => {
    document
      .getElementById("self-host")
      ?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return {
    stars,
    demo,
    heroCursor,
    onSignIn,
    onTryCloud,
    onSelfHost,
  };
}
