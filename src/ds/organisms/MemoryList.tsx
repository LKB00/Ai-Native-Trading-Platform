import { useState, type ReactNode } from "react";
import { Badge } from "../atoms/Badge";
import { Button, IconButton } from "../atoms/Button";
import { Switch } from "../atoms/Switch";
import { cn } from "../lib/cn";

export interface MemoryEntry {
  id: string;
  /** Short topic heading, for example "Work". */
  topic?: string;
  /** What is remembered. */
  text: string;
  /** Where it applies, for example "All chats" or "This project". */
  scope: string;
}

export interface MemoryListProps {
  entries: MemoryEntry[];
  /** Called with the entry id and new text when an edit is saved. */
  onEdit?: (id: string, text: string) => void;
  /** Called with the entry id when delete is chosen. */
  onDelete?: (id: string) => void;
  /** Whether new memories are paused. Controlled when set. */
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Whether past chats can be searched for context. Controlled when set. */
  searchChats?: boolean;
  defaultSearchChats?: boolean;
  onSearchChatsChange?: (on: boolean) => void;
  /** Replaces the empty state. */
  emptyState?: ReactNode;
  pauseLabel?: string;
  pauseDescription?: string;
  searchLabel?: string;
  searchDescription?: string;
  className?: string;
}

/** Private inline glyphs, 24px grid, 1.5 stroke. */
const svg = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
const PencilIcon = () => <svg {...svg}><path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" /></svg>;
const TrashIcon = () => <svg {...svg}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>;

function useFlag(controlled: boolean | undefined, initial: boolean, notify?: (v: boolean) => void) {
  const [inner, setInner] = useState(initial);
  return [controlled ?? inner, (v: boolean) => { if (controlled === undefined) setInner(v); notify?.(v); }] as const;
}

/** Memory manager. Two controls on top, then one row per remembered topic with scope, edit and delete. */
export function MemoryList({ entries, onEdit, onDelete, paused, defaultPaused = false, onPausedChange, searchChats, defaultSearchChats = true, onSearchChatsChange, emptyState, pauseLabel = "Pause memory", pauseDescription = "Stop saving new memories. Existing ones stay.", searchLabel = "Search past chats", searchDescription = "Let replies draw on earlier conversations.", className }: MemoryListProps) {
  const [isPaused, setPaused] = useFlag(paused, defaultPaused, onPausedChange);
  const [isSearch, setSearch] = useFlag(searchChats, defaultSearchChats, onSearchChatsChange);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  return (
    <div className={cn("space-y-4", className)}>
      <div className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {[{ l: pauseLabel, d: pauseDescription, v: isPaused, s: setPaused }, { l: searchLabel, d: searchDescription, v: isSearch, s: setSearch }].map((r) => (
          <div key={r.l} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0"><p className="text-sm font-medium text-fg">{r.l}</p><p className="text-xs text-fg-muted">{r.d}</p></div>
            <Switch checked={r.v} onChange={r.s} label={r.l} />
          </div>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-fg-muted">{emptyState ?? "Nothing is remembered yet. Memories you save will appear here."}</div>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
          {entries.map((e) => (
            <li key={e.id} className="px-4 py-3">
              {editing === e.id ? (
                <form className="space-y-2" onSubmit={(ev) => { ev.preventDefault(); onEdit?.(e.id, draft.trim()); setEditing(null); }}>
                  <label className="block text-xs font-medium text-fg-muted" htmlFor={`mem-${e.id}`}>{e.topic ?? "Memory"}</label>
                  <textarea id={`mem-${e.id}`} autoFocus value={draft} onChange={(ev) => setDraft(ev.target.value)} rows={2}
                    className="w-full resize-none rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-fg" />
                  <div className="flex gap-2">
                    <Button size="sm" type="submit" disabled={!draft.trim()}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                      {e.topic && <span className="text-xs font-medium text-fg-muted">{e.topic}</span>}
                      <Badge>{e.scope}</Badge>
                    </div>
                    <p className="text-sm text-fg">{e.text}</p>
                  </div>
                  <div className="flex shrink-0 gap-0.5">
                    <IconButton size="sm" label={`Edit memory: ${e.topic ?? e.text}`} onClick={() => { setDraft(e.text); setEditing(e.id); }}><PencilIcon /></IconButton>
                    <IconButton size="sm" label={`Delete memory: ${e.topic ?? e.text}`} onClick={() => onDelete?.(e.id)}><TrashIcon /></IconButton>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
