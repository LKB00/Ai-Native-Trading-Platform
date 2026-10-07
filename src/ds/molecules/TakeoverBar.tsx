import { useRef, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useFocusAfter } from "../lib/useFocusAfter";
import { EyeIcon } from "../lib/icons";
import { AgentStatusIcon } from "../atoms/AgentStatusIcon";
import { Button } from "../atoms/Button";

export type TakeoverState = "you-control" | "agent-working" | "supervise";

export interface TakeoverBarLabels {
  youControl?: string;
  youControlHint?: string;
  agentWorking?: string;
  supervise?: string;
  /** Receives the step the person is asked to watch. */
  superviseHint?: (step: string) => ReactNode;
  takeOver?: string;
  resume?: string;
  handBack?: string;
}

export interface TakeoverBarProps {
  state: TakeoverState;
  /** The step that needs watching. Shown in the supervise state. */
  step?: string;
  /** Person takes control from the agent. Shown in the working and supervise states. */
  onTakeOver?: () => void;
  /** Agent continues from where it paused. */
  onResume?: () => void;
  /** Person gives control back, and the agent continues with what the person changed. */
  onHandBack?: () => void;
  labels?: TakeoverBarLabels;
  className?: string;
}

/**
 * Full-width bar that says who is in control right now. The status sentence sits in one polite
 * live region so a screen reader says it once when the state changes. Only the supervise state uses
 * amber, because only then a person must act.
 */
export function TakeoverBar({ state, step, onTakeOver, onResume, onHandBack, labels, className }: TakeoverBarProps) {
  const l = {
    youControl: "You have control", youControlHint: "The agent is paused and is not doing anything.",
    agentWorking: "The agent is working", supervise: "This step needs you to watch",
    superviseHint: (s: string) => <>The agent will wait while you watch: {s}</>,
    takeOver: "Take over", resume: "Resume", handBack: "Hand back", ...labels,
  };
  const title = state === "you-control" ? l.youControl : state === "agent-working" ? l.agentWorking : l.supervise;
  const actions = useRef<HTMLDivElement>(null);
  // Every button is swapped when control changes hands. Focus moves to the first button of the new state.
  const arm = useFocusAfter(state, () => actions.current?.querySelector("button"));
  const act = (f?: () => void) => () => { arm(); f?.(); };
  const hint = state === "you-control" ? l.youControlHint : state === "supervise" ? (step ? l.superviseHint(step) : null) : null;
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3",
      state === "supervise" ? "border-transparent bg-attention-soft text-attention-fg" : "border-line bg-surface text-fg", className)}>
      <div className="flex min-w-0 flex-1 basis-56 items-start gap-2.5">
        <span className="mt-0.5 shrink-0" aria-hidden>
          {state === "agent-working" ? <AgentStatusIcon status="working" /> : state === "you-control" ? <AgentStatusIcon status="idle" /> : <EyeIcon />}
        </span>
        <div role="status" aria-live="polite" className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          {hint && <p className={cn("text-xs", state === "supervise" ? "text-attention-fg" : "text-fg-muted")}>{hint}</p>}
        </div>
      </div>
      <div ref={actions} className="ml-auto flex flex-wrap justify-end gap-2">
        {state === "agent-working" && <Button variant="secondary" onClick={act(onTakeOver)}>{l.takeOver}</Button>}
        {state === "supervise" && (<><Button variant="secondary" onClick={act(onTakeOver)}>{l.takeOver}</Button><Button onClick={act(onResume)}>{l.resume}</Button></>)}
        {state === "you-control" && (<><Button variant="secondary" onClick={act(onHandBack)}>{l.handBack}</Button><Button onClick={act(onResume)}>{l.resume}</Button></>)}
      </div>
    </div>
  );
}
