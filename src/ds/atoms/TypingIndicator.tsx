/** Three-dot "assistant is composing" indicator, shown before the first token arrives. */
export function TypingIndicator({ label = "Assistant is thinking" }: { label?: string }) {
  return (
    <span role="status" aria-label={label} className="inline-flex items-center gap-1 py-2">
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-1.5 rounded-full bg-fg-subtle animate-pulse-dot" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}
