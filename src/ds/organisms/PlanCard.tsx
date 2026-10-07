import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { headingTag, type HeadingLevel } from "../lib/useFocusAfter";
import { CheckIcon, InfoIcon, XIcon } from "../lib/icons";
import { Badge, type Tone } from "../atoms/Badge";
import { Button, IconButton } from "../atoms/Button";

export type PlanState = "draft" | "awaiting" | "approved" | "revised";

export interface PlanStep {
  id: string;
  title: string;
  /** One short sentence on what this step does. */
  description?: string;
}

export interface PlanCardLabels {
  approve?: string;
  revise?: string;
  editStep?: string;
  removeStep?: string;
  /** Shown while the plan is a draft. */
  draftNote?: string;
  approvedNote?: string;
  revisedNote?: string;
}

export interface PlanCardProps {
  title: string;
  steps: PlanStep[];
  /** Time or cost estimate, for example "About 6 minutes" or "Around 40 credits". */
  estimate?: ReactNode;
  /** State (controlled). Draft disables the actions, awaiting enables them. */
  state?: PlanState;
  /** Initial state when uncontrolled. */
  defaultState?: PlanState;
  onStateChange?: (state: PlanState) => void;
  onApprove?: () => void;
  onRevise?: () => void;
  /** Adds an Edit button to each step while the plan can still change. */
  onEditStep?: (id: string) => void;
  /** Adds a Remove button to each step while the plan can still change. */
  onRemoveStep?: (id: string) => void;
  /** Read-only badge text. Pass null to hide it. Hidden once approved. */
  readOnlyLabel?: string | null;
  labels?: PlanCardLabels;
  /** Level of the part's own heading, so it fits the page outline. Default 3. */
  headingLevel?: HeadingLevel;
  className?: string;
}

const stateBadge: Record<PlanState, { tone: Tone; text: string }> = {
  draft: { tone: "neutral", text: "Draft" },
  awaiting: { tone: "neutral", text: "Awaiting approval" },
  approved: { tone: "success", text: "Approved" },
  revised: { tone: "info", text: "Revision requested" },
};

/**
 * The plan, shown before any work starts. The person approves it or asks for a revision.
 * Focus stays where it is when the card appears, because a plan is not a blocking request.
 */
export function PlanCard({
  title, steps, estimate, state, defaultState = "awaiting", onStateChange, onApprove, onRevise, onEditStep, onRemoveStep,
  readOnlyLabel = "Nothing has changed yet", labels, headingLevel = 3, className,
}: PlanCardProps) {
  const l = {
    approve: "Approve", revise: "Revise", editStep: "Edit", removeStep: "Remove",
    draftNote: "The plan is still being written.", approvedNote: "Approved. The work can start.", revisedNote: "Revision requested. A new plan will replace this one.",
    ...labels,
  };
  const [inner, setInner] = useState<PlanState>(defaultState);
  const [announce, setAnnounce] = useState("");
  const current = state ?? inner;
  const set = (s: PlanState) => { if (state === undefined) setInner(s); onStateChange?.(s); setAnnounce(stateBadge[s].text); };
  const editable = current === "draft" || current === "awaiting";
  const badge = stateBadge[current];
  const note = current === "draft" ? l.draftNote : current === "approved" ? l.approvedNote : current === "revised" ? l.revisedNote : null;
  const headingId = `${useId()}-plan`;
  const H = headingTag(headingLevel);

  return (
    <section aria-labelledby={headingId} className={cn("rounded-3xl border border-line bg-surface p-5", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <H id={headingId} className="min-w-0 flex-1 text-xl">{title}</H>
        <Badge tone={badge.tone}>{current === "approved" && <CheckIcon width={11} height={11} />}{badge.text}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
        {readOnlyLabel && current !== "approved" && <Badge><InfoIcon width={11} height={11} />{readOnlyLabel}</Badge>}
        {estimate && <span>{estimate}</span>}
      </div>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s.id} className="flex items-start gap-3">
            <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line-strong bg-sunken text-xs tabular-nums text-fg-muted">{i + 1}</span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">{s.title}</p>
              {s.description && <p className="text-xs text-fg-muted">{s.description}</p>}
            </div>
            {editable && (onEditStep || onRemoveStep) && (
              <div className="flex shrink-0 items-center gap-1">
                {onEditStep && <Button size="sm" variant="ghost" onClick={() => onEditStep(s.id)} aria-label={`${l.editStep} step ${i + 1}: ${s.title}`}>{l.editStep}</Button>}
                {onRemoveStep && <IconButton size="sm" label={`${l.removeStep} step ${i + 1}: ${s.title}`} onClick={() => onRemoveStep(s.id)}><XIcon width={14} height={14} /></IconButton>}
              </div>
            )}
          </li>
        ))}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {editable ? (
          <>
            <Button disabled={current === "draft"} onClick={() => { onApprove?.(); set("approved"); }}>{l.approve}</Button>
            <Button variant="secondary" disabled={current === "draft"} onClick={() => { onRevise?.(); set("revised"); }}>{l.revise}</Button>
          </>
        ) : null}
        {note && <p className="text-xs text-fg-muted">{note}</p>}
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </section>
  );
}
