import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { headingTag, subHeadingTag, type HeadingLevel } from "../lib/useFocusAfter";
import { ChevronIcon, CheckIcon, HistoryIcon } from "../lib/icons";
import { AttentionDot } from "../atoms/AttentionDot";
import { Button } from "../atoms/Button";

export interface RecapNeed {
  id: string;
  /** What needs the person, in plain words. */
  text: string;
  actionLabel: string;
  onAction?: () => void;
}

export interface RecapChange {
  label: string;
  count: number;
}

export interface ReEntryRecapLabels {
  heading?: string;
  /** Receives the time away, such as "2 hours". */
  away?: (time: string) => string;
  finished?: string;
  needsYou?: string;
  changed?: string;
  nothingFinished?: string;
  nothingNeeded?: string;
  showLog?: string;
}

export interface ReEntryRecapProps {
  /** How long the person was away, such as "2 hours". */
  awayFor: string;
  /** Things that finished while the person was away. */
  finished?: string[];
  /** Things that now wait on the person. */
  needsYou?: RecapNeed[];
  /** What changed, as counts: "Files edited 4". */
  changes?: RecapChange[];
  /** Opens the full log. The button is hidden when omitted. */
  onShowLog?: () => void;
  defaultOpen?: boolean;
  labels?: ReEntryRecapLabels;
  /** Level of the part's own heading, so it fits the page outline. Default 3; the inner group headings are one level below. */
  headingLevel?: HeadingLevel;
  className?: string;
}

/**
 * "While you were away" card shown when a person comes back to a run. It lists what finished, what
 * needs the person (with actions), what changed as counts, and a way to open the full log. The
 * whole card folds down to its header.
 */
export function ReEntryRecap({ awayFor, finished = [], needsYou = [], changes = [], onShowLog, defaultOpen = true, labels, headingLevel = 3, className }: ReEntryRecapProps) {
  const l = {
    heading: "While you were away", away: (t: string) => `You were away for ${t}`, finished: "Finished", needsYou: "Needs you", changed: "What changed",
    nothingFinished: "Nothing has finished yet.", nothingNeeded: "Nothing needs you.", showLog: "Show full log", ...labels,
  };
  const [open, setOpen] = useState(defaultOpen);
  const uid = useId();
  const H = headingTag(headingLevel);
  const H2 = subHeadingTag(headingLevel);
  const Section = ({ title, children }: { title: string; children: ReactNode }) => (
    <div><H2 className="mb-1.5 text-xs font-medium text-fg-muted">{title}</H2>{children}</div>
  );
  return (
    <section aria-labelledby={`${uid}-h`} className={cn("rounded-2xl border border-line bg-surface", className)}>
      <H id={`${uid}-h`} className="m-0">
        <button type="button" aria-expanded={open} aria-controls={`${uid}-body`} onClick={() => setOpen(!open)}
          className="flex w-full cursor-pointer items-center gap-2.5 rounded-2xl px-4 py-3 text-left">
          <HistoryIcon className="shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{l.heading}</span>
            <span className="block text-xs font-normal text-fg-muted">{l.away(awayFor)}</span>
          </span>
          <ChevronIcon className={cn("shrink-0 text-fg-subtle transition-transform duration-[var(--dur-fast)] motion-reduce:transition-none", open && "rotate-90")} />
        </button>
      </H>
      <div id={`${uid}-body`} hidden={!open} className="space-y-4 border-t border-line px-4 py-3">
        <Section title={l.finished}>
          {finished.length ? (
            <ul className="space-y-1">{finished.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm"><CheckIcon className="mt-0.5 shrink-0 text-success" /><span className="min-w-0 break-words">{f}</span></li>
            ))}</ul>
          ) : <p className="text-sm text-fg-muted">{l.nothingFinished}</p>}
        </Section>
        <Section title={l.needsYou}>
          {needsYou.length ? (
            <ul className="space-y-1.5">{needsYou.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-attention px-3 py-2">
                <span className="flex min-w-0 flex-1 basis-48 items-start gap-2 text-sm"><span className="mt-1.5"><AttentionDot /></span><span className="min-w-0 break-words">{n.text}</span></span>
                <div className="ml-auto flex flex-wrap justify-end gap-2"><Button size="sm" onClick={n.onAction}>{n.actionLabel}</Button></div>
              </li>
            ))}</ul>
          ) : <p className="text-sm text-fg-muted">{l.nothingNeeded}</p>}
        </Section>
        {changes.length > 0 && (
          <Section title={l.changed}>
            <ul className="flex flex-wrap gap-2">{changes.map((c) => (
              <li key={c.label} className="rounded-xl bg-sunken px-3 py-1.5 text-xs text-fg-muted"><span className="text-sm font-medium tabular-nums text-fg">{c.count}</span> {c.label}</li>
            ))}</ul>
          </Section>
        )}
        {onShowLog && <Button variant="ghost" size="sm" onClick={onShowLog}>{l.showLog}</Button>}
      </div>
    </section>
  );
}
