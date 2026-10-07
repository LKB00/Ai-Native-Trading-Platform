import { useRef } from "react";
import { cn } from "../lib/cn";
import { useFocusAfter } from "../lib/useFocusAfter";
import { CheckIcon, FileIcon, XIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { Button } from "../atoms/Button";

export type DiffHunkState = "pending" | "kept" | "rejected";
/** A file is "partial" when some hunks are kept and others are rejected or still pending. */
export type DiffReviewState = DiffHunkState | "partial";

export interface DiffFileRowProps {
  /** File path. The directory is shown muted and the file name in full weight. */
  path: string;
  /** Number of added lines. */
  added: number;
  /** Number of removed lines. */
  removed: number;
  state?: DiffReviewState;
  /** Marks the file whose hunks are currently shown. */
  selected?: boolean;
  onSelect?: () => void;
  onKeep?: () => void;
  onReject?: () => void;
  /** Return a kept or rejected file to pending. When omitted, decided rows show no undo. */
  onReset?: () => void;
  labels?: { keep?: string; reject?: string; kept?: string; rejected?: string; partial?: string; undo?: string; /** Spoken in place of the +/- counts. */ lines?: (added: number, removed: number) => string };
  className?: string;
}

/** Half-filled circle for a partly kept file. */
function PartialGlyph() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
      <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  );
}

/** One file in a change review: name, +/- counts and a per-file Keep and Reject. Decided files show a badge with an icon and text, and a partly kept file shows its badge beside the buttons. */
export function DiffFileRow({ path, added, removed, state = "pending", selected, onSelect, onKeep, onReject, onReset, labels, className }: DiffFileRowProps) {
  const l = { keep: "Keep", reject: "Reject", kept: "Kept", rejected: "Rejected", partial: "Partly kept", undo: "Undo", lines: (a: number, r: number) => `${a} ${a === 1 ? "line" : "lines"} added, ${r} removed`, ...labels };
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash + 1) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const nameBtn = useRef<HTMLButtonElement>(null);
  // Keep, Reject and Undo disappear once pressed. Focus then lands on the file name, which says the new state.
  const arm = useFocusAfter(state, () => nameBtn.current);
  const act = (f?: () => void) => () => { arm(); f?.(); };
  const stateWord = state === "kept" ? l.kept : state === "rejected" ? l.rejected : state === "partial" ? l.partial : "";
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl px-3 py-2", selected ? "bg-sunken" : "hover:bg-hover", className)}>
      <button ref={nameBtn} type="button" onClick={onSelect} aria-current={selected ? "true" : undefined}
        className="flex min-w-[9rem] flex-1 cursor-pointer items-center gap-2 rounded-full text-left">
        <FileIcon width={14} height={14} className="shrink-0 text-fg-subtle" />
        <span className="min-w-0 truncate text-[13px]">
          <span className="text-fg-subtle">{dir}</span>
          <span className={cn("font-medium", state === "rejected" && "line-through text-fg-muted")}>{name}</span>
          {stateWord && <span className="sr-only">, {stateWord}</span>}
        </span>
      </button>
      <span className="font-mono text-xs tabular-nums">
        <span aria-hidden className="text-success-fg">+{added}</span>{" "}
        <span aria-hidden className="text-danger-fg">&minus;{removed}</span>
        <span className="sr-only">{l.lines(added, removed)}</span>
      </span>
      {state === "pending" || state === "partial" ? (
        <span key="open" className="flex flex-wrap items-center gap-1.5">
          {state === "partial" && (
            <Badge tone="neutral"><PartialGlyph />{l.partial}</Badge>
          )}
          <Button size="sm" variant="secondary" onClick={act(onKeep)} aria-label={`${l.keep} ${path}`}>{l.keep}</Button>
          <Button size="sm" variant="ghost" onClick={act(onReject)} aria-label={`${l.reject} ${path}`}>{l.reject}</Button>
          {state === "partial" && onReset && <Button size="sm" variant="ghost" onClick={act(onReset)} aria-label={`${l.undo}: ${path}`}>{l.undo}</Button>}
        </span>
      ) : (
        <span key="decided" className="flex items-center gap-1.5">
          <Badge tone={state === "kept" ? "success" : "danger"}>
            {state === "kept" ? <CheckIcon width={11} height={11} /> : <XIcon width={11} height={11} />}
            {state === "kept" ? l.kept : l.rejected}
          </Badge>
          {onReset && <Button size="sm" variant="ghost" onClick={act(onReset)} aria-label={`${l.undo}: ${path}`}>{l.undo}</Button>}
        </span>
      )}
    </div>
  );
}
