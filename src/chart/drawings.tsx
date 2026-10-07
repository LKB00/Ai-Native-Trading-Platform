import type { ReactNode } from 'react'
import type { Drawing, DrawKind } from '../store'

/** Converts between chart space (epoch seconds, price) and pixels of the main pane. Null when off-scale. */
export type Mapper = { x: (t: number) => number | null; y: (p: number) => number | null; t: (x: number) => number | null; p: (y: number) => number | null; w: number; h: number; barSec: number; barsBetween: (a: number, b: number) => number }

export type Tool = 'cross' | 'dot' | 'arrow' | 'hline' | 'alert' | DrawKind
export const CLICKS: Partial<Record<Tool, number>> = { trend: 2, ray: 2, extended: 2, fib: 2, rect: 2, measure: 2, channel: 3, hray: 1, vline: 1, text: 1, long: 1, short: 1 }
export const isDrawTool = (t: Tool) => t in CLICKS

export const DEFAULT_COLOR: Record<DrawKind, string> = { trend: '--chart-1', ray: '--chart-1', extended: '--chart-1', hray: '--chart-1', vline: '--chart-1', channel: '--chart-4', fib: '--chart-5', rect: '--chart-3', text: '--fg', long: '--success', short: '--danger', measure: '--chart-1' }
export const KIND_LABEL: Record<DrawKind, string> = { trend: 'Trend line', ray: 'Ray', extended: 'Extended line', hray: 'Horizontal ray', vline: 'Vertical line', channel: 'Parallel channel', fib: 'Fib retracement', rect: 'Rectangle', text: 'Text', long: 'Long position', short: 'Short position', measure: 'Measure' }
export const FIB = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const DASH = ['', '6 4', '2 3']
const v = (c: string) => `var(${c})`
const fmtP = (p: number) => p.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

type Pt = { x: number; y: number }
/** Anchor points (handles) of a drawing, in pixels. Order matches applyHandle(). */
export function handles(d: Drawing, m: Mapper): (Pt | null)[] {
  const P = (t: number, p: number) => { const x = m.x(t), y = m.y(p); return x == null || y == null ? null : { x, y } }
  switch (d.kind) {
    case 'hray': case 'text': return [P(d.t1, d.p1)]
    case 'vline': { const x = m.x(d.t1); return [x == null ? null : { x, y: m.h / 2 }] }
    case 'rect': return [P(d.t1, d.p1), P(d.t2, d.p2), P(d.t1, d.p2), P(d.t2, d.p1)]
    case 'channel': return [P(d.t1, d.p1), P(d.t2, d.p2), P(d.t1, d.p1 + (d.p3 ?? 0)), P(d.t2, d.p2 + (d.p3 ?? 0))]
    case 'long': case 'short': return [P(d.t1, d.p1), P(d.t1, d.p2), P(d.t1, d.p3 ?? d.p1), P(d.t2, d.p1)]
    default: return [P(d.t1, d.p1), P(d.t2, d.p2)]
  }
}
/** What dragging handle `i` to (t, p) changes. */
export function applyHandle(d: Drawing, i: number, t: number, p: number): Partial<Drawing> {
  switch (d.kind) {
    case 'hray': case 'text': case 'vline': return { t1: t, p1: p }
    case 'rect': return [{ t1: t, p1: p }, { t2: t, p2: p }, { t1: t, p2: p }, { t2: t, p1: p }][i]
    case 'channel': return [{ t1: t, p1: p }, { t2: t, p2: p }, { p3: p - d.p1 }, { p3: p - d.p2 }][i]
    case 'long': case 'short': return [{ t1: t, p1: p }, { p2: p }, { p3: p }, { t2: Math.max(t, d.t1 + 1) }][i]
    default: return i === 0 ? { t1: t, p1: p } : { t2: t, p2: p }
  }
}
/** Move the whole drawing by a time and price delta. Channel offsets are relative, so they stay put. */
export const translate = (d: Drawing, dt: number, dp: number): Partial<Drawing> => ({ t1: d.t1 + dt, t2: d.t2 + dt, p1: d.p1 + dp, p2: d.p2 + dp, ...(d.p3 != null && d.kind !== 'channel' ? { p3: d.p3 + dp } : {}) })

const distSeg = (p: Pt, a: Pt, b: Pt, infA = false, infB = false) => {
  const dx = b.x - a.x, dy = b.y - a.y; const L = dx * dx + dy * dy || 1
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L; if (!infA) t = Math.max(t, 0); if (!infB) t = Math.min(t, 1)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}
const inBox = (p: Pt, a: Pt, b: Pt) => p.x >= Math.min(a.x, b.x) - 3 && p.x <= Math.max(a.x, b.x) + 3 && p.y >= Math.min(a.y, b.y) - 3 && p.y <= Math.max(a.y, b.y) + 3
const extendsOf = (d: Drawing) => ({ L: d.kind === 'extended' || !!d.extendLeft, R: d.kind === 'ray' || d.kind === 'extended' || !!d.extendRight })

