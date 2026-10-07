import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "../atoms/Button";
import { Badge } from "../atoms/Badge";

export interface StarterIntent { id: string; label: string }
export interface StarterTemplate { id: string; title: string; description: string; category?: string }

export interface StarterGalleryProps {
  /** Heading above the statement. */
  heading?: string;
  /** One sentence on what the assistant can and cannot do. */
  statement: ReactNode;
  /** Starter intents. Three to six works best. */
  intents: StarterIntent[];
  onIntent: (id: string) => void;
  templates?: StarterTemplate[];
  onTemplate?: (id: string) => void;
  intentsLabel?: string;
  templatesLabel?: string;
  /** Slot beside the templates heading, usually a Randomize button. */
  randomize?: ReactNode;
  className?: string;
}

/** First-run view. It states scope, offers starter intents next to free text, and lists templates. */
export function StarterGallery({ heading = "What would you like to make?", statement, intents, onIntent, templates = [], onTemplate, intentsLabel = "Start with", templatesLabel = "Templates", randomize, className }: StarterGalleryProps) {
  return (
    <section aria-label={heading} className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <h2 className="text-2xl">{heading}</h2>
        <p className="max-w-xl text-sm text-fg-muted">{statement}</p>
      </div>
      <div className="space-y-2">
        <h3 className="text-[10px] font-normal tracking-[0.08em] text-fg-muted uppercase font-sans!">{intentsLabel}</h3>
        <ul className="flex flex-wrap gap-2">
          {intents.map((i) => <li key={i.id}><Button variant="secondary" size="sm" onClick={() => onIntent(i.id)}>{i.label}</Button></li>)}
        </ul>
      </div>
      {templates.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[10px] font-normal tracking-[0.08em] text-fg-muted uppercase font-sans!">{templatesLabel}</h3>
            {randomize}
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => onTemplate?.(t.id)}
                  className="flex h-full w-full cursor-pointer flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong hover:bg-hover">
                  {t.category && <Badge>{t.category}</Badge>}
                  <span className="text-sm font-medium">{t.title}</span>
                  <span className="text-xs text-fg-muted">{t.description}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
