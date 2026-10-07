import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { AlertIcon } from "../lib/icons";
import { Illustration, type IllustrationName } from "../atoms/Illustration";

export type EmptyStateVariant = "first-use" | "no-results" | "cleared" | "error" | "permission" | "offline" | "rate-limit";

interface Preset {
  art: IllustrationName;
  title: string;
  body: string;
  /** True when a person must act, which is the only time amber appears. */
  attention: boolean;
  /** Whether the region announces itself when it appears. */
  live: boolean;
}

/** Default copy follows "cause, then next step". Every string can be overridden. */
const presets: Record<EmptyStateVariant, Preset> = {
  "first-use": { art: "empty-chat", title: "Start your first chat", body: "Nothing is here yet. Ask a question or add a file to begin.", attention: false, live: false },
  "no-results": { art: "no-results", title: "No results for these filters", body: "Try a shorter search or clear the filters.", attention: false, live: true },
  cleared: { art: "success", title: "Everything here is done", body: "New items will show up as they arrive.", attention: false, live: false },
  error: { art: "error", title: "We could not load this", body: "The request failed on our side and your work is safe. Try again.", attention: false, live: false },
  permission: { art: "permission", title: "You need access to see this", body: "This project is private. Ask an owner to add you.", attention: true, live: false },
  offline: { art: "offline", title: "You are offline", body: "Changes are saved on this device and will sync when you reconnect.", attention: false, live: true },
  "rate-limit": { art: "rate-limit", title: "You reached the usage limit", body: "Wait for the limit to reset or upgrade your plan to continue.", attention: true, live: false },
};

export interface EmptyStateProps {
  /** Preset that sets the default art, copy, tone and live behavior. */
  variant?: EmptyStateVariant;
  /** Art slot. Omit for the variant's illustration, pass `null` for none, or pass an Illustration or Pictogram. */
  art?: ReactNode | null;
  /** Names the cause or invites the first step. */
  title?: string;
  /** One short line that gives the next step. */
  children?: ReactNode;
  /** The one primary action, usually a Button. */
  action?: ReactNode;
  /** Optional secondary link or ghost button. */
  secondary?: ReactNode;
  /** `center` suits full panels. `start` left-aligns text for small areas. */
  layout?: "center" | "start";
  /** Drops the art for dense contexts such as tables and menus. */
  compact?: boolean;
  /** Heading level of the title. */
  headingLevel?: 2 | 3 | 4;
  /** Overrides whether the region has role="status". Defaults per variant: no-results and offline only. */
  live?: boolean;
  /** Label of the amber chip shown for permission and rate-limit. */
  attentionLabel?: string;
  className?: string;
}

/**
 * Message for an area with nothing to show. It names the cause, gives one next step and optionally shows art.
 * Presets cover first use, no results, cleared, error, permission, offline and rate limit.
 */
export function EmptyState({
  variant = "first-use", art, title, children, action, secondary, layout = "center", compact = false,
  headingLevel = 3, live, attentionLabel = "Action needed", className,
}: EmptyStateProps) {
  const p = presets[variant];
  const Heading = `h${headingLevel}` as "h3";
  const center = layout === "center";
  const artNode = compact ? null : art === undefined ? <Illustration name={p.art} size={center ? 96 : 64} /> : art;
  const isLive = live ?? p.live;
  return (
    <div
      role={isLive ? "status" : undefined}
      className={cn("flex flex-col gap-4 rounded-3xl border border-line bg-surface p-6", center ? "items-center text-center" : "items-start text-left", compact && "gap-3 p-4", className)}
    >
      {artNode && <div aria-hidden={art === undefined ? true : undefined} className="shrink-0">{artNode}</div>}
      <div className={cn("min-w-0 max-w-[44ch]", center && "mx-auto")}>
        {p.attention && (
          <p className={cn("mb-2 inline-flex items-center gap-1.5 rounded-full bg-attention-soft px-2.5 py-0.5 text-[11px] font-medium text-attention-fg")}>
            <AlertIcon width={12} height={12} />{attentionLabel}
          </p>
        )}
        <Heading className="text-[17px] leading-6 [overflow-wrap:anywhere]">{title ?? p.title}</Heading>
        <p className="mt-1.5 text-sm leading-6 text-fg-muted">{children ?? p.body}</p>
      </div>
      {(action || secondary) && (
        <div className={cn("flex flex-wrap items-center gap-2", center && "justify-center")}>
          {action}{secondary}
        </div>
      )}
    </div>
  );
}
