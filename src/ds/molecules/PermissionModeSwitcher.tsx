import { useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";
import { AlertIcon, CheckIcon, ChevronIcon, InfoIcon, ShieldIcon } from "../lib/icons";
import { Popover } from "../atoms/Popover";
import { KeyHint } from "../atoms/KeyHint";

export type ModeRisk = "low" | "medium" | "high";

export interface PermissionMode {
  id: string;
  /** Short name shown on the trigger, such as "Manual". */
  label: string;
  /** Plain description of what the agent may do without asking. */
  description: string;
  risk: ModeRisk;
  /** Warning line shown under the description. Use it on the riskiest mode. */
  warning?: string;
  /** When set, the mode cannot be chosen and this reason is shown, for example an admin policy. */
  lockedReason?: string;
}

export const defaultPermissionModes: PermissionMode[] = [
  { id: "manual", label: "Manual", description: "Asks before every edit and command. Read-only commands run without asking.", risk: "low" },
  { id: "plan", label: "Plan (read-only)", description: "Reads and explores, then proposes a plan. Nothing is edited until you approve it.", risk: "low" },
  { id: "accept-edits", label: "Accept edits", description: "Edits files without asking. Commands still ask.", risk: "medium" },
  { id: "auto", label: "Auto", description: "A classifier reviews each action instead of you.", risk: "medium" },
  { id: "bypass", label: "Bypass", description: "Skips all permission prompts, including protected paths.", risk: "high", warning: "Use only in an isolated environment." },
];

const riskText: Record<ModeRisk, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };
const RiskIcon = { low: ShieldIcon, medium: InfoIcon, high: AlertIcon } as const;

export interface PermissionModeSwitcherProps {
  /** Modes in display order. Defaults to Manual, Plan, Accept edits, Auto and Bypass. */
  modes?: PermissionMode[];
  /** Selected mode id (controlled). */
  value?: string;
  /** Initial mode id when uncontrolled. Defaults to the first mode. */
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Accessible name for the mode list and the popover. */
  label?: string;
  /** Keyboard shortcut shown at the foot of the panel, such as "Shift+Tab". Only show it if the app binds it. */
  shortcut?: string;
  /** Text beside the shortcut. */
  shortcutLabel?: string;
  /** Text used in the live announcement, followed by the mode name. */
  announcePrefix?: string;
  className?: string;
}

/**
 * Always-visible trigger that names the current autonomy mode, with a popover to change it.
 * Each mode carries a risk label written out and shown with its own icon shape.
 */
export function PermissionModeSwitcher({
  modes = defaultPermissionModes, value, defaultValue, onChange, label = "Permission mode",
  shortcut, shortcutLabel = "to cycle modes", announcePrefix = "Mode changed to", className,
}: PermissionModeSwitcherProps) {
  const [inner, setInner] = useState(defaultValue ?? modes[0]?.id);
  const [announce, setAnnounce] = useState("");
  const current = value ?? inner;
  const active = modes.find((m) => m.id === current) ?? modes[0];
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  const choose = (m: PermissionMode, close: () => void) => {
    if (m.lockedReason) return;
    if (value === undefined) setInner(m.id);
    onChange?.(m.id);
    setAnnounce(`${announcePrefix} ${m.label}`);
    close();
  };
  const move = (i: number, e: KeyboardEvent) => {
    const n = modes.length;
    const dir = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    refs.current[(i + dir + n) % n]?.focus();
  };

  if (!active) return null;
  const ActiveIcon = RiskIcon[active.risk];

  return (
    <div className={cn("inline-block", className)}>
      <Popover label={label} align="start" side="top" panelClassName="w-80 max-w-[calc(100vw-2rem)]"
        trigger={({ toggle, triggerProps }) => (
          <button type="button" onClick={toggle} {...triggerProps}
            className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-3 text-xs font-medium text-fg hover:border-line-strong">
            <ActiveIcon width={14} height={14} className="text-fg-muted" />
            <span className="text-fg-subtle">{label}:</span>
            <span>{active.label}</span>
            <span className="sr-only">, {riskText[active.risk]}</span>
            <ChevronIcon width={12} height={12} className="rotate-90 text-fg-subtle" />
          </button>
        )}>
        {({ close }) => (
          <div>
            <ul role="radiogroup" aria-label={label} id={listId} className="space-y-0.5">
              {modes.map((m, i) => {
                const on = m.id === active.id;
                const locked = !!m.lockedReason;
                const Icon = RiskIcon[m.risk];
                return (
                  <li key={m.id} role="presentation">
                    <button ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-disabled={locked || undefined}
                      tabIndex={on ? 0 : -1} onKeyDown={(e) => move(i, e)} onClick={() => choose(m, close)}
                      className={cn("flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left transition-colors",
                        locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-hover", on && "bg-sunken")}>
                      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-fg">{on && <CheckIcon width={14} height={14} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-[13px] font-medium text-fg">
                          {m.label}
                          <span className={cn("inline-flex items-center gap-1 text-[11px] font-normal", m.risk === "high" ? "text-danger-fg" : "text-fg-muted")}>
                            <Icon width={12} height={12} />{riskText[m.risk]}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-xs text-fg-muted">{m.description}</span>
                        {m.warning && (
                          <span className="mt-1 flex items-start gap-1 text-xs font-medium text-danger-fg">
                            <AlertIcon width={12} height={12} className="mt-0.5 shrink-0" />{m.warning}
                          </span>
                        )}
                        {locked && <span className="mt-1 block text-xs text-fg-subtle">Locked: {m.lockedReason}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {shortcut && (
              <p className="mt-1 border-t border-line px-2.5 pt-2 pb-1 text-[11px] text-fg-subtle">
                <KeyHint>{shortcut}</KeyHint> {shortcutLabel}
              </p>
            )}
          </div>
        )}
      </Popover>
      <span role="status" aria-live="polite" className="sr-only">{announce}</span>
    </div>
  );
}
