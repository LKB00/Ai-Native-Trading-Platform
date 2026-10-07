import { INSTS, bySym, history, ema, rsiSeries, atr, type Candle, type Inst } from './market'
import type { Filter } from './actions'
import { useStore } from './store'

/** One row of scanner metrics for a stock. Percent fields are in percent units. */
export type Metrics = {
  sym: string; name: string; sector: string; fno: boolean; ltp: number; chg: number; gap: number; volx: number
  rsi: number; ema20: number; ema50: number; ema200: number; above20: number; above50: number; above200: number
  hi52: number; lo52: number; fromHi52: number; fromLo52: number; brk20: number; nr7: number; atrp: number
  r1w: number; r1m: number; r3m: number; r1y: number; rs: number
  mcap: number; pe: number; pb: number; roe: number; de: number; div: number; epsG: number; salesG: number
}

const cache: Record<string, Candle[]> = {}
const daily = (i: Inst) => (cache[i.sym] ??= history(i, '1D', 260))

export function metricsFor(sym: string): Metrics | null {
  const i = bySym(sym); if (!i || i.seg !== 'EQ') return null
  const q = useStore.getState().prices[sym]
  const d = daily(i).map((c) => ({ ...c })); const last = d[d.length - 1]
  last.close = q.ltp; last.high = Math.max(last.high, q.high); last.low = Math.min(last.low, q.low)
  const c = d.map((x) => x.close)
  const e20 = ema(c, 20).at(-1)!, e50 = ema(c, 50).at(-1)!, e200 = ema(c, 200).at(-1)!
  const hi52 = Math.max(...d.map((x) => x.high)), lo52 = Math.min(...d.map((x) => x.low))
  const prev20 = Math.max(...d.slice(-21, -1).map((x) => x.high))
  const ranges = d.slice(-7).map((x) => x.high - x.low)
  const ret = (n: number) => (q.ltp / c[c.length - 1 - n] - 1) * 100
  const n = INSTS[0]; const nd = daily(n).map((x) => x.close); nd[nd.length - 1] = useStore.getState().prices.NIFTY.ltp
  const nifty3m = (nd.at(-1)! / nd[nd.length - 64] - 1) * 100
  const f = i.fund!
  return {
    sym, name: i.name, sector: i.sector, fno: i.fno, ltp: q.ltp, chg: (q.ltp / q.prev - 1) * 100, gap: (q.open / q.prev - 1) * 100, volx: q.vol / q.avgVol * (6.25 * 3600) / Math.max(secondsIntoSession(), 1800),
    rsi: rsiSeries(c).at(-1)!, ema20: e20, ema50: e50, ema200: e200, above20: (q.ltp / e20 - 1) * 100, above50: (q.ltp / e50 - 1) * 100, above200: (q.ltp / e200 - 1) * 100,
    hi52, lo52, fromHi52: (q.ltp / hi52 - 1) * 100, fromLo52: (q.ltp / lo52 - 1) * 100, brk20: (q.ltp / prev20 - 1) * 100,
    nr7: ranges.at(-1)! <= Math.min(...ranges) ? 1 : 0, atrp: atr(d).at(-1)! / q.ltp * 100,
    r1w: ret(5), r1m: ret(21), r3m: ret(63), r1y: ret(250), rs: ret(63) - nifty3m,
    mcap: f.mcap, pe: f.pe, pb: f.pb, roe: f.roe, de: f.de, div: f.div, epsG: f.epsG, salesG: f.salesG,
  }
}
/** Simulated session clock: treat the market as 3 hours into the day so volume ratios read sensibly. */
const secondsIntoSession = () => 3 * 3600

export function allMetrics() { return INSTS.filter((i) => i.seg === 'EQ').map((i) => metricsFor(i.sym)!).filter(Boolean) }

