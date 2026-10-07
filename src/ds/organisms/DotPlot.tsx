import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { cn } from "../lib/cn";
import type { DataTableProps } from "../molecules/DataTable";
import { formatNumber, niceTicks, useElementWidth } from "../molecules/ChartFrame";

export interface DotDatum {
  /** Row name, for example a model or a prompt version. */
  label: string;
  /** Point estimate, such as a mean score. */
  estimate: number;
  /** Lower end of the interval. */
  low: number;
  /** Upper end of the interval. */
  high: number;
  /** Sample size behind the estimate. */
  n?: number;
}

export interface DotPlotProps {
  /** One row per estimate, in display order. */
  data: DotDatum[];
  /**
   * Required sentence that says what the dot and the line mean, with the interval level and sample size.
   * For example "Dots show mean score, lines show 95% confidence intervals, n = 200".
   */
  caption: string;
  /** Show the sample size next to each row. Use it for small samples. */
  showN?: boolean;
  /** Name of the estimate, used in announcements and the tooltip, for example "Mean score". */
  measure?: string;
  /** Names the interval in announcements and the tooltip, for example "95% confidence interval". */
  intervalLabel?: string;
  /** Formats the axis, labels and tooltip. */
  formatValue?: (n: number) => string;
  /** Unit word read after each value by screen readers. */
  unit?: string;
  /** Fixed value axis. Defaults to the interval extent. This chart does not need to start at zero. */
  domain?: [number, number];
  /** A named reference line, for example the current production model. */
  reference?: { value: number; label: string };
  /** Name for the chart region. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Estimates with intervals: a filled dot for the estimate and a hairline for its range. A caption above the plot says
 * what the dot and the line mean. Estimates and intervals are printed beside each row when there is room, and the
 * sample size is optional. Rows are reachable with the arrow keys.
 */
export function DotPlot({ data, caption, showN, measure = "Estimate", intervalLabel = "interval", formatValue = formatNumber, unit = "", domain, reference, ariaLabel = "Dot plot", className }: DotPlotProps) {
  const [ref, measured] = useElementWidth<HTMLDivElement>();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [said, setSaid] = useState("");

  const w = measured || 640;
  const n = data.length;
  const f = formatValue;
  const lo0 = domain ? domain[0] : Math.min(...data.map((d) => d.low), reference?.value ?? Infinity);
  const hi0 = domain ? domain[1] : Math.max(...data.map((d) => d.high), reference?.value ?? -Infinity);
  const ticks = domain ? niceTicks(domain[0], domain[1]) : niceTicks(Number.isFinite(lo0) ? lo0 : 0, Number.isFinite(hi0) ? hi0 : 1);
  const lo = domain ? domain[0] : ticks[0];
  const hi = domain ? domain[1] : ticks[ticks.length - 1];
  const tickLabels = ticks.map((t) => f(t));
  const tickW = Math.max(...tickLabels.map((t) => t.length)) * 6.6;

  const values = (d: DotDatum) => `${f(d.estimate)} (${f(d.low)} to ${f(d.high)})`;
  const showValues = w >= 440;
  const rightText = Math.max(0, ...data.map((d) => (showValues ? values(d).length : 0) + (showN && showValues && d.n !== undefined ? 10 : 0))) * 6.4;
  const left = Math.min(w * 0.34, Math.max(0, ...data.map((d) => d.label.length)) * 6.4 + 14);
  const right = showValues ? rightText + 16 : 16;
  const band = 36;
  const plotTop = reference ? 20 : 6;
  const h = plotTop + n * band + 30;
  const plotBottom = plotTop + n * band;
  const pw = Math.max(40, w - left - right);
  const xs = (v: number) => left + ((v - lo) / (hi - lo || 1)) * pw;
  const tickStep = Math.max(1, Math.ceil((tickW + 14) / (pw / Math.max(1, ticks.length - 1))));
  const fit = (s: string, px: number) => { const k = Math.max(1, Math.floor(px / 6.4)); return s.length > k ? `${s.slice(0, Math.max(1, k - 1))}…` : s; };

  const readout = (i: number) => {
    const d = data[i];
    return `${measure}, ${d.label}, ${f(d.estimate)}${unit ? ` ${unit}` : ""}, ${intervalLabel} ${f(d.low)} to ${f(d.high)}${d.n !== undefined ? `, n = ${d.n}` : ""}`;
  };
  const move = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!n) return;
    let i = active ?? 0;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") i = Math.min(n - 1, i + 1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") i = Math.max(0, i - 1);
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = n - 1;
    else if (e.key === "Escape") { setActive(null); setSaid(""); return; }
    else return;
    e.preventDefault();
    setActive(i);
    setSaid(readout(i));
  };
  const leave = (e: PointerEvent<SVGRectElement>) => { if (e.pointerType === "mouse" && document.activeElement !== wrapRef.current) setActive(null); };

  return (
    <div ref={ref} className={cn("relative min-w-0", className)}>
      <p className="mb-2 max-w-[68ch] text-xs leading-5 text-fg-muted">{caption}</p>
      <div ref={wrapRef} tabIndex={0} role="group" aria-roledescription="dot plot"
        aria-label={`${ariaLabel}. ${n} rows. ${caption}. Use arrow keys to step through rows.`}
        onKeyDown={move} onFocus={() => { if (n) setActive((p) => p ?? 0); }} onBlur={() => { setActive(null); setSaid(""); }}
        className="relative rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]">
        <svg ref={svgRef} width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block max-w-full touch-pan-y select-none" aria-hidden focusable="false" style={{ fontFamily: "var(--font-sans)", fontSize: 12 }}>
          {active !== null && <rect x={0} y={plotTop + active * band} width={w} height={band} fill="var(--surface-hover)" />}
          {ticks.map((t, i) => (
            <g key={t}>
              <line x1={xs(t)} x2={xs(t)} y1={plotTop} y2={plotBottom} stroke="var(--chart-grid)" strokeWidth={0.5} shapeRendering="crispEdges" />
              {(i % tickStep === 0 || i === ticks.length - 1) && <text x={xs(t)} y={plotBottom + 18} textAnchor="middle" fill="var(--fg-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{tickLabels[i]}</text>}
            </g>
          ))}
          <line x1={left} x2={left + pw} y1={plotBottom} y2={plotBottom} stroke="var(--chart-axis)" strokeWidth={1} shapeRendering="crispEdges" />
          {reference && (
            <g>
              <line x1={xs(reference.value)} x2={xs(reference.value)} y1={plotTop - 2} y2={plotBottom} stroke="var(--chart-axis)" strokeWidth={1} shapeRendering="crispEdges" />
              <text x={xs(reference.value)} y={plotTop - 8} textAnchor="middle" fill="var(--fg-muted)">{reference.label}</text>
            </g>
          )}
          {data.map((d, i) => {
            const cy = plotTop + i * band + band / 2;
            return (
              <g key={d.label}>
                <text x={left - 10} y={cy} textAnchor="end" dominantBaseline="central" fill="var(--fg)">{fit(d.label, left - 14)}</text>
                <line x1={xs(d.low)} x2={xs(d.high)} y1={cy} y2={cy} stroke="var(--chart-1)" strokeWidth={1.5} strokeLinecap="round" />
                <line x1={xs(d.low)} x2={xs(d.low)} y1={cy - 4} y2={cy + 4} stroke="var(--chart-1)" strokeWidth={1.5} strokeLinecap="round" />
                <line x1={xs(d.high)} x2={xs(d.high)} y1={cy - 4} y2={cy + 4} stroke="var(--chart-1)" strokeWidth={1.5} strokeLinecap="round" />
                <circle cx={xs(d.estimate)} cy={cy} r={5} fill="var(--chart-1)" stroke="var(--surface)" strokeWidth={2} />
                {showValues && (
                  <text x={left + pw + 14} y={cy} dominantBaseline="central" fill="var(--fg-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
                    <tspan fill="var(--fg)">{f(d.estimate)}</tspan>{` (${f(d.low)} to ${f(d.high)})`}{showN && d.n !== undefined ? `  n = ${d.n}` : ""}
                  </text>
                )}
                {!showValues && showN && d.n !== undefined && <text x={w - 4} y={cy + 14} textAnchor="end" fill="var(--fg-muted)" style={{ fontSize: 11 }}>n = {d.n}</text>}
              </g>
            );
          })}
          {data.map((d, i) => (
            <rect key={d.label} x={0} y={plotTop + i * band} width={w} height={band} fill="transparent" onPointerMove={() => setActive(i)} onPointerDown={() => setActive(i)} onPointerLeave={leave} />
          ))}
        </svg>
        {active !== null && data[active] && (
          <div aria-hidden className="pointer-events-none absolute z-10 min-w-40 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-md"
            style={{ top: plotTop + active * band + band, left: Math.min(Math.max(8, xs(data[active].estimate)), w - 8), transform: `translateX(${xs(data[active].estimate) > w / 2 ? "-100%" : "0"})` }}>
            <p className="mb-1 text-fg-muted">{data[active].label}</p>
            <p className="flex justify-between gap-3 leading-5"><span className="text-fg-muted">{measure}</span><span className="font-semibold text-fg [font-variant-numeric:tabular-nums]">{f(data[active].estimate)}</span></p>
            <p className="flex justify-between gap-3 leading-5"><span className="text-fg-muted">{intervalLabel}</span><span className="text-fg [font-variant-numeric:tabular-nums]">{f(data[active].low)} to {f(data[active].high)}</span></p>
            {data[active].n !== undefined && <p className="flex justify-between gap-3 leading-5"><span className="text-fg-muted">Sample size</span><span className="text-fg [font-variant-numeric:tabular-nums]">n = {data[active].n}</span></p>}
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite" role="status">{said}</div>
    </div>
  );
}

/** Table data for ChartFrame's table view: estimate, interval ends and sample size. */
export function dotPlotTable(data: DotDatum[], opts: { labelHeader: string; caption: string; measure?: string; formatValue?: (n: number) => string; intervalLabel?: string }): DataTableProps {
  const f = opts.formatValue ?? formatNumber;
  const il = opts.intervalLabel ?? "Interval";
  return {
    caption: opts.caption,
    columns: [
      { key: "l", header: opts.labelHeader },
      { key: "e", header: opts.measure ?? "Estimate", numeric: true },
      { key: "lo", header: `${il}, lower`, numeric: true },
      { key: "hi", header: `${il}, upper`, numeric: true },
      { key: "n", header: "Sample size (n)", numeric: true },
    ],
    rows: data.map((d) => ({ l: d.label, e: f(d.estimate), lo: f(d.low), hi: f(d.high), n: d.n !== undefined ? formatNumber(d.n) : "Not given" })),
  };
}
