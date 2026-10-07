import { cn } from "../lib/cn";

/** Shimmering status text such as "Searching the web…". */
export function ShimmerText({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn("bg-[linear-gradient(90deg,var(--fg-subtle)_40%,var(--fg)_50%,var(--fg-subtle)_60%)] bg-[length:200%_100%] bg-clip-text text-transparent animate-shimmer text-sm", className)}>
      {children}
    </span>
  );
}
