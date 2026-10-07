import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/** Keyboard hint pill such as Tab or Esc. Pair it with the action it triggers, and keep the action reachable without the key. */
export function KeyHint({ children, className }: { children: ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-strong bg-surface px-1.5 font-mono text-[10px] text-fg-muted", className)}>{children}</kbd>;
}
