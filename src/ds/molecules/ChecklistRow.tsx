import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { AttentionDot } from "../atoms/AttentionDot";

export interface ChecklistItem {
  id: string;
  title: ReactNode;
  badge?: ReactNode;
  status?: string;
  /** Needs a person: amber dot, status in the foreground colour. */
  attention?: boolean;
}

export function ChecklistRow({ item: i }: { item: ChecklistItem }) {
  return (
    <li className="flex items-center gap-3 border-b border-line px-1 py-3 text-[15px]">
      <span className="flex min-w-0 flex-1 items-center gap-2.5">{i.title}{i.badge}</span>
      {i.status && (
        <span className={cn("flex items-center gap-1.5 text-xs", i.attention ? "text-fg" : "text-fg-subtle")}>
          {i.attention && <AttentionDot />}{i.status}
        </span>
      )}
    </li>
  );
}
