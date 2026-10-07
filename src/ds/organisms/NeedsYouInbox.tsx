import { useId, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { AlertIcon, NeedsReviewIcon, ShieldIcon } from "../lib/icons";
import { AgentStatusIcon } from "../atoms/AgentStatusIcon";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { EmptyState } from "../molecules/EmptyState";

export type InboxKind = "question" | "approval" | "failure" | "review";
export type InboxUrgency = "now" | "soon" | "later";

export interface InboxItem {
  id: string;
  /** Name of the run that is waiting. */
  run: string;
  kind: InboxKind;
  urgency: InboxUrgency;
  /** What is needed, in plain words, such as "Pick a hotel". */
  need: string;
  /** How long it has waited, such as "12 min". */
  waited: string;
  /** Label of the action button, such as "Answer". */
  actionLabel: string;
}

export interface NeedsYouInboxLabels {
  title?: string;
  groups?: Partial<Record<InboxUrgency, string>>;
  kinds?: Partial<Record<InboxKind, string>>;
  waiting?: (time: string) => string;
  emptyTitle?: string;
  emptyBody?: string;
}

export interface NeedsYouInboxProps {
  items: InboxItem[];
  /** Called with the item when its action button is pressed. */
  onAction?: (item: InboxItem) => void;
  labels?: NeedsYouInboxLabels;
  /** Heading level. Default 2. */
  headingLevel?: 2 | 3 | 4;
  className?: string;
}

const groupOrder: InboxUrgency[] = ["now", "soon", "later"];
const groupDefaults: Record<InboxUrgency, string> = { now: "Needs you now", soon: "Needs you soon", later: "When you have time" };
const kindDefaults: Record<InboxKind, string> = { question: "Question", approval: "Approval", failure: "Failed", review: "Ready for review" };
const kindIcon: Record<InboxKind, ReactNode> = {
  question: <AgentStatusIcon status="needs-input" size={14} />,
  approval: <ShieldIcon width={14} height={14} />,
  failure: <AlertIcon width={14} height={14} />,
  review: <NeedsReviewIcon width={14} height={14} />,
};

/**
 * One list of everything that is waiting on a person, across all runs. Items are grouped by how
 * urgent they are, and each row says which run, what is needed, how long it has waited and has one
 * action. Rows wrap on a narrow screen. Amber marks only the "now" group, where a person must act.
 */
export function NeedsYouInbox({ items, onAction, labels, headingLevel = 2, className }: NeedsYouInboxProps) {
  const l = {
    title: "Waiting for you", emptyTitle: "Nothing is waiting for you", emptyBody: "When a run needs an answer, an approval or a look, it will show up here.",
    waiting: (t: string) => `Waiting ${t}`, ...labels,
  };
  const groups = { ...groupDefaults, ...labels?.groups };
  const kinds = { ...kindDefaults, ...labels?.kinds };
  const uid = useId();
  const H = `h${headingLevel}` as "h2";
  const H2 = `h${Math.min(headingLevel + 1, 6)}` as "h3";
  const total = items.length;
  return (
    <section aria-labelledby={`${uid}-title`} className={cn("rounded-3xl border border-line bg-surface p-4 sm:p-5", className)}>
      <div className="flex items-center gap-2">
        <H id={`${uid}-title`} className="text-sm font-medium">{l.title}</H>
        {total > 0 && <Badge tone="warning" aria-label={`${total} items`}>{total}</Badge>}
      </div>
      {total === 0 ? (
        <div className="mt-3"><EmptyState variant="cleared" title={l.emptyTitle} compact layout="start" headingLevel={Math.min(headingLevel + 1, 4) as 3 | 4}>{l.emptyBody}</EmptyState></div>
      ) : (
        <div className="mt-3 space-y-4">
          {groupOrder.map((g) => {
            const rows = items.filter((i) => i.urgency === g);
            if (!rows.length) return null;
            return (
              <div key={g}>
                <H2 className="mb-1.5 flex items-center gap-2 text-xs font-medium text-fg-muted">
                  {g === "now" && <AlertIcon width={12} height={12} className="text-attention" />}{groups[g]}<span className="text-fg-subtle">{rows.length}</span>
                </H2>
                <ul className="space-y-1.5">
                  {rows.map((it) => (
                    <li key={it.id} className={cn("flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border px-3 py-2.5", g === "now" ? "border-attention" : "border-line")}>
                      <div className="min-w-0 flex-1 basis-52">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-medium">{it.run}</span>
                          <Badge tone={it.kind === "failure" ? "danger" : "neutral"}>{kindIcon[it.kind]}{kinds[it.kind]}</Badge>
                        </div>
                        <p className="mt-0.5 text-sm break-words text-fg-muted">{it.need}</p>
                        <p className="mt-0.5 text-xs text-fg-subtle">{l.waiting(it.waited)}</p>
                      </div>
                      <div className="ml-auto flex flex-wrap justify-end gap-2">
                        <Button variant={g === "now" ? "primary" : "secondary"} size="sm" onClick={() => onAction?.(it)}
                          aria-label={`${it.actionLabel}: ${it.run}, ${it.need}`}>{it.actionLabel}</Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
