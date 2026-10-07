import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Badge } from "../atoms/Badge";

export interface ComparisonItem {
  id: string;
  name: string;
  /** Short line under the name. */
  subtitle?: string;
  /** Marks this item with a visible text badge and a lime fill. */
  badge?: string;
}

export interface ComparisonRow {
  id: string;
  /** Attribute name. */
  label: string;
  /** One value per item, in the same order as `items`. */
  values: ReactNode[];
}

export interface ComparisonTableProps {
  /** Two to five items. Extras are ignored. */
  items: ComparisonItem[];
  rows: ComparisonRow[];
  /** Names the table. Visible to screen readers on the table and used as the heading of the stacked cards. */
  caption: string;
  /** Header text of the attribute column. */
  attributeLabel?: string;
  className?: string;
}

/**
 * Semantic comparison table for 2 to 5 items. Column headers are th scope=col, row headers are th scope=row.
 * Below the sm breakpoint (600px) it switches to one stacked card per item. Only one form is exposed at a time.
 */
export function ComparisonTable({ items, rows, caption, attributeLabel = "Attribute", className }: ComparisonTableProps) {
  const list = items.slice(0, 5);
  return (
    <div className={className}>
      <div tabIndex={0} className="hidden overflow-x-auto rounded-3xl border border-line bg-surface sm:block">
        <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-sunken">
              <th scope="col" className="px-4 py-3 text-[10px] font-normal uppercase tracking-[0.08em] text-fg-muted">{attributeLabel}</th>
              {list.map((it) => (
                <th key={it.id} scope="col" className={cn("px-4 py-3 align-bottom font-medium text-fg", it.badge && "bg-lime/25")}>
                  <span className="block">{it.name}</span>
                  {it.subtitle && <span className="block text-[11.5px] font-normal text-fg-muted">{it.subtitle}</span>}
                  {it.badge && <Badge tone="accent" className="mt-1">{it.badge}</Badge>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3 font-medium text-fg">{r.label}</th>
                {list.map((it, i) => <td key={it.id} className={cn("px-4 py-3 leading-5 text-fg-muted", it.badge && "bg-lime/10")}>{r.values[i]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden">
        <h3 className="font-sans! mb-2 text-[13px] font-bold">{caption}</h3>
        <ul className="m-0 list-none space-y-3 p-0">
          {list.map((it, i) => (
            <li key={it.id} className="rounded-2xl border border-line bg-surface p-4">
              <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">{it.name}{it.badge && <Badge tone="accent">{it.badge}</Badge>}</p>
              {it.subtitle && <p className="text-[12px] text-fg-muted">{it.subtitle}</p>}
              <dl className="mt-3 space-y-2 text-[13px]">
                {rows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-3 border-t border-line pt-2">
                    <dt className="text-fg-subtle">{r.label}</dt>
                    <dd className="m-0 text-fg-muted">{r.values[i]}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
