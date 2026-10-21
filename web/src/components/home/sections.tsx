"use client";

import { clsx } from "clsx";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BellRing,
  Brain,
  Globe,
  History,
  KeyRound,
  Radio,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { CodeSnippet } from "@/components/ui/CodeSnippet";
import { FAQItem } from "@/components/ui/FAQItem";
import { Sparkline } from "@/components/ui/Sparkline";
import { StatusPageComponentRow } from "@/components/ui/StatusPageComponentRow";
import { StatusPageHeader } from "@/components/ui/StatusPageHeader";
import { StatusPill } from "@/components/ui/StatusPill";
import { TimeseriesPanel } from "@/components/ui/TimeseriesPanel";
import { UptimeCard } from "@/components/ui/UptimeCard";
import type { HomeDemoData, PreviewMonitor } from "@/controllers/home";
import { GithubIcon } from "./BrandIcons";
import { FAQ_ITEMS, GITHUB_URL, SELF_HOST_TABS } from "./content";
import { Section } from "./Section";

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function PreviewRow({ m }: { m: PreviewMonitor }) {
  const failed = m.trend.filter((p) => !p.ok).length;
  return (
    <div className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
      <StatusPill
        status={m.status === "up" ? "ok" : "crit"}
        label={m.status === "up" ? "UP" : "DOWN"}
        className="w-[76px] shrink-0"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium text-text">
          {m.name}
        </span>
        <span className="font-data truncate text-[11px] text-text-2">
          {m.target}
        </span>
      </span>
      <Sparkline
        points={m.trend}
        width={96}
        label={`${m.name}: last 30 checks${failed ? `, ${failed} failed` : ""}`}
        className="hidden shrink-0 sm:block"
      />
      <span className="font-data w-16 shrink-0 text-right text-[12px] tabular-nums text-text-2">
        {m.responseMs === null ? "timeout" : `${m.responseMs} ms`}
      </span>
    </div>
  );
}

/** A product window composed from the app's own components. */
function ProductPreview({ demo }: { demo: HomeDemoData }) {
  return (
    <div
      aria-label="Upstat dashboard preview"
      role="img"
      className="relative overflow-hidden rounded-[10px] border border-border bg-bg-elev shadow-2xl"
    >
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="size-2.5 rounded-full bg-crit/70" />
        <span className="size-2.5 rounded-full bg-warn/70" />
        <span className="size-2.5 rounded-full bg-ok/70" />
        <span className="font-data ml-3 truncate text-[11px] text-text-2">
          upstat · Monitors
        </span>
      </div>
      <div className="flex items-center gap-2 border-b border-crit/40 bg-crit/10 px-3 py-1.5 text-[12px]">
        <span className="rounded-(--radius) bg-crit px-1.5 text-[10px] font-semibold text-on-brand">
          DOWN
        </span>
        <span className="font-medium text-text">Checkout API is down</span>
        <span className="text-text-2">open 4m</span>
      </div>
      <div className="flex flex-col gap-3 p-3">
        <div className="rounded-(--radius) border border-border bg-bg">
          {demo.monitors.map((m) => (
            <PreviewRow key={m.name} m={m} />
          ))}
        </div>
        <UptimeCard
          name="Website — last 90 days"
          days={demo.days}
          uptimePct={demo.uptimePct}
          status="ok"
          className="w-full"
        />
      </div>
    </div>
  );
}

