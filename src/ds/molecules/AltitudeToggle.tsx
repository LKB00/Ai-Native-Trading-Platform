import { useId, useState } from "react";
import { cn } from "../lib/cn";
import { SegmentedControl } from "../atoms/SegmentedControl";

export type Altitude = "summary" | "steps" | "everything";

export interface AltitudeToggleProps {
  /** Selected view (controlled). */
  value?: Altitude;
  /** Starting view when uncontrolled. */
  defaultValue?: Altitude;
  onChange?: (value: Altitude) => void;
  /** Replace the names of the views. */
  labels?: Partial<Record<Altitude, string>>;
  /** Replace the line that explains each view. */
  hints?: Partial<Record<Altitude, string>>;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
}

const defaultLabels: Record<Altitude, string> = { summary: "Summary", steps: "Steps", everything: "Everything" };
const defaultHints: Record<Altitude, string> = {
  summary: "A short account of the result and anything that needs you.",
  steps: "Each thing the assistant did, one line at a time.",
  everything: "Every detail, including what it read and tried.",
};
const order: Altitude[] = ["summary", "steps", "everything"];

/** Switch between three levels of detail about what an agent did. Arrow keys move and select. */
export function AltitudeToggle({ value, defaultValue = "summary", onChange, labels, hints, label = "How much detail", className }: AltitudeToggleProps) {
  const [inner, setInner] = useState<Altitude>(defaultValue);
  const current = value ?? inner;
  const uid = useId();
  const l = { ...defaultLabels, ...labels };
  const h = { ...defaultHints, ...hints };
  return (
    <div className={cn("min-w-0", className)}>
      <div className="max-w-full overflow-x-auto">
        <SegmentedControl label={label} value={current} options={order.map((k) => ({ value: k, label: l[k] }))}
          onChange={(v) => { if (value === undefined) setInner(v); onChange?.(v); }} />
      </div>
      <p id={`${uid}-hint`} className="mt-1.5 text-xs text-fg-muted">{h[current]}</p>
    </div>
  );
}
