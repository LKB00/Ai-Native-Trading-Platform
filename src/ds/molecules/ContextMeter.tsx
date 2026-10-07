import { CheckIcon } from "../lib/icons";
import { Button } from "../atoms/Button";
import { MeterBar } from "../atoms/MeterBar";
import { cn } from "../lib/cn";

export interface ContextMeterProps {
  /** Share of the context window in use, 0 to 100. */
  percent: number;
  /** Text beside the bar. Defaults to "68% of context". */
  valueText?: string;
  /** At or above this percent the bar turns amber and Summarize appears. */
  summarizeAt?: number;
  /** Called when the person chooses Summarize. The action stays hidden when omitted. */
  onSummarize?: () => void;
  /** Disables Summarize while a summary is being made. */
  summarizing?: boolean;
  /** Shows a compaction marker with this text, for example "Earlier messages summarized". */
  compactionNote?: string;
  /** Reason shown beside the Summarize action. */
  warnText?: string;
  summarizeLabel?: string;
  /** Accessible name for the meter. */
  label?: string;
  className?: string;
}

/** Context-window usage. Stays neutral until the limit is near, then says why and offers to summarize. */
export function ContextMeter({ percent, valueText, summarizeAt = 85, onSummarize, summarizing, compactionNote, warnText = "Close to the limit.", summarizeLabel = "Summarize", label = "Context used", className }: ContextMeterProps) {
  const pct = Math.round(Math.max(0, Math.min(100, percent)));
  const text = valueText ?? `${pct}% of context`;
  const near = pct >= summarizeAt;
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-fg-muted">{text}</span>
        {near && <span className="text-attention-fg">{warnText}</span>}
      </div>
      <MeterBar label={label} value={pct} warnAt={summarizeAt / 100} valueText={text} />
      {(near && onSummarize) && (
        <Button size="sm" variant="secondary" disabled={summarizing} onClick={onSummarize}>{summarizing ? "Summarizing" : summarizeLabel}</Button>
      )}
      {compactionNote && (
        <p className="flex items-center gap-1.5 border-t border-line pt-2 text-xs text-fg-muted"><CheckIcon width={12} height={12} />{compactionNote}</p>
      )}
    </div>
  );
}
