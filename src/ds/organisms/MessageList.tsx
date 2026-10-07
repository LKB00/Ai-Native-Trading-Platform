import type { ReactNode } from "react";

/**
 * Labelled log for a thread. New messages are announced politely. A streaming Message opts its own text out
 * of announcements and says "Response complete" once when it finishes.
 */
export function MessageList({ children, label = "Conversation" }: { children: ReactNode; label?: string }) {
  return <div role="log" aria-label={label} aria-live="polite" aria-relevant="additions" className="mx-auto flex w-full max-w-3xl flex-col gap-6">{children}</div>;
}
