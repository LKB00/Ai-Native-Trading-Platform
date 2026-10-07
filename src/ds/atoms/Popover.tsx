import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../lib/cn";

export interface PopoverTriggerApi {
  open: boolean;
  toggle: () => void;
  /** Spread onto the trigger element: aria-expanded, aria-haspopup, aria-controls. */
  triggerProps: { "aria-expanded": boolean; "aria-haspopup": "dialog" | "menu" | "listbox"; "aria-controls": string };
}

export interface PopoverProps {
  trigger: (api: PopoverTriggerApi) => ReactNode;
  /** Panel content. A function receives `close` so items can dismiss the panel. */
  children: ReactNode | ((api: { close: () => void }) => ReactNode);
  /** Accessible name for the panel. */
  label: string;
  align?: "start" | "end";
  side?: "bottom" | "top";
  role?: "dialog" | "menu" | "listbox";
  /** Controlled mode. Omit both to let the popover manage itself. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Move focus into the panel when it opens. Set false when the opener manages focus itself. */
  autoFocus?: boolean;
  /** Open on the opposite side when the preferred side would overflow the viewport, and keep the panel inside the viewport edges. */
  flip?: boolean;
  className?: string;
  panelClassName?: string;
}

const GAP = 8;
const EDGE = 8;
const ITEM = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"]';
const CHECKED = '[role="menuitemradio"][aria-checked="true"],[role="option"][aria-selected="true"],[role="radio"][aria-checked="true"]';
const FOCUSABLE = 'a[href],button,input,select,textarea,summary,[contenteditable="true"],[tabindex]';

/**
 * Anchored panel for menus, pickers and explainers. Focus moves into the panel on open and returns to the
 * trigger on close. Menu and listbox panels add arrow-key movement, Home, End and Tab-to-leave. Placement
 * starts from CSS, then flips to the opposite side and clamps to the viewport edges when the panel would overflow.
 */
export function Popover({
  trigger, children, label, align = "start", side = "bottom", role = "dialog", open: controlled, onOpenChange,
  autoFocus = true, flip = true, className, panelClassName,
}: PopoverProps) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [place, setPlace] = useState({ flipped: false, dx: 0 });
  const skipRestore = useRef(false);
  const wasOpen = useRef(false);
  const mounted = useRef(false);
  const set = (v: boolean) => { if (controlled === undefined) setInner(v); onOpenChange?.(v); };

  const triggerEl = useCallback(
    () => root.current?.querySelector<HTMLElement>(`[aria-controls="${CSS.escape(id)}"]`) ?? root.current?.querySelector<HTMLElement>("[aria-haspopup]") ?? null,
    [id],
  );
  const items = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(ITEM) ?? []).filter((el) => !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true");

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!root.current || !t || root.current.contains(t)) return;
      // A click on another focusable element keeps focus there. A click on empty space returns focus to the trigger.
      if (t.closest?.(FOCUSABLE)) skipRestore.current = true;
      set(false);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") set(false); };
    // pointerdown, not mousedown: canvas widgets such as charts cancel pointerdown, which suppresses mousedown,
    // so a click on a chart would otherwise never close the popover.
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDoc); document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Placement: measure after mount, flip if the preferred side overflows, clamp horizontally.
  useLayoutEffect(() => {
    if (!open) { setPlace((p) => (p.flipped || p.dx ? { flipped: false, dx: 0 } : p)); return; }
    if (!flip) return;
    const measure = () => {
      const p = panel.current; const r = root.current;
      if (!p || !r) return;
      const rect = r.getBoundingClientRect();
      const w = p.offsetWidth; const h = p.offsetHeight;
      const vw = document.documentElement.clientWidth; const vh = window.innerHeight;
      const below = vh - rect.bottom - GAP; const above = rect.top - GAP;
      const room = side === "bottom" ? below : above;
      const other = side === "bottom" ? above : below;
      const flipped = room < h + GAP && other > room;
      const natural = align === "end" ? rect.right - w : rect.left;
      const clamped = w > vw - EDGE * 2 ? EDGE : Math.min(Math.max(natural, EDGE), vw - EDGE - w);
      const dx = Math.round(clamped - natural);
      setPlace((prev) => (prev.flipped === flipped && prev.dx === dx ? prev : { flipped, dx }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open, flip, side, align]);

  // Focus in on open, back to the trigger on close.
  useEffect(() => {
    const first = !mounted.current;
    mounted.current = true;
    if (open) {
      wasOpen.current = true;
      if (!autoFocus || first) return;
      const p = panel.current;
      if (!p) return;
      let target: HTMLElement | null | undefined;
      if (role === "dialog") {
        target = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABLE)).find((el) => el.tabIndex >= 0 && !(el as HTMLButtonElement).disabled && el.getAttribute("aria-disabled") !== "true");
      } else {
        target = p.querySelector<HTMLElement>(CHECKED) ?? items()[0];
        if (target && ((target as HTMLButtonElement).disabled || target.getAttribute("aria-disabled") === "true")) target = items()[0];
      }
      (target ?? p).focus();
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    if (skipRestore.current) { skipRestore.current = false; return; }
    const a = document.activeElement;
    if (!a || a === document.body || root.current?.contains(a)) triggerEl()?.focus();
  }, [open, autoFocus, role, triggerEl]);

  const onPanelKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (role === "dialog" || e.defaultPrevented) return;
    if (e.key === "Tab") {
      // Standard menu behavior: leave the menu and let focus continue from the trigger.
      skipRestore.current = true;
      triggerEl()?.focus();
      set(false);
      return;
    }
    const list = items();
    if (!list.length) return;
    const i = list.findIndex((el) => el === document.activeElement || el.contains(document.activeElement));
    let next = -1;
    if (e.key === "ArrowDown") next = i < 0 ? 0 : (i + 1) % list.length;
    else if (e.key === "ArrowUp") next = i < 0 ? list.length - 1 : (i - 1 + list.length) % list.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = list.length - 1;
    else return;
    e.preventDefault();
    list[next].focus();
  };

  const eff = place.flipped ? (side === "bottom" ? "top" : "bottom") : side;
  const style = place.dx ? (align === "end" ? { right: -place.dx } : { left: place.dx }) : undefined;

  return (
    <div ref={root} className={cn("relative inline-block", className)}>
      {trigger({ open, toggle: () => set(!open), triggerProps: { "aria-expanded": open, "aria-haspopup": role, "aria-controls": id } })}
      {open && (
        <div id={id} ref={panel} role={role} aria-label={label} tabIndex={-1} style={style} onKeyDown={onPanelKey}
          className={cn("absolute z-30 min-w-56 rounded-2xl border border-line bg-raised p-1.5 shadow-lg outline-none animate-rise",
            eff === "bottom" ? "top-full mt-2" : "bottom-full mb-2", align === "end" ? "right-0" : "left-0", panelClassName)}>
          {typeof children === "function" ? children({ close: () => set(false) }) : children}
        </div>
      )}
    </div>
  );
}
