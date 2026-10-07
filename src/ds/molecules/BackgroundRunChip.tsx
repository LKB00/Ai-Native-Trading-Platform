import type { ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";
import { AgentStatusIcon, type AgentStatus } from "../atoms/AgentStatusIcon";

export interface BackgroundRunChipProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Name of the run, such as "Trip plan". */
  name: string;
  status: AgentStatus;
  /** Short plain status, such as "Booking hotels". Defaults to the status name. */
  statusText?: string;
  /** How long the run has been going, such as "4 min". */
  elapsed?: string;
  /** Pass true while the details panel this chip opens is showing. */
  expanded?: boolean;
}

const defaults: Record<AgentStatus, string> = {
  working: "Working", "needs-input": "Needs you", idle: "Waiting", completed: "Done", failed: "Failed", stopped: "Stopped",
};

/**
 * Compact chip for a run in the background. It is a button that opens details or a peek. A run that
 * needs a person gets the amber style; every other state stays neutral. The state icon, the words and
 * the time are read together as the button name.
 */
export function BackgroundRunChip({ name, status, statusText, elapsed, expanded, className, type = "button", ...rest }: BackgroundRunChipProps) {
  const needs = status === "needs-input";
  return (
    <button type={type} aria-expanded={expanded} {...rest}
      className={cn("inline-flex max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition-colors duration-[var(--dur-fast)]",
        needs ? "border-transparent bg-attention-soft text-attention-fg hover:opacity-90" : "border-line bg-surface text-fg hover:border-line-strong hover:bg-bg", className)}>
      <AgentStatusIcon status={status} size={14} className={needs ? "text-attention-fg" : undefined} />
      <span className="truncate font-medium">{name}</span>
      <span className={cn("truncate", needs ? "" : "text-fg-muted")}>{statusText ?? defaults[status]}</span>
      {elapsed && <span className={cn("shrink-0 tabular-nums", needs ? "" : "text-fg-subtle")}>{elapsed}</span>}
    </button>
  );
}
