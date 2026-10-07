import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SectionLabelProps {
  children: ReactNode;
  action?: ReactNode;
  /** Element to render. A label is plain text by default. Use a heading level only when it should appear in the page outline. */
  as?: "p" | "h2" | "h3" | "h4";
  className?: string;
}

/** Small uppercase section label, used in trays, rails and lists. */
export function SectionLabel({ children, action, as: Tag = "p", className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center justify-between gap-2 px-1", className)}>
      <Tag className="font-sans! text-[10px] font-normal uppercase tracking-[0.08em] text-fg-muted">{children}</Tag>
      {action && <span className="text-xs text-fg-muted">{action}</span>}
    </div>
  );
}
