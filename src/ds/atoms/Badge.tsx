import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type Tone = "neutral" | "accent" | "lime" | "success" | "warning" | "danger" | "info";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-fg-muted border-line",
  accent: "bg-lime/25 text-fg border-transparent",
  /** Opaque lime for use over images and other busy backgrounds. */
  lime: "bg-lime text-on-lime border-transparent",
  success: "bg-success-soft text-success-fg border-transparent",
  warning: "bg-warning-soft text-warning-fg border-transparent",
  danger: "bg-danger-soft text-danger-fg border-transparent",
  info: "bg-info-soft text-info-fg border-transparent",
};

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] leading-4 font-medium", tones[tone], className)} {...rest} />;
}
