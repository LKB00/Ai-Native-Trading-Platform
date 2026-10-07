import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { CheckIcon, RefreshIcon, SendIcon } from "../lib/icons";
import { Button, IconButton } from "../atoms/Button";
import { Spinner } from "../atoms/Spinner";

export type SuggestionBarStatus = "generating" | "ready" | "committed" | "discarded";

export interface SuggestionBarProps {
  /** Where the staged output is in its life. Nothing reaches the document until it is committed. */
  status?: SuggestionBarStatus;
  /** Optional preview of the staged output, rendered above the bar. */
  children?: ReactNode;
  /** Label of the primary action. Use "Replace" when the output replaces a selection. */
  primaryLabel?: string;
  /** Called by the primary action. */
  onKeep?: () => void;
  onInsertBelow?: () => void;
  /** A fresh sample from the same prompt. Not a follow-up. */
  onRegenerate?: () => void;
  onDiscard?: () => void;
  /** A follow-up instruction that changes the draft. Not a fresh sample. */
  onRefine?: (instruction: string) => void;
  /** Cost of a retry, for example "Uses 1 AI response". Shown beside Regenerate. */
  retryCost?: ReactNode;
  /** Product text, all overridable. */
  labels?: Partial<Record<"insertBelow" | "regenerate" | "discard" | "refine" | "refinePlaceholder" | "refineSend" | "generating" | "ready" | "committed" | "discarded", string>>;
  className?: string;
}

const defaults = {
  insertBelow: "Insert below", regenerate: "Regenerate", discard: "Discard", refine: "Fine-tune this", refinePlaceholder: "Tell AI what to change",
  refineSend: "Send instruction", generating: "Writing a draft", ready: "Draft ready. Nothing is added until you choose.", committed: "Added to the document.", discarded: "Draft discarded.",
};

/**
 * Result bar for staged AI output. Keep, Insert below, Regenerate and Discard sit next to a "Fine-tune this" field.
 * Regenerate asks for a fresh sample, Fine-tune sends a follow-up instruction. Status changes are announced through a separate polite region.
 */
export function SuggestionBar({
  status = "ready", children, primaryLabel = "Keep", onKeep, onInsertBelow, onRegenerate, onDiscard, onRefine, retryCost, labels, className,
}: SuggestionBarProps) {
  const t = { ...defaults, ...labels };
  const [text, setText] = useState("");
  const ready = status === "ready";
  const message = t[status];
  return (
    <div className={cn("w-full space-y-3 rounded-3xl border border-line bg-surface p-3", className)}>
      <p role="status" className="sr-only">{status === "generating" ? "" : message}</p>
      {children && <div className={cn("rounded-2xl bg-sunken p-3 text-sm text-fg", status === "discarded" && "opacity-60")}>{children}</div>}
      {status === "generating" && (
        <div className="flex items-center gap-2 text-xs text-fg-muted"><Spinner size={14} label={t.generating} /><span aria-hidden="true">{t.generating}</span>
          <Button size="sm" variant="ghost" className="ml-auto" onClick={onDiscard}>{t.discard}</Button></div>
      )}
      {(status === "committed" || status === "discarded") && (
        <p className="flex items-center gap-1.5 text-xs text-fg-muted" aria-hidden="true">{status === "committed" && <CheckIcon width={13} height={13} />}{message}</p>
      )}
      {ready && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="lime" onClick={onKeep}>{primaryLabel}</Button>
            <Button size="sm" variant="secondary" onClick={onInsertBelow}>{t.insertBelow}</Button>
            <Button size="sm" variant="secondary" leading={<RefreshIcon width={13} height={13} />} onClick={onRegenerate}>{t.regenerate}</Button>
            {retryCost && <span className="text-[11px] text-fg-subtle">{retryCost}</span>}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={onDiscard}>{t.discard}</Button>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); const v = text.trim(); if (v) { onRefine?.(v); setText(""); } }}
            className="flex items-center gap-1 rounded-full border border-line bg-sunken pl-4 pr-1 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--focus-ring)]">
            <input value={text} onChange={(e) => setText(e.target.value)} aria-label={t.refine} placeholder={`${t.refine}. ${t.refinePlaceholder}`}
              className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-fg placeholder:text-fg-subtle focus:outline-none" />
            <IconButton type="submit" size="sm" variant="primary" label={t.refineSend} disabled={!text.trim()}><SendIcon width={13} height={13} /></IconButton>
          </form>
        </>
      )}
    </div>
  );
}
