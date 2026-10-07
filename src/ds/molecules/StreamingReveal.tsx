import { Fragment, useRef } from "react";
import { cn } from "../lib/cn";
import { useReducedMotion } from "../hooks/useReducedMotion";

export interface StreamingRevealProps {
  /** The text received so far. Pass the `text` from useStreamingText or your own buffer. */
  text: string;
  /** True while more text may arrive. The last partial word is held back until it ends, so words land whole. */
  streaming?: boolean;
  className?: string;
}

/**
 * Renders streamed text so each new word fades in once (opacity only, 150ms).
 * Words that have settled keep their element and never re-animate. New words append in flow, so nothing moves.
 * Under reduced motion the text appears instantly. Words present at first render do not animate.
 */
export function StreamingReveal({ text, streaming = false, className }: StreamingRevealProps) {
  const reduced = useReducedMotion();
  let tokens = text.split(/(\s+)/).filter((t) => t !== "");
  if (streaming && tokens.length > 0 && !/\s$/.test(text)) tokens = tokens.slice(0, -1);
  const settled = useRef<number | null>(null);
  if (settled.current === null) settled.current = tokens.length;
  if (tokens.length < settled.current) settled.current = 0;
  const initial = settled.current;

  if (reduced) return <span className={className}>{tokens.join("")}</span>;
  return (
    <span className={className}>
      {tokens.map((t, i) =>
        /^\s+$/.test(t) ? <Fragment key={i}>{t}</Fragment> : <span key={i} className={cn(i >= initial && "animate-word-in")}>{t}</span>,
      )}
    </span>
  );
}
