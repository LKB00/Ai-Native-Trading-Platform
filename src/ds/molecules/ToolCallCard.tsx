import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { AlertIcon, CheckIcon, ToolIcon } from "../lib/icons";
import { Badge, Tone } from "../atoms/Badge";
import { Spinner } from "../atoms/Spinner";
import { Collapsible } from "./Collapsible";

export type ToolStatus = "pending" | "running" | "success" | "error";

const status: Record<ToolStatus, { tone: Tone; label: string }> = {
  pending: { tone: "neutral", label: "Queued" },
  running: { tone: "accent", label: "Running" },
  success: { tone: "success", label: "Done" },
  error: { tone: "danger", label: "Failed" },
};

export interface ToolCallCardProps {
  name: string;
  status: ToolStatus;
  /** One-line human summary of what the tool is doing, e.g. 'Searching "q3 revenue"'. */
  summary?: string;
  input?: unknown;
  output?: ReactNode;
  durationMs?: number;
}

export function ToolCallCard({ name, status: s, summary, input, output, durationMs }: ToolCallCardProps) {
  const { tone, label } = status[s];
  return (
    <div className={cn("rounded-lg border bg-surface p-3", s === "error" ? "border-danger/40" : "border-line")}>
      <Collapsible
        header={
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-sunken text-fg-muted">
              {s === "running" ? <Spinner size={14} /> : s === "success" ? <CheckIcon className="text-success" /> : s === "error" ? <AlertIcon className="text-danger" /> : <ToolIcon />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-mono text-[13px] font-medium">{name}</span>
              {summary && <span className="block truncate text-xs text-fg-muted">{summary}</span>}
            </span>
            {durationMs != null && s !== "running" && <span className="text-xs text-fg-subtle tabular-nums">{(durationMs / 1000).toFixed(1)}s</span>}
            <Badge tone={tone}>{label}</Badge>
          </span>
        }
      >
        <div className="mt-3 space-y-2 text-xs">
          {input !== undefined && (
            <div>
              <p className="mb-1 font-medium text-fg-subtle">Input</p>
              <pre tabIndex={0} className="overflow-x-auto rounded-md bg-sunken p-2 font-mono leading-5">{JSON.stringify(input, null, 2)}</pre>
            </div>
          )}
          {output != null && (
            <div>
              <p className="mb-1 font-medium text-fg-subtle">Output</p>
              <div className="rounded-md bg-sunken p-2 font-mono leading-5">{output}</div>
            </div>
          )}
        </div>
      </Collapsible>
    </div>
  );
}
