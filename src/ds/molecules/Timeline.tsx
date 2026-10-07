import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { CheckIcon, XIcon } from "../lib/icons";

export type TimelineState = "done" | "current" | "upcoming" | "failed";

export interface TimelineEvent {
  id: string;
  /** Display text for the time, such as "09:40" or "3 Oct". */
  time: string;
  /** Machine-readable value for the time element, such as "2026-10-03T09:40". */
  dateTime?: string;
  title: string;
  description?: ReactNode;
  /** Optional state. Shown as a marker shape and as text. */
  state?: TimelineState;
}

export interface TimelineProps {
  events: TimelineEvent[];
  /** Text for each state label, for localisation. */
  stateLabels?: Record<TimelineState, string>;
  className?: string;
}

const defaultLabels: Record<TimelineState, string> = { done: "Done", current: "In progress", upcoming: "Upcoming", failed: "Failed" };

/** Vertical timeline as an ordered list. Each event has a time element, a title and an optional state. */
export function Timeline({ events, stateLabels = defaultLabels, className }: TimelineProps) {
  return (
    <ol className={cn("m-0 list-none p-0", className)}>
      {events.map((e, i) => (
        <li key={e.id} className="relative flex gap-4 pb-6 last:pb-0">
          {i < events.length - 1 && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-px bg-line-strong" />}
          <span aria-hidden className={cn("relative z-[1] flex size-6 shrink-0 items-center justify-center rounded-full border",
            e.state === "done" && "border-transparent bg-lime text-on-lime",
            e.state === "current" && "border-fg bg-surface",
            e.state === "failed" && "border-transparent bg-danger-soft text-danger-fg",
            (!e.state || e.state === "upcoming") && "border-line-strong bg-surface")}>
            {e.state === "done" && <CheckIcon width={12} height={12} />}
            {e.state === "current" && <span className="size-2 rounded-full bg-fg" />}
            {e.state === "failed" && <XIcon width={12} height={12} />}
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
              <time dateTime={e.dateTime} className="font-mono text-[11.5px] text-fg-subtle tabular-nums">{e.time}</time>
              <span className="font-medium text-fg">{e.title}</span>
              {e.state && <span className="text-[11px] text-fg-muted">{stateLabels[e.state]}</span>}
            </p>
            {e.description && <div className="mt-1 text-[13px] leading-6 text-fg-muted">{e.description}</div>}
          </div>
        </li>
      ))}
    </ol>
  );
}
