import { useState, type ReactNode } from "react";
import { Button } from "../atoms/Button";
import { SegmentedControl } from "../atoms/SegmentedControl";
import { cn } from "../lib/cn";

export type RevertVersion = "ai" | "user";

export interface RevertToggleProps {
  /** The original AI suggestion. */
  aiValue: ReactNode;
  /** The person's edited version. When absent, only the AI value shows and the controls are hidden. */
  userValue?: ReactNode;
  /** Controlled active version. Omit to let the toggle manage itself. */
  value?: RevertVersion;
  /** Starting version in uncontrolled mode. Defaults to "user" when an edit exists. */
  defaultValue?: RevertVersion;
  onChange?: (value: RevertVersion) => void;
  /** Called when the person chooses Revert to original. The app should drop the edit. */
  onRevert?: () => void;
  aiLabel?: string;
  userLabel?: string;
  revertLabel?: string;
  /** Accessible name for the version switch. */
  label?: string;
  className?: string;
}

/** Switches a value between the AI suggestion and the person's edit, with a way back to the original. */
export function RevertToggle({ aiValue, userValue, value, defaultValue, onChange, onRevert, aiLabel = "AI suggestion", userLabel = "Your edit", revertLabel = "Revert to original", label = "Version", className }: RevertToggleProps) {
  const hasEdit = userValue !== undefined && userValue !== null;
  const [inner, setInner] = useState<RevertVersion>(defaultValue ?? (hasEdit ? "user" : "ai"));
  const [message, setMessage] = useState("");
  const active: RevertVersion = hasEdit ? (value ?? inner) : "ai";
  const names = { ai: aiLabel, user: userLabel };
  const set = (v: RevertVersion) => { if (value === undefined) setInner(v); onChange?.(v); setMessage(`Showing ${names[v]}`); };
  return (
    <div className={cn("space-y-3", className)}>
      {hasEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl size="sm" label={label} value={active} onChange={set} options={[{ value: "ai", label: aiLabel }, { value: "user", label: userLabel }]} />
          <Button size="sm" variant="ghost" onClick={() => { set("ai"); onRevert?.(); }}>{revertLabel}</Button>
        </div>
      )}
      <div className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-fg">{active === "ai" ? aiValue : userValue}</div>
      <span role="status" className="sr-only">{message}</span>
    </div>
  );
}
