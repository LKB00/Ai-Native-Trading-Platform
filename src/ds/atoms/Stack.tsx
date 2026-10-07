import { createElement, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

/** Step on the 4px grid. 1 is 4px, 8 is 32px. Multiplied by --density. */
export type Space = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type StackTag = "div" | "section" | "article" | "ul" | "ol" | "nav" | "header" | "footer" | "main" | "aside";

/** CSS length for a space step, scaled by the density token. */
export const spaceValue = (n: Space) => `calc(var(--density) * ${n * 4}px)`;

export interface StackProps extends HTMLAttributes<HTMLElement> {
  /** Gap step from 1 to 8 on the 4px grid, scaled by --density. */
  gap?: Space;
  /** Element to render. Use ul or ol with li children for lists. */
  as?: StackTag;
  children?: ReactNode;
}

/** Vertical flow with one gap between children. Prefer it over margins between siblings. */
export function Stack({ gap = 4, as = "div", className, style, children, ...rest }: StackProps) {
  const s: CSSProperties = { gap: spaceValue(gap), ...style };
  // Safari stops calling a list a list once its markers are removed, so say it is one.
  const isList = as === "ul" || as === "ol";
  return createElement(as, { ...(isList ? { role: "list" } : {}), ...rest, className: cn("flex flex-col", isList ? "list-none p-0 m-0" : "", className), style: s }, children);
}
