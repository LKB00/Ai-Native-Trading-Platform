import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { useReducedMotion } from "./useReducedMotion";

export interface UseStickToBottomOptions {
  /** Distance in px from the bottom that still counts as "at the bottom". Default 80. */
  threshold?: number;
}

export interface UseStickToBottom<T extends HTMLElement> {
  /** Attach to the scrolling container. Put the content in one wrapper child so growth can be observed. */
  ref: RefObject<T | null>;
  /** True while the reader is within the threshold of the bottom. */
  atBottom: boolean;
  /** Messages that arrived while the reader was scrolled up. Reset when they reach the bottom. */
  unseen: number;
  /** Call when a new message arrives. Pins when the reader is at the bottom, otherwise raises `unseen`. */
  markUnseen: (count?: number) => void;
  /** Smooth scroll to the bottom, instant under reduced motion. Re-pins and clears `unseen`. */
  scrollToBottom: () => void;
}

/**
 * Keeps a scroll container pinned to the bottom only while the reader is near it.
 * Scrolling up releases the pin. Growth of the content and resizes of the container re-pin when pinned.
 * Pass the container as `ref`. Proposal: threshold 80px, from community and implementer sources.
 */
export function useStickToBottom<T extends HTMLElement = HTMLDivElement>({ threshold = 80 }: UseStickToBottomOptions = {}): UseStickToBottom<T> {
  const ref = useRef<T>(null);
  const pinned = useRef(true);
  const gliding = useRef(false);
  const reduced = useReducedMotion();
  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState(0);

  const jump = useCallback(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (gliding.current) {
        if (dist <= 1) { gliding.current = false; pinned.current = true; setAtBottom(true); setUnseen(0); }
        return;
      }
      const near = dist <= threshold;
      pinned.current = near;
      setAtBottom(near);
      if (near) setUnseen(0);
    };
    const cancelGlide = () => { gliding.current = false; };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("wheel", cancelGlide, { passive: true });
    el.addEventListener("touchstart", cancelGlide, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { if (pinned.current && !gliding.current) jump(); }) : null;
    ro?.observe(el);
    if (el.firstElementChild) ro?.observe(el.firstElementChild);
    jump();
    return () => {
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("wheel", cancelGlide);
      el.removeEventListener("touchstart", cancelGlide);
      ro?.disconnect();
    };
  }, [threshold, jump]);

  const scrollToBottom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    pinned.current = true;
    setUnseen(0);
    if (reduced) { gliding.current = false; jump(); setAtBottom(true); return; }
    gliding.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [reduced, jump]);

  const markUnseen = useCallback((count = 1) => {
    if (pinned.current) { jump(); return; }
    setUnseen((n) => n + count);
  }, [jump]);

  return { ref, atBottom, unseen, markUnseen, scrollToBottom };
}
