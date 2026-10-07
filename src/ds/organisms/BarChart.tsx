import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/cn";
import type { DataTableProps } from "../molecules/DataTable";
import { formatNumber, niceTicks, useElementWidth } from "../molecules/ChartFrame";
import { ChartLegend, seriesStyle } from "./ChartLegend";

export interface BarDatum {
  /** Category name. */
  label: string;
  /** Value for a single series chart. Must be zero or more. */
  value?: number;
  /** One value per stack segment, in stack order, for a stacked chart. Must be zero or more. */
  values?: number[];
}

export interface BarSeries {
  id: string;
  /** Segment name shown in the legend, tooltip and table. */
  label: string;
}

export interface BarChartProps {
  /** One entry per category, in display order. */
  data: BarDatum[];
  /** Horizontal bars read best for long labels and many categories. */
  orientation?: "horizontal" | "vertical";
  /** Stack segment definitions, at most four. When set the chart is stacked and each datum uses `values`. */
  series?: BarSeries[];
  /** Label of the one category to emphasize. It draws in the first chart color and the rest in the neutral. */
  highlight?: string;
  /** Name of the measure for single series charts, used in announcements and the tooltip, for example "Cost". */
  measure?: string;
  /** Formats values on the axis, in labels and in the tooltip. */
  formatValue?: (n: number) => string;
  /** Unit word read after each value by screen readers, for example "dollars". */
  unit?: string;
  /** Total height in px. Vertical charts default to 240. Horizontal charts size themselves to their rows. */
  height?: number;
  /** Name for the chart region, for example "Spend by model". */
  ariaLabel?: string;
  className?: string;
}

const MAX_STACK = 4;
const T = 24; // maximum bar thickness

/** Bar from a to b along the value axis, c to c+t across it, with the data end (b) rounded to 4px. */
function barPath(hor: boolean, a: number, b: number, c: number, t: number, round: boolean): string {
  const len = Math.abs(b - a);
  const r = round ? Math.min(4, len, t / 2) : 0;
  if (hor) {
    const x1 = b;
    return r ? `M${a} ${c}H${x1 - r}Q${x1} ${c} ${x1} ${c + r}V${c + t - r}Q${x1} ${c + t} ${x1 - r} ${c + t}H${a}Z` : `M${a} ${c}H${x1}V${c + t}H${a}Z`;
  }
  const y1 = b;
  return r ? `M${c} ${a}V${y1 + r}Q${c} ${y1} ${c + r} ${y1}H${c + t - r}Q${c + t} ${y1} ${c + t} ${y1 + r}V${a}Z` : `M${c} ${a}V${y1}H${c + t}V${a}Z`;
}

/**
 * Bar chart drawn in SVG. Bars start at zero with a 4px rounded data end and a 2px surface gap between neighbors.
 * Single series charts can emphasize one bar. Stacked charts carry up to four segments and a legend in stack order.
 * The plot takes focus: arrow keys step through bars and each one is announced as "Series, category, value, unit".
 */