/** Columns the scanner (and the AI) can filter on, with plain-language labels and units. */
export const FIELDS: Record<string, { label: string; unit?: '%' | '₹' | 'x' | 'cr' | ''; kind: 'num' | 'text' | 'bool' }> = {
  ltp: { label: 'Price', unit: '₹', kind: 'num' }, chg: { label: 'Change today', unit: '%', kind: 'num' }, gap: { label: 'Gap at open', unit: '%', kind: 'num' },
  volx: { label: 'Volume vs 20-day average', unit: 'x', kind: 'num' }, rsi: { label: 'RSI (14)', kind: 'num' },
  above20: { label: 'Distance from 20 EMA', unit: '%', kind: 'num' }, above50: { label: 'Distance from 50 EMA', unit: '%', kind: 'num' }, above200: { label: 'Distance from 200 EMA', unit: '%', kind: 'num' },
  fromHi52: { label: 'From 52-week high', unit: '%', kind: 'num' }, fromLo52: { label: 'From 52-week low', unit: '%', kind: 'num' }, brk20: { label: 'Above 20-day high', unit: '%', kind: 'num' },
  nr7: { label: 'Narrowest range in 7 days', kind: 'bool' }, atrp: { label: 'ATR', unit: '%', kind: 'num' },
  r1w: { label: '1-week return', unit: '%', kind: 'num' }, r1m: { label: '1-month return', unit: '%', kind: 'num' }, r3m: { label: '3-month return', unit: '%', kind: 'num' }, r1y: { label: '1-year return', unit: '%', kind: 'num' },
  rs: { label: 'Relative strength vs Nifty (3m)', unit: '%', kind: 'num' },
  mcap: { label: 'Market cap', unit: 'cr', kind: 'num' }, pe: { label: 'P/E', kind: 'num' }, pb: { label: 'P/B', kind: 'num' }, roe: { label: 'ROE', unit: '%', kind: 'num' },
  de: { label: 'Debt to equity', kind: 'num' }, div: { label: 'Dividend yield', unit: '%', kind: 'num' }, epsG: { label: 'EPS growth', unit: '%', kind: 'num' }, salesG: { label: 'Sales growth', unit: '%', kind: 'num' },
  sector: { label: 'Sector', kind: 'text' }, fno: { label: 'In F&O', kind: 'bool' },
}

export function applyFilters(rows: Metrics[], fs: Filter[]) {
  return rows.filter((r) => fs.every((f) => {
    const v = (r as unknown as Record<string, number | string | boolean>)[f.field]
    if (v === undefined) return true
    if (f.op === 'in') return (Array.isArray(f.value) ? f.value : [f.value]).map(String).map((x) => x.toLowerCase()).includes(String(v).toLowerCase())
    if (f.op === '=') return String(v).toLowerCase() === String(f.value).toLowerCase() || (typeof v === 'boolean' && (v ? 1 : 0) === Number(f.value))
    const a = Number(v), b = Number(f.value)
    return f.op === '>' ? a > b : f.op === '<' ? a < b : f.op === '>=' ? a >= b : a <= b
  }))
}

export const describeFilter = (f: Filter) => {
  const m = FIELDS[f.field]; if (!m) return `${f.field} ${f.op} ${f.value}`
  if (m.kind === 'bool') return Number(f.value) ? m.label : `Not ${m.label.toLowerCase()}`
  if (f.op === 'in') return `${m.label}: ${(Array.isArray(f.value) ? f.value : [f.value]).join(', ')}`
  const op = { '>': 'above', '<': 'below', '>=': 'at least', '<=': 'at most', '=': 'equals' }[f.op]
  const unit = m.unit === '%' ? '%' : m.unit === 'x' ? '×' : m.unit === 'cr' ? ' cr' : ''
  return `${m.label} ${op} ${m.unit === '₹' ? '₹' : ''}${f.value}${unit}`
}

