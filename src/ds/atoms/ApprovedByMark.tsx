import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn";
import { ApproveIcon, BookmarkIcon, LoopIcon, ShieldIcon } from "../lib/icons";

export type ApprovedBy = "you" | "check" | "rule" | "none";

export interface ApprovedByMarkProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  /** Who said yes: the person, an automatic safety check, a saved rule, or nobody (auto mode). */
  by: ApprovedBy;
  /** Replace the words for one kind. */
  labels?: Partial<Record<ApprovedBy, string>>;
  /** Extra plain detail, such as the name of the saved rule. Added to the tooltip and the screen reader text. */
  detail?: string;
}

const defaults: Record<ApprovedBy, string> = {
  you: "You approved",
  check: "Automatic check approved",
  rule: "Allowed by a saved rule",
  none: "Nobody asked (auto mode)",
};
const icons: Record<ApprovedBy, ReactNode> = {
  you: <ApproveIcon width={13} height={13} />,
  check: <ShieldIcon width={13} height={13} />,
  rule: <BookmarkIcon width={13} height={13} />,
  none: <LoopIcon width={13} height={13} />,
};

/** Small mark that says who approved an action. Always an icon plus words, never color alone. */
export function ApprovedByMark({ by, labels, detail, className, title, ...rest }: ApprovedByMarkProps) {
  const text = labels?.[by] ?? defaults[by];
  return (
    <span title={title ?? detail} className={cn("inline-flex min-w-0 items-center gap-1 text-xs text-fg-muted", className)} {...rest}>
      <span className="shrink-0">{icons[by]}</span>
      <span>{text}</span>
      {detail && <span className="sr-only">. {detail}</span>}
    </span>
  );
}