export function HeroSection({
  demo,
  onGetStarted,
}: {
  demo: HomeDemoData;
  onGetStarted: () => void;
}) {
  return (
    <section className="relative overflow-hidden">
      {/* soft brand glow behind the hero */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] w-full max-w-[900px] rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative mx-auto grid w-full max-w-[1200px] grid-cols-1 items-center gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:py-24">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-bg-elev px-3 py-1 text-[12px] text-text-2">
            <Radio aria-hidden="true" className="size-3.5 text-ok" />
            Open-source uptime monitoring
          </span>
          <h1 className="text-[40px] font-semibold leading-[1.08] tracking-tight text-text md:text-[52px]">
            Know the moment
            <br />
            your site goes down.
          </h1>
          <p className="max-w-[520px] text-[16px] leading-[1.55] text-text-2">
            Upstat checks your URLs around the clock, opens an incident the
            moment they fail, closes it when they recover, and keeps a public
            status page your users can trust — with an AI read on what&apos;s
            likely to break next.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={onGetStarted} data-testid="hero-get-started">
              Get started — it&apos;s free
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
            <Link
              href="/status/demo"
              className="inline-flex h-9 items-center gap-2 rounded-(--radius) border border-border px-4 text-[13px] font-medium text-text transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-60 motion-reduce:animate-none" />
                <span className="relative inline-flex size-2 rounded-full bg-ok" />
              </span>
              See a live status page
            </Link>
          </div>
          <dl className="mt-2 grid grid-cols-3 gap-6 text-left">
            {[
              ["3×", "retries before a check fails"],
              ["90 days", "of uptime history"],
              ["0", "clicks to resolve an incident"],
            ].map(([value, label]) => (
              <div key={label} className="flex flex-col gap-1">
                <dt className="font-data text-[20px] font-semibold text-text">
                  {value}
                </dt>
                <dd className="text-[12px] leading-[1.4] text-text-2">
                  {label}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <ProductPreview demo={demo} />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    title: "Add a URL",
    body: "Name it, paste the address, and pick how often to check it. Sensible defaults: every 60s, 10s timeout, 3 strikes.",
  },
  {
    title: "We watch it",
    body: "A Go worker sends an HTTP GET on schedule. 2xx/3xx is up; anything else is retried twice before it counts as a failure.",
  },
  {
    title: "Incidents run themselves",
    body: "Hit the failure threshold and an incident opens. The next good check closes it and records the downtime. Your status page updates on its own.",
  },
];

export function HowItWorksSection() {
  return (
    <Section
      id="how-it-works"
      title="Set up in a minute. Then forget about it."
      sub="Three steps, and the last one happens without you."
    >
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="relative flex flex-col gap-3 rounded-[10px] border border-border bg-bg-elev p-5"
          >
            <span className="font-data flex size-8 items-center justify-center rounded-full bg-brand/15 text-[13px] font-semibold text-brand-text">
              {i + 1}
            </span>
            <h3 className="text-[16px] font-semibold text-text">
              {step.title}
            </h3>
            <p className="text-[13px] leading-[1.55] text-text-2">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Features                                                            */
/* ------------------------------------------------------------------ */

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Activity,
    title: "HTTP checks with retries",
    body: "Per-monitor interval, timeout and failure threshold. Three attempts per check, so flaky networks don't cry wolf.",
  },
  {
    icon: BellRing,
    title: "Automatic incidents",
    body: "Opened at the threshold with the exact failure reason, resolved on recovery with the outage duration.",
  },
  {
    icon: Globe,
    title: "Public status page",
    body: "Every service, its 90-day strip, 24-hour uptime and incident history — shareable, and it never leaks your URLs.",
  },
  {
    icon: History,
    title: "History and latency",
    body: "Daily uptime for 90 days, the last 100 checks, and response-time percentiles for every monitor.",
  },
  {
    icon: Brain,
    title: "AI risk insight",
    body: "A 0–100 risk score, severity and a plain-English summary with a recommended next step, per monitor.",
  },
  {
    icon: KeyRound,
    title: "Google or email sign-in",
    body: "One click with Google, or a classic email and password. Sessions are signed JWTs; every monitor is private to its owner.",
  },
];

export function FeaturesSection() {
  return (
    <Section
      id="features"
      title="Everything you need to stay up"
      sub="No agents to install, nothing to configure on your servers."
    >
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex flex-col gap-3 rounded-[10px] border border-border bg-bg-elev p-5 transition-colors duration-[var(--duration-fast)] hover:border-brand/50"
          >
            <span className="flex size-9 items-center justify-center rounded-(--radius) bg-brand/15 text-brand-text">
              <Icon aria-hidden="true" className="size-4.5" />
            </span>
            <h3 className="text-[15px] font-semibold text-text">{title}</h3>
            <p className="text-[13px] leading-[1.55] text-text-2">{body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Showcase — status page + latency + insight                          */
/* ------------------------------------------------------------------ */

export function ShowcaseSection({ demo }: { demo: HomeDemoData }) {
  const statusDays = demo.days;
  return (
    <Section
      id="showcase"
      title="What your users see. What you see."
      sub="The public page on the left updates itself; the detail on the right is one click away in the dashboard."
    >
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div
          data-theme="light"
          className="flex flex-col gap-3 rounded-[10px] border border-border bg-bg p-5 text-text"
        >
          <p className="text-[16px] font-semibold">Shop status</p>
          <StatusPageHeader
            overall="partial_outage"
            lastUpdated={demo.updatedAt}
            updatedFormat="relative"
            updatedPlacement="banner"
          />
          <StatusPageComponentRow
            name="Website"
            status="ok"
            statusLabel="UP"
            days={statusDays}
            uptimePct={demo.uptimePct}
            layout="inline"
          />
          <StatusPageComponentRow
            name="Checkout API"
            status="crit"
            statusLabel="DOWN"
            days={statusDays.map((d, i) =>
              i === 89 ? { ...d, uptime_pct: 97.2, down_minutes: 40 } : d,
            )}
            uptimePct={99.84}
            layout="inline"
          />
          <StatusPageComponentRow
            name="Docs"
            status="ok"
            statusLabel="UP"
            days={statusDays.map((d) => ({
              ...d,
              uptime_pct: d.uptime_pct === null ? null : 100,
              down_minutes: 0,
            }))}
            uptimePct={100}
            layout="inline"
          />
        </div>
        <div className="flex flex-col gap-4">
          <TimeseriesPanel
            title="Response time — p50 / p95 / p99"
            titleAs="p"
            unit="ms"
            series={demo.latency}
            height={180}
          />
          <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-bg-elev p-4">
            <p className="flex items-center gap-2 text-[14px] font-semibold text-text">
              <Brain aria-hidden="true" className="size-4 text-brand-text" />
              Insight
            </p>
            <p className="text-[13px]">
              <span className="font-semibold uppercase text-crit-text">
                critical
              </span>{" "}
              <span className="text-text-2">
                · risk 92/100 · anomaly detected
              </span>
            </p>
            <p className="text-[13px] leading-[1.5] text-text">
              Multiple consecutive checks are failing and latency has climbed
              sharply over the last hour.
            </p>
            <p className="text-[13px] leading-[1.5] text-text-2">
              <span className="font-medium text-text">Recommended: </span>
              Investigate recent deploys and upstream dependencies.
            </p>
          </div>
        </div>
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Architecture                                                        */
/* ------------------------------------------------------------------ */

function Node({
  title,
  tech,
  body,
  accent = false,
}: {
  title: string;
  tech: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col gap-1.5 rounded-[10px] border bg-bg-elev p-4",
        accent ? "border-brand/60" : "border-border",
      )}
    >
      <p className="text-[14px] font-semibold text-text">{title}</p>
      <p className="font-data text-[11px] text-brand-text">{tech}</p>
      <p className="text-[12px] leading-[1.5] text-text-2">{body}</p>
    </div>
  );
}

function Edge({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-1.5 py-1 text-text-2 lg:flex-col lg:py-0">
      <ArrowDown aria-hidden="true" className="size-4 lg:hidden" />
      <ArrowRight aria-hidden="true" className="hidden size-4 lg:block" />
      <span className="font-data text-[10px] uppercase tracking-wide">
        {label}
      </span>
    </div>
  );
}

export function ArchitectureSection() {
  return (
    <Section
      id="architecture"
      title="How it's built"
      sub="A typed gRPC contract end to end — the browser speaks the same protobuf messages as the services."
    >
      <div className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr]">
        <Node
          title="Web app"
          tech="Next.js 16 · React 19 · TypeScript"
          body="Dashboard, status pages and sign-in. Talks gRPC-Web directly — no REST layer in between."
        />
        <Edge label="gRPC-Web" />
        <Node
          title="Envoy"
          tech="gRPC-Web ⇄ gRPC proxy"
          body="Translates browser gRPC-Web to native HTTP/2 gRPC and enforces CORS."
        />
        <Edge label="gRPC" />
        <Node
          accent
          title="API + check worker"
          tech="Go · gRPC · JWT auth"
          body="User and monitor services. The worker leases due monitors, runs the HTTP checks and drives the incident state machine."
        />
        <Edge label="driver" />
        <Node
          title="MongoDB"
          tech="monitors · checks · incidents"
          body="Every check result is stored; uptime and percentiles are computed from the raw data."
        />
      </div>
      <div className="mt-2 grid grid-cols-1 gap-2 lg:ml-auto lg:w-[calc(50%+24px)] lg:grid-cols-[auto_1fr]">
        <Edge label="gRPC" />
        <Node
          title="Insight service"
          tech="Python · FastAPI · gRPC"
          body="Scores risk from recent checks, latency trend and incident history, classifies severity, and writes the summary."
        />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Self-host, FAQ, CTA                                                 */
/* ------------------------------------------------------------------ */

export function SelfHostSection() {
  return (
    <Section
      id="self-host"
      title="Run it yourself in one command"
      sub="Open source. Docker Compose starts the whole stack and loads a demo account."
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <CodeSnippet tabs={SELF_HOST_TABS} tabsLabel="Install method" prompt />
        <ul className="flex flex-col gap-3 text-[13px] leading-[1.55] text-text-2">
          {[
            "Go API and check worker, MongoDB, Envoy, the Python insight service and this web app",
            "A demo account with real monitors, 90 days of history and a public status page",
            "Sign in at localhost:2003 with demo@upstat.app / upstat-demo",
          ].map((line) => (
            <li key={line} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand"
              />
              {line}
            </li>
          ))}
          <li>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-medium text-text hover:underline"
            >
              <GithubIcon className="size-4" />
              View the source on GitHub
            </a>
          </li>
        </ul>
      </div>
    </Section>
  );
}

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq" title="Questions">
      <div className="mx-auto flex max-w-[760px] flex-col">
        {FAQ_ITEMS.map((item, i) => (
          <FAQItem
            key={item.question}
            question={item.question}
            answer={item.answer}
            expanded={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
          />
        ))}
      </div>
    </Section>
  );
}

export function FinalCtaSection({
  onGetStarted,
}: {
  onGetStarted: () => void;
}) {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-[14px] border border-border bg-bg-elev px-6 py-12 text-center">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-24 mx-auto h-48 w-full max-w-[600px] rounded-full bg-brand/15 blur-3xl"
        />
        <h2 className="relative text-[28px] font-semibold text-text">
          Your first monitor takes a minute.
        </h2>
        <p className="relative mx-auto mt-3 max-w-[480px] text-[14px] leading-[1.55] text-text-2">
          Sign in with Google or email, paste a URL, and Upstat starts watching
          it right away.
        </p>
        <div className="relative mt-6 flex justify-center">
          <Button onClick={onGetStarted}>
            Get started
            <ArrowRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </Section>
  );
}
