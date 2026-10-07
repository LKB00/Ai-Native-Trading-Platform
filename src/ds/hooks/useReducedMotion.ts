import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(cb: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
const snapshot = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia(QUERY).matches;

/**
 * True when the person has asked the system to reduce motion.
 * Updates live when the setting changes. Returns false where matchMedia is unavailable.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