/** Hit test: a handle index, 'body', or null. */
export function hit(d: Drawing, m: Mapper, p: Pt): number | 'body' | null {
  const hs = handles(d, m)
  for (let i = 0; i < hs.length; i++) { const h = hs[i]; if (h && Math.hypot(p.x - h.x, p.y - h.y) < 8) return i }
  const [a, b] = hs
  switch (d.kind) {
    case 'hray': return a && Math.abs(p.y - a.y) < 5 && p.x >= a.x - 4 ? 'body' : null
    case 'vline': return a && Math.abs(p.x - a.x) < 5 ? 'body' : null
    case 'text': return a && p.x >= a.x - 4 && p.x <= a.x + (d.text ?? 'Text').length * 7.5 + 12 && p.y >= a.y - 20 && p.y <= a.y + 4 ? 'body' : null
    case 'rect': case 'measure': return a && b && inBox(p, a, b) ? 'body' : null
    case 'long': case 'short': { const e = m.x(d.t2); if (!a || e == null) return null; const ys = [hs[1]?.y, hs[2]?.y].filter((x): x is number => x != null); return p.x >= a.x && p.x <= e && p.y >= Math.min(...ys) && p.y <= Math.max(...ys) ? 'body' : null }
    case 'fib': { if (!a || !b) return null; if (p.x < Math.min(a.x, b.x) - 4 || p.x > Math.max(a.x, b.x) + 4) return null; return FIB.some((f) => Math.abs(p.y - (b.y + (a.y - b.y) * f)) < 5) || distSeg(p, a, b) < 5 ? 'body' : null }
    case 'channel': { const [, , c, e] = hs; if (!a || !b || !c || !e) return null; return distSeg(p, a, b) < 5 || distSeg(p, c, e) < 5 || inPoly(p, [a, b, e, c]) ? 'body' : null }
    default: { if (!a || !b) return null; const { L, R } = extendsOf(d); const [s, t] = a.x <= b.x ? [a, b] : [b, a]; const sL = a.x <= b.x ? L : R, tR = a.x <= b.x ? R : L; return distSeg(p, s, t, sL, tR) < 5 ? 'body' : null }
  }
}
function inPoly(p: Pt, poly: Pt[]) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[i], b = poly[j]; if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c } return c }

/** Extend segment a→b to the plot edges where asked. */
function extend(a: Pt, b: Pt, L: boolean, R: boolean, w: number): [Pt, Pt] {
  const [s, t] = a.x <= b.x ? [a, b] : [b, a]; const sL = a.x <= b.x ? L : R, tR = a.x <= b.x ? R : L
  const k = t.x === s.x ? 0 : (t.y - s.y) / (t.x - s.x)
  return [sL ? { x: -10, y: s.y + k * (-10 - s.x) } : s, tR ? { x: w + 10, y: t.y + k * (w + 10 - t.x) } : t]
}

