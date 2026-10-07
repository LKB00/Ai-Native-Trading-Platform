import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { AlertIcon, ChevronIcon, PinIcon, RegenerateIcon, RetryIcon } from "../lib/icons";
import { Button } from "../atoms/Button";
import { Spinner } from "../atoms/Spinner";
import { AILabel } from "../molecules/AILabel";

export type GeneratedSurfaceStatus = "streaming" | "ready" | "failed";

export interface GeneratedSurfaceLabels {
  madeBy?: (source: string) => string;
  viewSpec?: string;
  hideSpec?: string;
  pin?: string;
  pinned?: string;
  regenerate?: string;
  report?: string;
  retry?: string;
  streaming?: string;
  failed?: string;
  /** Intro of the AI label's explainer. */
  overview?: string;
}

export interface GeneratedSurfaceProps {
  /** Who made this, such as "Orders helper". Always visible. */
  source: string;
  /** The generated screen, usually a GenUIRenderer. */
  children?: ReactNode;
  status?: GeneratedSurfaceStatus;
  /** The spec behind the screen. Shown as JSON under "View spec". Pass a string to show it as is. */
  spec?: unknown;
  /** Whether the screen is pinned (controlled). */
  pinned?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  onRegenerate?: () => void;
  onReport?: () => void;
  /** Called by the Try again button when status is failed. */
  onRetry?: () => void;
  /** Plain text version of the answer. Shown when status is failed, so the person still gets something. */
  fallback?: ReactNode;
  labels?: GeneratedSurfaceLabels;
  className?: string;
}

function specText(spec: unknown): string {
  if (typeof spec === "string") return spec;
  try { return JSON.stringify(spec, null, 2) ?? ""; } catch { return "The spec could not be shown."; }
}

/**
 * The frame around a generated screen. It says who made it, lets the person read the spec, pin the screen, ask for a new
 * one or report it, and falls back to plain text when generation fails. Pin and regenerate have no published source:
 * they are our own design, so treat them as experimental.
 */
export function GeneratedSurface({ source, children, status = "ready", spec, pinned, onPinnedChange, onRegenerate, onReport, onRetry, fallback, labels, className }: GeneratedSurfaceProps) {
  const l = {
    madeBy: (s: string) => `Made by ${s}`, viewSpec: "View spec", hideSpec: "Hide spec", pin: "Pin", pinned: "Pinned", regenerate: "Regenerate", report: "Report",
    retry: "Try again", streaming: "Still being made…", failed: "This screen could not be made. Here is the answer as text.",
    overview: "This screen was made by an assistant. The app checked each part before showing it.", ...labels,
  };
  const [innerPinned, setInnerPinned] = useState(false);
  const isPinned = pinned ?? innerPinned;
  const [open, setOpen] = useState(false);
  const specId = useId();
  const togglePin = () => { const v = !isPinned; if (pinned === undefined) setInnerPinned(v); onPinnedChange?.(v); };

  return (
    <section aria-label={l.madeBy(source)} className={cn("min-w-0 rounded-3xl border border-line bg-surface p-4", className)}>
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <AILabel level="message" size={18} text={l.madeBy(source)} overview={l.overview} />
        {status === "streaming" && <span role="status" className="inline-flex items-center gap-1.5 text-xs text-fg-muted"><span aria-hidden><Spinner /></span>{l.streaming}</span>}
        <div className="ml-auto flex flex-wrap justify-end gap-1">
          <Button size="sm" variant="ghost" aria-pressed={isPinned} onClick={togglePin} leading={<PinIcon width={14} height={14} />}>{isPinned ? l.pinned : l.pin}</Button>
          {onRegenerate && <Button size="sm" variant="ghost" onClick={onRegenerate} disabled={status === "streaming"} leading={<RegenerateIcon width={14} height={14} />}>{l.regenerate}</Button>}
          {onReport && <Button size="sm" variant="ghost" onClick={onReport}>{l.report}</Button>}
        </div>
      </header>

      <div className="mt-3 min-w-0" aria-busy={status === "streaming"}>
        {status === "failed" ? (
          <div className="space-y-3">
            <p role="alert" className="flex items-start gap-2 rounded-2xl bg-sunken p-3 text-sm text-fg-muted"><AlertIcon className="mt-0.5 shrink-0" aria-hidden />{l.failed}</p>
            {fallback && <div className="text-sm text-fg">{fallback}</div>}
            {onRetry && <Button size="sm" variant="secondary" onClick={onRetry} leading={<RetryIcon width={14} height={14} />}>{l.retry}</Button>}
          </div>
        ) : children}
      </div>

      {spec !== undefined && (
        <div className="mt-3 border-t border-line pt-2">
          <button type="button" aria-expanded={open} aria-controls={specId} onClick={() => setOpen(!open)}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-1 text-xs font-medium text-fg-muted hover:text-fg">
            <ChevronIcon width={12} height={12} className={cn("transition-transform motion-reduce:transition-none", open && "rotate-90")} aria-hidden />
            {open ? l.hideSpec : l.viewSpec}
          </button>
          <div id={specId} hidden={!open}>
            {open && <pre tabIndex={0} className="mt-2 max-h-72 overflow-auto rounded-xl bg-code p-3 font-mono text-xs leading-5 text-code-fg"><code>{specText(spec)}</code></pre>}
          </div>
        </div>
      )}
    </section>
  );
}
