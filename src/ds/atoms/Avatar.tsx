import { cn } from "../lib/cn";
import { SparkleIcon } from "../lib/icons";

export interface AvatarProps {
  kind: "user" | "ai";
  name?: string;
  size?: "sm" | "md";
  className?: string;
}

/** The assistant is an ink disc with a lime spark: recognisable at 24px, and the only place lime fills a circle. */
export function Avatar({ kind, name = "You", size = "md", className }: AvatarProps) {
  const dims = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";
  return (
    <span
      role="img"
      aria-label={kind === "ai" ? "Assistant" : name}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full",
        kind === "ai" ? "bg-code text-lime border border-line-strong" : "border border-line bg-sunken font-serif text-fg-muted", dims, className)}
    >
      {kind === "ai" ? <SparkleIcon width={size === "sm" ? 11 : 14} height={size === "sm" ? 11 : 14} /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}
