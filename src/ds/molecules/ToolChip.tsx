import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { XIcon } from "../lib/icons";

export interface ToolChipProps {
  /** Tool name, for example "Web search". Also names the remove button. */
  label: string;
  /** Leading icon. Decorative, so it needs no name of its own. */
  icon?: ReactNode;
  /** Called when the remove button is pressed. Omit to render a fixed chip with no remove button. */
  onRemove?: () => void;
  /** Overrides the remove button name. Defaults to `Remove ${label}`. */
  removeLabel?: string;
  className?: string;
}

/** Pill shown in the composer for a tool that is switched on. The remove button is named after the tool. */
export function ToolChip({ label, icon, onRemove, removeLabel, className }: ToolChipProps) {
  return (
    <span className={cn("inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-line bg-sunken pl-3 text-xs font-medium text-fg", onRemove ? "pr-1" : "pr-3", className)}>
      {icon && <span className="flex shrink-0 items-center text-fg-muted">{icon}</span>}
      <span className="truncate">{label}</span>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={removeLabel ?? `Remove ${label}`} title={removeLabel ?? `Remove ${label}`}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-fg-subtle transition-colors hover:bg-hover hover:text-fg">
          <XIcon width={12} height={12} />
        </button>
      )}
    </span>
  );
}
