import { useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "../atoms/Button";
import { CheckIcon, XIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { DiffFileRow, type DiffHunkState, type DiffReviewState } from "../molecules/DiffFileRow";

export type DiffLineType = "add" | "remove" | "context";
export interface DiffLine { type: DiffLineType; text: string; oldNo?: number; newNo?: number }
export interface DiffHunk {
  /** Hunk header, such as "@@ -12,6 +12,9 @@" or a function name. */
  header?: string;
  lines: DiffLine[];
}
export interface DiffFile {
  id: string;
  path: string;
  hunks: DiffHunk[];
}

export type DiffStatuses = Record<string, DiffReviewState>;
/** Decision per hunk, by file id then hunk index. Missing entries follow the file's decision, or pending. */
export type DiffHunkStatuses = Record<string, DiffHunkState[]>;
export type { DiffHunkState, DiffReviewState };

export interface DiffViewLabels {
  files?: string;
  keepAll?: string;
  rejectAll?: string;
  nextFile?: string;
  /** Receives the number of files still pending. */
  remaining?: (n: number) => string;
  allReviewed?: string;
  noChanges?: string;
  keep?: string;
  reject?: string;
  kept?: string;
  rejected?: string;
  partial?: string;
  undo?: string;
  /** Receives the 1-based hunk number. */
  hunk?: (n: number) => string;
  /** Spoken after a whole file is decided or undone, such as "src/app.ts kept." */
  announceFile?: (path: string, state: DiffHunkState) => string;
  /** Spoken after one hunk is decided or undone. Receives the 1-based hunk number and the file's state after it. */
  announceHunk?: (n: number, path: string, state: DiffHunkState, fileState: DiffReviewState) => string;
  /** Spoken after Keep all or Reject all. */
  announceAll?: (count: number, state: DiffHunkState) => string;
}

const said: Record<DiffReviewState, string> = { kept: "kept", rejected: "rejected", pending: "returned to pending", partial: "partly kept" };

export interface DiffViewProps {
  files: DiffFile[];
  /** Review state per file id (controlled). Missing ids are pending. */
  statuses?: DiffStatuses;
  /** Initial states when uncontrolled. */
  defaultStatuses?: DiffStatuses;
  onStatusesChange?: (next: DiffStatuses) => void;
  /** Decision per hunk (controlled). Missing entries follow the file's decision, or pending. */
  hunkStatuses?: DiffHunkStatuses;
  /** Initial hunk decisions when uncontrolled. */
  defaultHunkStatuses?: DiffHunkStatuses;
  onHunkStatusesChange?: (next: DiffHunkStatuses) => void;
  /** Called when one hunk's Keep, Reject or Undo is chosen. Index is zero-based. */
  onHunkChange?: (fileId: string, hunkIndex: number, state: DiffHunkState) => void;
  /** Id of the file whose hunks are shown (controlled). */
  activeId?: string;
  defaultActiveId?: string;
  onActiveChange?: (id: string) => void;
  labels?: DiffViewLabels;
  className?: string;
}

const countOf = (f: DiffFile) => f.hunks.reduce((a, h) => {
  for (const l of h.lines) { if (l.type === "add") a.added++; else if (l.type === "remove") a.removed++; }
  return a;
}, { added: 0, removed: 0 });

const sign: Record<DiffLineType, { char: string; sr: string; cls: string }> = {
  add: { char: "+", sr: "Added: ", cls: "bg-success-soft text-success-fg" },
  remove: { char: "−", sr: "Removed: ", cls: "bg-danger-soft text-danger-fg" },
  context: { char: "", sr: "", cls: "text-fg-muted" },
};

/** Hunk renderer: a header with per-hunk Keep and Reject, then line numbers, a sign column and the line text. Added and removed lines carry a + or minus sign as well as color. */
function Hunks({ file, hunkState, onHunk, l }: { file: DiffFile; hunkState: (i: number) => DiffHunkState; onHunk: (i: number, s: DiffHunkState) => void; l: Required<Pick<DiffViewLabels, "keep" | "reject" | "kept" | "rejected" | "undo" | "hunk">> }) {
  return (
    <div role="group" aria-label={`Changes in ${file.path}`}>
      {file.hunks.map((h, hi) => {
        const st = hunkState(hi);
        const where = `${l.hunk(hi + 1).toLowerCase()} in ${file.path}`;
        return (
          <div key={hi} className="mb-1 last:mb-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-sunken px-3 py-1.5">
              <p className="min-w-0 flex-1 font-mono text-xs text-fg-subtle"><span className="font-sans font-medium text-fg-muted">{l.hunk(hi + 1)}</span>{h.header ? ` ${h.header}` : ""}</p>
              {st === "pending" ? (
                <span className="flex gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => onHunk(hi, "kept")} aria-label={`${l.keep} ${where}`}>{l.keep}</Button>
                  <Button size="sm" variant="ghost" onClick={() => onHunk(hi, "rejected")} aria-label={`${l.reject} ${where}`}>{l.reject}</Button>
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Badge tone={st === "kept" ? "success" : "danger"}>
                    {st === "kept" ? <CheckIcon width={11} height={11} /> : <XIcon width={11} height={11} />}
                    {st === "kept" ? l.kept : l.rejected}
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => onHunk(hi, "pending")} aria-label={`${l.undo}: ${where}`}>{l.undo}</Button>
                </span>
              )}
            </div>
            <div tabIndex={0} role="group" aria-label={`Lines of ${where}`} className="overflow-x-auto font-mono text-xs leading-5">
              <div className="min-w-max">
                {h.lines.map((ln, i) => {
                  const s = sign[ln.type];
                  return (
                    <div key={i} className={cn("grid grid-cols-[3rem_3rem_1.5rem_1fr]", s.cls, st === "rejected" && "opacity-60")}>
                      <span aria-hidden className="px-2 text-right text-fg-subtle tabular-nums select-none">{ln.oldNo ?? ""}</span>
                      <span aria-hidden className="px-2 text-right text-fg-subtle tabular-nums select-none">{ln.newNo ?? ""}</span>
                      <span aria-hidden className="text-center select-none">{s.char}</span>
                      <span className="pr-3 pl-1 whitespace-pre"><span className="sr-only">{s.sr}</span>{ln.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Review of an agent's changes. A file list with per-file Keep and Reject sits beside the hunks of the
 * selected file, and each hunk has its own Keep and Reject. A file is kept or rejected when all its hunks are,
 * and partly kept when they are mixed. A bottom bar offers Keep all, Reject all and Next file with a count of files left.
 */
export function DiffView({ files, statuses, defaultStatuses, onStatusesChange, hunkStatuses, defaultHunkStatuses, onHunkStatusesChange, onHunkChange, activeId, defaultActiveId, onActiveChange, labels, className }: DiffViewProps) {
  const l = {
    files: "Changed files", keepAll: "Keep all", rejectAll: "Reject all", nextFile: "Next file",
    remaining: (n: number) => `${n} ${n === 1 ? "file" : "files"} left to review`,
    allReviewed: "All files reviewed", noChanges: "No changes to review.",
    keep: "Keep", reject: "Reject", kept: "Kept", rejected: "Rejected", partial: "Partly kept", undo: "Undo",
    hunk: (n: number) => `Hunk ${n}`,
    announceFile: (path: string, st: DiffHunkState) => `${path} ${said[st]}.`,
    announceHunk: (n: number, path: string, st: DiffHunkState, fs: DiffReviewState) => `Hunk ${n} in ${path} ${said[st]}. ${path} is ${fs === "pending" ? "pending" : said[fs]}.`,
    announceAll: (n: number, st: DiffHunkState) => `${n} ${n === 1 ? "file" : "files"} ${said[st]}.`,
    ...labels,
  };
  const [innerStatuses, setInnerStatuses] = useState<DiffStatuses>(defaultStatuses ?? {});
  const [innerHunks, setInnerHunks] = useState<DiffHunkStatuses>(defaultHunkStatuses ?? {});
  const [innerActive, setInnerActive] = useState(defaultActiveId ?? files[0]?.id);
  const [announce, setAnnounce] = useState("");
  const st = statuses ?? innerStatuses;
  const hs = hunkStatuses ?? innerHunks;
  const active = files.find((f) => f.id === (activeId ?? innerActive)) ?? files[0];

  /** Decision for one hunk. Without a hunk entry it follows the file's kept or rejected decision. */
  const hunkOf = (f: DiffFile, i: number): DiffHunkState => {
    const own = hs[f.id]?.[i];
    if (own) return own;
    const fs = st[f.id];
    return fs === "kept" || fs === "rejected" ? fs : "pending";
  };
  const hunksOf = (f: DiffFile) => f.hunks.map((_, i) => hunkOf(f, i));
  const derive = (arr: DiffHunkState[]): DiffReviewState => {
    if (arr.length && arr.every((x) => x === "kept")) return "kept";
    if (arr.length && arr.every((x) => x === "rejected")) return "rejected";
    return arr.includes("kept") ? "partial" : "pending";
  };
  const stateOf = (f: DiffFile): DiffReviewState => (f.hunks.length ? derive(hunksOf(f)) : st[f.id] ?? "pending");
  const needsReview = (f: DiffFile) => (f.hunks.length ? hunksOf(f).includes("pending") : stateOf(f) === "pending");
  const pending = files.filter(needsReview);

  const setActive = (id: string) => { if (activeId === undefined) setInnerActive(id); onActiveChange?.(id); };
  /** Write new hunk decisions for some files and derive each file's state from them. */
  const commit = (updates: Record<string, DiffHunkState[]>, message: (left: number) => string) => {
    const nextHunks = { ...hs, ...updates };
    const nextStatuses = { ...st };
    for (const id of Object.keys(updates)) nextStatuses[id] = derive(updates[id]);
    if (hunkStatuses === undefined) setInnerHunks(nextHunks);
    if (statuses === undefined) setInnerStatuses(nextStatuses);
    onHunkStatusesChange?.(nextHunks);
    onStatusesChange?.(nextStatuses);
    const left = files.filter((f) => (updates[f.id] ? updates[f.id].includes("pending") : needsReview(f))).length;
    setAnnounce(`${message(left)} ${left === 0 ? l.allReviewed : l.remaining(left)}`);
  };
  const decide = (f: DiffFile, s: DiffHunkState) => {
    const arr = f.hunks.map(() => s);
    if (!f.hunks.length) {
      const nextStatuses = { ...st, [f.id]: s };
      if (statuses === undefined) setInnerStatuses(nextStatuses);
      onStatusesChange?.(nextStatuses);
      const left = files.filter((x) => (x.id === f.id ? s === "pending" : needsReview(x))).length;
      setAnnounce(`${l.announceFile(f.path, s)} ${left === 0 ? l.allReviewed : l.remaining(left)}`);
      return;
    }
    commit({ [f.id]: arr }, () => l.announceFile(f.path, s));
  };
  const decideHunk = (f: DiffFile, i: number, s: DiffHunkState) => {
    const arr = hunksOf(f); arr[i] = s;
    onHunkChange?.(f.id, i, s);
    commit({ [f.id]: arr }, () => l.announceHunk(i + 1, f.path, s, derive(arr)));
  };
  const decideAll = (s: DiffHunkState) => {
    const updates: Record<string, DiffHunkState[]> = {};
    for (const f of pending) updates[f.id] = hunksOf(f).map((x) => (x === "pending" ? s : x));
    const n = pending.length;
    commit(updates, () => l.announceAll(n, s));
  };
  const next = () => {
    if (!pending.length) return;
    const from = files.findIndex((f) => f.id === active?.id);
    const after = [...files.slice(from + 1), ...files.slice(0, from + 1)].find(needsReview);
    if (after) setActive(after.id);
  };

  if (!files.length) return <p className="rounded-2xl border border-line bg-surface p-4 text-sm text-fg-muted">{l.noChanges}</p>;

  return (
    <section aria-label="Review changes" className={cn("w-full overflow-hidden rounded-2xl border border-line bg-surface", className)}>
      <div className="grid md:grid-cols-[minmax(0,18rem)_1fr]">
        <ul aria-label={l.files} className="space-y-0.5 border-b border-line p-2 md:border-r md:border-b-0">
          {files.map((f) => {
            const c = countOf(f);
            return (
              <li key={f.id}>
                <DiffFileRow path={f.path} added={c.added} removed={c.removed} state={stateOf(f)} selected={f.id === active?.id}
                  labels={{ keep: l.keep, reject: l.reject, kept: l.kept, rejected: l.rejected, partial: l.partial, undo: l.undo }}
                  onSelect={() => setActive(f.id)} onKeep={() => decide(f, "kept")} onReject={() => decide(f, "rejected")} onReset={() => decide(f, "pending")} />
              </li>
            );
          })}
        </ul>
        <div className="min-w-0 py-2">
          {active && <Hunks file={active} hunkState={(i) => hunkOf(active, i)} onHunk={(i, s) => decideHunk(active, i, s)} l={l} />}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-sunken px-4 py-2.5">
        <p className="flex-1 text-xs text-fg-muted">{pending.length ? l.remaining(pending.length) : l.allReviewed}</p>
        <Button size="sm" variant="secondary" disabled={!pending.length} onClick={() => decideAll("kept")}>{l.keepAll}</Button>
        <Button size="sm" variant="ghost" disabled={!pending.length} onClick={() => decideAll("rejected")}>{l.rejectAll}</Button>
        <Button size="sm" disabled={!pending.length} onClick={next}>{l.nextFile}</Button>
      </div>
      <p role="status" aria-live="polite" className="sr-only">{announce}</p>
    </section>
  );
}
