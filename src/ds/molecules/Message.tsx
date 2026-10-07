import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { Avatar } from "../atoms/Avatar";

export interface MessageProps {
  role: "user" | "assistant";
  /** True while tokens are still arriving. Shows the caret, sets aria-busy and keeps the streaming text out of live announcements. */
  streaming?: boolean;
  /** Announced once, politely, when streaming ends. */
  completeLabel?: string;
  children: ReactNode;
  /** Slot under the bubble: MessageActions, FeedbackBar, SourceList... */
  footer?: ReactNode;
  className?: string;
}

/**
 * User messages are right-aligned bubbles; assistant messages are unboxed prose
 * with an avatar so long answers stay readable.
 */
export function Message({ role, streaming, completeLabel = "Response complete", children, footer, className }: MessageProps) {
  const [announce, setAnnounce] = useState("");
  const was = useRef(false);
  useEffect(() => {
    if (streaming) setAnnounce("");
    else if (was.current) setAnnounce(completeLabel);
    was.current = !!streaming;
  }, [streaming, completeLabel]);

  if (role === "user") {
    return (
      <div className={cn("flex justify-end animate-rise", className)}>
        <div className="max-w-[80%] rounded-3xl rounded-br-lg bg-sunken px-5 py-3 text-[15px] leading-relaxed">{children}</div>
      </div>
    );
  }
  return (
    <div className={cn("flex gap-3 animate-rise", className)} aria-busy={streaming || undefined}>
      <Avatar kind="ai" />
      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        {/* aria-live is off while tokens arrive, so screen readers are not interrupted per token. */}
        <div aria-live={streaming ? "off" : undefined} className="space-y-4 text-[15px] leading-7 text-fg">
          {children}
          {streaming && <span aria-hidden className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-fg animate-caret" />}
        </div>
        {footer}
        <span role="status" className="sr-only">{announce}</span>
      </div>
    </div>
  );
}
