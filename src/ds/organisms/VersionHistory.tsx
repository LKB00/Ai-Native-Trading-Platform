import { useState } from "react";
import { cn } from "../lib/cn";
import { SparkleIcon, UsersIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";

export interface VersionEntry {
  id: string;
  /** Overrides the automatic name "Version N". */
  name?: string;
  /** Display time such as "2 min ago". */
  time: string;
  author: "ai" | "person";
  /** Person name, or the model name for AI. */
  authorName?: string;
  /** One line about what changed. */
  summary?: string;
}

export interface VersionHistoryProps {
  /** Newest first. Versions are numbered from the end of the list, so the oldest is Version 1. */
  versions: VersionEntry[];
  /** Id of the current version. Defaults to the first entry. */
  currentId?: string;
  /** Controlled preview. Pass null for no preview. Omit to let the component manage it. */
  previewId?: string | null;
  onPreviewChange?: (id: string | null) => void;
  onRestore: (id: string) => void;
  title?: string;
  /** Note shown under each Preview action. */
  previewNote?: string;
  className?: string;
}

/** Auto-numbered version list with a preview mode and a restore action. */
export function VersionHistory({ versions, currentId, previewId: controlled, onPreviewChange, onRestore, title = "Version history", previewNote = "Preview does not create a new version.", className }: VersionHistoryProps) {
  const [inner, setInner] = useState<string | null>(null);
  const previewId = controlled === undefined ? inner : controlled;
  const setPreview = (id: string | null) => { if (controlled === undefined) setInner(id); onPreviewChange?.(id); };
  const current = currentId ?? versions[0]?.id;
  const nameOf = (v: VersionEntry, i: number) => v.name ?? `Version ${versions.length - i}`;
  const previewIdx = versions.findIndex((v) => v.id === previewId);
  const previewing = previewIdx >= 0 ? versions[previewIdx] : undefined;

  return (
    <section aria-label={title} className={cn("space-y-3 rounded-3xl border border-line bg-surface p-3", className)}>
      <h3 className="px-1 text-base">{title}</h3>
      <p role="status" aria-live="polite" className="sr-only">{previewing ? `Previewing ${nameOf(previewing, previewIdx)}` : ""}</p>
      {previewing && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-sunken px-3 py-2">
          <p className="text-sm">Previewing <b>{nameOf(previewing, previewIdx)}</b>. {previewNote}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => setPreview(null)}>Exit preview</Button>
            <Button size="sm" variant="primary" onClick={() => onRestore(previewing.id)}>Restore</Button>
          </div>
        </div>
      )}
      <ol className="space-y-1">
        {versions.map((v, i) => {
          const isCurrent = v.id === current;
          const isPreview = v.id === previewId;
          const name = nameOf(v, i);
          return (
            <li key={v.id} aria-current={isCurrent ? "true" : undefined} className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl px-3 py-2", isPreview ? "bg-sunken" : "hover:bg-hover")}>
              <div className="min-w-[12rem] flex-1">
                <p className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {name}
                  {isCurrent && <Badge tone="accent">Current</Badge>}
                  {isPreview && <Badge>Previewing</Badge>}
                </p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                  <span className="inline-flex items-center gap-1">
                    {v.author === "ai" ? <SparkleIcon width={11} height={11} /> : <UsersIcon width={11} height={11} />}
                    {v.author === "ai" ? "AI" : "Person"}{v.authorName ? `, ${v.authorName}` : ""}
                  </span>
                  <span aria-hidden>·</span>
                  <span>{v.time}</span>
                </p>
                {v.summary && <p className="mt-0.5 text-xs text-fg-subtle">{v.summary}</p>}
              </div>
              {!isCurrent && (
                <div className="flex gap-1.5">
                  <Button size="sm" variant="ghost" aria-pressed={isPreview} aria-label={`Preview ${name}`} onClick={() => setPreview(isPreview ? null : v.id)}>Preview</Button>
                  <Button size="sm" variant="secondary" aria-label={`Restore ${name}`} onClick={() => onRestore(v.id)}>Restore</Button>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <p className="px-1 text-xs text-fg-subtle">{previewNote}</p>
    </section>
  );
}
