import type { Candle } from '../market'

export type IndParam = { key: string; label: string; def: number; min?: number; max?: number; step?: number }
/** colors are CSS custom property NAMES like '--chart-1', '--success', '--danger', '--chart-neutral', '--fg-subtle' — never hex. */
export type Plot = { key: string; label: string; values: number[]; color: string; kind: 'line' | 'histogram' | 'dots'; dashed?: boolean; width?: 1 | 2; colors?: (string | undefined)[] }
export type IndCategory = 'Trend' | 'Momentum' | 'Volatility' | 'Volume'
export type IndDef = { type: string; name: string; short: string; category: IndCategory; desc: string; overlay: boolean; ownScale?: boolean; params: IndParam[]; levels?: number[]; range?: [number, number]; compute: (c: Candle[], p: Record<string, number>) => Plot[] }
export type IndInstance = { id: string; type: string; params: Record<string, number>; color?: string; visible: boolean }

/* ------------------------------------------------------------------ */
/* Math helpers — all return arrays the same length as input, NaN for  */
/* warm-up. Inputs may have leading NaNs (e.g. an EMA of an EMA); the  */
/* helpers start from the first finite value.                          */
/* ------------------------------------------------------------------ */

const nanArr = (n: number) => new Array<number>(n).fill(NaN)
const firstFinite = (a: number[]) => { for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i])) return i; return a.length }
const len = (v: number | undefined, d: number) => Math.max(1, Math.round(Number.isFinite(v) ? (v as number) : d))

function sma(a: number[], n: number): number[] {
  const out = nanArr(a.length), s = firstFinite(a)
  let sum = 0
  for (let i = s; i < a.length; i++) {
    sum += a[i]
    if (i - s >= n) sum -= a[i - n]
    if (i - s + 1 >= n) out[i] = sum / n
  }
  return out
}

/** Exponential MA, seeded with the SMA of the first n values (TradingView-style). */
function emaK(a: number[], n: number, k: number): number[] {
  const out = nanArr(a.length), s = firstFinite(a)
  if (a.length - s < n) return out
  let v = 0
  for (let i = s; i < s + n; i++) v += a[i]
  v /= n
  out[s + n - 1] = v
  for (let i = s + n; i < a.length; i++) { v = a[i] * k + v * (1 - k); out[i] = v }
  return out
}
const ema = (a: number[], n: number) => emaK(a, n, 2 / (n + 1))
/** Wilder's smoothing (RMA). */
const rma = (a: number[], n: number) => emaK(a, n, 1 / n)

/** Linearly weighted MA in O(n). */
function wma(a: number[], n: number): number[] {
  const out = nanArr(a.length), s = firstFinite(a)
  const denom = (n * (n + 1)) / 2
  let sum = 0, wsum = 0
  for (let i = s; i < a.length; i++) {
    const k = i - s
    if (k < n) { sum += a[i]; wsum += (k + 1) * a[i] }
    else { wsum = wsum + n * a[i] - sum; sum = sum + a[i] - a[i - n] }
    if (k + 1 >= n) out[i] = wsum / denom
  }
  return out
}

/** Population standard deviation over a rolling window. */
function stdev(a: number[], n: number): number[] {
  const out = nanArr(a.length), s = firstFinite(a)
  let sum = 0, sq = 0
  for (let i = s; i < a.length; i++) {
    sum += a[i]; sq += a[i] * a[i]
    if (i - s >= n) { sum -= a[i - n]; sq -= a[i - n] * a[i - n] }
    if (i - s + 1 >= n) { const m = sum / n; out[i] = Math.sqrt(Math.max(0, sq / n - m * m)) }
  }
  return out
}

/** Rolling max (dir=1) / min (dir=-1) via monotonic deque, O(n). */
function rolling(a: number[], n: number, dir: 1 | -1): number[] {
  const out = nanArr(a.length), dq: number[] = []
  let head = 0
  for (let i = 0; i < a.length; i++) {
    while (dq.length > head && (a[dq[dq.length - 1]] - a[i]) * dir <= 0) dq.pop()
    dq.push(i)
    if (dq[head] <= i - n) head++
    if (i + 1 >= n) out[i] = a[dq[head]]
  }
  return out
}
const highest = (a: number[], n: number) => rolling(a, n, 1)
const lowest = (a: number[], n: number) => rolling(a, n, -1)

