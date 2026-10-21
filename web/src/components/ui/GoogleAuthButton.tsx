"use client";

import { clsx } from "clsx";
import Image from "next/image";

/** Google 'G' mark — the brand asset in public/google.png (design.md §8.1),
 *  NOT a Lucide icon. `unoptimized`: served as-is, so it works in the
 *  standalone server build and the desktop static export alike. */
function GoogleGlyph() {
  return (
    <Image
      src="/google.png"
      alt=""
      aria-hidden="true"
      width={18}
      height={18}
      unoptimized
      draggable={false}
      className="size-[18px] shrink-0 select-none"
    />
  );
}

export interface GoogleAuthButtonProps {
  onClick?: () => void;
  /** loading state — "Connecting…" with the glyph swapped for a spinner. */
  loading?: boolean;
  disabled?: boolean;
  /** `lg` = the 44px auth-screen height; default is the 36px compact CTA. */
  size?: "md" | "lg";
  className?: string;
}

/**
 * GoogleAuthButton — the Google sign-in CTA (design.md §8.2b:
 * default / hover / loading). Same name in every CueLABS™ product.
 * Google brand button colors are brand-mandated raw values (white /
 * #1F1F1F / #D9D9D9 — Figma 92:1449), NOT token-bound, in both modes.
 */
export function GoogleAuthButton({
  onClick,
  loading = false,
  disabled = false,
  size = "md",
  className,
}: GoogleAuthButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading}
      className={clsx(
        "font-ui inline-flex w-full items-center justify-center gap-[var(--space-3)]",
        size === "lg" ? "h-11" : "h-9",
        // raw values: the token theme resets Tailwind's default palette,
        // so bg-white does not exist — use arbitrary values
        "rounded-(--radius) border border-[#D9D9D9] bg-[#FFFFFF] px-[var(--space-4)]",
        "text-[14px] font-medium text-[#1F1F1F]",
        "transition-colors duration-[var(--duration-fast)] ease-standard",
        "hover:bg-[#F5F5F5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed",
        !loading && "disabled:opacity-60", // loading is busy, not dimmed (Figma 92:1448)
        className,
      )}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="inline-block size-4 animate-spin rounded-full border-2 border-[#D9D9D9] border-t-brand-deep motion-reduce:animate-none"
        />
      ) : (
        <GoogleGlyph />
      )}
      <span>{loading ? "Signing in…" : "Continue with Google"}</span>
    </button>
  );
}
