import type { ReactNode } from "react";
import { SparkleIcon, XIcon } from "../lib/icons";
import { Button, IconButton } from "../atoms/Button";
import { cn } from "../lib/cn";

export interface MemoryNoticeProps {
  /** Heading. */
  title?: string;
  /** What was saved, in the person's terms. */
  saved: ReactNode;
  /** Opens the memory manager. The button is hidden when omitted. */
  onManage?: () => void;
  /** Removes the saved item. The button is hidden when omitted. */
  onUndo?: () => void;
  /** Dismisses the notice. The close button is hidden when omitted. */
  onDismiss?: () => void;
  manageLabel?: string;
  undoLabel?: string;
  dismissLabel?: string;
  className?: string;
}

/** Inline notice shown at the moment something is saved to memory. It names what was saved and offers Manage and Undo. */
export function MemoryNotice({ title = "Memory updated", saved, onManage, onUndo, onDismiss, manageLabel = "Manage", undoLabel = "Undo", dismissLabel = "Dismiss memory notice", className }: MemoryNoticeProps) {
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-2xl border border-line bg-sunken px-4 py-3 text-sm", className)}>
      <SparkleIcon className="mt-0.5 shrink-0 text-fg-muted" width={14} height={14} />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{title}</p>
        <p className="mt-0.5 text-fg-muted">{saved}</p>
        {(onManage || onUndo) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {onManage && <Button size="sm" variant="secondary" onClick={onManage}>{manageLabel}</Button>}
            {onUndo && <Button size="sm" variant="ghost" onClick={onUndo}>{undoLabel}</Button>}
          </div>
        )}
      </div>
      {onDismiss && <IconButton size="sm" label={dismissLabel} onClick={onDismiss}><XIcon /></IconButton>}
    </div>
  );
}
