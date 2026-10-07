import { cn } from "../lib/cn";

export interface MeterBarProps {
  value: number;
  max?: number;
  /** Accessible name, e.g. "Context used". */
  label: string;
  /** Switch to the attention color at or above this fraction of max (0 to 1). Use only when the person should act. */
  warnAt?: number;
  /** Text read out with the value, e.g. "68% of context". */
  valueText?: string;
  className?: string;
}

/** Thin progress bar exposed as a meter. Ink by default, amber past the warn threshold. */
export function MeterBar({ value, max = 100, label, warnAt, valueText, className }: MeterBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const warn = warnAt !== undefined && value / max >= warnAt;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={valueText}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-line", className)}>
      <div className={cn("h-full origin-left animate-grow-x rounded-full transition-[width] duration-[var(--dur-base)]", warn ? "bg-attention" : "bg-fg")} style={{ width: `${pct}%` }} />
    </div>
  );
}
