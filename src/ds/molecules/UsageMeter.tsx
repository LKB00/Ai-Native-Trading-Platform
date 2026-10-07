import type { ReactNode } from "react";
import { MeterBar } from "../atoms/MeterBar";
import { cn } from "../lib/cn";

export interface UsageMeterProps {
  /** Credits or quota left. */
  remaining: number;
  /** Full allowance for the period. */
  total: number;
  /** Plural unit name. */
  unit?: string;
  /** Cost of the action about to run, in the same unit. Shows "This will use about N credits". */
  estimate?: number;
  /** Reset time, for example "Resets Nov 1". */
  resetText?: string;
  /** Fraction of the allowance used at which the meter warns, 0 to 1. */
  warnAt?: number;
  /** Slot for an upgrade action. Shown only in the warn state. */
  upgrade?: ReactNode;
  /** Reason shown in the warn state. */
  warnText?: string;
  /** Accessible name for the meter. */
  label?: string;
  className?: string;
}

/** Remaining credits or quota with an optional cost estimate. Warns only when the person may need to act. */
export function UsageMeter({ remaining, total, unit = "credits", estimate, resetText, warnAt = 0.8, upgrade, warnText, label = "Usage", className }: UsageMeterProps) {
  const used = Math.max(0, total - remaining);
  const short = estimate !== undefined && estimate > remaining;
  const low = total > 0 && used / total >= warnAt;
  const warn = low || short;
  const reason = warnText ?? (short ? `Not enough ${unit} left for this.` : `Running low on ${unit}.`);
  const text = `${remaining} of ${total} ${unit} left`;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-fg">{text}</span>
        {resetText && <span className="text-fg-subtle">{resetText}</span>}
      </div>
      <MeterBar label={label} value={used} max={total} warnAt={warnAt} valueText={text} className={short && !low ? "[&>div]:bg-attention" : undefined} />
      {estimate !== undefined && <p className="text-xs text-fg-muted">This will use about {estimate} {unit}.</p>}
      {warn && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-attention-fg">{reason}</span>
          {upgrade}
        </div>
      )}
    </div>
  );
}
