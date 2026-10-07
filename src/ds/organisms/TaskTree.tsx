import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { ChevronIcon, XIcon } from "../lib/icons";
import { AgentStatusIcon, type AgentStatus } from "../atoms/AgentStatusIcon";
import { Button, IconButton } from "../atoms/Button";

export type TaskStatus = "running" | "done" | "failed" | "stopped" | "partial";

export interface TaskNode {
  id: string;
  name: string;
  status: TaskStatus;
  children?: TaskNode[];
}

export interface TaskTreeLabels {
  status?: Partial<Record<TaskStatus, string>>;
  open?: string;
  dismiss?: string;
  expand?: string;
  collapse?: string;
}

export interface TaskTreeProps {
  tasks: TaskNode[];
  /** Called when the person opens a row, for example to show that subagent's transcript. */
  onOpen?: (id: string) => void;
  /** Called when a row is dismissed: the Dismiss button on a failed row, or `dismissAfterMs` on a done row. The tree hides the row at once, and the app should also remove it from its data. */
  onDismiss?: (id: string) => void;
  /** Milliseconds after which a done row is dismissed and onDismiss(id) is called. Off when undefined. Failed rows never auto-dismiss. A done parent waits until its nested rows are done too. */
  dismissAfterMs?: number;
  /** Ids that start collapsed. Everything else starts expanded. */
  defaultCollapsed?: string[];
  labels?: TaskTreeLabels;
  className?: string;
}

const statusText: Record<TaskStatus, string> = { running: "Running", done: "Done", failed: "Failed", stopped: "Stopped", partial: "Partial" };
const mapped: Record<Exclude<TaskStatus, "partial">, AgentStatus> = { running: "working", done: "completed", failed: "failed", stopped: "stopped" };

const countDescendants = (n: TaskNode): number => (n.children ?? []).reduce((a, c) => a + 1 + countDescendants(c), 0);

/** Half-filled circle for Partial, which the shared status icon has no shape for. */
function PartialGlyph() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden className="shrink-0 text-fg-muted">
      <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

/**
 * Nested subagent or task rows. Each row shows a name, a status written out beside an icon shape,
 * a (+N) count of nested tasks, and an Open action. Parents expand and collapse. Failed rows stay
 * until the person dismisses them. With dismissAfterMs, done rows are dismissed after that delay.
 * The app owns the data and removes the row in onDismiss.
 */
export function TaskTree({ tasks, onOpen, onDismiss, dismissAfterMs, defaultCollapsed = [], labels, className }: TaskTreeProps) {
  const l = { open: "Open", dismiss: "Dismiss", expand: "Expand", collapse: "Collapse", ...labels };
  const names = { ...statusText, ...labels?.status };
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(defaultCollapsed));
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState("");

  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const latest = useRef({ onDismiss });
  latest.current = { onDismiss };

  const toggle = (id: string) => setCollapsed((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const dismiss = (n: TaskNode) => { setDismissed((d) => new Set(d).add(n.id)); onDismiss?.(n.id); setAnnounce(`Dismissed ${n.name}`); };

  // Schedule one timer per finished row. A timer is kept while its row stays done, so re-renders do not restart it.
  useEffect(() => {
    const live = timers.current;
    const due = new Map<string, TaskNode>();
    const walk = (nodes: TaskNode[]): boolean => {
      let allDone = true;
      for (const n of nodes) {
        if (dismissed.has(n.id)) continue;
        const kidsDone = walk(n.children ?? []);
        if (n.status === "done" && kidsDone) due.set(n.id, n); else allDone = false;
      }
      return allDone;
    };
    if (dismissAfterMs !== undefined) walk(tasks);
    for (const [id, t] of live) if (!due.has(id)) { clearTimeout(t); live.delete(id); }
    for (const [id, n] of due) {
      if (live.has(id)) continue;
      live.set(id, setTimeout(() => {
        live.delete(id);
        setDismissed((d) => new Set(d).add(id));
        latest.current.onDismiss?.(id);
        setAnnounce(`Dismissed ${n.name}`);
      }, dismissAfterMs));
    }
  }, [tasks, dismissAfterMs, dismissed]);
  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t); timers.current.clear(); }, []);

  const renderList = (nodes: TaskNode[], depth: number) => (
    <ul className="space-y-0.5">
      {nodes.filter((n) => !dismissed.has(n.id)).map((n) => {
        const kids = (n.children ?? []).filter((c) => !dismissed.has(c.id));
        const total = countDescendants({ ...n, children: kids });
        const isOpen = !collapsed.has(n.id);
        return (
          <li key={n.id}>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl py-1 pr-2 hover:bg-hover sm:rounded-full" style={{ paddingLeft: depth * 20 + 4 }}>
              {kids.length ? (
                <IconButton size="sm" label={`${isOpen ? l.collapse : l.expand} ${n.name}`} aria-expanded={isOpen} onClick={() => toggle(n.id)}>
                  <ChevronIcon width={12} height={12} className={cn("transition-transform", isOpen && "rotate-90")} />
                </IconButton>
              ) : <span aria-hidden className="size-7 shrink-0" />}
              {n.status === "partial" ? <PartialGlyph /> : <AgentStatusIcon status={mapped[n.status]} label={names[n.status]} />}
              <span className="min-w-[7rem] flex-1 truncate text-[13px] font-medium">{n.name}</span>
              {total > 0 && <span className="text-xs text-fg-subtle tabular-nums"><span className="sr-only">{total} nested tasks </span><span aria-hidden>(+{total})</span></span>}
              <span className="ml-auto flex items-center gap-2"><span className="text-xs text-fg-muted">{names[n.status]}</span>
              <Button size="sm" variant="ghost" onClick={() => onOpen?.(n.id)} aria-label={`${l.open} ${n.name}`}>{l.open}</Button>
              {n.status === "failed" && <IconButton size="sm" label={`${l.dismiss} ${n.name}`} onClick={() => dismiss(n)}><XIcon width={12} height={12} /></IconButton>}</span>
            </div>
            {kids.length > 0 && isOpen && renderList(kids, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className={cn("rounded-2xl border border-line bg-surface p-2", className)}>
      <div role="group" aria-label="Tasks">{renderList(tasks, 0)}</div>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </div>
  );
}
