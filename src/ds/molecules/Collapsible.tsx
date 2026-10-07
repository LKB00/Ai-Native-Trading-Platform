import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { ChevronIcon } from "../lib/icons";

export interface CollapsibleProps {
  header: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function Collapsible({ header, children, defaultOpen = false, className }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 text-left">
        <ChevronIcon className={cn("shrink-0 text-fg-subtle transition-transform duration-[var(--dur-fast)]", open && "rotate-90")} />
        {header}
      </button>
      <div id={id} hidden={!open}>{children}</div>
    </div>
  );
}
