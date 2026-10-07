import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { SectionLabel } from "../atoms/SectionLabel";

/**
 * A soft sand surface that holds a short list and, optionally, the composer beneath it,
 * so list and input share one width and edge.
 */
export function Tray({ label, action, children, footer, className }: { label?: string; action?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <section aria-label={label} className={cn("rounded-4xl bg-sunken p-1 shadow-sm", className)}>
      <div className="space-y-1 px-3.5 pt-3 pb-2.5">
        {label && <SectionLabel action={action}>{label}</SectionLabel>}
        <ul className="space-y-0.5">{children}</ul>
      </div>
      {footer}
    </section>
  );
}
