import { useEffect, useRef } from "react";

/**
 * Keeps keyboard focus in place when a part swaps the control someone just pressed for something else
 * (Keep becomes a "Kept" badge, Confirm becomes a summary). Call `arm()` in the handler; when `key`
 * next changes and focus has fallen to the page body, focus moves to what `target()` returns.
 */
export function useFocusAfter(key: unknown, target: () => HTMLElement | null | undefined) {
  const armed = useRef(false);
  const pick = useRef(target);
  pick.current = target;
  useEffect(() => {
    if (!armed.current) return;
    armed.current = false;
    const a = document.activeElement;
    if (a && a !== document.body && a.isConnected) return;
    pick.current()?.focus({ preventScroll: true });
  }, [key]);
  return () => { armed.current = true; };
}

export type HeadingLevel = 2 | 3 | 4 | 5 | 6;
/** The heading tag for a level, and the one below it for inner headings (never deeper than h6). */
export const headingTag = (level: HeadingLevel) => `h${level}` as "h2" | "h3" | "h4" | "h5" | "h6";
export const subHeadingTag = (level: HeadingLevel) => headingTag(Math.min(level + 1, 6) as HeadingLevel);
