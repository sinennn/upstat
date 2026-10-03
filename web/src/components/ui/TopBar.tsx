"use client";

import { clsx } from "clsx";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

export interface TopBarProps {
  /** Page-level title slot (left). */
  title?: ReactNode;
  /** Signed-in user's email, shown next to sign-out. */
  email?: string | null;
  onSignOut?: () => void;
  className?: string;
}

/**
 * TopBar — app chrome above every /dashboard page: title · the signed-in
 * account · theme toggle · sign out. On mobile the email hides and the
 * controls collapse to icons.
 */
export function TopBar({ title, email, onSignOut, className }: TopBarProps) {
  return (
    <header
      className={clsx(
        "font-ui sticky top-0 z-[var(--z-sticky)] flex h-[43px] items-center gap-1.5 md:gap-3",
        "border-b border-border bg-bg px-3",
        className,
      )}
    >
      <div className="min-w-0 truncate text-[13px] font-medium text-text">
        {title}
      </div>

      <div className="flex-1" />

      {email && (
        <span className="hidden max-w-[240px] truncate text-[12px] text-text-2 md:inline">
          {email}
        </span>
      )}

      <ThemeToggle />

      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Sign out"
          className="flex items-center gap-1.5 rounded-(--radius) p-1.5 text-[12px] text-text-2 transition-colors duration-[var(--duration-fast)] hover:bg-bg-elev hover:text-text"
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span className="hidden md:inline">Sign out</span>
        </button>
      )}
    </header>
  );
}