function trueRange(c: Candle[]): number[] {
  return c.map((x, i) => (i ? Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)) : x.high - x.low))
}
const atrArr = (c: Candle[], n: number) => rma(trueRange(c), n)

const closes = (c: Candle[]) => c.map((x) => x.close)
const highs = (c: Candle[]) => c.map((x) => x.high)
const lows = (c: Candle[]) => c.map((x) => x.low)
const typical = (c: Candle[]) => c.map((x) => (x.high + x.low + x.close) / 3)

const line = (key: string, label: string, values: number[], color: string, extra: Partial<Plot> = {}): Plot => ({ key, label, values, color, kind: 'line', ...extra })

/* ------------------------------------------------------------------ */
/* Indicator computations                                              */
/* ------------------------------------------------------------------ */

function vwapCalc(c: Candle[]): number[] {
  let pv = 0, vv = 0, day = NaN
  return c.map((x) => {
    const d = Math.floor((x.time + 19800) / 86400)
    if (d !== day) { day = d; pv = 0; vv = 0 }
    const tp = (x.high + x.low + x.close) / 3
    pv += tp * x.volume; vv += x.volume
    return vv > 0 ? pv / vv : tp
  })
}

function supertrendCalc(c: Candle[], n: number, f: number) {
  const atr = atrArr(c, n)
  const values = nanArr(c.length), colors: (string | undefined)[] = new Array(c.length).fill(undefined)
  let upPrev = NaN, dnPrev = NaN, trend = 1
  for (let i = 0; i < c.length; i++) {
    if (!Number.isFinite(atr[i])) continue
    const hl2 = (c[i].high + c[i].low) / 2
    let up = hl2 - f * atr[i], dn = hl2 + f * atr[i]
    const pc = i ? c[i - 1].close : c[i].close
    if (Number.isFinite(upPrev) && pc > upPrev) up = Math.max(up, upPrev)
    if (Number.isFinite(dnPrev) && pc < dnPrev) dn = Math.min(dn, dnPrev)
    if (Number.isFinite(upPrev)) {
      if (trend === -1 && c[i].close > dnPrev) trend = 1
      else if (trend === 1 && c[i].close < upPrev) trend = -1
    }
    values[i] = trend === 1 ? up : dn
    colors[i] = trend === 1 ? '--success' : '--danger'
    upPrev = up; dnPrev = dn
  }
  return { values, colors }
}

function psarCalc(c: Candle[], start: number, inc: number, max: number): number[] {
  const out = nanArr(c.length)
  if (c.length < 2) return out
  let up = c[1].close >= c[0].close
  let sar = up ? c[0].low : c[0].high
  let ep = up ? c[0].high : c[0].low
  let af = start
  for (let i = 1; i < c.length; i++) {
    const x = c[i]
    let next = sar + af * (ep - sar)
    if (up) {
      next = Math.min(next, c[i - 1].low, i > 1 ? c[i - 2].low : c[i - 1].low)
      if (x.low < next) { up = false; next = ep; ep = x.low; af = start }
      else if (x.high > ep) { ep = x.high; af = Math.min(af + inc, max) }
    } else {
      next = Math.max(next, c[i - 1].high, i > 1 ? c[i - 2].high : c[i - 1].high)
      if (x.high > next) { up = true; next = ep; ep = x.high; af = start }
      else if (x.low < ep) { ep = x.low; af = Math.min(af + inc, max) }
    }
    sar = next
    out[i] = sar
  }
  return out
}

