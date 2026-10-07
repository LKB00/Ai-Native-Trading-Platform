import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/cn";
import type { DataTableProps } from "../molecules/DataTable";
import { formatNumber, niceTicks, useElementWidth, usePrefersReducedMotion } from "../molecules/ChartFrame";
import { ChartLegend, SeriesMark, seriesStyle } from "./ChartLegend";

export interface LineSeries {
  /** Stable id. Color follows the series position, so keep the order fixed. */
  id: string;
  /** Name shown in the legend, end label, tooltip and table. */
  label: string;
  /** One value per x position. Use null for a gap. */
  data: (number | null)[];
  /** Index of the first projected point. Points from here on are dotted, and the line is solid before it. */
  projectionFrom?: number;
}

export interface LineChartProps {
  /** Up to five series. Extra series are ignored. Fold the tail into one "Other" series before passing it in. */
  series: LineSeries[];
  /** X labels, one per data position, already formatted for display. */
  x: string[];
  /** Formats values on the axis, in labels and in the tooltip. */
  formatValue?: (n: number) => string;
  /** Unit word read after each value by screen readers, for example "milliseconds". */
  unit?: string;
  /** Plot height in px, including the x axis band. Minimum 160. */
  height?: number;
  /** Fixed y domain. Overrides zeroBaseline. */
  yDomain?: [number, number];
  /** Start the y axis at zero when every value is non-negative. Turn off only for data where zero is meaningless. */
  zeroBaseline?: boolean;
  /** The latest point of each series is hollow because it is not final yet. */
  streaming?: boolean;
  /** Reveal the lines once on mount. Skipped when the person prefers reduced motion. */
  animate?: boolean;
  /** Name for the chart region, for example "p95 latency by model". */
  ariaLabel?: string;
  className?: string;
}

const MAX_SERIES = 5;

