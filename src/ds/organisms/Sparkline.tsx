import { formatNumber } from "../molecules/ChartFrame";

export interface SparklineProps {
  /** Values in time order. At least two points are drawn. */
  data: number[];
  /** What the line measures, for example "p95 latency". Used in the accessible name. */
  label: string;
  /** Unit appended to values in the accessible name, for example " ms". Include the leading space if needed. */
  unit?: string;
  /** Formats values for the accessible name. */
  formatValue?: (n: number) => string;
  /** Width in px. */
  width?: number;
  /** Height in px. */
  height?: number;
  /** Mark the minimum and maximum with dots. */
  showMinMax?: boolean;
  /** Hide from assistive technology. Use when the number beside it already says everything, such as inside a StatTile. */
  decorative?: boolean;
  /** Color of the emphasized end point. Defaults to the first chart color. */
  color?: string;
  className?: string;
}

/**
 * Tiny trend line in the context color with the latest point emphasized. The accessible name states the first,
 * last, minimum and maximum values. Set decorative when a visible number carries the same information.
 */
export function Sparkline({ data, label, unit = "", formatValue = formatNumber, width = 96, height = 28, showMinMax, decorative, color = "var(--chart-1)", className }: SparklineProps) {
  const n = data.length;
  const pad = 6;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const x = (i: number) => pad + (n <= 1 ? (width - 2 * pad) / 2 : (i * (width - 2 * pad)) / (n - 1));
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);
  const d = data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join("");
  const iMin = data.indexOf(min);
  const iMax = data.indexOf(max);
  const f = (v: number) => `${formatValue(v)}${unit}`;
  const name = n ? `${label}: first ${f(data[0])}, last ${f(data[n - 1])}, minimum ${f(min)}, maximum ${f(max)}.` : `${label}: no data.`;
  if (!n) return null;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className}
      role={decorative ? undefined : "img"} aria-label={decorative ? undefined : name} aria-hidden={decorative || undefined} focusable="false">
      {n > 1 && <path d={d} fill="none" stroke="var(--chart-axis)" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />}
      {showMinMax && iMin !== n - 1 && <circle cx={x(iMin)} cy={y(min)} r={3.5} fill="var(--surface)" stroke="var(--chart-axis)" strokeWidth={1.5} />}
      {showMinMax && iMax !== n - 1 && iMax !== iMin && <circle cx={x(iMax)} cy={y(max)} r={3.5} fill="var(--surface)" stroke="var(--chart-axis)" strokeWidth={1.5} />}
      <circle cx={x(n - 1)} cy={y(data[n - 1])} r={4.5} fill={color} stroke="var(--surface)" strokeWidth={2} />
    </svg>
  );
}