function rsiCalc(src: number[], n: number): number[] {
  const g = nanArr(src.length), l = nanArr(src.length)
  for (let i = 1; i < src.length; i++) { const d = src[i] - src[i - 1]; g[i] = Math.max(d, 0); l[i] = Math.max(-d, 0) }
  const ag = rma(g, n), al = rma(l, n)
  return ag.map((u, i) => {
    const d = al[i]
    if (!Number.isFinite(u) || !Number.isFinite(d)) return NaN
    if (d === 0) return u === 0 ? 50 : 100
    return 100 - 100 / (1 + u / d)
  })
}

function adxCalc(c: Candle[], n: number) {
  const N = c.length, pdm = nanArr(N), mdm = nanArr(N), tr = nanArr(N)
  for (let i = 1; i < N; i++) {
    const upMove = c[i].high - c[i - 1].high, downMove = c[i - 1].low - c[i].low
    pdm[i] = upMove > downMove && upMove > 0 ? upMove : 0
    mdm[i] = downMove > upMove && downMove > 0 ? downMove : 0
    tr[i] = Math.max(c[i].high - c[i].low, Math.abs(c[i].high - c[i - 1].close), Math.abs(c[i].low - c[i - 1].close))
  }
  const str = rma(tr, n), sp = rma(pdm, n), sm = rma(mdm, n)
  const pdi = str.map((t, i) => (t > 0 ? (100 * sp[i]) / t : Number.isFinite(t) ? 0 : NaN))
  const mdi = str.map((t, i) => (t > 0 ? (100 * sm[i]) / t : Number.isFinite(t) ? 0 : NaN))
  const dx = pdi.map((p, i) => { const s = p + mdi[i]; return Number.isFinite(s) ? (s === 0 ? 0 : (100 * Math.abs(p - mdi[i])) / s) : NaN })
  return { adx: rma(dx, n), pdi, mdi }
}

function cciCalc(c: Candle[], n: number): number[] {
  const tp = typical(c), ma = sma(tp, n), out = nanArr(c.length)
  for (let i = n - 1; i < c.length; i++) {
    let md = 0
    for (let j = i - n + 1; j <= i; j++) md += Math.abs(tp[j] - ma[i])
    md /= n
    out[i] = md === 0 ? 0 : (tp[i] - ma[i]) / (0.015 * md)
  }
  return out
}

function obvCalc(c: Candle[]): number[] {
  let v = 0
  return c.map((x, i) => {
    if (i) { const p = c[i - 1].close; if (x.close > p) v += x.volume; else if (x.close < p) v -= x.volume }
    return v
  })
}

function mfiCalc(c: Candle[], n: number): number[] {
  const tp = typical(c), out = nanArr(c.length)
  const pos = new Array<number>(c.length).fill(0), neg = new Array<number>(c.length).fill(0)
  for (let i = 1; i < c.length; i++) {
    const mf = tp[i] * c[i].volume
    if (tp[i] > tp[i - 1]) pos[i] = mf
    else if (tp[i] < tp[i - 1]) neg[i] = mf
  }
  let sp = 0, sn = 0
  for (let i = 1; i < c.length; i++) {
    sp += pos[i]; sn += neg[i]
    if (i > n) { sp -= pos[i - n]; sn -= neg[i - n] }
    if (i >= n) out[i] = sn === 0 ? (sp === 0 ? 50 : 100) : 100 - 100 / (1 + sp / sn)
  }
  return out
}

/* ------------------------------------------------------------------ */
/* Definitions                                                         */
/* ------------------------------------------------------------------ */

const P = (key: string, label: string, def: number, min = 1, max = 500, step = 1): IndParam => ({ key, label, def, min, max, step })
const LEN = (def: number) => P('length', 'Length', def)

