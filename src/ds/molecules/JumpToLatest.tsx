import { cn } from "../lib/cn";
import { ChevronIcon } from "../lib/icons";
import { useReducedMotion } from "../hooks/useReducedMotion";

export interface JumpToLatestProps {
  /** Show the pill. Usually `!atBottom` from useStickToBottom. */
  visible: boolean;
  /** Messages that arrived while the reader was scrolled up. Shown with the "New messages" label when above zero. */
  count?: number;
  /** Scrolls the thread. Usually `scrollToBottom` from useStickToBottom. */
  onClick: () => void;
  /** Label with no unseen messages. */
  label?: string;
  /** Label with unseen messages. */
  newLabel?: string;
  className?: string;
}

/**
 * Floating pill that returns the reader to the newest message. Position it inside a relatively positioned thread.
 * It rises in over 220ms, or appears with no motion when the person prefers reduced motion.
 */
export function JumpToLatest({ visible, count = 0, onClick, label = "Jump to latest", newLabel = "New messages", className }: JumpToLatestProps) {
  const reduced = useReducedMotion();
  if (!visible) return null;
  return (
    <div className={cn("pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center", className)}>
      <button type="button" onClick={onClick}
        className={cn("pointer-events-auto inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-line-strong bg-surface-raised px-4 text-[13px] text-fg shadow-md hover:bg-hover", !reduced && "animate-rise")}>
        <ChevronIcon className="rotate-90" width={14} height={14} />
        <span>{count > 0 ? newLabel : label}</span>
        {count > 0 && <span className="rounded-full bg-lime px-1.5 text-[11px] font-medium text-on-lime tabular-nums"><span className="sr-only">, </span>{count}</span>}
      </button>
    </div>
  );
}
