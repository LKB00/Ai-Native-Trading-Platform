import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "../lib/cn";
import { Button } from "../atoms/Button";
import { Skeleton } from "../atoms/Skeleton";
import { ErrorState } from "./ErrorState";
import { DataTable, type DataTableProps } from "./DataTable";

/* ---------- shared chart helpers (used by the chart organisms) ---------- */

/** Measures the content width of an element and keeps it current with a ResizeObserver. Returns 0 until measured. */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(Math.floor(el.getBoundingClientRect().width));
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const next = Math.floor(entries[0].contentRect.width);
      setW((p) => (p === next ? p : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

/** True when the person asked the system to reduce motion. Charts skip draw-in animation when it is true. */
export function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return r;
}

const round = (n: number) => Math.round(n * 1e9) / 1e9;

/** Round tick values that cover min to max, never more than 6. */
export function niceTicks(min: number, max: number, target = 5): number[] {
  if (!(max > min)) max = min + 1;
  let raw = (max - min) / Math.max(1, target - 1);
  for (let guard = 0; guard < 8; guard++) {
    const mag = 10 ** Math.floor(Math.log10(raw));
    const n = raw / mag;
    const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    const lo = Math.floor(min / step + 1e-9) * step;
    const hi = Math.ceil(max / step - 1e-9) * step;
    const out: number[] = [];
    for (let v = lo; v <= hi + step / 1e6; v += step) out.push(round(v));
    if (out.length <= 6) return out;
    raw = step * 1.01;
  }
  return [min, max];
}

/** Default number formatter: thousands separators and at most two decimals. */
export function formatNumber(n: number): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/* ---------- ChartFrame ---------- */

export interface ChartEmptyState {
  /** What is missing, for example "No requests in this window." */
  what: string;
  /** Why it is empty, for example "Filters exclude every model." */
  why: string;
  /** The action that fixes it, such as a Button. */
  action?: ReactNode;
}

export interface ChartFrameProps {
  /** Chart title. Set in the serif. */
  title: string;
  /** States the unit and the time window, for example "p95 latency in ms, last 7 days". */
  subtitle?: string;
  /** Plain-language reading of the chart, shown above it in body text. Say what the data shows. */
  summary?: ReactNode;
  /** The chart. Receives the full width of the frame. */
  children?: ReactNode;
  /** Data for the table view. Without it the toggle is hidden. */
  table?: DataTableProps;
  /** Source line, for example "Source: gateway logs". */
  source?: string;
  /** Caveat line, for example "Latest point is still streaming." */
  note?: string;
  /** Rendered above the chart, usually a ChartLegend. */
  legend?: ReactNode;
  /** Data state. Anything other than "ready" replaces the chart. */
  state?: "ready" | "loading" | "empty" | "error";
  /** Content for the empty state. */
  empty?: ChartEmptyState;
  /** Message for the error state. */
  errorMessage?: string;
  /** Called by the retry button in the error state. */
  onRetry?: () => void;
  /** Shown instead of the chart when the frame is narrower than minWidth, usually a Sparkline. */
  fallback?: ReactNode;
  /** Narrowest width in px at which the chart is drawn. */
  minWidth?: number;
  /** Start in the table view. */
  defaultView?: "chart" | "table";
  /** Adds a Download data button and calls this when pressed. */
  onDownload?: () => void;
  /** Height in px reserved for loading and empty states so the layout does not jump. */
  stateHeight?: number;
  className?: string;
}

/**
 * Frame for every chart: serif title, unit and time window, a visible text summary, the chart, a source line
 * and a "View as table" toggle. It also owns the loading, empty and error states and the collapse-below-minimum fallback.
 */
export function ChartFrame({
  title, subtitle, summary, children, table, source, note, legend, state = "ready", empty, errorMessage, onRetry,
  fallback, minWidth = 280, defaultView = "chart", onDownload, stateHeight = 200, className,
}: ChartFrameProps) {
  const [view, setView] = useState<"chart" | "table">(defaultView);
  const [bodyRef, width] = useElementWidth<HTMLDivElement>();
  const id = useId();
  const showTable = view === "table" && !!table;
  const collapsed = !showTable && !!fallback && width > 0 && width < minWidth;

  let body: ReactNode;
  if (state === "loading") {
    body = (
      <div role="status" aria-label="Loading chart" style={{ height: stateHeight }} className="relative flex items-end gap-3 border-b border-l border-[var(--chart-axis)] px-4 pb-0">
        <span className="sr-only">Loading chart data</span>
        {[0.45, 0.7, 0.55, 0.85, 0.6, 0.75].map((h, i) => <Skeleton key={i} className="flex-1 rounded-b-none" style={{ height: `${h * 100}%` }} />)}
      </div>
    );
  } else if (state === "empty") {
    body = (
      <div style={{ minHeight: stateHeight }} className="flex flex-col items-start justify-center gap-2 rounded-2xl border border-dashed border-line-strong px-5 py-6 text-[13px] leading-5">
        <p className="font-medium text-fg">{empty?.what ?? "No data to show."}</p>
        {empty?.why && <p className="text-fg-muted">{empty.why}</p>}
        {empty?.action}
      </div>
    );
  } else if (state === "error") {
    body = <div style={{ minHeight: stateHeight }}><ErrorState title="This chart did not load" message={errorMessage ?? "The data could not be fetched. Nothing you entered was lost."} onRetry={onRetry} /></div>;
  } else if (showTable && table) {
    body = <DataTable {...table} maxHeight={table.maxHeight ?? 320} stickyHeader={table.stickyHeader ?? true} />;
  } else if (collapsed) {
    body = (
      <div className="flex flex-wrap items-center gap-3">
        {fallback}
        <p className="text-xs text-fg-muted">Too narrow for the full chart. Use the table view for every value.</p>
      </div>
    );
  } else {
    body = <>{legend}{children}</>;
  }

  return (
    <figure className={cn("m-0 min-w-0 rounded-3xl border border-line bg-surface p-4 sm:p-5", className)} aria-busy={state === "loading" || undefined}>
      <figcaption>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="font-serif! text-[17px] leading-6 [overflow-wrap:anywhere]">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs leading-5 text-fg-muted">{subtitle}</p>}
          </div>
          {state === "ready" && (table || onDownload) && (
            <div className="flex shrink-0 flex-wrap gap-2">
              {table && (
                <Button size="sm" variant="secondary" aria-controls={`${id}-body`} onClick={() => setView(showTable ? "chart" : "table")}>
                  {showTable ? "View as chart" : "View as table"}
                </Button>
              )}
              {onDownload && <Button size="sm" variant="ghost" onClick={onDownload}>Download data</Button>}
            </div>
          )}
        </div>
        {summary && state === "ready" && <p className="mt-3 max-w-[68ch] text-[13px] leading-6 text-fg-muted">{summary}</p>}
      </figcaption>
      <div ref={bodyRef} id={`${id}-body`} className="mt-3 min-w-0">{body}</div>
      {(source || note) && state === "ready" && (
        <p className="mt-3 text-[11px] leading-4 text-fg-subtle">{[source, note].filter(Boolean).join(" ")}</p>
      )}
    </figure>
  );
}
