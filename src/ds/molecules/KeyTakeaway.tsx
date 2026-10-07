import { useId, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { SparkleIcon } from "../lib/icons";

export interface KeyTakeawayProps {
  /** Visible label. It names the region. */
  label?: string;
  /** One to three sentences that close the answer. */
  children: ReactNode;
  className?: string;
}

/** Closing summary of an answer. An icon and a text label name the region, so it never relies on color. */
export function KeyTakeaway({ label = "Key takeaway", children, className }: KeyTakeawayProps) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-2xl border border-line bg-sunken p-4", className)}>
      <p id={id} className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-fg-muted">
        <span className="flex size-5 items-center justify-center rounded-full bg-lime text-on-lime"><SparkleIcon width={11} height={11} /></span>
        {label}
      </p>
      <div className="mt-2 text-[15px] leading-7 text-fg">{children}</div>
    </section>
  );
}
