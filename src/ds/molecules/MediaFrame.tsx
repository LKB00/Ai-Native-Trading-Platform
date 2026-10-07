import { useState } from "react";
import { cn } from "../lib/cn";
import { ImageIcon } from "../lib/icons";
import { AIBadge } from "../atoms/AIBadge";
import { Button } from "../atoms/Button";
import { Skeleton } from "../atoms/Skeleton";
import { ProvenancePopover, type ProvenancePopoverProps } from "./ProvenancePopover";

export type MediaRatio = "1:1" | "4:3" | "16:9" | "3:2";

const ratioClass: Record<MediaRatio, string> = {
  "1:1": "aspect-square",
  "4:3": "aspect-[4/3]",
  "16:9": "aspect-video",
  "3:2": "aspect-[3/2]",
};

export interface MediaFrameProps {
  /** Image URL. */
  src: string;
  /** Describes what the image shows, not how it was made. Required. Ignored when `decorative` is set. */
  alt: string;
  /** Marks the image as decoration. Renders alt="". */
  decorative?: boolean;
  /** Fixed ratio. The frame reserves this space before the image loads, so layout does not shift. */
  ratio?: MediaRatio;
  /** Average color of the image as any CSS color, such as a token `var(--lime-soft)`. Used as the placeholder. When omitted, a shimmer shows while loading. */
  dominantColor?: string;
  /** Caption below the image. Wraps the frame in figure and figcaption. */
  caption?: string;
  /** Shows the AI-generated label on the image. */
  aiGenerated?: boolean;
  /** Label text for the AI badge. */
  aiLabel?: string;
  /** Provenance details. When set, the label opens a popover with them. */
  provenance?: Omit<ProvenancePopoverProps, "label">;
  /** Called when Retry is pressed after a load failure. */
  onRetry?: () => void;
  /** Forces a state. Use it for previews and for controlled loading. */
  status?: "loading" | "error";
  /** Copy for the error tile. */
  errorLabel?: string;
  retryLabel?: string;
  className?: string;
}

/**
 * Image with a fixed ratio, a token radius and a reserved box. It shows a placeholder while loading,
 * a fallback tile with Retry when the image fails, an optional caption and an optional AI label.
 */
export function MediaFrame({
  src, alt, decorative, ratio = "4:3", dominantColor, caption, aiGenerated, aiLabel = "AI-generated", provenance, onRetry,
  status, errorLabel = "Image could not load", retryLabel = "Retry", className,
}: MediaFrameProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const error = status === "error" || (status === undefined && failed);
  const showImage = status === undefined && !failed;
  const loading = status === "loading" || (showImage && !loaded);

  const retry = () => { setFailed(false); setLoaded(false); setAttempt((n) => n + 1); onRetry?.(); };

  const frame = (
    <div className={cn("relative", className)}>
      <div className={cn("relative overflow-hidden rounded-2xl border border-line bg-sunken", ratioClass[ratio])} style={dominantColor && !error ? { backgroundColor: dominantColor } : undefined}>
        {loading && !dominantColor && <Skeleton className="absolute inset-0 rounded-none" />}
        {showImage && (
          <img
            key={attempt}
            src={src}
            alt={decorative ? "" : alt}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn("absolute inset-0 size-full object-cover transition-opacity duration-[var(--dur-base)] motion-reduce:transition-none", loaded ? "opacity-100" : "opacity-0")}
          />
        )}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-sunken p-3 text-center">
            <ImageIcon width={20} height={20} className="text-fg-subtle" />
            <p className="text-xs text-fg-muted">{errorLabel}</p>
            <Button size="sm" variant="secondary" onClick={retry}>{retryLabel}</Button>
          </div>
        )}
      </div>
      {aiGenerated && (
        <div className="absolute bottom-2 left-2 z-10 rounded-full bg-surface p-0.5">
          {provenance ? <ProvenancePopover label={aiLabel} side="top" {...provenance} /> : <AIBadge label={aiLabel} solid />}
        </div>
      )}
    </div>
  );

  if (!caption) return frame;
  return (
    <figure className="m-0">
      {frame}
      <figcaption className="mt-2 text-xs leading-5 text-fg-muted">{caption}</figcaption>
    </figure>
  );
}
