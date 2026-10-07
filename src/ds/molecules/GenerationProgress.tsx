import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { AlertIcon, CheckIcon } from "../lib/icons";
import { Button } from "../atoms/Button";
import { MeterBar } from "../atoms/MeterBar";
import { Skeleton } from "../atoms/Skeleton";

export type GenerationStatus = "queued" | "generating" | "finalising" | "done" | "failed";

export interface GenerationProgressProps {
  status: GenerationStatus;
  /** 0 to 100. Shown as a bar while generating. Omit for an indeterminate state. */
  percent?: number;
  /** Place in the queue while queued. */
  queuePosition?: number;
  /** Time estimate such as "About 30 seconds left". */
  eta?: string;
  /** Shown while failed. */
  error?: string;
  onCancel?: () => void;
  onRetry?: () => void;
  /** Result shown when done. While work is under way a skeleton of the same shape stands in. */
  preview?: ReactNode;
  /** Classes for the preview area, to set its aspect ratio. */
  previewClassName?: string;
  /** Replaces the text for each status. Also used for the announcement. */
  labels?: Partial<Record<GenerationStatus, string>>;
  className?: string;
}

const DEFAULT_LABELS: Record<GenerationStatus, string> = {
  queued: "Queued", generating: "Generating", finalising: "Finalising", done: "Done", failed: "Generation failed",
};

/** Status for slow generation. The visible text can change often, but screen readers only hear status changes. */
export function GenerationProgress({ status, percent, queuePosition, eta, error, onCancel, onRetry, preview, previewClassName = "aspect-video", labels, className }: GenerationProgressProps) {
  const text = { ...DEFAULT_LABELS, ...labels };
  const active = status === "queued" || status === "generating" || status === "finalising";
  const determinate = status === "generating" && percent !== undefined;
  const announcement = status === "failed" && error ? `${text.failed}. ${error}` : text[status];
  const pct = percent === undefined ? 0 : Math.round(Math.max(0, Math.min(100, percent)));

  return (
    <div className={cn("space-y-3 rounded-3xl border border-line bg-surface p-3", className)}>
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      <div className={cn("overflow-hidden rounded-2xl", previewClassName)}>
        {status === "done" && preview ? preview : <Skeleton className={cn("h-full w-full", status === "failed" && "animate-none")} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-sm font-medium" aria-hidden>
          {status === "done" && <CheckIcon width={14} height={14} />}
          {status === "failed" && <AlertIcon width={14} height={14} className="text-danger-fg" />}
          <span className={status === "failed" ? "text-danger-fg" : undefined}>{text[status]}</span>
          {status === "queued" && queuePosition !== undefined && <span className="font-normal text-fg-muted">Position {queuePosition}</span>}
          {determinate && <span className="font-normal text-fg-muted">{pct}%</span>}
        </p>
        <div className="flex items-center gap-2">
          {active && eta && <span className="text-xs text-fg-muted">{eta}</span>}
          {active && onCancel && <Button size="sm" variant="secondary" onClick={onCancel}>Cancel</Button>}
          {status === "failed" && onRetry && <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>}
        </div>
      </div>
      {determinate && <MeterBar label="Generation progress" value={pct} valueText={`${pct}%`} />}
      {active && !determinate && status !== "queued" && <div aria-hidden className="h-1.5 w-full rounded-full bg-[linear-gradient(90deg,var(--border)_25%,var(--fg-subtle)_50%,var(--border)_75%)] bg-[length:200%_100%] animate-shimmer" />}
      {status === "failed" && error && <p className="text-xs text-fg-muted">{error}</p>}
    </div>
  );
}
