import { SparkleIcon, ChevronIcon } from "../lib/icons";
import { Popover } from "../atoms/Popover";

export interface ProvenancePopoverProps {
  /** Text of the AI label. It is the accessible name of the trigger. */
  label?: string;
  /** Tool or model that produced the content. */
  madeWith?: string;
  /** When it was made, as display text. */
  date?: string;
  /** What the AI did, one short phrase each. */
  actions?: string[];
  /** Whether a person changed the content after it was generated. Omit to leave the row out. */
  editedByPerson?: boolean;
  /** One short line answering "why am I seeing this". */
  why?: string;
  /** Link to a fuller record. */
  detailsHref?: string;
  detailsLabel?: string;
  /** Heading inside the panel. */
  title?: string;
  /** Row labels, so product copy can be localised. */
  rowLabels?: { madeWith: string; date: string; actions: string; edited: string; yes: string; no: string };
  /** Controlled mode. Omit both to let it manage itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "end";
  side?: "bottom" | "top";
}

const defaultRows = { madeWith: "Made with", date: "Date", actions: "What AI did", edited: "Edited by a person", yes: "Yes", no: "No" };

/**
 * AI label that opens an explanation on demand. The label is always visible text, the details sit one click away.
 * Built on Popover, so it opens with Enter, Space or a tap, closes on Escape and returns focus to the label.
 */
export function ProvenancePopover({
  label = "AI-generated", madeWith, date, actions, editedByPerson, why, detailsHref, detailsLabel = "View full details",
  title = "About this content", rowLabels = defaultRows, open, onOpenChange, align = "start", side = "bottom",
}: ProvenancePopoverProps) {
  const r = { ...defaultRows, ...rowLabels };
  const rows: [string, string][] = [];
  if (madeWith) rows.push([r.madeWith, madeWith]);
  if (date) rows.push([r.date, date]);
  if (editedByPerson !== undefined) rows.push([r.edited, editedByPerson ? r.yes : r.no]);
  return (
    <Popover label={title} open={open} onOpenChange={onOpenChange} align={align} side={side} panelClassName="w-72 max-w-[calc(100vw-2rem)] p-3.5"
      trigger={({ open: isOpen, toggle, triggerProps }) => (
        <button type="button" onClick={toggle} {...triggerProps}
          className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-transparent bg-lime/25 px-2 py-0.5 text-[11px] leading-4 font-medium text-fg transition-colors hover:bg-lime/40">
          <SparkleIcon width={10} height={10} />{label}
          <ChevronIcon width={10} height={10} className={isOpen ? "-rotate-90" : "rotate-90"} />
        </button>
      )}>
      <div className="space-y-3 text-[13px]">
        <h4 className="font-sans! text-sm font-medium text-fg">{title}</h4>
        {rows.length > 0 && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            {rows.map(([k, v]) => (<div key={k} className="contents"><dt className="text-fg-muted">{k}</dt><dd className="text-fg">{v}</dd></div>))}
          </dl>
        )}
        {actions && actions.length > 0 && (
          <div>
            <p className="text-fg-muted">{r.actions}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4 text-fg">{actions.map((a) => <li key={a}>{a}</li>)}</ul>
          </div>
        )}
        {why && <p className="rounded-xl bg-sunken px-3 py-2 text-xs text-fg-muted">{why}</p>}
        {detailsHref && <a href={detailsHref} className="inline-block text-xs font-medium text-fg underline underline-offset-2">{detailsLabel}</a>}
      </div>
    </Popover>
  );
}
