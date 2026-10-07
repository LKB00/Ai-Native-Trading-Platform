import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { ChevronIcon, XIcon } from "../lib/icons";

/**
 * Scope control that lives inside the composer: "what is this chat about?"
 * With onClick it opens a picker (shows a chevron). With onClear it is a removable label.
 */
export function ContextPill({ icon, children, onClick, onClear, className }: { icon?: ReactNode; children: ReactNode; onClick?: () => void; onClear?: () => void; className?: string }) {
  const body = (
    <>
      {icon && <span className="text-fg-subtle">{icon}</span>}
      <span>{children}</span>
      {onClick && <ChevronIcon className="size-3 rotate-90 text-fg-subtle" />}
    </>
  );
  const base = cn("inline-flex h-7 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg", className);
  return (
    <span className={cn("inline-flex items-center", onClear && "rounded-full bg-hover pr-1")}>
      {onClick
        ? <button type="button" onClick={onClick} className={cn(base, "cursor-pointer hover:bg-bg")}>{body}</button>
        : <span className={cn(base, onClear && "border-transparent bg-transparent pr-1")}>{body}</span>}
      {onClear && <button type="button" aria-label="Clear context" onClick={onClear} className="flex size-5 items-center justify-center rounded-full text-fg-subtle hover:bg-line cursor-pointer"><XIcon width={12} height={12} /></button>}
    </span>
  );
}
