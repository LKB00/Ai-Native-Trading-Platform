import type { ReactNode } from "react";
import { RefreshIcon, XIcon } from "../lib/icons";
import { Button, IconButton } from "../atoms/Button";

/** Side panel for generated artifacts (docs, code, designs) that outlive a single chat message. */
export function CanvasPanel({ title, version, versions = 1, onVersionChange, onClose, onRegenerate, children, actions }: {
  title: string; version?: number; versions?: number; onVersionChange?: (v: number) => void; onClose?: () => void; onRegenerate?: () => void; children: ReactNode; actions?: ReactNode;
}) {
  return (
    <aside aria-label={title} className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-md">
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-line px-3 py-2">
        <h3 className="min-w-[8rem] flex-1 truncate text-sm font-medium">{title}</h3>
        {versions > 1 && version != null && (
          <div className="flex items-center gap-1 text-xs text-fg-muted" role="group" aria-label="Version history">
            <Button size="sm" variant="ghost" disabled={version <= 1} onClick={() => onVersionChange?.(version - 1)} aria-label="Previous version">‹</Button>
            <span className="tabular-nums">v{version} of {versions}</span>
            <Button size="sm" variant="ghost" disabled={version >= versions} onClick={() => onVersionChange?.(version + 1)} aria-label="Next version">›</Button>
          </div>
        )}
        {onRegenerate && <IconButton size="sm" label="Regenerate" onClick={onRegenerate}><RefreshIcon /></IconButton>}
        {actions}
        {onClose && <IconButton size="sm" label="Close panel" onClick={onClose}><XIcon /></IconButton>}
      </header>
      <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
    </aside>
  );
}
