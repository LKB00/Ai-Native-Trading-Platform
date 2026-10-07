import { useId, useState, type ReactNode } from "react";
import { Button } from "../atoms/Button";
import { CodeBlock } from "./CodeBlock";

export interface DiagramFigureProps {
  /** Short alt. Names the diagram and says where the long description is. Becomes the figure's aria-label. */
  label: string;
  /** Visible caption. */
  caption: string;
  /** Long description, shown on the page for everyone. */
  description?: ReactNode;
  /** Text alternative shown under the diagram, such as an ordered list of steps. */
  alternative?: ReactNode;
  /** Textual definition of the diagram. Enables the view-source toggle. */
  source?: string;
  /** Language label for the source block. */
  sourceLanguage?: string;
  /** The diagram itself. */
  children: ReactNode;
}

/**
 * Accessible wrapper for a complex image. It renders a figure with a short aria-label, a caption,
 * a visible long description, an optional text alternative and a view-source toggle with copy.
 */
export function DiagramFigure({ label, caption, description, alternative, source, sourceLanguage = "text", children }: DiagramFigureProps) {
  const [open, setOpen] = useState(false);
  const uid = useId();
  const desc = `${uid}-desc`;
  const src = `${uid}-src`;
  return (
    <figure aria-label={label} className="m-0 min-w-0 rounded-3xl border border-line bg-surface p-4 sm:p-5">
      <div tabIndex={0} className="overflow-x-auto">{children}</div>
      <figcaption className="mt-4 border-t border-line pt-4">
        <p className="text-[13px] font-medium text-fg">{caption}</p>
        {description && <div id={desc} className="mt-1 max-w-[68ch] text-[13px] leading-6 text-fg-muted">{description}</div>}
      </figcaption>
      {alternative && <div className="mt-3 text-[13px] leading-6 text-fg-muted">{alternative}</div>}
      {source && (
        <div className="mt-3">
          <Button variant="secondary" size="sm" aria-expanded={open} aria-controls={src} onClick={() => setOpen((o) => !o)}>{open ? "Hide source" : "View source"}</Button>
          {open && <div id={src} className="mt-3"><CodeBlock code={source} language={sourceLanguage} /></div>}
        </div>
      )}
    </figure>
  );
}