/** SVG for one drawing. `ctx` gives values that need market data (bars between, entry risk). */
export function renderDrawing(d: Drawing, m: Mapper, selected: boolean, key?: string): ReactNode {
  const color = v(d.color ?? DEFAULT_COLOR[d.kind]); const w = d.width ?? (selected ? 2 : 1); const dash = DASH[d.dash ?? 0]
  const hs = handles(d, m); const [a, b] = hs
  const line = (p: Pt, q: Pt, extra: Record<string, unknown> = {}) => <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke={color} strokeWidth={w} strokeDasharray={dash} {...extra} />
  const label = (x: number, y: number, text: string, anchor: 'start' | 'middle' | 'end' = 'start', fill = color, bg = true) => (
    <g>{bg && <rect x={anchor === 'start' ? x - 3 : anchor === 'end' ? x - text.length * 6.2 - 3 : x - text.length * 3.1 - 4} y={y - 11} width={text.length * 6.2 + 7} height={15} rx={4} fill="var(--surface)" opacity={0.85} />}
      <text x={x} y={y} fontSize={11} fill={fill} textAnchor={anchor} style={{ fontFamily: 'var(--ds-font-mono)' }}>{text}</text></g>)
  let body: ReactNode = null
  switch (d.kind) {
    case 'hray': if (a) body = <>{line(a, { x: m.w + 10, y: a.y })}{label(a.x + 4, a.y - 4, fmtP(d.p1))}</>; break
    case 'vline': { const x = m.x(d.t1); if (x != null) body = line({ x, y: -10 }, { x, y: m.h + 10 }); break }
    case 'text': if (a) body = <g><rect x={a.x - 4} y={a.y - 16} width={(d.text ?? 'Text').length * 7.5 + 10} height={22} rx={6} fill="var(--surface)" stroke={selected ? color : 'transparent'} opacity={0.92} /><text x={a.x + 1} y={a.y} fontSize={13} fill={color} style={{ fontFamily: 'var(--ds-font-sans)' }}>{d.text ?? 'Text'}</text></g>; break
    case 'rect': if (a && b) body = <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={w} strokeDasharray={dash} />; break
    case 'channel': { const [, , c, e] = hs; if (a && b && c && e) { const { L, R } = extendsOf(d); const [p1, p2] = extend(a, b, L, R, m.w), [p3, p4] = extend(c, e, L, R, m.w); const mid = (p: Pt, q: Pt) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 })
      body = <><polygon points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${p4.x},${p4.y} ${p3.x},${p3.y}`} fill={color} fillOpacity={0.1} />{line(p1, p2)}{line(p3, p4)}{line(mid(p1, p3), mid(p2, p4), { strokeDasharray: '4 4', strokeWidth: 1, opacity: 0.7 })}</> } break }
    case 'fib': if (a && b) { const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x) + (d.extendRight ? m.w : 0)
      body = <>{FIB.map((f, i) => { const y = b.y + (a.y - b.y) * f; const yn = i < FIB.length - 1 ? b.y + (a.y - b.y) * FIB[i + 1] : y; const price = d.p2 + (d.p1 - d.p2) * f
        return <g key={f}>{i < FIB.length - 1 && <rect x={x0} y={Math.min(y, yn)} width={x1 - x0} height={Math.abs(yn - y)} fill={v(['--chart-2', '--chart-4', '--chart-3', '--chart-1', '--chart-5', '--chart-neutral'][i])} fillOpacity={0.07} />}
          <line x1={x0} y1={y} x2={x1} y2={y} stroke={color} strokeWidth={1} opacity={f === 0 || f === 1 || f === 0.5 ? 1 : 0.7} />{label(x0 + 3, y - 3, `${f} (${fmtP(price)})`, 'start', color, false)}</g> })}
        {line(a, b, { strokeDasharray: '3 3', strokeWidth: 1, opacity: 0.5 })}</> } break
    case 'long': case 'short': { const e = m.x(d.t2), yE = m.y(d.p1), yT = m.y(d.p2), yS = m.y(d.p3 ?? d.p1); if (a && e != null && yE != null && yT != null && yS != null) {
      const x = a.x, wd = Math.max(e - x, 4); const risk = Math.abs(d.p1 - (d.p3 ?? d.p1)), reward = Math.abs(d.p2 - d.p1); const rr = risk ? reward / risk : 0
      const pct = (p: number) => `${((p / d.p1 - 1) * 100 >= 0 ? '+' : '−')}${Math.abs((p / d.p1 - 1) * 100).toFixed(2)}%`
      body = <><rect x={x} y={Math.min(yE, yT)} width={wd} height={Math.abs(yT - yE)} fill="var(--success)" fillOpacity={0.16} /><rect x={x} y={Math.min(yE, yS)} width={wd} height={Math.abs(yS - yE)} fill="var(--danger)" fillOpacity={0.16} />
        <line x1={x} y1={yE} x2={x + wd} y2={yE} stroke="var(--fg-subtle)" strokeWidth={1} />
        {label(x + wd / 2, yT + (yT < yE ? -5 : 15), `Target ${fmtP(d.p2)} (${pct(d.p2)})`, 'middle', 'var(--success-fg)')}
        {label(x + wd / 2, yS + (yS > yE ? 15 : -5), `Stop ${fmtP(d.p3 ?? d.p1)} (${pct(d.p3 ?? d.p1)})`, 'middle', 'var(--danger-fg)')}
        {label(x + wd / 2, yE + (yT < yE ? 15 : -5), `${d.kind === 'long' ? 'Long' : 'Short'} · R:R ${rr.toFixed(2)}`, 'middle', 'var(--fg)')}</> } break }
    case 'measure': if (a && b) { const up = d.p2 >= d.p1; const c2 = up ? 'var(--success)' : 'var(--danger)'; const dp = d.p2 - d.p1; const bars = Math.round(m.barsBetween(d.t1, d.t2))
      const secs = Math.abs(d.t2 - d.t1); const dur = secs >= 86400 ? `${Math.round(secs / 86400)}d` : `${Math.floor(secs / 3600)}h ${Math.round((secs % 3600) / 60)}m`
      const t = `${dp >= 0 ? '+' : '−'}${fmtP(Math.abs(dp))} (${dp >= 0 ? '+' : '−'}${Math.abs((dp / d.p1) * 100).toFixed(2)}%) · ${bars} bars · ${dur}`
      body = <><rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(b.x - a.x)} height={Math.abs(b.y - a.y)} fill={c2} fillOpacity={0.14} />
        <line x1={(a.x + b.x) / 2} y1={a.y} x2={(a.x + b.x) / 2} y2={b.y} stroke={c2} markerEnd="url(#arrow)" />{label((a.x + b.x) / 2, Math.max(a.y, b.y) + 16, t, 'middle', c2)}</> } break
    default: if (a && b) { const { L, R } = extendsOf(d); const [p, q] = extend(a, b, L, R, m.w); body = line(p, q) }
  }
  return (
    <g key={key ?? d.id} opacity={d.locked && !selected ? 0.95 : 1}>
      {body}
      {selected && hs.map((h, i) => h && <circle key={i} cx={h.x} cy={h.y} r={4.5} fill="var(--surface)" stroke={color} strokeWidth={2} />)}
    </g>
  )
}
