"use client";

import { BellRing, Brain, Check, Globe } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/ui/BrandMark";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusPill } from "@/components/ui/StatusPill";
import { buildHomeDemoData } from "@/controllers/home";

// fixed epoch: the panel is decorative and must render identically on the
// server and after hydration
const PREVIEW = buildHomeDemoData(Date.parse("2026-07-18T09:00:00Z"));

const POINTS = [
  { icon: BellRing, text: "Incidents open and close themselves" },
  { icon: Globe, text: "A public status page your users can trust" },
  { icon: Brain, text: "AI risk scoring for every monitor" },
];

/** Decorative product preview — illustration data, not an account. */
function Preview() {
  return (
    <div
      aria-hidden="true"
      className="w-full max-w-[420px] rounded-[12px] border border-border bg-bg/70 p-2 shadow-2xl backdrop-blur"
    >
      {PREVIEW.monitors.map((m) => (
        <div
          key={m.name}
          className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 odd:bg-bg-elev/60"
        >
          <StatusPill
            status={m.status === "up" ? "ok" : "crit"}
            label={m.status === "up" ? "UP" : "DOWN"}
            className="w-[72px] shrink-0"
          />
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-text">
            {m.name}
          </span>
          <Sparkline points={m.trend} width={88} label={m.name} />
        </div>
      ))}
    </div>
  );
}

/**
 * Auth screens: brand panel (≥lg) beside a centered form column. Below lg
 * the panel folds away and the logo sits above the form.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="font-ui grid min-h-screen bg-bg text-text lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden border-r border-border bg-bg-elev lg:flex lg:flex-col lg:justify-between lg:p-12">
        {/* dot grid + brand glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-[480px] rounded-full bg-brand/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 right-[-120px] size-[420px] rounded-full bg-brand/10 blur-3xl"
        />

        <Link href="/" className="relative w-fit" aria-label="Upstat home">
          <BrandMark
            wordmark
            className="gap-2.5 text-[20px]"
            glyphClassName="size-6"
          />
        </Link>

        <div className="relative flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            <h2 className="max-w-[440px] text-[34px] font-semibold leading-[1.12] tracking-tight">
              Know the moment your site goes down.
            </h2>
            <p className="max-w-[420px] text-[15px] leading-[1.55] text-text-2">
              HTTP checks with retries, automatic incidents and a public status
              page — running around the clock.
            </p>
          </div>
          <Preview />
          <ul className="flex flex-col gap-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-3 text-[14px] text-text"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-brand/15 text-brand-text">
                  <Icon aria-hidden="true" className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-2 text-[12px] text-text-2">
          <Check aria-hidden="true" className="size-3.5 text-ok" />
          Open source · MIT licensed
        </p>
      </aside>

      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        {children}
      </main>
    </div>
  );
}
