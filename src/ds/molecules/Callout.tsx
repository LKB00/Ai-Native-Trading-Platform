import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { AlertIcon, InfoIcon } from "../lib/icons";
import { Tone } from "../atoms/Badge";

const calloutTones: Record<Exclude<Tone, "neutral" | "accent" | "lime">, string> = {
  info: "bg-info-soft text-info-fg",
  success: "bg-success-soft text-success-fg",
  warning: "bg-warning-soft text-warning-fg",
  danger: "bg-danger-soft text-danger-fg",
};

export function Callout({ tone = "info", title, children, action }: { tone?: keyof typeof calloutTones; title?: string; children?: ReactNode; action?: ReactNode }) {
  const Icon = tone === "info" || tone === "success" ? InfoIcon : AlertIcon;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-2xl p-4 text-sm", calloutTones[tone])}>
      <Icon className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5")}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
