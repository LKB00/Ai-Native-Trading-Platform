import { createElement, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { spaceValue, type Space } from "./Stack";

const align = { start: "items-start", center: "items-center", end: "items-end", baseline: "items-baseline" } as const;
const justify = { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" } as const;

export interface ClusterProps extends HTMLAttributes<HTMLElement> {
  /** Gap step from 1 to 8 on the 4px grid, scaled by --density. */
  gap?: Space;
  /** Cross-axis alignment. */
  align?: keyof typeof align;
  /** Main-axis distribution. */
  justify?: keyof typeof justify;
  as?: "div" | "ul" | "ol" | "nav" | "section" | "header" | "footer";
  children?: ReactNode;
}

/** Wrapping horizontal group for chips, actions and metadata. Items drop to the next line instead of overflowing. */
export function Cluster({ gap = 2, align: a = "center", justify: j = "start", as = "div", className, style, children, ...rest }: ClusterProps) {
  const s: CSSProperties = { gap: spaceValue(gap), ...style };
  // Safari stops calling a list a list once its markers are removed, so say it is one.
  const isList = as === "ul" || as === "ol";
  return createElement(as, { ...(isList ? { role: "list" } : {}), ...rest, className: cn("flex flex-wrap", align[a], justify[j], isList ? "list-none p-0 m-0" : "", className), style: s }, children);
}
