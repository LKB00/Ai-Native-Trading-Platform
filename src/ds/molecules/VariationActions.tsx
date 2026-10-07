import { useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Button } from "../atoms/Button";
import { SegmentedControl, type SegmentOption } from "../atoms/SegmentedControl";

export interface VariationAction {
  id: string;
  label: string;
  /** Cost hint shown beside the action, such as "About 4 credits". */
  cost?: ReactNode;
  /** Set false for actions with no strength choice. Default true. */
  strength?: boolean;
}

export const DEFAULT_VARIATION_ACTIONS: VariationAction[] = [
  { id: "vary", label: "Vary" },
  { id: "upscale", label: "Upscale" },
  { id: "remix", label: "Remix" },
  { id: "extend", label: "Extend", strength: false },
];

export interface VariationActionsProps {
  /** Actions in display order. Defaults to Vary, Upscale, Remix and Extend. */
  actions?: VariationAction[];
  /** Called with the action id and the chosen strength value. */
  onAction: (actionId: string, strength: string) => void;
  /** Strength choices shared by every action that has one. */
  strengths?: SegmentOption<string>[];
  /** Strength selected at first for each action. Defaults to the first strength. */
  defaultStrength?: string;
  /** Lineage line, for example "Made from Variant B". */
  lineage?: ReactNode;
  disabled?: boolean;
  className?: string;
}

const STRENGTHS: SegmentOption<string>[] = [{ value: "subtle", label: "Subtle" }, { value: "strong", label: "Strong" }];

/** Action row for one generated item. Each action keeps its own strength choice and can show what it costs. */
export function VariationActions({ actions = DEFAULT_VARIATION_ACTIONS, onAction, strengths = STRENGTHS, defaultStrength, lineage, disabled, className }: VariationActionsProps) {
  const first = defaultStrength ?? strengths[0]?.value ?? "";
  const [chosen, setChosen] = useState<Record<string, string>>({});
  return (
    <div className={cn("space-y-2", className)}>
      {lineage && <p className="text-xs text-fg-muted">{lineage}</p>}
      <ul className="space-y-1.5">
        {actions.map((a) => {
          const s = chosen[a.id] ?? first;
          const hasStrength = a.strength !== false;
          return (
            <li key={a.id} className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" disabled={disabled} onClick={() => onAction(a.id, hasStrength ? s : "")}>{a.label}</Button>
              {hasStrength && <SegmentedControl size="sm" label={`${a.label} strength`} options={strengths} value={s} onChange={(v) => setChosen((c) => ({ ...c, [a.id]: v }))} />}
              {a.cost && <span className="text-xs text-fg-subtle">{a.cost}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