export const INDICATOR_DEFS: IndDef[] = [
  /* ---------------- Overlays ---------------- */
  {
    type: 'sma', name: 'Simple Moving Average', short: 'SMA', category: 'Trend', overlay: true,
    desc: 'Plain average of recent closes — smooths noise to show the underlying trend direction.',
    params: [LEN(20)],
    compute: (c, p) => [line('sma', 'SMA', sma(closes(c), len(p.length, 20)), '--chart-1')],
  },
  {
    type: 'ema', name: 'Exponential Moving Average', short: 'EMA', category: 'Trend', overlay: true,
    desc: 'Moving average weighted toward recent bars — reacts faster to trend changes than an SMA.',
    params: [LEN(20)],
    compute: (c, p) => [line('ema', 'EMA', ema(closes(c), len(p.length, 20)), '--chart-2')],
  },
  {
    type: 'wma', name: 'Weighted Moving Average', short: 'WMA', category: 'Trend', overlay: true,
    desc: 'Linearly weighted average of closes — a middle ground between SMA smoothness and EMA speed.',
    params: [LEN(20)],
    compute: (c, p) => [line('wma', 'WMA', wma(closes(c), len(p.length, 20)), '--chart-3')],
  },
  {
    type: 'vwap', name: 'Volume Weighted Average Price', short: 'VWAP', category: 'Volume', overlay: true,
    desc: 'Average price weighted by volume since the session open — the intraday fair-value benchmark.',
    params: [],
    compute: (c) => [line('vwap', 'VWAP', vwapCalc(c), '--chart-4', { width: 2 })],
  },
  {
    type: 'bb', name: 'Bollinger Bands', short: 'BB', category: 'Volatility', overlay: true,
    desc: 'Bands two standard deviations around an SMA — spot squeezes, breakouts and stretched moves.',
    params: [LEN(20), P('mult', 'StdDev', 2, 0.1, 10, 0.1)],
    compute: (c, p) => {
      const n = len(p.length, 20), m = Number.isFinite(p.mult) ? p.mult : 2, src = closes(c)
      const basis = sma(src, n), sd = stdev(src, n)
      return [
        line('upper', 'Upper', basis.map((b, i) => b + m * sd[i]), '--chart-1', { dashed: true }),
        line('basis', 'Basis', basis, '--chart-neutral'),
        line('lower', 'Lower', basis.map((b, i) => b - m * sd[i]), '--chart-1', { dashed: true }),
      ]
    },
  },
  {
    type: 'supertrend', name: 'SuperTrend', short: 'ST', category: 'Trend', overlay: true,
    desc: 'ATR-based trailing line that flips green/red with the trend — popular for stop-loss and trend filters.',
    params: [P('atrLength', 'ATR Length', 10), P('factor', 'Factor', 3, 0.1, 20, 0.1)],
    compute: (c, p) => {
      const { values, colors } = supertrendCalc(c, len(p.atrLength, 10), Number.isFinite(p.factor) ? p.factor : 3)
      return [{ key: 'st', label: 'SuperTrend', values, color: '--success', kind: 'line', width: 2, colors }]
    },
  },
  {
    type: 'kc', name: 'Keltner Channels', short: 'KC', category: 'Volatility', overlay: true,
    desc: 'EMA with ATR-based bands — trend-following channel; closes outside hint at momentum breakouts.',
    params: [LEN(20), P('mult', 'Multiplier', 2, 0.1, 10, 0.1)],
    compute: (c, p) => {
      const n = len(p.length, 20), m = Number.isFinite(p.mult) ? p.mult : 2
      const basis = ema(closes(c), n), atr = atrArr(c, n)
      return [
        line('upper', 'Upper', basis.map((b, i) => b + m * atr[i]), '--chart-5'),
        line('basis', 'Basis', basis, '--chart-neutral', { dashed: true }),
        line('lower', 'Lower', basis.map((b, i) => b - m * atr[i]), '--chart-5'),
      ]
    },
  },
  {
    type: 'dc', name: 'Donchian Channels', short: 'DC', category: 'Volatility', overlay: true,
    desc: 'Highest high and lowest low over N bars — classic breakout levels used by turtle traders.',
    params: [LEN(20)],
    compute: (c, p) => {
      const n = len(p.length, 20), up = highest(highs(c), n), lo = lowest(lows(c), n)
      return [
        line('upper', 'Upper', up, '--chart-3'),
        line('lower', 'Lower', lo, '--chart-3'),
        line('basis', 'Basis', up.map((u, i) => (u + lo[i]) / 2), '--chart-neutral', { dashed: true }),
      ]
    },
  },
  {
    type: 'psar', name: 'Parabolic SAR', short: 'SAR', category: 'Trend', overlay: true,
    desc: 'Dots that trail price and flip sides on reversals — used for trailing stops and trend direction.',
    params: [P('start', 'Start', 0.02, 0.001, 1, 0.001), P('increment', 'Increment', 0.02, 0.001, 1, 0.001), P('max', 'Max', 0.2, 0.01, 1, 0.01)],
    compute: (c, p) => [{
      key: 'sar', label: 'SAR', kind: 'dots', color: '--chart-1',
      values: psarCalc(c, Number.isFinite(p.start) ? p.start : 0.02, Number.isFinite(p.increment) ? p.increment : 0.02, Number.isFinite(p.max) ? p.max : 0.2),
    }],
  },
  {
    type: 'volume', name: 'Volume', short: 'Vol', category: 'Volume', overlay: true, ownScale: true,
    desc: 'Shares traded per bar with an average — confirms the strength behind price moves.',
    params: [P('length', 'MA Length', 20)],
    compute: (c, p) => {
      const vol = c.map((x) => x.volume)
      return [
        { key: 'vol', label: 'Volume', values: vol, color: '--chart-neutral', kind: 'histogram', colors: c.map((x) => (x.close >= x.open ? '--success' : '--danger')) },
        line('ma', 'MA', sma(vol, len(p.length, 20)), '--chart-1'),
      ]
    },
  },

  /* ---------------- Panes ---------------- */
  {
    type: 'rsi', name: 'Relative Strength Index', short: 'RSI', category: 'Momentum', overlay: false,
    desc: 'Momentum oscillator from 0–100 — above 70 overbought, below 30 oversold; watch for divergences.',
    params: [LEN(14)], levels: [70, 30], range: [0, 100],
    compute: (c, p) => [line('rsi', 'RSI', rsiCalc(closes(c), len(p.length, 14)), '--chart-5')],
  },
  {
    type: 'macd', name: 'MACD', short: 'MACD', category: 'Momentum', overlay: false,
    desc: 'Difference of fast and slow EMAs with a signal line — crossovers flag momentum shifts.',
    params: [P('fast', 'Fast', 12), P('slow', 'Slow', 26), P('signal', 'Signal', 9)],
    compute: (c, p) => {
      const src = closes(c), f = ema(src, len(p.fast, 12)), s = ema(src, len(p.slow, 26))
      const macd = f.map((v, i) => v - s[i])
      const sig = ema(macd, len(p.signal, 9))
      const hist = macd.map((v, i) => v - sig[i])
      return [
        { key: 'hist', label: 'Histogram', values: hist, color: '--chart-neutral', kind: 'histogram', colors: hist.map((h) => (Number.isFinite(h) ? (h >= 0 ? '--success' : '--danger') : undefined)) },
        line('macd', 'MACD', macd, '--chart-1'),
        line('signal', 'Signal', sig, '--chart-2'),
      ]
    },
  },
  {
    type: 'stoch', name: 'Stochastic', short: 'Stoch', category: 'Momentum', overlay: false,
    desc: 'Where the close sits within the recent high–low range — overbought above 80, oversold below 20.',
    params: [P('k', '%K Length', 14), P('d', '%D Smoothing', 3), P('smooth', '%K Smoothing', 3)], levels: [80, 20], range: [0, 100],
    compute: (c, p) => {
      const n = len(p.k, 14), hh = highest(highs(c), n), ll = lowest(lows(c), n)
      const raw = c.map((x, i) => { const r = hh[i] - ll[i]; return Number.isFinite(r) ? (r === 0 ? 50 : (100 * (x.close - ll[i])) / r) : NaN })
      const k = sma(raw, len(p.smooth, 3)), d = sma(k, len(p.d, 3))
      return [line('k', '%K', k, '--chart-1'), line('d', '%D', d, '--chart-2')]
    },
  },
  {
    type: 'atr', name: 'Average True Range', short: 'ATR', category: 'Volatility', overlay: false,
    desc: 'Average bar range including gaps — sizes stops and positions to current volatility.',
    params: [LEN(14)],
    compute: (c, p) => [line('atr', 'ATR', atrArr(c, len(p.length, 14)), '--chart-3')],
  },
  {
    type: 'adx', name: 'Average Directional Index', short: 'ADX', category: 'Trend', overlay: false,
    desc: 'Measures trend strength (not direction) — above 25 suggests a trending market; DI lines show bias.',
    params: [LEN(14)], levels: [25],
    compute: (c, p) => {
      const { adx, pdi, mdi } = adxCalc(c, len(p.length, 14))
      return [line('adx', 'ADX', adx, '--chart-5', { width: 2 }), line('pdi', '+DI', pdi, '--success'), line('mdi', '−DI', mdi, '--danger')]
    },
  },
  {
    type: 'cci', name: 'Commodity Channel Index', short: 'CCI', category: 'Momentum', overlay: false,
    desc: 'Deviation of price from its average — beyond ±100 signals strong moves or stretched extremes.',
    params: [LEN(20)], levels: [100, -100],
    compute: (c, p) => [line('cci', 'CCI', cciCalc(c, len(p.length, 20)), '--chart-4')],
  },
  {
    type: 'obv', name: 'On Balance Volume', short: 'OBV', category: 'Volume', overlay: false,
    desc: 'Running total of up-volume minus down-volume — rising OBV confirms accumulation behind a move.',
    params: [],
    compute: (c) => [line('obv', 'OBV', obvCalc(c), '--chart-1')],
  },
  {
    type: 'willr', name: 'Williams %R', short: '%R', category: 'Momentum', overlay: false,
    desc: 'Close relative to the recent high–low range on a 0 to −100 scale — above −20 overbought, below −80 oversold.',
    params: [LEN(14)], levels: [-20, -80], range: [-100, 0],
    compute: (c, p) => {
      const n = len(p.length, 14), hh = highest(highs(c), n), ll = lowest(lows(c), n)
      return [line('wr', '%R', c.map((x, i) => { const r = hh[i] - ll[i]; return Number.isFinite(r) ? (r === 0 ? -50 : (-100 * (hh[i] - x.close)) / r) : NaN }), '--chart-2')]
    },
  },
  {
    type: 'mfi', name: 'Money Flow Index', short: 'MFI', category: 'Volume', overlay: false,
    desc: 'Volume-weighted RSI — above 80 overbought, below 20 oversold, with volume confirming pressure.',
    params: [LEN(14)], levels: [80, 20], range: [0, 100],
    compute: (c, p) => [line('mfi', 'MFI', mfiCalc(c, len(p.length, 14)), '--chart-3')],
  },
]

