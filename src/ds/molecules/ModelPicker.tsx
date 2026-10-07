import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { CheckIcon, ChevronIcon, InfoIcon } from "../lib/icons";
import { Badge } from "../atoms/Badge";
import { Popover } from "../atoms/Popover";
import { SegmentedControl, type SegmentOption } from "../atoms/SegmentedControl";

export interface ModelOption {
  id: string;
  name: string;
  /** One line describing when to use it. */
  description?: string;
  /** Short badge text such as "Auto". */
  badge?: string;
  /** Marks the option that routes to another model by itself. Pair with `routedId` on the picker. */
  auto?: boolean;
  disabled?: boolean;
}

export interface ModelLimit {
  /** Reason line shown above the list, for example "Weekly limit reached. Resets Friday." */
  reason: string;
  /** Options that cannot be chosen until the limit resets. */
  limitedIds: string[];
  /** Option the conversation continues on. Its name appears in the fallback line. */
  fallbackId: string;
}

export interface ModelPickerProps {
  models: ModelOption[];
  /** Selected model id. Omit for uncontrolled use. */
  value?: string;
  defaultValue?: string;
  onChange?: (id: string) => void;
  /** Accessible name for the list and the panel. */
  label?: string;
  /** Model that actually answered when an auto option is selected. Shown in the panel and on the trigger. */
  routedId?: string;
  /** Builds the line that names the answering model. */
  routedText?: (modelName: string) => string;
  /** Reasoning effort choices, for example Standard and Extended. Omit to hide the control. */
  effortOptions?: SegmentOption<string>[];
  effortValue?: string;
  defaultEffort?: string;
  onEffortChange?: (value: string) => void;
  effortLabel?: string;
  /** Puts the picker in its limit-reached state. */
  limit?: ModelLimit;
  /** Builds the line that names the fallback model. */
  fallbackText?: (modelName: string) => string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  /** Replaces the trigger chip's trailing content. */
  triggerExtra?: ReactNode;
}

/** Chip plus popover for choosing a model or mode. Options form a labelled radio list with arrow-key movement, and an optional effort control sits below. */
export function ModelPicker({
  models, value, defaultValue, onChange, label = "Model", routedId, routedText = (n) => `Answered by ${n}`,
  effortOptions, effortValue, defaultEffort, onEffortChange, effortLabel = "Thinking time",
  limit, fallbackText = (n) => `Continuing on ${n}.`, align = "start", side = "bottom", triggerExtra,
}: ModelPickerProps) {
  const [innerValue, setInnerValue] = useState(defaultValue ?? models[0]?.id ?? "");
  const [innerEffort, setInnerEffort] = useState(defaultEffort ?? effortOptions?.[0]?.value ?? "");
  const current = value ?? innerValue;
  const effort = effortValue ?? innerEffort;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const isOff = (m: ModelOption) => m.disabled || !!limit?.limitedIds.includes(m.id);
  const selected = models.find((m) => m.id === current);
  const routed = selected?.auto && routedId ? models.find((m) => m.id === routedId) : undefined;
  const fallback = limit ? models.find((m) => m.id === limit.fallbackId) : undefined;

  const pick = (id: string) => { if (value === undefined) setInnerValue(id); onChange?.(id); };
  const setEffort = (v: string) => { if (effortValue === undefined) setInnerEffort(v); onEffortChange?.(v); };

  const move = (i: number, e: KeyboardEvent) => {
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    const edge = e.key === "Home" ? 0 : e.key === "End" ? models.length - 1 : -1;
    if (!dir && edge < 0) return;
    e.preventDefault();
    const n = models.length;
    let next = i;
    if (edge >= 0) { next = edge; let guard = 0; while (isOff(models[next]) && guard++ < n) next = (next + (edge === 0 ? 1 : -1) + n) % n; }
    else { let guard = 0; do { next = (next + dir + n) % n; } while (isOff(models[next]) && guard++ < n); }
    if (isOff(models[next])) return;
    pick(models[next].id);
    refs.current[next]?.focus();
  };

  // Roving tab stop: the checked enabled option, else the first enabled one.
  const stopId = selected && !isOff(selected) ? selected.id : models.find((m) => !isOff(m))?.id;

  return (
    <Popover label={label} align={align} side={side} panelClassName="w-80 max-w-[calc(100vw-2rem)]"
      trigger={({ toggle, triggerProps }) => (
        <button type="button" onClick={toggle} {...triggerProps}
          className="inline-flex h-8 max-w-full cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface pl-3 pr-2 text-xs font-medium text-fg transition-colors hover:bg-hover">
          <span className="sr-only">{label}: </span>
          <span className="truncate">{selected?.name ?? label}</span>
          {routed && <span className="truncate font-normal text-fg-muted">via {routed.name}</span>}
          {triggerExtra}
          <ChevronIcon width={14} height={14} className="shrink-0 rotate-90 text-fg-subtle" />
        </button>
      )}>
      {({ close }) => (
        <div>
          {limit && (
            <p className="mx-1 mb-1 flex gap-2 rounded-xl bg-sunken px-3 py-2 text-xs text-fg-muted">
              <InfoIcon width={14} height={14} className="mt-0.5 shrink-0" />
              <span>{limit.reason}{fallback ? ` ${fallbackText(fallback.name)}` : ""}</span>
            </p>
          )}
          <div role="radiogroup" aria-label={label}>
            {models.map((m, i) => {
              const on = m.id === current;
              const off = isOff(m);
              return (
                <button key={m.id} ref={(el) => { refs.current[i] = el; }} type="button" role="radio" aria-checked={on} aria-disabled={off || undefined}
                  tabIndex={m.id === stopId ? 0 : -1}
                  onClick={() => { if (off) return; pick(m.id); close(); }} onKeyDown={(e) => move(i, e)}
                  className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors", off ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-hover", on && "bg-sunken")}>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13px] font-medium text-fg">
                      <span className="truncate">{m.name}</span>
                      {m.badge && <Badge>{m.badge}</Badge>}
                    </span>
                    {m.description && <span className="block text-xs text-fg-muted">{m.description}</span>}
                  </span>
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-fg">{on && <CheckIcon width={16} height={16} />}</span>
                </button>
              );
            })}
          </div>
          {routed && (
            <p className="mx-1 mt-1 rounded-xl bg-sunken px-3 py-2 text-xs text-fg-muted">{routedText(routed.name)}</p>
          )}
          {effortOptions && (
            <div className="mt-1 flex items-center justify-between gap-3 border-t border-line px-3 pt-2.5 pb-1.5">
              <span className="text-xs text-fg-muted">{effortLabel}</span>
              <SegmentedControl size="sm" label={effortLabel} options={effortOptions} value={effort} onChange={setEffort} />
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
