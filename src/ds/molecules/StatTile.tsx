import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { MeterBar } from "../atoms/MeterBar";
import { AlertIcon } from "../lib/icons";

export type DeltaDirection = "up" | "down" | "flat";

export interface StatDelta {
  /** Signed text with the unit, for example "+4.2%" or "-120 ms". */
  text: string;
  /** Which way the number moved. Drives the arrow. */
  direction: DeltaDirection;
  /** The comparison period, for example "vs previous 7 days". */
  versus?: string;
}

export interface StatThreshold {
  /** Current value on the same scale as max. */
  value: number;
  /** Upper end of the scale. */
  max: number;
  /** Where the threshold tick sits on the scale. */
  at: number;
  /** Visible name for the tick, for example "Target 800 ms". */
  label: string;
}

export interface StatTileProps {
  /** Metric name in sentence case, without a trailing colon. */
  label: string;
  /** Formatted value, for example "1.24 s" or "$4.2K". */
  value: string;
  /** Set the value in the serif. */
  serif?: boolean;
  /** Change since the comparison period. */
  delta?: StatDelta;
  /** Which direction of change is an improvement. Use "down" for latency, cost and error rate. */
  goodDirection?: "up" | "down" | "neutral";
  /** A visible detail line under the value, such as an interval or a sample size. */
  detail?: string;
  /** Slot for a Sparkline. Pass it with decorative set, since the value and delta already say the numbers. */
  spark?: ReactNode;
  /** Draws a thin scale with a tick at the threshold. */
  threshold?: StatThreshold;
  /** A person has to act on this metric. Shows an amber chip with text. Leave off for ordinary good or bad movement. */
  needsAction?: boolean;
  /** Text of the amber chip. */
  actionText?: string;
  className?: string;
}

const Arrow = ({ d }: { d: DeltaDirection }) => {
  const I = d === "up" ? ArrowUp : d === "down" ? ArrowDown : Minus;
  return <I size={14} strokeWidth={2} aria-hidden />;
};

/**
 * One headline number with its change. The delta carries an arrow and text, and a visible "better" or "worse" word,
 * so the meaning never rests on color. goodDirection decides which way counts as better, so a drop in latency reads as good.
 */
export function StatTile({ label, value, serif, delta, goodDirection = "up", detail, spark, threshold, needsAction, actionText = "Needs review", className }: StatTileProps) {
  const verdict = !delta || delta.direction === "flat" || goodDirection === "neutral" ? "none" : delta.direction === goodDirection ? "better" : "worse";
  const tone = verdict === "better" ? "text-success-fg" : verdict === "worse" ? "text-danger-fg" : "text-fg-muted";
  const dirWord = delta ? { up: "up", down: "down", flat: "unchanged" }[delta.direction] : "";
  return (
    <div role="group" aria-label={label} className={cn("min-w-0 rounded-2xl border border-line bg-surface p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs leading-5 text-fg-muted">{label}</p>
        {needsAction && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-attention-soft px-2 py-0.5 text-[11px] leading-4 font-medium text-attention-fg"><AlertIcon width={12} height={12} />{actionText}</span>}
      </div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <p className={cn("min-w-0 text-[30px] leading-9 font-medium tracking-[-0.01em] text-fg [overflow-wrap:anywhere]", serif && "font-serif font-normal")}>{value}</p>
        {spark && <div className="shrink-0 pb-1">{spark}</div>}
      </div>
      {delta && (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs leading-5">
          <span className={cn("inline-flex items-center gap-1 font-medium", tone)}>
            <Arrow d={delta.direction} />
            <span className="sr-only">{dirWord}, </span>{delta.text}
            {verdict !== "none" && <span className="font-normal">{verdict}</span>}
          </span>
          {delta.versus && <span className="text-fg-subtle">{delta.versus}</span>}
        </p>
      )}
      {detail && <p className="mt-1 text-xs leading-5 text-fg-muted">{detail}</p>}
      {threshold && (
        <div className="mt-3">
          <div className="relative">
            <MeterBar label={label} value={threshold.value} max={threshold.max} warnAt={needsAction ? threshold.at / threshold.max : undefined}
              valueText={`${value}. ${threshold.label}.`} />
            <span aria-hidden className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-fg" style={{ left: `${Math.max(0, Math.min(100, (threshold.at / threshold.max) * 100))}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] leading-4 text-fg-subtle">{threshold.label}</p>
        </div>
      )}
    </div>
  );
}
