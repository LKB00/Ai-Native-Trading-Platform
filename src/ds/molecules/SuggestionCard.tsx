import type { ReactNode } from "react";
import { AlertIcon, SearchIcon, SparkleIcon, UsersIcon } from "../lib/icons";
import { Badge, type Tone } from "../atoms/Badge";
import { Button } from "../atoms/Button";

export type SuggestionCategory = "correctness" | "clarity" | "engagement" | "tone";

const categories: Record<SuggestionCategory, { label: string; icon: ReactNode; tone: Tone }> = {
  correctness: { label: "Correctness", icon: <AlertIcon width={11} height={11} />, tone: "danger" },
  clarity: { label: "Clarity", icon: <SearchIcon width={11} height={11} />, tone: "info" },
  engagement: { label: "Engagement", icon: <SparkleIcon width={11} height={11} />, tone: "success" },
  tone: { label: "Tone", icon: <UsersIcon width={11} height={11} />, tone: "neutral" },
};

export interface SuggestionCardProps {
  category?: SuggestionCategory;
  /** Override the category text, for document-specific categories. */
  categoryLabel?: string;
  /** Override the category icon. */
  categoryIcon?: ReactNode;
  /** Text as written. Shown struck through. */
  original: string;
  /** Proposed replacement. Shown highlighted. Leave empty for a deletion. */
  suggestion: string;
  /** Short reason for the change. */
  explanation?: string;
  onAccept?: () => void;
  onDismiss?: () => void;
  acceptLabel?: string;
  dismissLabel?: string;
  className?: string;
}

/** One writing suggestion with a category label, an original-versus-suggested diff, a reason, Accept and Dismiss. Category is always text plus an icon, never color alone. */
export function SuggestionCard({
  category = "correctness", categoryLabel, categoryIcon, original, suggestion, explanation, onAccept, onDismiss,
  acceptLabel = "Accept", dismissLabel = "Dismiss", className,
}: SuggestionCardProps) {
  const c = categories[category];
  const label = categoryLabel ?? c.label;
  return (
    <article aria-label={`${label} suggestion`} className={`w-full max-w-sm space-y-3 rounded-2xl border border-line bg-surface p-4 text-sm shadow-sm ${className ?? ""}`}>
      <Badge tone={c.tone}>{categoryIcon ?? c.icon}{label}</Badge>
      <p className="leading-relaxed text-fg">
        <span className="sr-only">Original: </span>
        <del className="text-fg-muted decoration-danger decoration-2">{original}</del>
        {" "}
        <span className="sr-only">Suggested: </span>
        {suggestion ? <ins className="rounded-sm bg-lime/30 px-0.5 text-fg no-underline">{suggestion}</ins> : <span className="text-fg-muted">(remove)</span>}
      </p>
      {explanation && <p className="text-xs text-fg-muted">{explanation}</p>}
      <div className="flex gap-2">
        <Button size="sm" variant="lime" onClick={onAccept}>{acceptLabel}</Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>{dismissLabel}</Button>
      </div>
    </article>
  );
}
