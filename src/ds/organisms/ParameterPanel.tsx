import { useId, useRef, type KeyboardEvent } from "react";
import { cn } from "../lib/cn";
import { SparkleIcon } from "../lib/icons";
import { Button } from "../atoms/Button";
import { SegmentedControl } from "../atoms/SegmentedControl";
import { Spinner } from "../atoms/Spinner";
import { Switch } from "../atoms/Switch";

/** A value held for one parameter. A seed is a number when fixed and null when left random. */
export type ParameterValue = string | number | boolean | null;
export type ParameterValues = Record<string, ParameterValue>;

export interface ParameterOption { value: string; label: string; description?: string }

interface BaseSpec { /** Key in the values object. */ id: string; /** Visible label. */ label: string; /** Short helper text under the label. */ hint?: string }

export type ParameterSpec =
  | (BaseSpec & { kind: "segmented"; options: ParameterOption[] })
  | (BaseSpec & { kind: "aspect"; options: ParameterOption[] })
  | (BaseSpec & { kind: "presets"; options: ParameterOption[] })
  | (BaseSpec & { kind: "number"; min?: number; max?: number; step?: number; unit?: string })
  | (BaseSpec & { kind: "seed"; /** Seed used when the person switches Fixed on. */ defaultSeed?: number; fixedLabel?: string });

export interface ParameterPanelProps {
  /** Schema that decides which controls render, in order. */
  parameters: ParameterSpec[];
  /** Current values keyed by parameter id. */
  values: ParameterValues;
  onChange: (values: ParameterValues) => void;
  /** Called with the current values when Generate is pressed. */
  onGenerate: (values: ParameterValues) => void;
  /** Returns the cost for the current values. Omit to hide the readout. */
  estimateCost?: (values: ParameterValues) => number;
  /** Formats the cost readout. */
  formatCost?: (cost: number) => string;
  title?: string;
  generateLabel?: string;
  busyLabel?: string;
  /** Disables Generate and shows a spinner. */
  busy?: boolean;
  className?: string;
}

function RatioGlyph({ ratio }: { ratio: string }) {
  const [w, h] = ratio.split(":").map(Number);
  if (!w || !h) return null;
  const scale = 12 / Math.max(w, h);
  return <span aria-hidden className="inline-block rounded-[2px] border border-current" style={{ width: Math.max(4, w * scale), height: Math.max(4, h * scale) }} />;
}

/** Wrapping single-choice chips with roving tab stop and arrow keys. */
function ChipGroup({ options, value, onChange, label, glyph }: { options: ParameterOption[]; value: string; onChange: (v: string) => void; label: string; glyph?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const move = (i: number, e: KeyboardEvent) => {
    const n = options.length;
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  const hasValue = options.some((o) => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button key={o.value} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} title={o.description}
            tabIndex={on || (!hasValue && i === 0) ? 0 : -1} onClick={() => onChange(o.value)} onKeyDown={(e) => move(i, e)}
            className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              on ? "border-fg bg-surface text-fg shadow-sm" : "border-line text-fg-muted hover:bg-hover hover:text-fg")}>
            {glyph && <RatioGlyph ratio={o.label} />}{o.label}
          </button>
        );
      })}
    </div>
  );
}

function Field({ spec, children, labelId }: { spec: BaseSpec; children: React.ReactNode; labelId: string }) {
  return (
    <div className="space-y-1.5">
      <div>
        <span id={labelId} className="text-xs font-medium text-fg">{spec.label}</span>
        {spec.hint && <span className="ml-2 text-xs text-fg-subtle">{spec.hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * Generation settings driven by a schema. Values are controlled. A cost readout is computed
 * from the values by `estimateCost`, and Generate passes the values back to the caller.
 */
export function ParameterPanel({ parameters, values, onChange, onGenerate, estimateCost, formatCost = (c) => `About ${c} credits`, title = "Settings", generateLabel = "Generate", busyLabel = "Generating…", busy, className }: ParameterPanelProps) {
  const uid = useId();
  const set = (id: string, v: ParameterValue) => onChange({ ...values, [id]: v });
  const cost = estimateCost?.(values);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!busy) onGenerate(values); }} aria-label={title}
      className={cn("space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-sm", className)}>
      <h3 className="text-base">{title}</h3>
      {parameters.map((p) => {
        const labelId = `${uid}-${p.id}`;
        const v = values[p.id];
        if (p.kind === "segmented") {
          return <Field key={p.id} spec={p} labelId={labelId}>
            <SegmentedControl label={p.label} options={p.options} value={String(v ?? p.options[0]?.value ?? "")} onChange={(x) => set(p.id, x)} />
          </Field>;
        }
        if (p.kind === "aspect" || p.kind === "presets") {
          return <Field key={p.id} spec={p} labelId={labelId}>
            <ChipGroup label={p.label} glyph={p.kind === "aspect"} options={p.options} value={String(v ?? "")} onChange={(x) => set(p.id, x)} />
          </Field>;
        }
        if (p.kind === "number") {
          return <Field key={p.id} spec={p} labelId={labelId}>
            <div className="inline-flex items-center gap-2 rounded-full border border-line bg-sunken px-3 py-1 focus-within:border-fg-subtle has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-[var(--focus-ring)]">
              <input type="number" aria-labelledby={labelId} min={p.min} max={p.max} step={p.step} value={typeof v === "number" ? v : ""}
                onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) set(p.id, n); }}
                className="w-16 bg-transparent text-sm outline-none" />
              {p.unit && <span className="text-xs text-fg-muted">{p.unit}</span>}
            </div>
          </Field>;
        }
        const fixed = typeof v === "number";
        return <Field key={p.id} spec={p} labelId={labelId}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-xs text-fg-muted">
              <Switch label={`${p.fixedLabel ?? "Fixed"} ${p.label.toLowerCase()}`} checked={fixed} onChange={(on) => set(p.id, on ? (p.defaultSeed ?? 1234) : null)} />
              {p.fixedLabel ?? "Fixed"}
            </span>
            {fixed
              ? <input type="number" aria-labelledby={labelId} value={v as number} onChange={(e) => { const n = e.target.valueAsNumber; if (!Number.isNaN(n)) set(p.id, n); }}
                  className="w-28 rounded-full border border-line bg-sunken px-3 py-1 text-sm focus:border-fg-subtle" />
              : <span className="text-xs text-fg-subtle">Random each time</span>}
          </div>
        </Field>;
      })}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <p role="status" aria-live="polite" className="text-xs text-fg-muted">{cost !== undefined ? formatCost(cost) : ""}</p>
        <Button type="submit" variant="lime" disabled={busy} leading={busy ? <Spinner size={14} /> : <SparkleIcon width={14} height={14} />}>{busy ? busyLabel : generateLabel}</Button>
      </div>
    </form>
  );
}
