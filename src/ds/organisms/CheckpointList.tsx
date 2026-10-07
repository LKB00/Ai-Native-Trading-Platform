import { useState, type ReactNode } from "react";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { cn } from "../lib/cn";

export type RestoreMode = "everything" | "conversation" | "work";

export interface Checkpoint {
  id: string;
  /** The prompt that created this checkpoint. */
  prompt: string;
  /** Relative time, for example "12 min ago". */
  time: string;
  /** Number of files changed since the previous checkpoint. */
  files: number;
}

export interface CheckpointListProps {
  /** Newest first or oldest first, rendered in the order given. */
  checkpoints: Checkpoint[];
  /** Id of the checkpoint the work is at now. It is marked and has no actions. */
  currentId?: string;
  /** Called after the person confirms a restore. */
  onRestore?: (id: string, mode: RestoreMode) => void;
  /** Called when Summarize from here is chosen. It runs without a confirm step. */
  onSummarize?: (id: string) => void;
  /** Slot for what the checkpoints do not cover, such as untracked changes. */
  limitations?: ReactNode;
  /** Overrides for any visible label. */
  labels?: Partial<Record<RestoreMode | "summarize" | "confirm" | "cancel" | "current" | "rewind", string>>;
  /** Words for the change count, for example `(n) => `${n} edits``. Defaults to a file count. */
  changeLabel?: (count: number) => string;
  className?: string;
}

const defaults = { everything: "Restore everything", conversation: "Restore conversation only", work: "Restore work only", summarize: "Summarize from here", confirm: "Confirm restore", cancel: "Cancel", current: "Current", rewind: "Rewind" };
const warnings: Record<RestoreMode, string> = {
  everything: "This replaces your work and the conversation with how they were at this point. Later changes are removed.",
  conversation: "This removes the messages after this point. Your work stays as it is.",
  work: "This replaces your work with how it was at this point. The conversation stays as it is.",
};

/** Rewind list with one row per earlier prompt. A destructive restore needs an inline confirm. */
export function CheckpointList({ checkpoints, currentId, onRestore, onSummarize, limitations, labels, changeLabel, className }: CheckpointListProps) {
  const t = { ...defaults, ...labels };
  const [open, setOpen] = useState<string | null>(null);
  const [pending, setPending] = useState<RestoreMode | null>(null);
  const close = () => { setOpen(null); setPending(null); };
  const modes: RestoreMode[] = ["everything", "conversation", "work"];

  return (
    <div className={cn("space-y-3", className)}>
      <ol className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {checkpoints.map((c) => {
          const current = c.id === currentId;
          const expanded = open === c.id;
          return (
            <li key={c.id} className="px-4 py-3" aria-current={current ? "step" : undefined}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-fg">{c.prompt}</p>
                  <p className="mt-0.5 text-xs text-fg-muted">{c.time} · {changeLabel ? changeLabel(c.files) : c.files === 1 ? "1 file changed" : `${c.files} files changed`}</p>
                </div>
                {current ? <Badge tone="accent">{t.current}</Badge> : (
                  <Button size="sm" variant="secondary" aria-expanded={expanded} onClick={() => (expanded ? close() : (setOpen(c.id), setPending(null)))}>{t.rewind}</Button>
                )}
              </div>
              {expanded && !current && (
                <div className="mt-3 space-y-3 rounded-xl bg-sunken p-3">
                  {pending === null ? (
                    <div className="flex flex-wrap gap-2">
                      {modes.map((m) => (
                        <Button key={m} size="sm" variant="secondary" disabled={m === "work" && c.files === 0} onClick={() => setPending(m)}>{t[m]}</Button>
                      ))}
                      <Button size="sm" variant="ghost" onClick={() => { onSummarize?.(c.id); close(); }}>{t.summarize}</Button>
                    </div>
                  ) : (
                    <div role="group" aria-label={t[pending]} className="space-y-2">
                      <p className="text-sm text-fg">{t[pending]}? <span className="text-fg-muted">{warnings[pending]}</span></p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="danger" onClick={() => { onRestore?.(c.id, pending); close(); }}>{t.confirm}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setPending(null)}>{t.cancel}</Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {limitations && <div className="text-xs text-fg-muted">{limitations}</div>}
    </div>
  );
}