const DEF_MAP = new Map(INDICATOR_DEFS.map((d) => [d.type, d]))
export const indDef = (type: string): IndDef | undefined => DEF_MAP.get(type)

const rid = () => Math.random().toString(36).slice(2, 10)

export const newInstance = (type: string, params: Record<string, number> = {}): IndInstance => {
  const defaults: Record<string, number> = {}
  for (const p of indDef(type)?.params ?? []) defaults[p.key] = p.def
  return { id: rid(), type, params: { ...defaults, ...params }, visible: true }
}

export const DEFAULT_INDICATORS: IndInstance[] = [newInstance('vwap'), newInstance('ema', { length: 20 }), newInstance('volume')]

const SRC_CLOSE = new Set(['sma', 'ema', 'wma'])
const fmt = (v: number) => (Number.isInteger(v) ? String(v) : String(+v.toFixed(4)))

/** Legend title like "EMA 20 close", "RSI 14", "BB 20 2", "MACD 12 26 9" */
export const instanceTitle = (i: IndInstance): string => {
  const d = indDef(i.type)
  if (!d) return i.type.toUpperCase()
  const parts = [d.short, ...d.params.map((p) => fmt(i.params[p.key] ?? p.def))]
  if (SRC_CLOSE.has(d.type)) parts.push('close')
  return parts.join(' ')
}
