import { useState, type ReactNode } from "react";
import { AIMark } from "../atoms/AIMark";
import { Popover } from "../atoms/Popover";
import { cn } from "../lib/cn";
import { RevertAIIcon } from "../lib/icons";

export type AILabelLevel = "feature" | "message" | "field" | "image";
export type AILabelSize = 16 | 18 | 22;

export interface AILabelProps {
  /** Where the label sits. Sets the placement classes when `placed` is true and the side the explainer opens toward. */
  level?: AILabelLevel;
  /** Pixel size. Match the text beside it: 16 for 12px text, 18 for 14px, 22 for 16px. Use one size smaller next to ghost icon buttons. */
  size?: AILabelSize;
  /** Text in the pill. */
  text?: string;
  /** Apply absolute placement for the level. The parent needs `relative`. Leave false to place the label yourself, for example inline in a row. */
  placed?: boolean;
  /** Toggletip section: a short statement of what the AI did here. */
  overview?: ReactNode;
  /** Toggletip section: model, inputs, limits or anything specific to this instance. */
  details?: ReactNode;
  /** Toggletip section: links to documentation or sources. */
  resources?: ReactNode;
  /** Toggletip section: controls such as Learn more or Turn off. The label never triggers an AI action itself. */
  actions?: ReactNode;
  /** True once a person has edited the content. The tint is dropped and an icon-only revert button replaces the pill. */
  edited?: boolean;
  /** Called when the revert button is pressed. The app restores the AI version and sets `edited` back to false. */
  onRevert?: () => void;
  /** Accessible name for the revert button. */
  revertLabel?: string;
  /** Accessible name for the toggletip panel. */
  popoverLabel?: string;
  className?: string;
}

const PILL: Record<AILabelSize, string> = {
  16: "h-4 gap-0.5 px-1.5 text-[10px] leading-4",
  18: "h-[18px] gap-1 px-2 text-[11px] leading-[18px]",
  22: "h-[22px] gap-1 px-2.5 text-xs leading-[22px]",
};
const MARK: Record<AILabelSize, 16 | 18 | 22> = { 16: 16, 18: 16, 22: 16 };
const PLACE: Record<AILabelLevel, string> = {
  feature: "absolute top-3 right-3",
  message: "",
  field: "absolute top-1/2 right-3 -translate-y-1/2",
  image: "absolute bottom-2 left-2",
};

/**
 * Marks content as produced by AI and opens a toggletip that explains it. The pill is a lime fill with charcoal text.
 * It labels and explains. It never starts an AI action. After a person edits the content the pill is replaced by an
 * icon-only revert button, and reverting brings the pill back.
 */
export function AILabel({
  level = "feature", size = 18, text = "AI", placed = false, overview, details, resources, actions,
  edited = false, onRevert, revertLabel = "Revert to AI version", popoverLabel = "About this AI content", className,
}: AILabelProps) {
  const [open, setOpen] = useState(false);
  const place = placed ? PLACE[level] : "";

  if (edited) {
    return (
      <button type="button" aria-label={revertLabel} title={revertLabel} onClick={onRevert}
        className={cn("inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-line bg-surface text-fg-muted hover:bg-hover hover:text-fg pointer-coarse:size-11", place, className)}>
        <RevertAIIcon width={size === 16 ? 14 : 16} height={size === 16 ? 14 : 16} />
      </button>
    );
  }

  const sections: [string, ReactNode][] = ([["Overview", overview], ["Details", details], ["Resources", resources], ["Actions", actions]] as [string, ReactNode][]).filter(([, v]) => v !== undefined && v !== null && v !== false);

  return (
    <span className={cn("inline-flex align-middle", place, className)} onBlur={(e) => { if (open && !e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false); }}>
      <Popover open={open} onOpenChange={setOpen} label={popoverLabel} align={level === "image" || level === "message" ? "start" : "end"} side={level === "image" ? "top" : "bottom"}
        panelClassName="w-72 max-w-[calc(100vw-2rem)] p-4"
        trigger={({ triggerProps, toggle }) => (
          <button type="button" onClick={toggle} {...triggerProps} aria-label={`${text}. About this AI content`}
            className="group inline-flex min-h-6 shrink-0 cursor-pointer items-center rounded-full pointer-coarse:min-h-11">
            <span className={cn("inline-flex animate-pop items-center rounded-full border border-transparent bg-lime font-medium text-on-lime group-hover:bg-lime-hover", PILL[size])}>
              <AIMark size={MARK[size]} />{text}
            </span>
          </button>
        )}>
        {sections.length === 0 ? <p className="text-[13px] leading-5 text-fg-muted">This content was produced by AI.</p> : (
          <div className="space-y-3 text-[13px] leading-5 text-fg-muted">
            {sections.map(([name, body]) => (
              <section key={name} aria-label={name}>
                <h4 className="font-sans! mb-1 text-[10px] font-normal uppercase tracking-[0.08em] text-fg-subtle">{name}</h4>
                <div className={name === "Actions" ? "flex flex-wrap gap-2" : undefined}>{body}</div>
              </section>
            ))}
          </div>
        )}
      </Popover>
    </span>
  );
}
