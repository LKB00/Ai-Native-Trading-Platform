import { useRef, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";

export interface SegmentOption<T extends string> { value: T; label: string; description?: string }

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Single-choice pill group. Arrow keys move and select, Home and End jump, and only the selected option is a tab stop. */
export function SegmentedControl<T extends string>({ options, value, onChange, label, size = "md", className }: SegmentedControlProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  // If value matches nothing, keep the first option reachable so the group is never skipped by Tab.
  const hasMatch = options.some((o) => o.value === value);
  const move = (i: number, e: KeyboardEvent) => {
    const n = options.length;
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-full border border-line bg-sunken p-0.5", className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} title={o.description}
            tabIndex={on || (!hasMatch && i === 0) ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={(e) => move(i, e)}
            className={cn("cursor-pointer rounded-full font-medium whitespace-nowrap transition-colors", size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-1.5 text-xs",
              on ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg")}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
