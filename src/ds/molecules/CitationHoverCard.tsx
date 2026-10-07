import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { GlobeIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";

export interface CitationHoverCardProps {
  /** Citation number shown in the marker. */
  n: number;
  title: string;
  domain: string;
  /** Where "Open source" goes. */
  url: string;
  snippet?: string;
  /** Trust label as text, for example "Government" or "Academic". */
  trust?: string;
  /** Favicon or any small mark. Falls back to the first letter of the domain. */
  favicon?: ReactNode;
  openLabel?: string;
  className?: string;
}

/**
 * Numbered citation that opens a source card on hover, on keyboard focus and on click or tap.
 * Click pins the card so it stays open on touch. Escape closes it and returns focus to the marker.
 */
export function CitationHoverCard({ n, title, domain, url, snippet, trust, favicon, openLabel = "Open source", className }: CitationHoverCardProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  const close = () => { setOpen(false); setPinned(false); };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (root.current && !root.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { close(); btn.current?.focus(); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <span ref={root} className={`relative mx-0.5 inline-block align-baseline ${className ?? ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false); }}
      onFocus={() => setOpen(true)}
      onBlur={(e) => { if (!root.current?.contains(e.relatedTarget as Node)) close(); }}>
      <button ref={btn} type="button" aria-label={`Source ${n}: ${domain}`} aria-expanded={open} aria-controls={id}
        onClick={() => { if (open && pinned) close(); else { setOpen(true); setPinned(true); } }}
        className="inline-flex h-4 min-w-4 -translate-y-0.5 cursor-pointer items-center justify-center rounded bg-accent-soft px-1 text-[10px] font-semibold text-accent-fg hover:bg-accent hover:text-on-accent">
        {n}
      </button>
      {open && (
        <span id={id} role="group" aria-label={`Source ${n}: ${title}`} className="absolute bottom-full left-1/2 z-30 block w-72 max-w-[calc(100vw-2rem)] -translate-x-1/2 pb-2">
          <span className="block animate-rise rounded-2xl border border-line bg-raised p-3 text-left text-sm font-normal shadow-lg">
            <span className="flex items-center gap-2 text-xs text-fg-subtle">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-sunken text-[10px] font-semibold text-fg-muted" aria-hidden="true">
                {favicon ?? (domain ? domain.charAt(0).toUpperCase() : <GlobeIcon width={11} height={11} />)}
              </span>
              <span className="min-w-0 flex-1 truncate">{domain}</span>
              {trust && <Badge>{trust}</Badge>}
            </span>
            <span className="mt-2 block font-medium text-fg">{title}</span>
            {snippet && <span className="mt-1 line-clamp-3 block text-xs text-fg-muted">{snippet}</span>}
            <a href={url} target="_blank" rel="noreferrer noopener" className="mt-2.5 inline-block text-xs font-medium text-fg underline underline-offset-2">{openLabel}</a>
          </span>
        </span>
      )}
    </span>
  );
}
