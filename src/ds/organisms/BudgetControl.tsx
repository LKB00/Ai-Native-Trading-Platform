import { useId, useState } from "react";
import { cn } from "../lib/cn";
import { headingTag, type HeadingLevel } from "../lib/useFocusAfter";
import { AlertIcon } from "../lib/icons";
import { MeterBar } from "../atoms/MeterBar";

export type LimitAction = "stop-and-ask" | "stop" | "ask-for-more";

export interface BudgetLimit {
  id: string;
  /** Plain name, such as "Time", "Spend" or "Steps". */
  label: string;
  used: number;
  cap: number;
  /** Unit shown beside the number, such as "minutes", "credits", "$" or "steps". */
  unit: string;
}

export interface BudgetControlLabels {
  heading?: string;
  whenReached?: string;
  stopAndAsk?: string;
  stop?: string;
  askForMore?: string;
  nearLimit?: string;
  limitReached?: string;
  /** Receives the limit name. */
  capLabel?: (label: string) => string;
}

export interface BudgetControlProps {
  limits: BudgetLimit[];
  /** Called with the limit id and the new cap when the person edits a number. */
  onCapChange?: (id: string, cap: number) => void;
  /** What happens at a limit (controlled). */
  limitAction?: LimitAction;
  defaultLimitAction?: LimitAction;
  onLimitActionChange?: (action: LimitAction) => void;
  /** Fraction of a cap at which a limit counts as close, 0 to 1. */
  warnAt?: number;
  labels?: BudgetControlLabels;
  /** Level of the part's own heading, so it fits the page outline. Default 3. */
  headingLevel?: HeadingLevel;
  className?: string;
}

/** Shows how much of each limit a run has used (time, spend, steps), lets the person change the caps, and sets what happens at a limit. */
export function BudgetControl({ limits, onCapChange, limitAction, defaultLimitAction = "stop-and-ask", onLimitActionChange, warnAt = 0.8, labels, headingLevel = 3, className }: BudgetControlProps) {
  const l = {
    heading: "Limits for this run", whenReached: "When a limit is reached", stopAndAsk: "Stop and ask me", stop: "Stop", askForMore: "Ask for more",
    nearLimit: "Close to the limit", limitReached: "Limit reached", capLabel: (n: string) => `${n} limit`, ...labels,
  };
  const [inner, setInner] = useState<LimitAction>(defaultLimitAction);
  const [caps, setCaps] = useState<Record<string, string>>({});
  const current = limitAction ?? inner;
  const uid = useId();
  const H = headingTag(headingLevel);
  const options: { value: LimitAction; label: string }[] = [
    { value: "stop-and-ask", label: l.stopAndAsk }, { value: "stop", label: l.stop }, { value: "ask-for-more", label: l.askForMore },
  ];
  const state = (x: BudgetLimit) => (x.cap > 0 && x.used >= x.cap ? "reached" : x.cap > 0 && x.used / x.cap >= warnAt ? "near" : "ok");
  const alerts = limits.filter((x) => state(x) !== "ok").map((x) => `${x.label}: ${state(x) === "reached" ? l.limitReached : l.nearLimit}`).join(". ");

  const edit = (x: BudgetLimit, text: string) => {
    setCaps((c) => ({ ...c, [x.id]: text }));
    const n = Number(text);
    if (text.trim() !== "" && Number.isFinite(n) && n >= 0) onCapChange?.(x.id, n);
  };

  return (
    <section aria-label={l.heading} className={cn("rounded-3xl border border-line bg-surface p-4", className)}>
      <H className="text-sm font-medium">{l.heading}</H>
      <ul className="mt-3 space-y-3">
        {limits.map((x) => {
          const s = state(x);
          return (
            <li key={x.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <p className="min-w-0 text-sm font-medium">{x.label}</p>
                <label className="flex items-center gap-2 text-xs text-fg-muted">
                  <span className="sr-only">{l.capLabel(x.label)}</span>
                  <input type="number" min={0} inputMode="decimal" value={caps[x.id] ?? String(x.cap)} onChange={(e) => edit(x, e.target.value)}
                    className="h-9 w-24 rounded-full border border-line bg-surface px-3 text-sm text-fg" />
                  <span>{x.unit}</span>
                </label>
              </div>
              <MeterBar className="mt-2.5" label={x.label} value={Math.min(x.used, x.cap || x.used)} max={x.cap || 1} warnAt={warnAt} valueText={`${x.used} of ${x.cap} ${x.unit} used`} />
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-fg-muted">
                <span>{x.used} of {x.cap} {x.unit} used</span>
                {s !== "ok" && <span className="inline-flex items-center gap-1 font-medium text-fg"><AlertIcon width={12} height={12} />{s === "reached" ? l.limitReached : l.nearLimit}</span>}
              </p>
            </li>
          );
        })}
      </ul>
      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{l.whenReached}</legend>
        <div className="mt-1.5 space-y-1">
          {options.map((o) => (
            <label key={o.value} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-[1.5px]", current === o.value ? "border-line-strong bg-sunken" : "border-transparent hover:bg-hover")}>
              <input type="radio" name={`${uid}-action`} value={o.value} checked={current === o.value} className="size-4 shrink-0 accent-[var(--accent)]"
                onChange={() => { if (limitAction === undefined) setInner(o.value); onLimitActionChange?.(o.value); }} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p role="status" aria-live="polite" className="sr-only">{alerts}</p>
    </section>
  );
}
