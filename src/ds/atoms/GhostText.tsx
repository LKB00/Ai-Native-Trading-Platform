import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { XIcon } from "../lib/icons";
import { KeyHint } from "./KeyHint";

export interface GhostTextProps {
  /** The suggested continuation, shown dimmed. */
  children: string;
  /** Text the person already typed. Rendered in normal ink before the suggestion. */
  typed?: ReactNode;
  /** Id for the visually hidden description. Point the field's aria-describedby at it. */
  id?: string;
  /** Key that accepts the whole suggestion. Shown in the hint. */
  acceptKey?: string;
  /** Key that dismisses the suggestion. Announced to assistive tech. */
  dismissKey?: string;
  /** Text for a partial accept path, for example "Ctrl + Right accepts one word". Omit when partial accept is not offered. */
  partialHint?: string;
  /** Override the text read by assistive tech. The default names the suggestion, the accept key and the dismiss key. */
  description?: string;
  /** Called when the hint is activated. The consumer wires the real key (usually Tab) to the same handler. */
  onAccept?: () => void;
  /** Called when the dismiss control is activated. The consumer wires Escape to the same handler. */
  onDismiss?: () => void;
  /** Accessible names for the two controls. */
  acceptLabel?: string;
  dismissLabel?: string;
  className?: string;
}

/**
 * Dimmed inline suggestion shown after typed text. The visible suggestion is hidden from the accessibility tree and
 * a visually hidden description carries the same text, so it is read as a pending suggestion and not as typed text.
 * It never uses aria-live. The consumer owns key handling.
 */
export function GhostText({
  children, typed, id, acceptKey = "Tab", dismissKey = "Esc", partialHint, description,
  onAccept, onDismiss, acceptLabel = "Accept suggestion", dismissLabel = "Dismiss suggestion", className,
}: GhostTextProps) {
  const hint = <KeyHint>{acceptKey}</KeyHint>;
  return (
    <span className={cn("inline", className)}>
      {typed}
      <span id={id} className="sr-only">
        {description ?? `Suggestion available: ${children}. Press ${acceptKey} to accept, ${dismissKey} to dismiss.${partialHint ? ` ${partialHint}.` : ""}`}
      </span>
      <span aria-hidden="true" data-ghost className="rounded-sm bg-sunken/70 text-fg-subtle underline decoration-line-strong decoration-dotted underline-offset-4">{children}</span>
      <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
        {onAccept
          ? <button type="button" aria-label={`${acceptLabel}, ${acceptKey}`} onClick={onAccept} className="cursor-pointer rounded-md">{hint}</button>
          : <span aria-hidden="true">{hint}</span>}
        {partialHint && <span aria-hidden="true" className="text-[11px] text-fg-subtle">{partialHint}</span>}
        {onDismiss && (
          <button type="button" aria-label={dismissLabel} title={dismissLabel} onClick={onDismiss}
            className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full text-fg-subtle hover:bg-hover hover:text-fg">
            <XIcon width={12} height={12} />
          </button>
        )}
      </span>
    </span>
  );
}
