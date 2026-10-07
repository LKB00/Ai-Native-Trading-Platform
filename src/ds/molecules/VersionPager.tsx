import { useState, type ReactNode } from "react";
import { ChevronIcon } from "../lib/icons";
import { IconButton } from "../atoms/Button";
import { cn } from "../lib/cn";

export interface VersionPagerProps {
  /** Number of sibling versions, from edits and regenerations. */
  total: number;
  /** Controlled current version, 1-based. Omit to let the pager manage itself. */
  current?: number;
  /** Starting version in uncontrolled mode. Defaults to the last version. */
  defaultCurrent?: number;
  /** Called with the new 1-based version when the person steps. */
  onChange?: (version: number) => void;
  /** Shows a small "edited" label when the current version came from an edit. */
  edited?: boolean;
  /** Text for the edited label. */
  editedLabel?: string;
  /** Slot for an action such as a "Branch from here" button. */
  branchAction?: ReactNode;
  /** Builds the polite announcement. Defaults to "Version 2 of 3". */
  announce?: (current: number, total: number) => string;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
}

/** Pager for sibling versions of one message. Announces each change through a separate polite status region. */
export function VersionPager({ total, current, defaultCurrent, onChange, edited, editedLabel = "Edited", branchAction, announce = (c, t) => `Version ${c} of ${t}`, label = "Message versions", className }: VersionPagerProps) {
  const [inner, setInner] = useState(defaultCurrent ?? total);
  const [message, setMessage] = useState("");
  const value = Math.min(Math.max(current ?? inner, 1), Math.max(total, 1));
  const go = (next: number) => {
    if (next < 1 || next > total) return;
    if (current === undefined) setInner(next);
    onChange?.(next);
    setMessage(announce(next, total));
  };
  return (
    <div role="group" aria-label={label} className={cn("inline-flex max-w-full flex-wrap items-center gap-1.5 text-xs text-fg-muted", className)}>
      <IconButton size="sm" label="Previous version" disabled={value <= 1} onClick={() => go(value - 1)}><ChevronIcon className="rotate-180" /></IconButton>
      <span className="min-w-8 text-center tabular-nums" aria-hidden="true">{value}/{total}</span>
      <IconButton size="sm" label="Next version" disabled={value >= total} onClick={() => go(value + 1)}><ChevronIcon /></IconButton>
      {edited && <span className="rounded-full border border-line bg-sunken px-2 py-0.5 text-[11px] leading-4">{editedLabel}</span>}
      {branchAction}
      <span role="status" className="sr-only">{message}</span>
    </div>
  );
}
