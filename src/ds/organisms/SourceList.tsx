import { cn } from "../lib/cn";
import { Source, SourceCard } from "../molecules/SourceCard";

export function SourceList({ sources, className }: { sources: Source[]; className?: string }) {
  return (
    <section aria-label="Sources" className={cn("space-y-1.5", className)}>
      <p className="text-[10px] uppercase tracking-[0.08em] text-fg-muted">Sources</p>
      <ol className="grid gap-2 sm:grid-cols-2">
        {sources.map((s) => <SourceCard key={s.id} source={s} />)}
      </ol>
    </section>
  );
}
