import type { ReactNode } from "react";
import { XIcon } from "../lib/icons";
import { Button, IconButton } from "../atoms/Button";
import { cn } from "../lib/cn";

/** Private inline glyph: a ghost, 24px grid, 1.5 stroke. */
function GhostIcon({ className }: { className?: string }) {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M5 21V11a7 7 0 0 1 14 0v10l-3.5-2.5L12 21l-3.5-2.5L5 21z" /><path d="M9.5 11h.01M14.5 11h.01" />
    </svg>
  );
}

export interface PrivateChatBannerProps {
  /** "banner" is a full-width strip with retention copy. "compact" is a pill for headers. */
  variant?: "banner" | "compact";
  /** Name of the mode. */
  label?: string;
  /** Plain retention copy. State the real retention period for your product. */
  description?: ReactNode;
  /** Leaves the private chat. */
  onExit?: () => void;
  exitLabel?: string;
  className?: string;
}

/** Persistent indicator that the current chat is private. Neutral on purpose, because nothing needs fixing. */
export function PrivateChatBanner({ variant = "banner", label = "Private chat", description = "Not saved to your history or memory and not used for training. A copy may be kept for 30 days.", onExit, exitLabel = "Exit", className }: PrivateChatBannerProps) {
  if (variant === "compact") {
    return (
      <div className={cn("inline-flex items-center gap-1.5 rounded-full border border-line-strong bg-sunken py-0.5 pr-0.5 pl-2.5 text-xs font-medium text-fg", className)}>
        <GhostIcon className="text-fg-muted" />
        <span>{label}</span>
        {onExit ? <IconButton size="sm" label={`Exit ${label.toLowerCase()}`} onClick={onExit}><XIcon /></IconButton> : <span className="w-2" />}
      </div>
    );
  }
  return (
    <section aria-label={label} className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line-strong bg-sunken px-4 py-3", className)}>
      <GhostIcon className="shrink-0 text-fg-muted" />
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="text-xs text-fg-muted">{description}</p>
      </div>
      {onExit && <Button size="sm" variant="secondary" onClick={onExit}>{exitLabel}</Button>}
    </section>
  );
}
