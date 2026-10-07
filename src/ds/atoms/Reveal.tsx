import { createElement, type CSSProperties, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { useReducedMotion } from "../hooks/useReducedMotion";

/** Stagger step in ms. Proposal. */
export const REVEAL_STEP = 40;
/** Items beyond this index share the last delay, so the whole group settles inside 400ms. Proposal. */
export const REVEAL_CAP = 5;

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  /** rise moves 6px up while fading in (220ms). fade is opacity only (150ms). */
  variant?: "rise" | "fade";
  /** Position in a group. Delay is index x 40ms, held at the cap so the group stays under 400ms. */
  index?: number;
  as?: "div" | "li" | "section" | "article" | "span" | "p";
  children?: ReactNode;
}

/**
 * Enter animation wrapper using animate-rise or animate-fade.
 * Under reduced motion it renders its children with no animation.
 * Stagger numbers (40ms step, 5 items) are proposals.
 */
export function Reveal({ variant = "rise", index = 0, as = "div", className, style, children, ...rest }: RevealProps) {
  const reduced = useReducedMotion();
  const delay = Math.min(Math.max(index, 0), REVEAL_CAP - 1) * REVEAL_STEP;
  const s: CSSProperties | undefined = reduced ? style : { animationDelay: `${delay}ms`, ...style };
  return createElement(as, { ...rest, className: cn(!reduced && (variant === "rise" ? "animate-rise" : "animate-fade"), className), style: s }, children);
}
