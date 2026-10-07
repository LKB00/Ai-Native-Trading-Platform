import { cn } from "../lib/cn";
import { CheckIcon } from "../lib/icons";
import { ChecklistItem, ChecklistRow } from "../molecules/ChecklistRow";

export type { ChecklistItem };

/** Hairline-ruled progress list for a running task. Open items first, finished work folded into one line. */
export function Checklist({ items, doneSummary, className }: { items: ChecklistItem[]; doneSummary?: string; className?: string }) {
  return (
    <ul className={cn("border-t border-line", className)}>
      {items.map((i) => <ChecklistRow key={i.id} item={i} />)}
      {doneSummary && (
        <li className="flex items-center gap-2.5 border-b border-line px-1 py-3 text-sm text-fg-muted">
          <span className="flex size-4 items-center justify-center rounded-full border border-line-strong"><CheckIcon width={10} height={10} /></span>{doneSummary}
        </li>
      )}
    </ul>
  );
}
