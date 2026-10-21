"use client";

import { clsx } from "clsx";
import { CircleAlert, CircleCheck, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type ToastKind = "ok" | "crit" | "info";

export interface ToastInput {
  kind?: ToastKind;
  title: string;
  body?: string;
}

interface ToastItem extends Required<Pick<ToastInput, "kind" | "title">> {
  id: number;
  body?: string;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** Push a transient notification (no-op outside a ToastProvider). */
export function useToast(): (t: ToastInput) => void {
  return useContext(ToastContext);
}

const ICON = { ok: CircleCheck, crit: CircleAlert, info: Info };
const TINT: Record<ToastKind, string> = {
  ok: "text-ok-text",
  crit: "text-crit-text",
  info: "text-brand-text",
};
const DISMISS_MS = 6000;

/**
 * Toast stack — bottom-right, newest on top, auto-dismissing. The region
 * is `aria-live="polite"`, so screen readers hear monitor state changes
 * as they happen.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    ({ kind = "info", title, body }: ToastInput) => {
      const id = ++nextId.current;
      setItems((list) => [{ id, kind, title, body }, ...list].slice(0, 4));
      window.setTimeout(() => dismiss(id), DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-[var(--z-toast)] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2"
      >
        {items.map((t) => {
          const Icon = ICON[t.kind];
          return (
            <div
              key={t.id}
              role="status"
              data-kind={t.kind}
              className={clsx(
                "font-ui pointer-events-auto flex items-start gap-3 rounded-(--radius) border border-border bg-bg-elev p-3 shadow-xl",
                "animate-[slide-in_var(--duration-fast)_var(--ease-standard)] motion-reduce:animate-none",
              )}
            >
              <Icon
                aria-hidden="true"
                className={clsx("mt-0.5 size-4 shrink-0", TINT[t.kind])}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-[13px] font-medium text-text">{t.title}</p>
                {t.body && (
                  <p className="line-clamp-2 break-words text-[12px] leading-[1.45] text-text-2">
                    {t.body}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="rounded-(--radius) p-0.5 text-text-2 hover:text-text"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
