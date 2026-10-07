import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { CheckIcon } from "../lib/icons";
import { EmptyState } from "../molecules/EmptyState";
import { MediaFrame, type MediaFrameProps, type MediaRatio } from "../molecules/MediaFrame";

export interface MediaGridItem extends Omit<MediaFrameProps, "ratio" | "className"> {
  id: string;
}

export interface MediaGridProps {
  items: MediaGridItem[];
  /** Maximum columns. The grid uses 2 on small screens, 3 from the md breakpoint and 4 from xl, capped by this value. */
  columns?: 2 | 3 | 4;
  /** Ratio shared by every tile, so rows stay even. */
  ratio?: MediaRatio;
  /** Lets people pick tiles with a checkbox button on each one. */
  selectable?: boolean;
  /** Controlled selection, as item ids. */
  selected?: string[];
  onSelectedChange?: (ids: string[]) => void;
  /** Accessible name of the list. */
  label: string;
  /** Replaces the default empty state. */
  empty?: ReactNode;
  /** Builds the count line. Defaults to "N images". */
  countLabel?: (count: number, selected: number) => string;
  className?: string;
}

const cols: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-3 xl:grid-cols-4",
};

const defaultCount = (n: number, s: number) => `${n} ${n === 1 ? "image" : "images"}${s ? `, ${s} selected` : ""}`;

/**
 * Responsive gallery of MediaFrames with one gap and one ratio. Selection is optional and every control is a native button,
 * so it works with Tab, Enter and Space. When there are no items it shows an EmptyState.
 */
export function MediaGrid({
  items, columns = 4, ratio = "4:3", selectable, selected, onSelectedChange, label, empty, countLabel = defaultCount, className,
}: MediaGridProps) {
  const [inner, setInner] = useState<string[]>([]);
  const picked = selected ?? inner;
  const toggle = (id: string) => {
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    if (selected === undefined) setInner(next);
    onSelectedChange?.(next);
  };

  if (items.length === 0) return <>{empty ?? <EmptyState variant="first-use" title="No images yet" className={className}>Add images and they will appear here.</EmptyState>}</>;

  return (
    <div className={className}>
      <p role="status" className="mb-3 text-xs text-fg-muted">{countLabel(items.length, picked.length)}</p>
      <ul aria-label={label} className={cn("m-0 grid list-none gap-3 p-0", cols[columns])}>
        {items.map((it) => {
          const { id, ...frame } = it;
          const on = picked.includes(id);
          return (
            <li key={id} className="relative min-w-0">
              <div className={cn("rounded-2xl", on && "ring-2 ring-fg ring-offset-2 ring-offset-bg")}>
                <MediaFrame {...frame} ratio={ratio} />
              </div>
              {selectable && (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  aria-label={`Select ${frame.decorative ? `image ${id}` : frame.alt}`}
                  onClick={() => toggle(id)}
                  className={cn(
                    "absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-full border",
                    on ? "border-transparent bg-lime text-on-lime" : "border-line-strong bg-surface text-transparent hover:text-fg-subtle",
                  )}
                >
                  <CheckIcon width={14} height={14} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
