import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { CheckIcon } from "../lib/icons";
import { AIBadge } from "../atoms/AIBadge";

export interface Variant { id: string; node: ReactNode; label: string }

/** One generated option. Selection shows a check mark, not only a colour change. Arrow key movement between tiles comes from VariantGrid. */
export function VariantTile({ variant: v, selected, onSelect, tabIndex }: {
  variant: Variant; selected: boolean; onSelect: (id: string) => void;
  /** Set to -1 on tiles that are not the tab stop of a roving group. VariantGrid does this for you. Leave unset for a standalone tile. */
  tabIndex?: number;
}) {
  return (
    <button type="button" role="radio" aria-checked={selected} aria-label={v.label} tabIndex={tabIndex} onClick={() => onSelect(v.id)}
      className={cn("group relative aspect-square cursor-pointer overflow-hidden rounded-2xl border-2 text-left transition-all animate-rise", selected ? "border-fg shadow-md" : "border-line hover:border-line-strong")}>
      {v.node}
      <span className="absolute top-2 left-2"><AIBadge label="AI" solid /></span>
      {selected && <span className="absolute right-2 bottom-2 flex size-5 items-center justify-center rounded-full bg-fg text-bg"><CheckIcon width={12} height={12} /></span>}
    </button>
  );
}
