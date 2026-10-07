import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { FileIcon, ImageIcon, XIcon } from "../lib/icons";
import { Button, IconButton } from "../atoms/Button";
import { MeterBar } from "../atoms/MeterBar";

export type AttachmentStatus = "ready" | "uploading" | "error";

export interface AttachmentChipProps {
  /** File name. */
  name: string;
  /** Display size such as "2.4 MB". */
  size?: string;
  /** Picks the default icon when no thumbnail is given. */
  kind?: "file" | "image";
  /** Replaces the default icon, for example an img element. Keep it decorative. */
  thumbnail?: ReactNode;
  status?: AttachmentStatus;
  /** Upload progress from 0 to 100. Used while status is "uploading". */
  progress?: number;
  /** Text shown when status is "error". */
  errorMessage?: string;
  /** Shows a Retry button in the error state. */
  onRetry?: () => void;
  /** Shows the remove button. The button is named after the file. */
  onRemove?: () => void;
  className?: string;
}

/** File or image chip for the composer. Shows upload progress as a meter and a retry action when the upload fails. */
export function AttachmentChip({ name, size, kind = "file", thumbnail, status = "ready", progress = 0, errorMessage = "Upload failed", onRetry, onRemove, className }: AttachmentChipProps) {
  const pct = Math.round(Math.max(0, Math.min(100, progress)));
  const Icon = kind === "image" ? ImageIcon : FileIcon;
  return (
    <div className={cn("flex w-64 max-w-full items-center gap-2.5 rounded-2xl border bg-surface p-2", status === "error" ? "border-danger/40" : "border-line", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sunken text-fg-muted">
        {thumbnail ?? <Icon width={18} height={18} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-fg" title={name}>{name}</span>
        {status === "ready" && size && <span className="block text-xs text-fg-muted">{size}</span>}
        {status === "uploading" && (
          <span className="mt-1 block">
            <MeterBar value={pct} label={`Uploading ${name}`} valueText={`${pct}% uploaded`} />
            <span className="mt-1 block text-xs text-fg-muted tabular-nums">Uploading {pct}%{size ? ` of ${size}` : ""}</span>
          </span>
        )}
        {status === "error" && <span className="block truncate text-xs text-danger-fg">{errorMessage}</span>}
      </span>
      {status === "error" && onRetry && <Button size="sm" variant="secondary" onClick={onRetry} aria-label={`Retry upload of ${name}`}>Retry</Button>}
      {onRemove && (
        <IconButton label={`Remove ${name}`} size="sm" onClick={onRemove}><XIcon width={14} height={14} /></IconButton>
      )}
    </div>
  );
}
