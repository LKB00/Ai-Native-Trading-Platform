import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("rounded-md bg-[linear-gradient(90deg,var(--surface-sunken)_25%,var(--border)_50%,var(--surface-sunken)_75%)] bg-[length:200%_100%] animate-shimmer", className)}
      {...rest}
    />
  );
}