function seg(vals: (number | null)[], from: number, to: number, px: (i: number) => number, py: (v: number) => number): string {
  let d = "";
  let pen = false;
  for (let i = Math.max(0, from); i <= Math.min(vals.length - 1, to); i++) {
    const v = vals[i];
    if (v === null || v === undefined) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${px(i).toFixed(1)} ${py(v).toFixed(1)}`;
    pen = true;
  }
  return d;
}

/**
 * Multi-series line chart drawn in SVG at real pixel size. Solid lines are actuals and dotted lines are projections.
 * The plot takes focus: arrow keys step through points and each point is announced as "Series, x, value, unit".
 * The tooltip shows on focus, pointer and tap and never depends on hover.
 */
export function LineChart({ series: all, x, formatValue = formatNumber, unit = "", height = 240, yDomain, zeroBaseline = true, streaming, animate, ariaLabel = "Line chart", className }: LineChartProps) {
  const series = all.slice(0, MAX_SERIES);
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const reduced = usePrefersReducedMotion();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const cid = `clip-${useId().replace(/:/g, "")}`;
  const [active, setActive] = useState<{ s: number; i: number } | null>(null);
  const [said, setSaid] = useState("");
  const [revealed, setRevealed] = useState(!animate);
  useEffect(() => { if (animate && !reduced) { const t = requestAnimationFrame(() => setRevealed(true)); return () => cancelAnimationFrame(t); } setRevealed(true); }, [animate, reduced]);

  const w = measured || 640;
  const h = Math.max(160, height);
  const n = x.length;
  const all_ = series.flatMap((s) => s.data).filter((v): v is number => typeof v === "number");
  const dMin = all_.length ? Math.min(...all_) : 0;
  const dMax = all_.length ? Math.max(...all_) : 1;
  const ticks = yDomain ? niceTicks(yDomain[0], yDomain[1]) : niceTicks(zeroBaseline && dMin >= 0 ? 0 : dMin, dMax);
  const lo = yDomain ? yDomain[0] : ticks[0];
  const hi = yDomain ? yDomain[1] : ticks[ticks.length - 1];
  const tickLabels = ticks.map((t) => formatValue(t));
  const left = Math.max(28, Math.max(...tickLabels.map((t) => t.length)) * 6.6 + 14);
  const endY = (s: LineSeries) => {
    for (let i = s.data.length - 1; i >= 0; i--) if (s.data[i] !== null && s.data[i] !== undefined) return i;
    return -1;
  };

  const plotTop = 12;
  const plotBottom = h - 28;
  const py = (v: number) => plotBottom - ((v - lo) / (hi - lo || 1)) * (plotBottom - plotTop);

  const labelsWanted = series.length >= 2 && series.length <= 4 && w >= 480;
  const endYs = series.map((s) => { const e = endY(s); return e >= 0 ? py(s.data[e] as number) : -999; }).sort((a, b) => a - b);
  const collide = endYs.some((v, i) => i > 0 && v - endYs[i - 1] < 14);
  const direct = labelsWanted && !collide;
  const clip = (t: string) => (t.length > 20 ? `${t.slice(0, 19)}…` : t);
  const right = direct ? Math.min(150, Math.max(...series.map((s) => clip(s.label).length)) * 6.4 + 24) : 24;
  const pw = Math.max(40, w - left - right);
  const px = (i: number) => left + (n <= 1 ? pw / 2 : (i * pw) / (n - 1));

  const xw = Math.max(0, ...x.map((t) => t.length)) * 6.4 + 14;
  const stepK = Math.max(1, Math.ceil(xw / (n > 1 ? pw / (n - 1) : pw)));

  const pf = (s: LineSeries) => s.projectionFrom ?? n;
  const readout = (s: number, i: number) => {
    const sr = series[s];
    const v = sr.data[i];
    const tail = i >= pf(sr) ? ", projected" : streaming && i === endY(sr) ? ", provisional" : "";
    return `${sr.label}, ${x[i]}, ${v === null || v === undefined ? "no data" : `${formatValue(v)}${unit ? ` ${unit}` : ""}`}${tail}`;
  };

  const step = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!n || !series.length) return;
    const cur = active ?? { s: 0, i: n - 1 };
    let { s, i } = cur;
    if (e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else if (e.key === "ArrowDown") s = Math.min(series.length - 1, s + 1);
    else if (e.key === "ArrowUp") s = Math.max(0, s - 1);
    else if (e.key === "Escape") { setActive(null); setSaid(""); return; }
    else return;
    e.preventDefault();
    setActive({ s, i });
    setSaid(readout(s, i));
  };

  const point = (e: PointerEvent<SVGRectElement>) => {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || !n) return;
    const i = n <= 1 ? 0 : Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - left) / pw) * (n - 1))));
    const yy = e.clientY - r.top;
    let best = 0, bd = Infinity;
    series.forEach((s, si) => { const v = s.data[i]; if (v === null || v === undefined) return; const d = Math.abs(py(v) - yy); if (d < bd) { bd = d; best = si; } });
    setActive({ s: best, i });
  };

  const ai = active?.i ?? -1;
  const tipRight = ai >= 0 && px(ai) > w / 2;

  return (
    <div ref={ref} className={cn("relative min-w-0", className)}>
      {series.length >= 2 && <ChartLegend items={series.map((s) => ({ id: s.id, label: s.label }))} />}
      <div ref={wrapRef} tabIndex={0} role="group" aria-roledescription="line chart"
        aria-label={`${ariaLabel}. ${series.length} series, ${n} points. Use arrow keys to step through points.`}
        onKeyDown={step} onFocus={() => { if (n) setActive((p) => p ?? { s: 0, i: n - 1 }); }}
        onBlur={() => { setActive(null); setSaid(""); }}
        className="relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
        <svg ref={svgRef} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block max-w-full touch-pan-y select-none" aria-hidden focusable="false"
          style={{ fontFamily: "var(--font-sans)", fontSize: 12 }}>
          <defs>
            <clipPath id={cid}>
              <rect x={0} y={0} height={h} width={revealed ? w : 0} style={{ transition: reduced ? "none" : "width 700ms var(--ease-standard, ease-out)" }} />
            </clipPath>
          </defs>
          {ticks.map((t, i) => (
            <g key={t}>
              <line x1={left} x2={left + pw} y1={py(t)} y2={py(t)} stroke={i === 0 ? "var(--chart-axis)" : "var(--chart-grid)"} strokeWidth={i === 0 ? 1 : 0.5} shapeRendering="crispEdges" />
              <text x={left - 8} y={py(t)} textAnchor="end" dominantBaseline="central" fill="var(--fg-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{tickLabels[i]}</text>
            </g>
          ))}
          {x.map((t, i) => {
            if (i % stepK !== 0) return null;
            const half = (t.length * 6.4) / 2;
            const cx = px(i);
            const anchor = cx - half < 0 ? "start" : cx + half > w ? "end" : "middle";
            return <text key={i} x={anchor === "start" ? Math.max(0, cx - half) : cx} y={plotBottom + 18} textAnchor={anchor} fill="var(--fg-muted)">{t}</text>;
          })}
          {ai >= 0 && <line x1={px(ai)} x2={px(ai)} y1={plotTop} y2={plotBottom} stroke="var(--chart-axis)" strokeWidth={1} shapeRendering="crispEdges" />}
          <g clipPath={`url(#${cid})`}>
            {series.map((s, si) => {
              const st = seriesStyle(si);
              const p = pf(s);
              return (
                <g key={s.id}>
                  <path d={seg(s.data, 0, p - 1, px, py)} fill="none" stroke={st.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={st.dash} />
                  {p < n && <path d={seg(s.data, p - 1, n - 1, px, py)} fill="none" stroke={st.color} strokeWidth={2} strokeLinecap="round" strokeDasharray="0.1 5" />}
                </g>
              );
            })}
          </g>
          {series.map((s, si) => {
            const e = endY(s);
            if (e < 0) return null;
            const st = seriesStyle(si);
            return (
              <g key={s.id}>
                <SeriesMark shape={st.shape} cx={px(e)} cy={py(s.data[e] as number)} color={st.color} hollow={streaming} />
                {direct && <text x={px(e) + 11} y={py(s.data[e] as number)} dominantBaseline="central" fill="var(--fg)" style={{ fontWeight: 500 }}>{clip(s.label)}</text>}
              </g>
            );
          })}
          {ai >= 0 && series.map((s, si) => {
            const v = s.data[ai];
            if (v === null || v === undefined || ai === endY(s)) return null;
            const st = seriesStyle(si);
            return <SeriesMark key={s.id} shape={st.shape} cx={px(ai)} cy={py(v)} color={st.color} r={active?.s === si ? 5.5 : 4.5} />;
          })}
          <rect x={left} y={0} width={pw + Math.min(right, 12)} height={plotBottom + 4} fill="transparent" onPointerMove={point} onPointerDown={point}
            onPointerLeave={(e) => { if (e.pointerType === "mouse" && document.activeElement !== wrapRef.current) setActive(null); }} />
        </svg>
        {ai >= 0 && (
          <div aria-hidden className="pointer-events-none absolute z-10 min-w-36 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-md"
            style={{ top: plotTop, left: px(ai), transform: `translateX(${tipRight ? "calc(-100% - 12px)" : "12px"})` }}>
            <p className="mb-1 text-fg-muted">{x[ai]}</p>
            {series.map((s, si) => {
              const v = s.data[ai];
              const st = seriesStyle(si);
              return (
                <p key={s.id} className="flex items-center gap-2 leading-5">
                  <svg width={18} height={10} viewBox="0 0 18 10" aria-hidden><line x1={0} x2={18} y1={5} y2={5} stroke={st.color} strokeWidth={2} strokeDasharray={st.dash} /></svg>
                  <span className={cn("flex-1 text-fg-muted", active?.s === si && "font-medium text-fg")}>{s.label}</span>
                  <span className="font-semibold text-fg [font-variant-numeric:tabular-nums]">{v === null || v === undefined ? "No data" : formatValue(v)}</span>
                  {v !== null && v !== undefined && (ai >= pf(s) ? <span className="text-fg-subtle">projected</span> : streaming && ai === endY(s) ? <span className="text-fg-subtle">provisional</span> : null)}
                </p>
              );
            })}
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite" role="status">{said}</div>
    </div>
  );
}

/** Table data for ChartFrame's table view, with one column per series. */
export function lineChartTable(x: string[], series: LineSeries[], opts: { xHeader: string; caption: string; formatValue?: (n: number) => string; unit?: string }): DataTableProps {
  const f = opts.formatValue ?? formatNumber;
  return {
    caption: opts.caption,
    columns: [{ key: "x", header: opts.xHeader }, ...series.slice(0, MAX_SERIES).map((s) => ({ key: s.id, header: opts.unit ? `${s.label} (${opts.unit})` : s.label, numeric: true }))],
    rows: x.map((label, i) => {
      const row: Record<string, string> = { x: label };
      series.slice(0, MAX_SERIES).forEach((s) => {
        const v = s.data[i];
        row[s.id] = v === null || v === undefined ? "No data" : `${f(v)}${s.projectionFrom !== undefined && i >= s.projectionFrom ? " (projected)" : ""}`;
      });
      return row;
    }),
  };
}
