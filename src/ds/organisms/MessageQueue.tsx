import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { ChevronIcon, XIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { Button, IconButton } from "../atoms/Button";
import { KeyHint } from "../atoms/KeyHint";

export interface QueuedMessage {
  id: string;
  text: string;
}

export interface MessageQueueProps {
  items: QueuedMessage[];
  /** Sends this message now instead of waiting for its turn. */
  onSendNow?: (id: string) => void;
  /** Moves a message one place earlier or later. The parent reorders `items`. */
  onMove?: (id: string, direction: "up" | "down") => void;
  onDelete?: (id: string) => void;
  title?: string;
  /** Explains queueing against steering. Replace it with your own product wording. */
  description?: ReactNode;
  emptyText?: string;
  /** Shortcut shown beside Send now on the first item, for example "Ctrl Enter". Omit to hide. */
  sendNowShortcut?: string;
  className?: string;
}

/** Messages the person sent while the assistant was working. They show in a pending style, and can be sent now, reordered or removed. */
export function MessageQueue({
  items, onSendNow, onMove, onDelete, title = "Queued", sendNowShortcut, className, emptyText = "Nothing queued. Messages you send while the assistant works will wait here.",
  description = "Queued messages send in order when the assistant finishes this step. To change what it is doing now, steer it instead.",
}: MessageQueueProps) {
  const [note, setNote] = useState("");
  const move = (id: string, i: number, dir: "up" | "down") => {
    setNote(`Message moved to position ${dir === "up" ? i : i + 2} of ${items.length}`);
    onMove?.(id, dir);
  };
  return (
    <section aria-label={title} className={cn("rounded-2xl border border-line bg-surface p-4", className)}>
      <header className="flex items-center gap-2">
        <h3 className="font-sans! text-[13px] font-medium text-fg">{title}</h3>
        <Badge>{items.length}</Badge>
      </header>
      <p className="mt-1 text-xs text-fg-muted">{description}</p>
      {items.length === 0 ? (
        <p className="mt-3 rounded-xl bg-sunken px-3 py-4 text-center text-xs text-fg-muted">{emptyText}</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {items.map((m, i) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-dashed border-line-strong bg-sunken/60 py-1.5 pr-1.5 pl-3">
              <span className="w-4 shrink-0 text-xs text-fg-subtle tabular-nums">{i + 1}</span>
              <span className="min-w-[8rem] flex-1 truncate text-[13px] text-fg-muted" title={m.text}>{m.text}</span>
              <span className="ml-auto flex flex-wrap items-center justify-end gap-1">
              <Button size="sm" variant="secondary" onClick={() => onSendNow?.(m.id)} aria-label={`Send now: ${m.text}`}>
                Send now{i === 0 && sendNowShortcut && <KeyHint>{sendNowShortcut}</KeyHint>}
              </Button>
              <IconButton size="sm" label={`Move message ${i + 1} up`} disabled={i === 0} onClick={() => move(m.id, i, "up")}><ChevronIcon width={14} height={14} className="-rotate-90" /></IconButton>
              <IconButton size="sm" label={`Move message ${i + 1} down`} disabled={i === items.length - 1} onClick={() => move(m.id, i, "down")}><ChevronIcon width={14} height={14} className="rotate-90" /></IconButton>
              <IconButton size="sm" label={`Delete message ${i + 1}`} onClick={() => onDelete?.(m.id)}><XIcon width={14} height={14} /></IconButton>
              </span>
            </li>
          ))}
        </ol>
      )}
      <p role="status" className="sr-only">{note}</p>
    </section>
  );
}
