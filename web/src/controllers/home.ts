"use client";

/**
 * Landing controller — illustration data for the product previews (the
 * page is public, so it never reads a real account), the GitHub star
 * count, and navigation into the app.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { UptimeDay } from "@/models";
import type { Series } from "@/models/chart";
import type { SparklinePoint } from "@/components/ui/Sparkline";
import { githubRepo } from "@/models/repositories";
import {
  HOUR,
  MINUTE,
  hashSeed,
  heartbeatDays,
  latencySeries,
  mulberry32,
} from "./home-demo";

export interface PreviewMonitor {
  name: string;
  target: string;
  status: "up" | "down";
  responseMs: number | null;
  trend: SparklinePoint[];
}

export interface HomeDemoData {
  latency: Series[];
  days: UptimeDay[];
  uptimePct: number;
  monitors: PreviewMonitor[];
  /** "Last updated" for the status-page preview — a minute ago. */
  updatedAt: string;
}

function trend(key: string, base: number, failFrom?: number): SparklinePoint[] {
  const r = mulberry32(hashSeed(key));
  return Array.from({ length: 30 }, (_, i) => {
    const ok = failFrom === undefined || i < failFrom;
    return { ok, value: Math.round(base * (0.8 + r() * 0.45)) };
  });
}

/** Pure — deterministic for a given time (5-minute buckets). */
export function buildHomeDemoData(now: number): HomeDemoData {
  const step = 5 * MINUTE;
  const snapped = now - (now % step);
  const days = heartbeatDays(snapped);
  const known = days.filter((d) => d.uptime_pct !== null);
  const uptimePct =
    Math.round(
      (known.reduce((s, d) => s + (d.uptime_pct ?? 0), 0) / known.length) *
        1000,
    ) / 1000;
  return {
    latency: latencySeries(snapped - 4 * HOUR, snapped, step, {
      start: snapped - 126 * MINUTE,
      end: snapped - 114 * MINUTE,
    }),
    days,
    uptimePct,
    updatedAt: new Date(now - MINUTE).toISOString(),
    monitors: [
      {
        name: "Checkout API",
        target: "https://api.shop.example/health",
        status: "down",
        responseMs: null,
        trend: trend("checkout", 140, 24),
      },
      {
        name: "Website",
        target: "https://shop.example",
        status: "up",
        responseMs: 118,
        trend: trend("website", 120),
      },
      {
        name: "Docs",
        target: "https://docs.shop.example",
        status: "up",
        responseMs: 204,
        trend: trend("docs", 210),
      },
    ],
  };
}

/**
 * First render uses a pinned epoch so the static prerender and hydration
 * agree; a post-mount effect switches to the real clock.
 */
const DEMO_EPOCH_MS = Date.parse("2026-07-18T09:00:00Z");

export function useHomeDemoData(): HomeDemoData {
  const [data, setData] = useState(() => buildHomeDemoData(DEMO_EPOCH_MS));
  useEffect(() => {
    const t = window.setTimeout(
      () => setData(buildHomeDemoData(Date.now())),
      0,
    );
    return () => window.clearTimeout(t);
  }, []);
  return data;
}

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

export function useHomeController() {
  const router = useRouter();
  const stars = useGithubStars();
  const demo = useHomeDemoData();
  const onGetStarted = useCallback(() => router.push("/signin"), [router]);
  return { stars, demo, onGetStarted };
}
