import { useId, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { AlertIcon, CheckIcon, HistoryIcon, UndoIcon, XIcon } from "../lib/icons";
import { ApprovedByMark, type ApprovedBy } from "../atoms/ApprovedByMark";
import { Badge, type Tone } from "../atoms/Badge";
import { Button } from "../atoms/Button";
import { SegmentedControl } from "../atoms/SegmentedControl";

export type ActionStatus = "done" | "failed" | "undone" | "waiting";

export interface ActionLogItem {
  id: string;
  /** What was done, in plain words, such as "Moved 12 files to Archive". */
  action: string;
  /** Who did it, such as "Travel helper". */
  actor: string;
  status: ActionStatus;
  /** When, as text, such as "10:42" or "2 minutes ago". */
  time: string;
  approvedBy?: ApprovedBy;
  /** Minutes left to undo. Omit when it was never undoable and give notUndoableReason instead. 0 means the time is over. */
  undoMinutes?: number;
  /** Why this cannot be undone, such as "The email was already sent." */
  notUndoableReason?: string;
}

export interface ActionLogLabels {
  filter?: string;
  all?: string;
  done?: string;
  failed?: string;
  undone?: string;
  waiting?: string;
  undo?: string;
  empty?: string;
  cannotUndo?: string;
  undoEnded?: string;
  /** Receives the minutes left. */
  undoFor?: (minutes: number) => string;
}

export interface ActionLogProps {
  items: ActionLogItem[];
  /** Called when the person presses Undo. The row then shows Undone. */
  onUndo?: (id: string) => void;
  /** Starting filter. */
  defaultFilter?: ActionStatus | "all";
  labels?: ActionLogLabels;
  className?: string;
}

const tone: Record<ActionStatus, Tone> = { done: "success", failed: "danger", undone: "neutral", waiting: "info" };
const statusIcon: Record<ActionStatus, ReactNode> = {
  done: <CheckIcon width={11} height={11} />, failed: <XIcon width={11} height={11} />,
  undone: <UndoIcon width={11} height={11} />, waiting: <HistoryIcon width={11} height={11} />,
};
const statuses: ActionStatus[] = ["done", "failed", "undone", "waiting"];

/** Lasting record of what an agent did. Each row shows who did it, how it ended, who approved it, and Undo while time remains. */
export function ActionLog({ items, onUndo, defaultFilter = "all", labels, className }: ActionLogProps) {
  const l = {
    filter: "Show actions", all: "All", done: "Done", failed: "Failed", undone: "Undone", waiting: "Waiting", undo: "Undo",
    empty: "No actions match this filter.", cannotUndo: "Can't be undone", undoEnded: "Undo time is over",
    undoFor: (m: number) => `Undo for ${m} more ${m === 1 ? "minute" : "minutes"}`, ...labels,
  };
  const [filter, setFilter] = useState<ActionStatus | "all">(defaultFilter);
  const [undoneIds, setUndoneIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const uid = useId();
  const rows = items.map((i) => (undoneIds.includes(i.id) ? { ...i, status: "undone" as const } : i));
  const count = (s: ActionStatus) => rows.filter((r) => r.status === s).length;
  const shown = filter === "all" ? rows : rows.filter((r) => r.status === filter);
  const summary = `${rows.length} ${rows.length === 1 ? "action" : "actions"}: ${statuses.filter((s) => count(s) > 0).map((s) => `${count(s)} ${l[s].toLowerCase()}`).join(", ") || "none yet"}`;
  const name = (s: ActionStatus) => l[s];

  const undo = (r: ActionLogItem) => {
    setUndoneIds((x) => [...x, r.id]);
    setMessage(`Undone: ${r.action}`);
    onUndo?.(r.id);
  };
  const choose = (v: ActionStatus | "all") => {
    setFilter(v);
    const n = v === "all" ? rows.length : rows.filter((r) => r.status === v).length;
    setMessage(`${n} ${n === 1 ? "action" : "actions"} shown`);
  };

  return (
    <section aria-label="Action log" className={cn("rounded-3xl border border-line bg-surface p-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0 text-sm font-medium">{summary}</p>
        <div className="max-w-full overflow-x-auto">
          <SegmentedControl size="sm" label={l.filter} value={filter} onChange={choose}
            options={[{ value: "all", label: `${l.all} ${rows.length}` }, ...statuses.map((s) => ({ value: s, label: `${l[s]} ${count(s)}` }))]} />
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="mt-3 text-sm text-fg-muted">{l.empty}</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-xl border border-line px-3 py-2.5">
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm break-words">{r.action}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-fg-muted">
                  <span>{r.actor}</span><span aria-hidden>·</span><span>{r.time}</span>
                </p>
                {r.approvedBy && <ApprovedByMark by={r.approvedBy} className="mt-1" />}
              </div>
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <Badge tone={tone[r.status]}>{statusIcon[r.status]}{name(r.status)}</Badge>
                {r.status === "done" && (
                  r.notUndoableReason ? (
                    <p id={`${uid}-${r.id}`} className="flex max-w-56 items-start gap-1 text-xs text-fg-muted">
                      <AlertIcon width={13} height={13} className="mt-0.5 shrink-0" /><span><span className="font-medium text-fg">{l.cannotUndo}.</span> {r.notUndoableReason}</span>
                    </p>
                  ) : r.undoMinutes && r.undoMinutes > 0 ? (
                    <Button size="sm" variant="secondary" leading={<UndoIcon width={13} height={13} />} onClick={() => undo(r)} aria-label={`${l.undo}: ${r.action}. ${l.undoFor(r.undoMinutes)}`}>{l.undoFor(r.undoMinutes)}</Button>
                  ) : r.undoMinutes === 0 ? (
                    <span className="text-xs text-fg-muted">{l.undoEnded}</span>
                  ) : null
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p role="status" aria-live="polite" className="sr-only">{message}</p>
    </section>
  );
}
