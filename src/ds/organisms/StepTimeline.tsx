import { cn } from "../lib/cn";
import { CheckIcon, XIcon } from "../lib/icons";
import { Spinner } from "../atoms/Spinner";

export type StepState = "done" | "active" | "todo" | "failed";
export interface Step { id: string; title: string; detail?: string; state: StepState }

export function StepTimeline({ steps }: { steps: Step[] }) {
  return (
    <ol aria-label="Task progress" className="space-y-0">
      {steps.map((s, i) => (
        <li key={s.id} className="relative flex gap-3 pb-4 last:pb-0" aria-current={s.state === "active" ? "step" : undefined}>
          {i < steps.length - 1 && <span aria-hidden className={cn("absolute top-6 bottom-0 left-[11px] w-px", s.state === "done" ? "bg-success" : "bg-line")} />}
          <span className={cn("z-10 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
            s.state === "done" && "border-success bg-success text-white",
            s.state === "failed" && "border-danger bg-danger text-white",
            s.state === "active" && "border-accent bg-surface",
            s.state === "todo" && "border-line-strong bg-surface text-fg-subtle")}>
            {s.state === "done" ? <CheckIcon width={12} height={12} /> : s.state === "failed" ? <XIcon width={12} height={12} /> : s.state === "active" ? <Spinner size={14} /> : i + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className={cn("text-sm font-medium", s.state === "todo" && "text-fg-subtle")}>{s.title}</p>
            {s.detail && <p className="text-xs text-fg-muted">{s.detail}</p>}
            <span className="sr-only">{s.state}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}
