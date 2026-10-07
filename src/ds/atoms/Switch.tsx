import { useId } from "react";
import { cn } from "../lib/cn";

export interface SwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  /** Accessible name. */
  label: string;
  /** Blocks toggling and dims the switch. */
  disabled?: boolean;
  /** Extra context announced after the name through aria-describedby. Rendered as screen reader text. */
  description?: string;
  id?: string;
  className?: string;
}

/** Controlled on/off toggle. The track is 20px tall. The button around it is at least 24px tall, and 44px on coarse pointers. */
export function Switch({ checked, onChange, label, disabled, description, id, className }: SwitchProps) {
  const descId = useId();
  return (
    <button type="button" role="switch" id={id} aria-checked={checked} aria-label={label} disabled={disabled}
      aria-describedby={description ? descId : undefined} onClick={() => { if (!disabled) onChange(!checked); }}
      className={cn("inline-flex min-h-6 min-w-9 shrink-0 cursor-pointer items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:min-w-11", className)}>
      <span aria-hidden className={cn("relative block h-5 w-9 rounded-full border border-transparent forced-colors:border-[CanvasText] transition-colors duration-[var(--dur-fast)]", checked ? "bg-accent" : "bg-line-strong")}>
        <span className={cn("absolute top-px left-px size-4 rounded-full bg-white shadow-sm forced-colors:bg-[CanvasText] transition-transform duration-[var(--dur-fast)]", checked && "translate-x-4")} />
      </span>
      {description && <span id={descId} className="sr-only">{description}</span>}
    </button>
  );
}
