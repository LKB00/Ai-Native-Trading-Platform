import { useRef, type KeyboardEvent } from "react";
import { Skeleton } from "../atoms/Skeleton";
import { Variant, VariantTile } from "../molecules/VariantTile";


export type { Variant };

/**
 * Generated options as a radio group. Loading slots reserve space so the layout never jumps.
 * Focus roves like a native radio group: only the selected tile (or the first when none is selected) is a tab stop,
 * arrow keys move focus and select with wrapping, and Home and End jump to the first and last tile.
 */
export function VariantGrid({ variants, selectedId, onSelect, loadingCount = 0 }: { variants: Variant[]; selectedId?: string; onSelect: (id: string) => void; loadingCount?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const selectedIndex = variants.findIndex((v) => v.id === selectedId);
  const stop = selectedIndex >= 0 ? selectedIndex : 0;

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey || !variants.length) return;
    const tiles = Array.from(ref.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? []);
    const from = tiles.indexOf(document.activeElement as HTMLElement);
    if (from < 0) return;
    let to = from;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (from + 1) % variants.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (from - 1 + variants.length) % variants.length;
    else if (e.key === "Home") to = 0;
    else if (e.key === "End") to = variants.length - 1;
    else return;
    e.preventDefault();
    tiles[to]?.focus();
    onSelect(variants[to].id);
  };

  return (
    <div ref={ref} role="radiogroup" aria-label="Generated variants" onKeyDown={onKeyDown} className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
      {variants.map((v, i) => <VariantTile key={v.id} variant={v} selected={v.id === selectedId} onSelect={onSelect} tabIndex={i === stop ? 0 : -1} />)}
      {Array.from({ length: loadingCount }, (_, i) => <Skeleton key={`l${i}`} className="aspect-square" />)}
    </div>
  );
}
