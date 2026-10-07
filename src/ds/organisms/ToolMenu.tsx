import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { CheckIcon, PlusIcon } from "../lib/icons";
import { IconButton } from "../atoms/Button";
import { Popover } from "../atoms/Popover";

export interface ToolMenuAction {
  id: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
}

export interface ToolMenuTool extends ToolMenuAction {
  /** Whether the tool is switched on. Owned by the parent. */
  checked: boolean;
}

export interface ToolMenuConnector extends ToolMenuAction {
  /** Status text shown at the end of the row, for example "Connected". */
  status?: string;
}

export interface ToolMenuProps {
  /** Attach actions such as "Upload file". Selecting one closes the menu. */
  attach?: ToolMenuAction[];
  /** Tools with a checked state. Toggling keeps the menu open. */
  tools?: ToolMenuTool[];
  /** Connected sources. Selecting one closes the menu. */
  connectors?: ToolMenuConnector[];
  onAttach?: (id: string) => void;
  onToggle?: (id: string, checked: boolean) => void;
  onConnector?: (id: string) => void;
  /** Section headings. */
  labels?: { attach?: string; tools?: string; connectors?: string };
  /** Name of the trigger button and the menu. */
  label?: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
}

function Row({ icon, label, description, trailing, disabled, role, checked, onSelect }: ToolMenuAction & { trailing?: ReactNode; role: "menuitem" | "menuitemcheckbox"; checked?: boolean; onSelect: () => void }) {
  return (
    <button type="button" role={role} aria-checked={role === "menuitemcheckbox" ? !!checked : undefined} disabled={disabled} tabIndex={-1} onClick={onSelect}
      className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-hover focus-visible:bg-hover disabled:pointer-events-none disabled:opacity-50")}>
      {icon && <span className="flex shrink-0 items-center text-fg-muted">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-fg">{label}</span>
        {description && <span className="block truncate text-xs text-fg-muted">{description}</span>}
      </span>
      {trailing}
      {role === "menuitemcheckbox" && <span className="flex size-4 shrink-0 items-center justify-center text-fg">{checked && <CheckIcon width={16} height={16} />}</span>}
    </button>
  );
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={title} className="py-1 not-first:border-t not-first:border-line">
      {title && <div aria-hidden className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-[0.08em] text-fg-muted">{title}</div>}
      {children}
    </div>
  );
}

/** The composer plus menu. Sections for attaching, tools with a checked state, and connectors. Focus, arrow keys, Home, End, Escape and Tab come from Popover with role menu. */
export function ToolMenu({ attach = [], tools = [], connectors = [], onAttach, onToggle, onConnector, labels, label = "Add to message", align = "start", side = "top" }: ToolMenuProps) {
  return (
    <Popover role="menu" label={label} align={align} side={side} panelClassName="w-72 max-w-[calc(100vw-2rem)]"
      trigger={({ toggle, triggerProps }) => (
        <IconButton label={label} variant="secondary" onClick={toggle} {...triggerProps}><PlusIcon /></IconButton>
      )}>
      {({ close }) => (
        <div>
          {attach.length > 0 && (
            <Group title={labels?.attach ?? "Attach"}>
              {attach.map((a) => <Row key={a.id} role="menuitem" {...a} onSelect={() => { onAttach?.(a.id); close(); }} />)}
            </Group>
          )}
          {tools.length > 0 && (
            <Group title={labels?.tools ?? "Tools"}>
              {tools.map((t) => <Row key={t.id} role="menuitemcheckbox" {...t} onSelect={() => onToggle?.(t.id, !t.checked)} />)}
            </Group>
          )}
          {connectors.length > 0 && (
            <Group title={labels?.connectors ?? "Connectors"}>
              {connectors.map((c) => (
                <Row key={c.id} role="menuitem" {...c} onSelect={() => { onConnector?.(c.id); close(); }}
                  trailing={c.status ? <span className="shrink-0 text-xs text-fg-subtle">{c.status}</span> : undefined} />
              ))}
            </Group>
          )}
        </div>
      )}
    </Popover>
  );
}
