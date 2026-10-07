
/** Inline numbered marker, e.g. "…grew 12%[1]". Links to the source and is keyboard reachable. */
export function CitationMarker({ n, href, title }: { n: number; href?: string; title?: string }) {
  return (
    <a href={href ?? `#source-${n}`} title={title} aria-label={`Source ${n}${title ? `: ${title}` : ""}`}
      className="mx-0.5 inline-flex animate-pop h-4 min-w-4 -translate-y-0.5 items-center justify-center rounded bg-accent-soft px-1 text-[10px] font-semibold text-accent-fg no-underline hover:bg-accent hover:text-on-accent">
      {n}
    </a>
  );
}
