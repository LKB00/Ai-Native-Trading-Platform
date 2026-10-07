import { cn } from "../lib/cn";
import { Badge } from "../atoms/Badge";

export type ConfidenceLevel = "low" | "medium" | "high";
/** Amber marks low confidence because a person should verify. Medium is neutral: it asks for nothing. */
const map: Record<ConfidenceLevel, { tone: "neutral" | "warning" | "success"; text: string; bars: number }> = {
  low: { tone: "warning", text: "Low confidence. Verify before relying on this.", bars: 1 },
  medium: { tone: "neutral", text: "Moderate confidence. Spot-check key facts.", bars: 2 },
  high: { tone: "success", text: "High confidence, supported by multiple sources.", bars: 3 },
};

/** Never convey confidence by colour alone: bars + text label are always present. */
export function ConfidenceIndicator({ level, showText = true }: { level: ConfidenceLevel; showText?: boolean }) {
  const m = map[level];
  return (
    <span className="inline-flex items-center gap-2" title={m.text}>
      <span className="flex items-end gap-0.5" aria-hidden>
        {[1, 2, 3].map((b) => (
          <span key={b} className={cn("w-1 origin-bottom animate-grow-y rounded-sm", b <= m.bars ? { low: "bg-attention", medium: "bg-fg-subtle", high: "bg-success" }[level] : "bg-line-strong")} style={{ height: 6 + b * 3, animationDelay: `${b * 60}ms` }} />
        ))}
      </span>
      <Badge tone={m.tone}>{level[0].toUpperCase() + level.slice(1)} confidence</Badge>
      {showText && <span className="sr-only">{m.text}</span>}
    </span>
  );
}
