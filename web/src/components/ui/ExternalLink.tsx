"use client";

import type { AnchorHTMLAttributes } from "react";
import { isDesktopShell, openExternal } from "@/desktop/bridge";

/**
 * A link that leaves the app. On the web it is a normal new-tab link; in
 * the desktop app (where target=_blank goes nowhere) it opens the system
 * browser.
 */
export function ExternalLink({
  href,
  onClick,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented && isDesktopShell()) {
          e.preventDefault();
          void openExternal(href);
        }
      }}
      {...rest}
    />
  );
}
