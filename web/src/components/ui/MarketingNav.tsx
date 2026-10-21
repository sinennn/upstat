"use client";

import { useState } from "react";
import { clsx } from "clsx";
import Link from "next/link";
import { Menu, Star, X } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { Button } from "./Button";
import { ThemeToggle } from "./ThemeToggle";

export interface MarketingNavProps {
  onSignIn?: () => void;
  onTryCloud?: () => void;
  /** Live GitHub star count — populated at runtime, never a static number (A13). */
  starCount?: number | null;
  className?: string;
}

/** Section anchors on the landing, the live demo status page, GitHub. */
export const NAV_LINKS = [
  { label: "Features", href: "/#features", external: false },
  { label: "How it works", href: "/#how-it-works", external: false },
  { label: "Architecture", href: "/#architecture", external: false },
  { label: "Live status", href: "/status/demo", external: false },
  {
    label: "GitHub",
    href: "https://github.com/cuesoftinc/upstat",
    external: true,
  },
] as const;

/**
 * StarBadge — the GitHub nav item as a compact star chip (canon revision
 * 2026-07-19): star glyph + "Star" + the live runtime count when one
 * arrives. Neutral "Star" in TEST_MODE or on fetch failure — never a
 * static number (§8.2b).
 */
function StarBadge({
  starCount,
  onClick,
  className,
}: {
  starCount: number | null;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <a
      href="https://github.com/cuesoftinc/upstat"
      target="_blank"
      rel="noreferrer"
      aria-label="Star cuesoftinc/upstat on GitHub"
      onClick={onClick}
      className={clsx(
        "items-center gap-1.5 font-medium text-text-2 transition-colors duration-[var(--duration-fast)]",
        className,
      )}
    >
      <Star aria-hidden="true" className="size-3.5" />
      Star
      {typeof starCount === "number" && (
        <span className="tabular-nums text-text">
          {starCount.toLocaleString()}
        </span>
      )}
    </a>
  );
}

/**
 * MarketingNav — logo · section links · live status page · GitHub star
 * badge · ThemeToggle · Sign in · Get started (both → /signin).
 *
 * The bar (border/background) is full-bleed, but the ROW sits on the
 * marketing container (design.md §2: 1152px content at 1440, rails
 * x144/x1296).
 *
 * Mobile (SKILL.md mobile clause, [Revised 2026-07-19]): below `md` the
 * bar keeps the Get started CTA beside the hamburger; the menu-button
 * disclosure (`aria-expanded`) opens a panel carrying the links +
 * ThemeToggle + Sign in — no canonical link may be unreachable at any
 * viewport, and the always-visible bar CTA is not duplicated in the panel.
 */
export function MarketingNav({
  onSignIn,
  onTryCloud,
  starCount = null,
  className,
}: MarketingNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <nav
      aria-label="Marketing"
      className={clsx(
        "font-ui sticky top-0 z-[var(--z-sticky)] border-b border-border bg-bg",
        className,
      )}
    >
      <div
        // gaps compress below md (375w support); md+ is the QA'd layout.
        // max-w matches the Section shell (max-w-[1200px] px-6 → 1152 content).
        className="mx-auto flex h-14 w-full max-w-[1200px] items-center gap-3 px-6 md:gap-4"
      >
        {/* landing v2 brand mark (135:2): filled bolt glyph + lowercase
            wordmark — the shared BrandMark construction */}
        <Link href="/" className="flex items-center">
          <BrandMark wordmark className="text-[16px]" />
        </Link>

        {NAV_LINKS.map((link) =>
          link.label === "GitHub" ? (
            <StarBadge
              key={link.label}
              starCount={starCount}
              className="hidden h-7 rounded-(--radius) border border-border px-2 text-[12px] hover:border-text-2 hover:text-text md:flex"
            />
          ) : (
            <a
              key={link.label}
              href={link.href}
              {...(link.external
                ? { target: "_blank", rel: "noreferrer" }
                : {})}
              className="hidden text-[13px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text md:block"
            >
              {link.label}
            </a>
          ),
        )}

        <div className="flex-1" />

        <ThemeToggle className="hidden md:block" />
        {/* href carries the semantics (middle-click, copy link); onClick
            halts the hero rAF loop before the transition (useHomeController) */}
        <Link
          href="/signin"
          onClick={onSignIn}
          className="hidden text-[13px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text md:block"
        >
          Sign in
        </Link>
        {/* Get started stays in the bar at every viewport ([Revised
            2026-07-19]) — compact below md, standard size on md+. Display
            control lives on wrapper spans: a `hidden` on the Button itself
            fights its base `inline-flex` (same-property utility conflict) */}
        <span className="shrink-0 md:hidden">
          <Button kind="brand" size="sm" onClick={onTryCloud}>
            Get started
          </Button>
        </span>
        <span className="hidden shrink-0 md:block">
          <Button kind="brand" onClick={onTryCloud}>
            Get started
          </Button>
        </span>

        {/* mobile disclosure trigger — the panel below carries the links */}
        <button
          type="button"
          aria-label="Menu"
          aria-expanded={menuOpen}
          aria-controls="marketing-menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="rounded-(--radius) p-1.5 text-text-2 transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-elev hover:text-text md:hidden"
        >
          {menuOpen ? (
            <X aria-hidden="true" className="size-4.5" />
          ) : (
            <Menu aria-hidden="true" className="size-4.5" />
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          id="marketing-menu"
          className="border-t border-border px-6 pt-2 pb-4 md:hidden"
        >
          {NAV_LINKS.map((link) =>
            link.label === "GitHub" ? (
              <StarBadge
                key={link.label}
                starCount={starCount}
                onClick={() => setMenuOpen(false)}
                className="flex py-2.5 text-[14px] hover:text-text"
              />
            ) : (
              <a
                key={link.label}
                href={link.href}
                {...(link.external
                  ? { target: "_blank", rel: "noreferrer" }
                  : {})}
                onClick={() => setMenuOpen(false)}
                className="block py-2.5 text-[14px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
              >
                {link.label}
              </a>
            ),
          )}
          {/* Get started lives in the always-visible bar, not the panel
              ([Revised 2026-07-19] — no duplication) */}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-3">
            <ThemeToggle />
            <Link
              href="/signin"
              onClick={() => {
                setMenuOpen(false);
                onSignIn?.();
              }}
              className="text-[14px] font-medium text-text-2 transition-colors duration-[var(--duration-fast)] hover:text-text"
            >
              Sign in
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
