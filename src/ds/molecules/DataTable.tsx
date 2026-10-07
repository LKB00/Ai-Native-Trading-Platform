import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface DataTableColumn {
  /** Key into each row object. */
  key: string;
  /** Visible column header. Include the unit, for example "p95 latency (ms)". */
  header: string;
  /** Right-align and use tabular figures. Set on every numeric column. */
  numeric?: boolean;
}

export interface DataTableProps {
  /** Column definitions in display order. The first column is the row header. */
  columns: DataTableColumn[];
  /** One object per row, keyed by column key. Values are already formatted. */
  rows: Record<string, ReactNode>[];
  /** Names the table for assistive technology and states what it holds. */
  caption: string;
  /** Keep the header row visible while the body scrolls. Pair with maxHeight. */
  stickyHeader?: boolean;
  /** Maximum body height in px before the table scrolls vertically. */
  maxHeight?: number;
  className?: string;
}

/**
 * Semantic table counterpart to a chart. Numbers are right-aligned with tabular figures and the
 * table scrolls horizontally in its own region on narrow screens.
 */
export function DataTable({ columns, rows, caption, stickyHeader, maxHeight, className }: DataTableProps) {
  return (
    <div role="region" aria-label={caption} tabIndex={0}
      className={cn("overflow-auto rounded-2xl border border-line bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]", className)}
      style={maxHeight ? { maxHeight } : undefined}>
      <table className="w-full border-collapse text-left text-[13px] leading-5">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col"
                className={cn("bg-sunken px-3 py-2 text-[11px] font-medium whitespace-nowrap text-fg-muted", c.numeric && "text-right", stickyHeader && "sticky top-0 z-10")}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row" className="px-3 py-2 font-medium whitespace-nowrap text-fg">{r[c.key]}</th>
                ) : (
                  <td key={c.key} className={cn("px-3 py-2 whitespace-nowrap text-fg-muted", c.numeric && "text-right [font-variant-numeric:tabular-nums]")}>{r[c.key]}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