export function BarChart({ data, orientation = "horizontal", series, highlight, measure = "Value", formatValue = formatNumber, unit = "", height, ariaLabel = "Bar chart", className }: BarChartProps) {
  const stack = series && series.length ? series.slice(0, MAX_STACK) : undefined;
  const hor = orientation === "horizontal";
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<{ c: number; s: number } | null>(null);
  const [said, setSaid] = useState("");

  const w = measured || 640;
  const n = data.length;
  const segs = (d: BarDatum) => (stack ? stack.map((_, i) => Math.max(0, d.values?.[i] ?? 0)) : [Math.max(0, d.value ?? 0)]);
  const totals = data.map((d) => segs(d).reduce((a, b) => a + b, 0));
  const max = Math.max(0, ...totals);
  const ticks = niceTicks(0, max || 1);
  const hi = ticks[ticks.length - 1] || 1;
  const tickLabels = ticks.map((t) => formatValue(t));
  const tickW = Math.max(...tickLabels.map((t) => t.length)) * 6.6;
  const valW = Math.max(0, ...totals.map((t) => formatValue(t).length)) * 6.6;

  // geometry
  const catChars = Math.max(0, ...data.map((d) => d.label.length));
  const left = hor ? Math.min(w * 0.4, catChars * 6.4 + 14) : tickW + 14;
  const right = hor ? valW + 14 : 10;
  const plotTop = hor ? 4 : 20;
  const band = hor ? (height ? Math.max(20, (height - 32) / Math.max(1, n)) : 32) : Math.max(10, (w - left - right) / Math.max(1, n));
  const h = hor ? Math.round(n * band + 32) : Math.max(160, height ?? 240);
  const plotBottom = h - 28;
  const pw = Math.max(40, w - left - right);
  const ph = plotBottom - plotTop;
  const thick = Math.min(T, band * (hor ? 0.62 : 0.6));
  const vs = (v: number) => (hor ? left + (v / hi) * pw : plotBottom - (v / hi) * ph);
  const cross = (c: number) => (hor ? plotTop + c * band + (band - thick) / 2 : left + c * band + (band - thick) / 2);
  const fit = (s: string, px: number) => { const k = Math.max(1, Math.floor(px / 6.4)); return s.length > k ? `${s.slice(0, Math.max(1, k - 1))}…` : s; };

  const tickStep = Math.max(1, Math.ceil((tickW + 12) / Math.max(1, hor ? pw / Math.max(1, ticks.length - 1) : 1)));
  const colorOf = (c: number, s: number) => (stack ? seriesStyle(s).color : highlight ? (data[c].label === highlight ? "var(--chart-1)" : "var(--chart-neutral)") : "var(--chart-1)");
  const nameOf = (s: number) => (stack ? stack[s].label : measure);
  const readout = (c: number, s: number) => `${nameOf(s)}, ${data[c].label}, ${formatValue(segs(data[c])[s])}${unit ? ` ${unit}` : ""}`;

  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!n) return;
    const cur = active ?? { c: 0, s: 0 };
    let { c, s } = cur;
    const catKeys = hor ? ["ArrowDown", "ArrowUp"] : ["ArrowRight", "ArrowLeft"];
    const segKeys = hor ? ["ArrowRight", "ArrowLeft"] : ["ArrowUp", "ArrowDown"];
    const nextC = (d: number) => Math.max(0, Math.min(n - 1, c + d));
    if (e.key === catKeys[0]) c = nextC(1);
    else if (e.key === catKeys[1]) c = nextC(-1);
    else if (stack && e.key === segKeys[0]) s = Math.min(stack.length - 1, s + 1);
    else if (stack && e.key === segKeys[1]) s = Math.max(0, s - 1);
    else if (!stack && e.key === segKeys[0]) c = nextC(1);
    else if (!stack && e.key === segKeys[1]) c = nextC(-1);
    else if (e.key === "Home") c = 0;
    else if (e.key === "End") c = n - 1;
    else if (e.key === "Escape") { setActive(null); setSaid(""); return; }
    else return;
    e.preventDefault();
    setActive({ c, s });
    setSaid(readout(c, s));
  };

  const pointAt = (c: number, e: PointerEvent<SVGRectElement>) => {
    let s = 0;
    const r = svgRef.current?.getBoundingClientRect();
    if (stack && r) {
      const pos = hor ? e.clientX - r.left : e.clientY - r.top;
      const v = hor ? ((pos - left) / pw) * hi : ((plotBottom - pos) / ph) * hi;
      let cum = 0;
      const vals = segs(data[c]);
      s = vals.length - 1;
      for (let i = 0; i < vals.length; i++) { cum += vals[i]; if (v <= cum) { s = i; break; } }
    }
    setActive({ c, s });
  };

  const ac = active?.c ?? -1;
  const acTotal = ac >= 0 ? totals[ac] : 0;
  const tipAnchor = ac >= 0 ? vs(acTotal) : 0;
  const tipStyle = ac >= 0
    ? hor
      ? { top: plotTop + ac * band, left: tipAnchor, transform: tipAnchor > w * 0.55 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }
      : { top: tipAnchor, left: left + ac * band + band / 2, transform: tipAnchor > 90 ? "translate(-50%, calc(-100% - 8px))" : "translate(-50%, 8px)" }
    : undefined;
  const lastNonZero = (vals: number[]) => { for (let i = vals.length - 1; i >= 0; i--) if (vals[i] > 0) return i; return -1; };

  return (
    <div ref={ref} className={cn("relative min-w-0", className)}>
      {stack && stack.length >= 2 && <ChartLegend kind="bar" label="Legend, in stack order" items={stack.map((s) => ({ id: s.id, label: s.label }))} />}
      <div ref={wrapRef} tabIndex={0} role="group" aria-roledescription="bar chart"
        aria-label={`${ariaLabel}. ${n} categories${stack ? `, ${stack.length} segments` : ""}. Use arrow keys to step through bars.`}
        onKeyDown={move} onFocus={() => { if (n) setActive((p) => p ?? { c: 0, s: 0 }); }} onBlur={() => { setActive(null); setSaid(""); }}
        className="relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
        <svg ref={svgRef} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block max-w-full touch-pan-y select-none" aria-hidden focusable="false" style={{ fontFamily: "var(--font-sans)", fontSize: 12 }}>
          {ac >= 0 && (hor
            ? <rect x={left} y={plotTop + ac * band} width={pw} height={band} fill="var(--surface-hover)" />
            : <rect x={left + ac * band} y={plotTop} width={band} height={ph} fill="var(--surface-hover)" />)}
          {ticks.map((t, i) => {
            const p = vs(t);
            const base = i === 0;
            return (
              <g key={t}>
                {hor
                  ? <line x1={p} x2={p} y1={plotTop} y2={plotBottom} stroke={base ? "var(--chart-axis)" : "var(--chart-grid)"} strokeWidth={base ? 1 : 0.5} shapeRendering="crispEdges" />
                  : <line x1={left} x2={left + pw} y1={p} y2={p} stroke={base ? "var(--chart-axis)" : "var(--chart-grid)"} strokeWidth={base ? 1 : 0.5} shapeRendering="crispEdges" />}
                {hor
                  ? (i % tickStep === 0 || i === ticks.length - 1) && <text x={p} y={plotBottom + 18} textAnchor="middle" fill="var(--fg-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{tickLabels[i]}</text>
                  : <text x={left - 8} y={p} textAnchor="end" dominantBaseline="central" fill="var(--fg-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{tickLabels[i]}</text>}
              </g>
            );
          })}
          {data.map((d, c) => {
            const vals = segs(d);
            const last = lastNonZero(vals);
            let cum = 0;
            const c0 = cross(c);
            return (
              <g key={d.label}>
                {hor
                  ? <text x={left - 8} y={plotTop + c * band + band / 2} textAnchor="end" dominantBaseline="central" fill="var(--fg)">{fit(d.label, left - 12)}</text>
                  : <text x={left + c * band + band / 2} y={plotBottom + 18} textAnchor="middle" fill="var(--fg-muted)">{fit(d.label, band - 4)}</text>}
                {vals.map((v, s) => {
                  if (v <= 0) { return null; }
                  const a = vs(cum) + (s > 0 ? (hor ? 1 : -1) : 0);
                  cum += v;
                  const b = vs(cum) + (s < last ? (hor ? -1 : 1) : 0);
                  if (Math.abs(b - a) < 1) return null;
                  return <path key={s} d={barPath(hor, a, b, c0, thick, s === last)} fill={colorOf(c, s)} />;
                })}
                {(() => {
                  const tot = totals[c];
                  const txt = formatValue(tot);
                  if (hor) return <text x={vs(tot) + 8} y={plotTop + c * band + band / 2} dominantBaseline="central" fill="var(--fg)" style={{ fontVariantNumeric: "tabular-nums" }}>{txt}</text>;
                  return band >= txt.length * 6.6 + 4 ? <text x={left + c * band + band / 2} y={vs(tot) - 6} textAnchor="middle" fill="var(--fg)" style={{ fontVariantNumeric: "tabular-nums" }}>{txt}</text> : null;
                })()}
              </g>
            );
          })}
          {data.map((d, c) => (
            <rect key={d.label} x={hor ? 0 : left + c * band} y={hor ? plotTop + c * band : 0} width={hor ? w : band} height={hor ? band : h} fill="transparent"
              onPointerMove={(e) => pointAt(c, e)} onPointerDown={(e) => pointAt(c, e)}
              onPointerLeave={(e) => { if (e.pointerType === "mouse" && document.activeElement !== wrapRef.current) setActive(null); }} />
          ))}
        </svg>
        {ac >= 0 && (
          <div aria-hidden className="pointer-events-none absolute z-10 min-w-36 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-md" style={tipStyle}>
            <p className="mb-1 text-fg-muted">{data[ac].label}</p>
            {stack ? (
              <>
                {segs(data[ac]).map((v, s) => (
                  <p key={stack[s].id} className="flex items-center gap-2 leading-5">
                    <span className="inline-block h-2.5 w-2.5 rounded-[2px]" style={{ background: seriesStyle(s).color }} />
                    <span className={cn("flex-1 text-fg-muted", active?.s === s && "font-medium text-fg")}>{stack[s].label}</span>
                    <span className="font-semibold text-fg [font-variant-numeric:tabular-nums]">{formatValue(v)}</span>
                  </p>
                ))}
                <p className="mt-1 flex justify-between gap-2 border-t border-line pt-1 leading-5"><span className="text-fg-muted">Total</span><span className="font-semibold text-fg [font-variant-numeric:tabular-nums]">{formatValue(acTotal)}</span></p>
              </>
            ) : (
              <p className="flex items-center gap-2 leading-5"><span className="text-fg-muted">{measure}</span><span className="font-semibold text-fg [font-variant-numeric:tabular-nums]">{formatValue(acTotal)}</span></p>
            )}
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite" role="status">{said}</div>
    </div>
  );
}

/** Table data for ChartFrame's table view. Stacked charts get one column per segment and a total. */
export function barChartTable(data: BarDatum[], opts: { labelHeader: string; caption: string; series?: BarSeries[]; measure?: string; formatValue?: (n: number) => string; unit?: string }): DataTableProps {
  const f = opts.formatValue ?? formatNumber;
  const st = opts.series?.slice(0, MAX_STACK);
  const u = opts.unit ? ` (${opts.unit})` : "";
  if (!st) {
    return { caption: opts.caption, columns: [{ key: "l", header: opts.labelHeader }, { key: "v", header: `${opts.measure ?? "Value"}${u}`, numeric: true }], rows: data.map((d) => ({ l: d.label, v: f(d.value ?? 0) })) };
  }
  return {
    caption: opts.caption,
    columns: [{ key: "l", header: opts.labelHeader }, ...st.map((s) => ({ key: s.id, header: `${s.label}${u}`, numeric: true })), { key: "total", header: `Total${u}`, numeric: true }],
    rows: data.map((d) => {
      const row: Record<string, string> = { l: d.label };
      let tot = 0;
      st.forEach((s, i) => { const v = d.values?.[i] ?? 0; tot += v; row[s.id] = f(v); });
      row.total = f(tot);
      return row;
    }),
  };
}
