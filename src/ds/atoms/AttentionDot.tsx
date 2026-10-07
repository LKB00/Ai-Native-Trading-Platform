/** Amber dot. The only signal that something needs a person; it always travels with text. */
export function AttentionDot({ label = "Needs attention" }: { label?: string }) {
  return <span role="img" aria-label={label} className="size-1.5 shrink-0 rounded-full bg-attention" />;
}
