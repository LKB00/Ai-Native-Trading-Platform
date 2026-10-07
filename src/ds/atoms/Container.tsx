import { createElement, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";

const widths = {
  chat: "max-w-[var(--w-chat)]",
  home: "max-w-[var(--w-home)]",
  page: "max-w-[var(--w-page)]",
  full: "max-w-none",
} as const;

export interface ContainerProps extends HTMLAttributes<HTMLElement> {
  /** Max-width preset. chat 768px, home 680px, page 1120px (proposed), full has no cap. */
  size?: keyof typeof widths;
  /** Remove the side margins, for content that bleeds to the edge. */
  flush?: boolean;
  as?: "div" | "main" | "section" | "article" | "header" | "footer" | "nav";
  children?: ReactNode;
}

/** Centered column with a width preset and side margins from --margin (16, 24 and 32px by window class). */
export function Container({ size = "page", flush, as = "div", className, children, ...rest }: ContainerProps) {
  return createElement(as, { ...rest, className: cn("mx-auto w-full", widths[size], !flush && "px-[var(--margin)]", className) }, children);
}
