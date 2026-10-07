import { cn } from "../lib/cn";
import { PlusIcon } from "../lib/icons";
import { Avatar } from "../atoms/Avatar";

export interface AvatarStackPerson {
  name: string;
  kind?: "user" | "ai";
}

export interface AvatarStackProps {
  /** People to show, most relevant first. Only the first `max` are drawn. */
  people: AvatarStackPerson[];
  /** Everyone counted, including the ones drawn. The number shown is the rest: `total - drawn`. Defaults to `people.length`. */
  total?: number;
  /** How many avatars to draw before the plus and the number. */
  max?: number;
  /** Word after the number, e.g. "others" or "more viewers". */
  label?: string;
  size?: "sm" | "md";
  /** Show large numbers short, e.g. 1.2k instead of 1,248. */
  compact?: boolean;
  className?: string;
}

/**
 * A few overlapping avatars, a plus, then how many more people there are.
 * The picture is decoration; screen readers hear one plain sentence with the names and the count.
 */
export function AvatarStack({ people, total = people.length, max = 3, label = "others", size = "md", compact = false, className }: AvatarStackProps) {
  const shown = people.slice(0, Math.max(0, max));
  const rest = Math.max(0, total - shown.length);
  const fmt = new Intl.NumberFormat(undefined, compact ? { notation: "compact", maximumFractionDigits: 1 } : undefined);
  const names = shown.map((p) => (p.kind === "ai" ? "Assistant" : p.name));
  const sentence = names.length === 0
    ? `${fmt.format(rest)} ${label}`
    : rest > 0 ? `${names.join(", ")} and ${fmt.format(rest)} ${label}` : names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0];
  const ring = "ring-2 ring-[var(--bg)]";
  const disc = size === "sm" ? "size-6" : "size-8";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden className="flex items-center">
        {shown.map((p, i) => (
          <Avatar key={`${p.name}-${i}`} kind={p.kind ?? "user"} name={p.name} size={size} className={cn(ring, i > 0 && (size === "sm" ? "-ml-1.5" : "-ml-2.5"))} />
        ))}
        {rest > 0 && (
          <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface text-fg-muted", disc, ring, shown.length > 0 && (size === "sm" ? "-ml-1.5" : "-ml-2.5"))}>
            <PlusIcon width={size === "sm" ? 11 : 14} height={size === "sm" ? 11 : 14} />
          </span>
        )}
      </span>
      {rest > 0 && (
        <span aria-hidden className={cn("tabular-nums text-fg", size === "sm" ? "text-xs" : "text-sm")}>
          <span className="font-semibold">{fmt.format(rest)}</span> <span className="text-fg-muted">{label}</span>
        </span>
      )}
      <span className="sr-only">{sentence}</span>
    </span>
  );
}
