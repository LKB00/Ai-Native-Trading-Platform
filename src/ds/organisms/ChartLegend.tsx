import { cn } from "../lib/cn";

export type MarkerShape = "circle" | "square" | "triangle" | "diamond";

export interface SeriesStyle {
  /** CSS color value, a chart token such as var(--chart-1). */
  color: string;
  /** Marker drawn at line ends and in the legend. */
  shape: MarkerShape;
  /** SVG stroke-dasharray for lines. Undefined means solid. */
  dash?: string;
}

/**
 * Fixed series order. Colors are assigned by position and never cycled. From the third series on, a dash pattern
 * and a marker shape repeat the color so identity never rests on hue alone. Dotted lines are kept for projections.
 */
export const SERIES_STYLES: SeriesStyle[] = [
  { color: "var(--chart-1)", shape: "circle" },
  { color: "var(--chart-2)", shape: "circle" },
  { color: "var(--chart-3)", shape: "square", dash: "9 4" },
  { color: "var(--chart-4)", shape: "triangle", dash: "9 4 2 4" },
  { color: "var(--chart-5)", shape: "diamond", dash: "14 4" },
];
/** Color used for "Other" and context series. */
export const NEUTRAL_STYLE: SeriesStyle = { color: "var(--chart-neutral)", shape: "circle" };

/** Style for series at index i. Index 5 and beyond is not defined: fold the tail into Other. */
export function seriesStyle(i: number): SeriesStyle {
  return SERIES_STYLES[Math.min(i, SERIES_STYLES.length - 1)];
}

/** Path for a marker of the given shape centred on cx, cy. r is the half size (use 4 or more for an 8px marker). */
export function markerPath(shape: MarkerShape, cx: number, cy: number, r: number): string {
  switch (shape) {
    case "square": return `M${cx - r} ${cy - r}h${2 * r}v${2 * r}h${-2 * r}z`;
    case "triangle": return `M${cx} ${cy - r * 1.15}L${cx + r * 1.1} ${cy + r * 0.85}L${cx - r * 1.1} ${cy + r * 0.85}z`;
    case "diamond": return `M${cx} ${cy - r * 1.25}L${cx + r * 1.25} ${cy}L${cx} ${cy + r * 1.25}L${cx - r * 1.25} ${cy}z`;
    default: return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
  }
}

export interface SeriesMarkProps {
  shape: MarkerShape;
  cx: number;
  cy: number;
  color: string;
  /** Half size in px. Default 4.5, which gives a 9px marker. */
  r?: number;
  /** Hollow marker: surface fill with a colored outline. Used for provisional values. */
  hollow?: boolean;
}

/** Marker with a 2px surface ring so it stays legible where it crosses a line. Use inside an svg. */
export function SeriesMark({ shape, cx, cy, color, r = 4.5, hollow }: SeriesMarkProps) {
  const d = markerPath(shape, cx, cy, r);
  if (hollow) {
    return (<g><path d={d} fill="var(--surface)" stroke="var(--surface)" strokeWidth={5} strokeLinejoin="round" /><path d={d} fill="var(--surface)" stroke={color} strokeWidth={2} strokeLinejoin="round" /></g>);
  }
  return <path d={d} fill={color} stroke="var(--surface)" strokeWidth={2} paintOrder="stroke" strokeLinejoin="round" />;
}

export interface LegendItem {
  id: string;
  label: string;
  /** Overrides the style taken from the item's position. */
  style?: SeriesStyle;
}

export interface ChartLegendProps {
  /** Items in the same order as the chart's series or stack. */
  items: LegendItem[];
  /** "line" shows the dash and marker. "bar" shows a rounded swatch. */
  kind?: "line" | "bar";
  /** Ids currently hidden. Only used when onToggle is set. */
  hidden?: string[];
  /** Makes items toggle buttons. Pressed means the series is shown. */
  onToggle?: (id: string) => void;
  /** Accessible name for the group. */
  label?: string;
  className?: string;
}

function Key({ style, kind }: { style: SeriesStyle; kind: "line" | "bar" }) {
  if (kind === "bar") return <span aria-hidden className="inline-block h-2.5 w-4 shrink-0 rounded-[3px]" style={{ background: style.color }} />;
  return (
    <svg aria-hidden width={26} height={12} viewBox="0 0 26 12" className="shrink-0">
      <line x1={1} y1={6} x2={25} y2={6} stroke={style.color} strokeWidth={2} strokeDasharray={style.dash} strokeLinecap="butt" />
      <SeriesMark shape={style.shape} cx={13} cy={6} color={style.color} r={4} />
    </svg>
  );
}

/**
 * Legend that defines every visual property: color, dash and marker for lines, color for bars. Order matches the
 * chart. Items become toggle buttons (aria-pressed) when onToggle is given. Render it for two or more series only.
 */
export function ChartLegend({ items, kind = "line", hidden = [], onToggle, label = "Legend", className }: ChartLegendProps) {
  return (
    <ul aria-label={label} className={cn("m-0 mb-2 flex list-none flex-wrap gap-x-4 gap-y-1 p-0", className)}>
      {items.map((it, i) => {
        const st = it.style ?? seriesStyle(i);
        const off = hidden.includes(it.id);
        const inner = (<><Key style={st} kind={kind} /><span className={cn("text-xs leading-5", off ? "text-fg-subtle line-through" : "text-fg-muted")}>{it.label}</span></>);
        return (
          <li key={it.id}>
            {onToggle ? (
              <button type="button" aria-pressed={!off} onClick={() => onToggle(it.id)}
                className={cn("inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-full px-1.5 hover:bg-hover", off && "opacity-70")}>
                {inner}<span className="sr-only">{off ? "hidden" : "shown"}</span>
              </button>
            ) : (
              <span className="inline-flex min-h-6 items-center gap-1.5">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
