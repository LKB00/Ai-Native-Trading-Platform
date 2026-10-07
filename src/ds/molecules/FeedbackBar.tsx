import { useEffect, useRef, useState } from "react";
import { ThumbDownIcon, ThumbUpIcon } from "../lib/icons";
import { Button, IconButton } from "../atoms/Button";

export type Rating = "up" | "down" | null;
const reasons = ["Inaccurate", "Not helpful", "Unsafe", "Too long", "Other"];

export interface FeedbackBarProps {
  /** Called once per message. Thumbs up sends the rating. Thumbs down sends the rating with a reason, or alone when the person chooses Skip. */
  onSubmit: (rating: Exclude<Rating, null>, reason?: string) => void;
  /** Any value. When it changes, for example to the message id, the bar returns to its starting state. */
  resetKey?: unknown;
}

/** Thumbs up and down for one response. After submitting, the chosen thumb stays pressed and a thank-you line sits beside it. */
export function FeedbackBar({ onSubmit, resetKey }: FeedbackBarProps) {
  const [rating, setRating] = useState<Rating>(null);
  const [done, setDone] = useState(false);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setRating(null); setDone(false);
  }, [resetKey]);

  const submit = (r: Exclude<Rating, null>, reason?: string) => { setRating(r); setDone(true); if (reason === undefined) onSubmit(r); else onSubmit(r, reason); };

  return (
    <div className="space-y-2">
      <div className="-ml-1.5 flex items-center gap-0.5">
        <IconButton size="sm" label="Good response" active={rating === "up"} onClick={() => { if (!done) submit("up"); }}><ThumbUpIcon /></IconButton>
        <IconButton size="sm" label="Bad response" active={rating === "down"} onClick={() => { if (!done) setRating("down"); }}><ThumbDownIcon /></IconButton>
        <p className="ml-1.5 text-xs text-fg-muted" role="status">{done ? "Thanks, your feedback helps improve responses." : ""}</p>
      </div>
      {rating === "down" && !done && (
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="What went wrong?">
          <span className="text-xs text-fg-muted">What went wrong?</span>
          {reasons.map((r) => <Button key={r} size="sm" variant="secondary" className="h-7 px-2.5 text-xs" onClick={() => submit("down", r)}>{r}</Button>)}
          <Button size="sm" variant="ghost" className="h-7 px-2.5 text-xs" onClick={() => submit("down")}>Skip</Button>
        </div>
      )}
    </div>
  );
}
