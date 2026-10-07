import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { ShieldIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";

export type Risk = "low" | "medium" | "high";

export interface ApprovalPromptProps {
  action: string;
  /** Exactly what will happen, in plain language. Show real values, not placeholders. */
  detail: ReactNode;
  risk?: Risk;
  onApprove: () => void;
  onDeny: () => void;
  onAlways?: () => void;
}

/**
 * Human-in-the-loop gate for consequential agent actions. Deny is always as easy as approve.
 * Amber means a person must act, so low risk uses the neutral sunken surface, medium uses the attention surface,
 * and high uses the attention surface with a danger badge. The risk is always written out as text.
 */
export function ApprovalPrompt({ action, detail, risk = "medium", onApprove, onDeny, onAlways }: ApprovalPromptProps) {
  return (
    <div role="alertdialog" aria-label={`Approval needed: ${action}`} className={cn("rounded-lg border p-4", risk === "low" ? "border-line bg-sunken" : "border-warning/50 bg-warning-soft/60")}>
      <div className="flex items-center gap-2">
        <ShieldIcon className={risk === "low" ? "text-fg-muted" : "text-warning-fg"} />
        <p className="flex-1 text-sm font-medium">{action}</p>
        <Badge tone={risk === "high" ? "danger" : risk === "medium" ? "warning" : "neutral"}>{risk} risk</Badge>
      </div>
      <div className="mt-2 text-sm text-fg-muted">{detail}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={onApprove}>Approve</Button>
        <Button size="sm" variant="secondary" onClick={onDeny}>Deny</Button>
        {onAlways && risk === "low" && <Button size="sm" variant="ghost" onClick={onAlways}>Always allow</Button>}
      </div>
    </div>
  );
}
