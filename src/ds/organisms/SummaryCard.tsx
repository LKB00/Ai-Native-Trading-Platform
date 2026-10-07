import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { ChevronIcon } from "../lib/icons";
import { AIBadge } from "../atoms/AIBadge";
import { Spinner } from "../atoms/Spinner";
import { FeedbackBar, type Rating } from "../molecules/FeedbackBar";
import type { Source } from "../molecules/SourceCard";
import { SourceList } from "./SourceList";

export interface SummaryCardProps {
  /** Heading of the block. */
  title?: string;
  /** Text of the AI label. */
  aiLabel?: string;
  /** Status line, for example "Based on 4 sources". Announced politely when it changes. */
  status?: ReactNode;
  /** Show a spinner beside the status while the summary is still being produced. */
  generating?: boolean;
  /** The summary. Place CitationHoverCard markers inline here. Never put aria-live on streamed text. */
  children: ReactNode;
  /** Longer detail revealed by the expand control. Omit to hide the control. */
  detail?: ReactNode;
  expandLabel?: string;
  collapseLabel?: string;
  defaultExpanded?: boolean;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  sources?: Source[];
  /** Disclaimer line under the content. */
  disclaimer?: ReactNode;
  /** Shows the feedback row when provided. */
  onFeedback?: (rating: Exclude<Rating, null>, reason?: string) => void;
  className?: string;
}

/** AI overview block: label and status, summary, optional expandable detail, sources, a disclaimer and a feedback row. */
export function SummaryCard({
  title = "Overview", aiLabel, status, generating, children, detail, expandLabel = "Show more", collapseLabel = "Show less", defaultExpanded = false,
  expanded, onExpandedChange, sources, disclaimer = "AI responses may include mistakes. Check important information.", onFeedback, className,
}: SummaryCardProps) {
  const [inner, setInner] = useState(defaultExpanded);
  const open = expanded ?? inner;
  const id = useId();
  const toggle = () => { const v = !open; if (expanded === undefined) setInner(v); onExpandedChange?.(v); };
  return (
    <section aria-label={title} className={cn("w-full space-y-4 rounded-3xl border border-line bg-surface p-5", className)}>
      <header className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <AIBadge {...(aiLabel ? { label: aiLabel } : {})} />
        <h3 className="text-base text-fg">{title}</h3>
        {status && (
          <p role="status" className="ml-auto flex items-center gap-1.5 text-xs text-fg-muted">
            {generating && <Spinner size={12} label="Working" />}{status}
          </p>
        )}
      </header>
      <div className="text-sm leading-relaxed text-fg">{children}</div>
      {detail && (
        <div>
          <button type="button" aria-expanded={open} aria-controls={id} onClick={toggle}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full text-xs font-medium text-fg-muted hover:text-fg">
            <ChevronIcon width={12} height={12} className={cn("transition-transform duration-[var(--dur-fast)]", open ? "-rotate-90" : "rotate-90")} />
            {open ? collapseLabel : expandLabel}
          </button>
          <div id={id} hidden={!open} className="mt-2 text-sm leading-relaxed text-fg-muted">{detail}</div>
        </div>
      )}
      {sources && sources.length > 0 && <SourceList sources={sources} />}
      {disclaimer && <p className="text-xs text-fg-subtle">{disclaimer}</p>}
      {onFeedback && <FeedbackBar onSubmit={onFeedback} />}
    </section>
  );
}
