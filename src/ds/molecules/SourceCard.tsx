import { GlobeIcon } from "../lib/icons";

export interface Source { id: number; title: string; url: string; domain: string; snippet?: string }

/** One numbered source. Render inside an <ol>; the id anchors inline citation markers. */
export function SourceCard({ source: s }: { source: Source }) {
  return (
    <li id={`source-${s.id}`}>
      <a href={s.url} target="_blank" rel="noreferrer noopener"
        className="flex h-full animate-rise gap-2.5 rounded-2xl border border-line bg-surface p-3 text-sm no-underline transition-colors hover:border-line-strong hover:bg-sunken">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-lime/30 text-[10px] font-semibold text-fg">{s.id}</span>
        <span className="min-w-0">
          <span className="line-clamp-1 font-medium text-fg">{s.title}</span>
          <span className="flex items-center gap-1 text-xs text-fg-subtle"><GlobeIcon width={11} height={11} />{s.domain}</span>
          {s.snippet && <span className="mt-1 line-clamp-2 block text-xs text-fg-muted">{s.snippet}</span>}
        </span>
      </a>
    </li>
  );
}