/** Ready-made scans that traders run daily, grouped by who uses them. */
export const PRESETS: { id: string; name: string; group: 'Intraday' | 'Swing' | 'Investing'; desc: string; filters: Filter[]; sort: string }[] = [
  { id: 'vol', name: 'Volume shockers', group: 'Intraday', desc: 'Trading at 2× or more of normal volume', filters: [{ field: 'volx', op: '>=', value: 2 }], sort: 'volx' },
  { id: 'gapup', name: 'Gap up', group: 'Intraday', desc: 'Opened 1% or more above yesterday’s close', filters: [{ field: 'gap', op: '>=', value: 1 }], sort: 'gap' },
  { id: 'gapdn', name: 'Gap down', group: 'Intraday', desc: 'Opened 1% or more below yesterday’s close', filters: [{ field: 'gap', op: '<=', value: -1 }], sort: 'gap' },
  { id: 'gainers', name: 'Top gainers', group: 'Intraday', desc: 'Up 1.5% or more today', filters: [{ field: 'chg', op: '>=', value: 1.5 }], sort: 'chg' },
  { id: 'hi52', name: 'Near 52-week high', group: 'Swing', desc: 'Within 3% of the 52-week high', filters: [{ field: 'fromHi52', op: '>=', value: -3 }], sort: 'fromHi52' },
  { id: 'brk20', name: '20-day breakout', group: 'Swing', desc: 'Price above the highest high of the last 20 days', filters: [{ field: 'brk20', op: '>', value: 0 }], sort: 'brk20' },
  { id: 'trend', name: 'Strong uptrend', group: 'Swing', desc: 'Above 20, 50 and 200 EMA with RSI over 55', filters: [{ field: 'above20', op: '>', value: 0 }, { field: 'above50', op: '>', value: 0 }, { field: 'above200', op: '>', value: 0 }, { field: 'rsi', op: '>', value: 55 }], sort: 'rs' },
  { id: 'pullback', name: 'Pullback to 20 EMA', group: 'Swing', desc: 'Uptrend above 200 EMA, now within 1.5% of the 20 EMA', filters: [{ field: 'above200', op: '>', value: 0 }, { field: 'above20', op: '>=', value: -1.5 }, { field: 'above20', op: '<=', value: 1.5 }], sort: 'rs' },
  { id: 'oversold', name: 'RSI oversold', group: 'Swing', desc: 'RSI(14) below 35', filters: [{ field: 'rsi', op: '<', value: 35 }], sort: 'rsi' },
  { id: 'nr7', name: 'NR7 squeeze', group: 'Swing', desc: 'Narrowest daily range in 7 days, often before a big move', filters: [{ field: 'nr7', op: '=', value: 1 }], sort: 'atrp' },
  { id: 'rs', name: 'Outperforming Nifty', group: 'Swing', desc: 'Beat Nifty by 5% or more over 3 months', filters: [{ field: 'rs', op: '>=', value: 5 }], sort: 'rs' },
  { id: 'quality', name: 'Quality at fair price', group: 'Investing', desc: 'ROE over 18%, low debt, P/E under 35', filters: [{ field: 'roe', op: '>', value: 18 }, { field: 'de', op: '<', value: 0.5 }, { field: 'pe', op: '<', value: 35 }], sort: 'roe' },
  { id: 'growth', name: 'Fast growers', group: 'Investing', desc: 'EPS and sales both growing over 15%', filters: [{ field: 'epsG', op: '>', value: 15 }, { field: 'salesG', op: '>', value: 15 }], sort: 'epsG' },
  { id: 'value', name: 'Value and dividends', group: 'Investing', desc: 'P/E under 15 and dividend yield over 2%', filters: [{ field: 'pe', op: '<', value: 15 }, { field: 'div', op: '>', value: 2 }], sort: 'div' },
  { id: 'lo52', name: 'Near 52-week low', group: 'Investing', desc: 'Within 10% of the 52-week low', filters: [{ field: 'fromLo52', op: '<=', value: 10 }], sort: 'fromLo52' },
]
