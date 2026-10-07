import { cn } from "../lib/cn";

export type AgentStatus = "working" | "needs-input" | "idle" | "completed" | "failed" | "stopped";

const defaultLabels: Record<AgentStatus, string> = {
  working: "Working",
  "needs-input": "Needs input",
  idle: "Idle",
  completed: "Completed",
  failed: "Failed",
  stopped: "Stopped",
};

const tone: Record<AgentStatus, string> = {
  working: "text-fg-muted",
  "needs-input": "text-attention",
  idle: "text-fg-subtle",
  completed: "text-success",
  failed: "text-danger",
  stopped: "text-fg-subtle",
};

export interface AgentStatusIconProps {
  status: AgentStatus;
  /** Glyph size in px. */
  size?: number;
  /** Override the accessible text for this status, for example for another language. */
  label?: string;
  /** Show the label as visible text beside the glyph. The glyph is then hidden from assistive tech so the text is read once. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Status glyph for an agent session. Each status has its own shape (working arc, question mark,
 * dash, check, cross, square), so it reads without color. Needs input uses the attention color
 * because a person must act. The working arc spins and is static under prefers-reduced-motion.
 */
export function AgentStatusIcon({ status, size = 16, label, showLabel = false, className }: AgentStatusIconProps) {
  const text = label ?? defaultLabels[status];
  const svg = (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={showLabel ? true : undefined} role={showLabel ? undefined : "img"} aria-label={showLabel ? undefined : text}
      className={cn("shrink-0", tone[status], status === "working" && "animate-spin", !showLabel && className)}>
      {status === "working" && (<><circle cx="12" cy="12" r="9" strokeOpacity="0.25" /><path d="M21 12a9 9 0 0 0-9-9" /></>)}
      {status === "needs-input" && (<><circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" /><path d="M9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.8-1.1 1.6M12 16.6h.01" stroke="var(--surface)" strokeWidth={2} /></>)}
      {status === "idle" && (<><circle cx="12" cy="12" r="9" /><path d="M8.5 12h7" /></>)}
      {status === "completed" && (<><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" /></>)}
      {status === "failed" && (<><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>)}
      {status === "stopped" && <rect x="5" y="5" width="14" height="14" rx="3" />}
    </svg>
  );
  if (!showLabel) return svg;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium text-fg", className)}>
      {svg}
      {text}
    </span>
  );
}
