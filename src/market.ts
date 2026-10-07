// Simulated NSE market: instruments, tick engine, Black-Scholes, option chain.
export type Fund = { mcap: number; pe: number; pb: number; roe: number; de: number; div: number; epsG: number; salesG: number }
export type Inst = { sym: string; name: string; seg: 'IDX' | 'EQ'; base: number; vol: number; lot: number; step: number; sector: string; fno: boolean; fund?: Fund }

// [sym, name, sector, price, annual vol, F&O lot (0 = cash only), strike step, mcap ₹cr, PE, PB, ROE%, D/E, div%, EPS growth%, sales growth%]
type Row = [string, string, string, number, number, number, number, number, number, number, number, number, number, number, number]
const ROWS: Row[] = [
  ['RELIANCE', 'Reliance Industries', 'Energy', 1425, 0.22, 500, 10, 1928000, 24.1, 2.3, 9.2, 0.42, 0.4, 8, 7],
  ['TCS', 'Tata Consultancy Services', 'IT', 3120, 0.2, 175, 20, 1129000, 23.4, 12.1, 51.2, 0.08, 3.9, 6, 5],
  ['HDFCBANK', 'HDFC Bank', 'Banks', 1960, 0.18, 550, 10, 1501000, 20.8, 2.9, 14.6, 0, 1.1, 11, 16],
  ['ICICIBANK', 'ICICI Bank', 'Banks', 1430, 0.2, 700, 10, 1021000, 19.6, 3.3, 17.8, 0, 0.8, 15, 14],
  ['INFY', 'Infosys', 'IT', 1510, 0.23, 400, 10, 627000, 22.7, 7.0, 30.1, 0.09, 2.9, 7, 6],
  ['SBIN', 'State Bank of India', 'Banks', 865, 0.24, 750, 5, 772000, 9.8, 1.5, 17.2, 0, 1.8, 13, 11],
  ['BHARTIARTL', 'Bharti Airtel', 'Telecom', 1890, 0.2, 475, 10, 1131000, 41.0, 9.4, 24.3, 1.3, 0.4, 62, 19],
  ['ITC', 'ITC', 'FMCG', 415, 0.18, 1600, 5, 519000, 25.2, 7.1, 28.4, 0, 3.4, 4, 9],
  ['LT', 'Larsen & Toubro', 'Capital Goods', 3600, 0.22, 175, 20, 495000, 31.5, 5.3, 16.8, 1.1, 0.8, 14, 15],
  ['HINDUNILVR', 'Hindustan Unilever', 'FMCG', 2480, 0.17, 300, 20, 583000, 54.3, 11.2, 20.6, 0, 1.7, 3, 2],
  ['KOTAKBANK', 'Kotak Mahindra Bank', 'Banks', 2050, 0.2, 400, 10, 408000, 18.9, 2.6, 13.9, 0, 0.1, 9, 12],
  ['AXISBANK', 'Axis Bank', 'Banks', 1180, 0.23, 625, 10, 365000, 13.1, 2.0, 16.1, 0, 0.1, 6, 10],
  ['BAJFINANCE', 'Bajaj Finance', 'Financials', 975, 0.27, 750, 10, 605000, 33.8, 6.0, 19.4, 3.7, 0.4, 17, 25],
  ['MARUTI', 'Maruti Suzuki', 'Auto', 15900, 0.21, 50, 100, 500000, 29.7, 4.6, 15.8, 0, 0.8, 9, 8],
  ['M&M', 'Mahindra & Mahindra', 'Auto', 3550, 0.24, 200, 20, 441000, 29.0, 5.4, 19.9, 1.4, 0.6, 21, 17],
  ['TATAMOTORS', 'Tata Motors', 'Auto', 690, 0.3, 800, 5, 254000, 9.2, 2.3, 26.1, 1.1, 0.9, -12, 3],
  ['SUNPHARMA', 'Sun Pharmaceutical', 'Pharma', 1640, 0.19, 350, 10, 393000, 35.1, 5.5, 16.4, 0.02, 0.8, 13, 9],
  ['DRREDDY', "Dr. Reddy's Labs", 'Pharma', 1255, 0.21, 625, 10, 105000, 18.6, 3.2, 18.9, 0.06, 0.6, 2, 15],
  ['CIPLA', 'Cipla', 'Pharma', 1510, 0.2, 375, 10, 122000, 23.0, 3.9, 17.1, 0.01, 1.0, 20, 7],
  ['HCLTECH', 'HCL Technologies', 'IT', 1460, 0.22, 350, 10, 396000, 23.3, 5.9, 25.0, 0.07, 3.7, 8, 6],
  ['WIPRO', 'Wipro', 'IT', 248, 0.23, 3000, 2.5, 260000, 19.4, 3.1, 16.0, 0.22, 2.4, 12, 1],
  ['TECHM', 'Tech Mahindra', 'IT', 1480, 0.26, 600, 10, 145000, 32.0, 5.0, 15.7, 0.08, 3.0, 25, 2],
  ['ASIANPAINT', 'Asian Paints', 'Consumer', 2420, 0.2, 250, 20, 232000, 59.8, 11.8, 20.1, 0.11, 1.0, -15, -2],
  ['TITAN', 'Titan Company', 'Consumer', 3420, 0.22, 175, 20, 304000, 81.5, 25.2, 31.0, 1.2, 0.3, 14, 22],
  ['ULTRACEMCO', 'UltraTech Cement', 'Cement', 12150, 0.21, 50, 100, 358000, 50.2, 5.1, 10.3, 0.3, 0.6, 5, 9],
  ['NTPC', 'NTPC', 'Power', 340, 0.21, 1500, 5, 330000, 14.0, 1.8, 13.1, 1.4, 2.4, 9, 6],
  ['POWERGRID', 'Power Grid Corp', 'Power', 288, 0.19, 1900, 5, 268000, 17.2, 3.0, 17.9, 1.4, 3.9, 3, 4],
  ['ONGC', 'Oil & Natural Gas Corp', 'Energy', 238, 0.25, 2250, 2.5, 299000, 8.1, 0.9, 11.8, 0.5, 5.1, -9, 2],
  ['COALINDIA', 'Coal India', 'Energy', 385, 0.24, 1350, 5, 237000, 7.4, 2.6, 36.0, 0.1, 6.8, -4, -3],
  ['TATASTEEL', 'Tata Steel', 'Metals', 168, 0.3, 5500, 1, 210000, 46.0, 2.3, 4.9, 1.0, 2.1, 140, -3],
  ['JSWSTEEL', 'JSW Steel', 'Metals', 1095, 0.27, 675, 10, 267000, 57.0, 3.3, 5.8, 1.2, 0.3, 30, 2],
  ['HINDALCO', 'Hindalco Industries', 'Metals', 745, 0.28, 1400, 10, 167000, 10.4, 1.4, 13.9, 0.5, 0.5, 38, 11],
  ['ADANIENT', 'Adani Enterprises', 'Diversified', 2390, 0.38, 300, 20, 276000, 40.1, 5.0, 10.9, 1.6, 0.1, 30, 4],
  ['ADANIPORTS', 'Adani Ports & SEZ', 'Infra', 1420, 0.3, 475, 10, 306000, 27.5, 4.9, 19.0, 0.8, 0.5, 26, 17],
  ['BEL', 'Bharat Electronics', 'Defence', 405, 0.3, 1425, 5, 296000, 52.0, 13.0, 27.8, 0, 0.6, 22, 17],
  ['HAL', 'Hindustan Aeronautics', 'Defence', 4720, 0.32, 150, 50, 316000, 37.6, 9.5, 26.0, 0, 0.8, 10, 8],
  ['TRENT', 'Trent', 'Retail', 5280, 0.34, 100, 50, 188000, 105.0, 30.0, 31.2, 0.4, 0.1, 35, 30],
  ['ZOMATO', 'Eternal (Zomato)', 'Internet', 318, 0.38, 2425, 5, 307000, 310.0, 13.5, 2.1, 0, 0, 40, 64],
  ['DMART', 'Avenue Supermarts', 'Retail', 4250, 0.24, 150, 50, 276000, 88.0, 12.4, 14.2, 0, 0, 6, 16],
  ['IRCTC', 'IRCTC', 'Travel', 742, 0.24, 875, 10, 59300, 46.5, 15.8, 38.0, 0, 1.1, 10, 9],
  ['POLYCAB', 'Polycab India', 'Capital Goods', 7150, 0.3, 125, 50, 107000, 51.0, 11.2, 21.9, 0, 0.5, 33, 26],
  ['DIXON', 'Dixon Technologies', 'Electronics', 16800, 0.4, 50, 100, 101000, 92.0, 30.4, 34.7, 0.1, 0.1, 85, 95],
  ['TATAPOWER', 'Tata Power', 'Power', 395, 0.29, 1450, 5, 126000, 30.4, 3.5, 11.6, 1.4, 0.6, 8, 4],
  ['IRFC', 'Indian Railway Finance', 'Financials', 128, 0.33, 0, 1, 167000, 25.0, 3.1, 12.6, 7.6, 1.2, 2, 3],
  ['SUZLON', 'Suzlon Energy', 'Power', 58, 0.45, 0, 1, 79000, 41.0, 13.0, 33.0, 0.1, 0, 110, 60],
  ['NIFTYBEES', 'Nippon Nifty 50 ETF', 'ETF', 274, 0.13, 0, 1, 42000, 0, 0, 0, 0, 0, 0, 0],
  ['GOLDBEES', 'Nippon Gold ETF', 'ETF', 98, 0.14, 0, 1, 21000, 0, 0, 0, 0, 0, 0, 0],
]

export const INSTS: Inst[] = [
  { sym: 'NIFTY', name: 'Nifty 50', seg: 'IDX', base: 24650, vol: 0.13, lot: 65, step: 50, sector: 'Index', fno: true },
  { sym: 'BANKNIFTY', name: 'Nifty Bank', seg: 'IDX', base: 53200, vol: 0.16, lot: 30, step: 100, sector: 'Index', fno: true },
  { sym: 'FINNIFTY', name: 'Nifty Financial Services', seg: 'IDX', base: 25900, vol: 0.15, lot: 65, step: 50, sector: 'Index', fno: true },
  { sym: 'SENSEX', name: 'BSE Sensex', seg: 'IDX', base: 80700, vol: 0.13, lot: 20, step: 100, sector: 'Index', fno: true },
  ...ROWS.map(([sym, name, sector, base, vol, lot, step, mcap, pe, pb, roe, de, div, epsG, salesG]): Inst =>
    ({ sym, name, seg: 'EQ', base, vol, lot: lot || 1, step, sector, fno: lot > 0, fund: { mcap, pe, pb, roe, de, div, epsG, salesG } })),
]
export const bySym = (s: string) => INSTS.find((i) => i.sym === s.toUpperCase())
export const SECTORS = [...new Set(INSTS.filter((i) => i.seg === 'EQ').map((i) => i.sector))]

export type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number }
export type TF = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '1D' | '1W' | '1M'
export const TF_SEC: Record<TF, number> = { '1m': 60, '3m': 180, '5m': 300, '15m': 900, '30m': 1800, '1h': 3600, '2h': 7200, '4h': 14400, '1D': 86400, '1W': 604800, '1M': 2592000 }
export const TF_LABEL: Record<TF, string> = { '1m': '1 minute', '3m': '3 minutes', '5m': '5 minutes', '15m': '15 minutes', '30m': '30 minutes', '1h': '1 hour', '2h': '2 hours', '4h': '4 hours', '1D': '1 day', '1W': '1 week', '1M': '1 month' }
export const intraday = (tf: TF) => TF_SEC[tf] < 86400

// ---- NSE session clock (IST). Bars exist only 09:15–15:30 on weekdays, like TradingView's NSE charts. ----
export const IST = 19800
const OPEN = 9 * 3600 + 15 * 60, CLOSE = 15 * 3600 + 30 * 60
const dayStart = (t: number) => Math.floor((t + IST) / 86400) * 86400 - IST // IST midnight, as epoch seconds
const isTradingDay = (t: number) => { const wd = new Date((t + IST) * 1000).getUTCDay(); return wd !== 0 && wd !== 6 }
export const inSession = (t: number) => isTradingDay(t) && t - dayStart(t) >= OPEN && t - dayStart(t) < CLOSE
const LOADED = Date.now() / 1000
/**
 * Simulated exchange time. During market hours it is the real time. Outside them the simulator replays a session:
 * it starts at 12:15 on the latest trading day and runs forward in real time, so charts always look like a live NSE day.
 */
export function simNow(): number {
  const real = Date.now() / 1000
  if (inSession(LOADED)) return Math.min(real, dayStart(LOADED) + CLOSE - 1)
  let d = dayStart(LOADED); if (!isTradingDay(d + 43200) || LOADED - d < OPEN) { do d -= 86400; while (!isTradingDay(d + 43200)) }
  return Math.min(d + OPEN + 3 * 3600 + (real - LOADED), d + CLOSE - 1)
}
export const marketOpenNow = () => inSession(Date.now() / 1000)
/** Brokers close intraday (MIS) positions at 3:20 pm IST and stop new intraday entries from then on. */
export const SQUARE_OFF = 15 * 3600 + 20 * 60
/** Seconds since IST midnight of exchange time t. */
export const secOfDay = (t = simNow()) => t - dayStart(t)
/** The trading session a time belongs to, as YYYY-MM-DD in IST. */
export const sessionDay = (t = simNow()) => new Date((dayStart(t) + IST) * 1000).toISOString().slice(0, 10)
/** Calendar date (YYYY-MM-DD) of an expiry label like "13 OCT", picking the year that puts it nearest `near`. */
export function expiryDate(label: string, near: string): string | undefined {
  const m = /^(\d{1,2}) ([A-Z]{3})/.exec(label); if (!m) return undefined
  const mon = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].indexOf(m[2]); if (mon < 0) return undefined
  const ref = Date.parse(near); const y = new Date(ref).getUTCFullYear()
  const best = [y - 1, y, y + 1].map((yy) => Date.UTC(yy, mon, +m[1])).sort((a, b) => Math.abs(a - ref) - Math.abs(b - ref))[0]
  return new Date(best).toISOString().slice(0, 10)
}
/** Start of the bar that contains time t (session-aligned for intraday, IST day/week/month otherwise). */
export function barStart(tf: TF, t: number): number {
  const ds = dayStart(t)
  if (intraday(tf)) { const sec = TF_SEC[tf]; const off = Math.max(0, Math.min(t - ds, CLOSE - 1) - OPEN); return ds + OPEN + Math.floor(off / sec) * sec }
  if (tf === '1D') return ds
  const d = new Date((ds + IST) * 1000)
  if (tf === '1W') return ds - ((d.getUTCDay() + 6) % 7) * 86400
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) / 1000 - IST
}
/** The n bar start times ending with the bar that contains `end`, skipping nights and weekends. */
export function barTimes(tf: TF, n: number, end = simNow()): number[] {
  const out: number[] = []; let t = barStart(tf, end)
  const sec = TF_SEC[tf]
  while (out.length < n) {
    out.push(t)
    if (intraday(tf)) { const ds = dayStart(t); if (t - sec >= ds + OPEN) t -= sec; else { let d = ds - 86400; while (!isTradingDay(d + 43200)) d -= 86400; t = barStart(tf, d + CLOSE - 1) } }
    else if (tf === '1D') { let d = t - 86400; while (!isTradingDay(d + 43200)) d -= 86400; t = d }
    else if (tf === '1W') t -= 7 * 86400
    else { const d = new Date((t + IST) * 1000); t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1) / 1000 - IST }
  }
  return out.reverse()
}
const fmtCache: Record<string, Intl.DateTimeFormat> = {}
/** Format epoch seconds in IST. */
export function fmtIST(t: number, o: Intl.DateTimeFormatOptions) { const k = JSON.stringify(o); return (fmtCache[k] ??= new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', ...o })).format(new Date(t * 1000)) }

function rng(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r())
const hash = (s: string) => s.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

/** Per-stock personality, so scans find a realistic mix of trends, breakouts and laggards. */
export function drift(inst: Inst) { const r = rng(hash(inst.sym) + 99); return (r() - 0.42) * 0.9 }

/**
 * Deterministic OHLCV history that ends exactly at `last` (the live price).
 * Built backwards from the end, so the newest bar always matches the ticker.
 */
export function history(inst: Inst, tf: TF = '5m', n = 300, last = inst.base): Candle[] {
  const r = rng(hash(inst.sym + tf))
  const sec = TF_SEC[tf]
  const yearFrac = tf === '1D' ? 1 / 252 : tf === '1W' ? 1 / 52 : tf === '1M' ? 1 / 12 : sec / (252 * 6.25 * 3600)
  const sig = inst.vol * Math.sqrt(yearFrac) * (intraday(tf) ? 1.6 : 1)
  const mu = drift(inst) * yearFrac
  const closes: number[] = new Array(n); closes[n - 1] = last
  for (let i = n - 1; i > 0; i--) closes[i - 1] = closes[i] / Math.exp(mu + gauss(r) * sig)
  const times = barTimes(tf, n)
  const daily = inst.fund ? Math.max(2e5, 4e10 / inst.base / 40) : 3e6
  const baseVol = intraday(tf) ? daily * sec / 22500 : daily * (tf === '1W' ? 5 : tf === '1M' ? 21 : 1)
  return closes.map((c, i) => {
    const o = i ? closes[i - 1] * (1 + gauss(r) * sig * 0.15) : c
    const h = Math.max(o, c) * (1 + Math.abs(gauss(r)) * sig * 0.35), l = Math.min(o, c) * (1 - Math.abs(gauss(r)) * sig * 0.35)
    const shock = r() < 0.04 ? 2.5 + r() * 2 : 1
    const volume = Math.round(baseVol * (0.6 + r()) * shock * (1 + Math.abs(c - o) / (o * sig + 1e-9) * 0.25))
    return { time: times[i], open: o, high: h, low: l, close: c, volume }
  })
}

// ---- Indicators (pure functions over closes / candles) ----
export const sma = (v: number[], n: number) => v.map((_, i) => (i < n - 1 ? NaN : v.slice(i - n + 1, i + 1).reduce((a, b) => a + b, 0) / n))
export function ema(v: number[], n: number) { const k = 2 / (n + 1); const out: number[] = []; v.forEach((x, i) => out.push(i ? x * k + out[i - 1] * (1 - k) : x)); return out }
export function rsiSeries(v: number[], n = 14) {
  const out: number[] = [NaN]; let g = 0, l = 0
  for (let i = 1; i < v.length; i++) {
    const d = v[i] - v[i - 1]; const up = Math.max(d, 0), dn = Math.max(-d, 0)
    if (i <= n) { g += up / n; l += dn / n } else { g = (g * (n - 1) + up) / n; l = (l * (n - 1) + dn) / n }
    out.push(i < n ? NaN : l === 0 ? 100 : 100 - 100 / (1 + g / l))
  }
  return out
}
export function macd(v: number[]) { const m = ema(v, 12).map((x, i) => x - ema(v, 26)[i]); const s = ema(m, 9); return { macd: m, signal: s, hist: m.map((x, i) => x - s[i]) } }
export function atr(c: Candle[], n = 14) { const tr = c.map((x, i) => (i ? Math.max(x.high - x.low, Math.abs(x.high - c[i - 1].close), Math.abs(x.low - c[i - 1].close)) : x.high - x.low)); return ema(tr, n) }
export function bollinger(v: number[], n = 20, k = 2) { const m = sma(v, n); return v.map((_, i) => { if (i < n - 1) return { mid: NaN, up: NaN, lo: NaN }; const w = v.slice(i - n + 1, i + 1); const sd = Math.sqrt(w.reduce((a, x) => a + (x - m[i]) ** 2, 0) / n); return { mid: m[i], up: m[i] + k * sd, lo: m[i] - k * sd } }) }
export function vwap(c: Candle[]) { let pv = 0, vv = 0, day = -1; return c.map((x) => { const d = Math.floor((x.time + 19800) / 86400); if (d !== day) { day = d; pv = 0; vv = 0 } const tp = (x.high + x.low + x.close) / 3; pv += tp * x.volume; vv += x.volume; return pv / vv }) }
export function supertrend(c: Candle[], n = 10, m = 3) {
  const a = atr(c, n); let up = 0, dn = 0, trend = 1
  return c.map((x, i) => {
    const hl = (x.high + x.low) / 2; const bu = hl - m * a[i], bd = hl + m * a[i]
    if (i === 0) { up = bu; dn = bd; return { v: bu, up: true } }
    up = c[i - 1].close > up ? Math.max(bu, up) : bu; dn = c[i - 1].close < dn ? Math.min(bd, dn) : bd
    if (x.close > dn) trend = 1; else if (x.close < up) trend = -1
    return { v: trend === 1 ? up : dn, up: trend === 1 }
  })
}
/** Classic floor pivots from the previous session's high, low and close. */
export function pivots(h: number, l: number, c: number) { const p = (h + l + c) / 3; return { P: p, R1: 2 * p - l, S1: 2 * p - h, R2: p + (h - l), S2: p - (h - l), BC: (h + l) / 2, TC: 2 * p - (h + l) / 2 } }
/** Swing-point support/resistance: local extremes clustered within ~0.6 ATR, ranked by touches. */
export function levels(c: Candle[], max = 4) {
  const a = atr(c).at(-1)! || c.at(-1)!.close * 0.01; const pts: number[] = []
  for (let i = 3; i < c.length - 3; i++) {
    const w = c.slice(i - 3, i + 4)
    if (c[i].high === Math.max(...w.map((x) => x.high))) pts.push(c[i].high)
    if (c[i].low === Math.min(...w.map((x) => x.low))) pts.push(c[i].low)
  }
  const clusters: { p: number; n: number }[] = []
  for (const p of pts) { const k = clusters.find((x) => Math.abs(x.p - p) < a * 0.6); if (k) { k.p = (k.p * k.n + p) / (k.n + 1); k.n++ } else clusters.push({ p, n: 1 }) }
  const last = c.at(-1)!.close
  return clusters.filter((x) => x.n >= 2).sort((x, y) => y.n - x.n).slice(0, max).map((x) => ({ price: x.p, touches: x.n, kind: x.p > last ? 'resistance' as const : 'support' as const }))
}

// Black-Scholes
const N = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x)); const d = 0.3989423 * Math.exp((-x * x) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return x > 0 ? 1 - p : p
}
const n = (x: number) => 0.3989423 * Math.exp((-x * x) / 2)
export const R = 0.065
export function bs(S: number, K: number, T: number, iv: number, call: boolean) {
  T = Math.max(T, 1e-5)
  const d1 = (Math.log(S / K) + (R + iv * iv / 2) * T) / (iv * Math.sqrt(T)), d2 = d1 - iv * Math.sqrt(T)
  const price = call ? S * N(d1) - K * Math.exp(-R * T) * N(d2) : K * Math.exp(-R * T) * N(-d2) - S * N(-d1)
  const delta = call ? N(d1) : N(d1) - 1
  const gamma = n(d1) / (S * iv * Math.sqrt(T))
  const theta = (-(S * n(d1) * iv) / (2 * Math.sqrt(T)) - (call ? 1 : -1) * R * K * Math.exp(-R * T) * N(call ? d2 : -d2)) / 365
  const vega = (S * n(d1) * Math.sqrt(T)) / 100
  return { price: Math.max(price, 0.05), delta, gamma, theta, vega }
}

const lastWeekday = (y: number, m: number, wd: number) => { const d = new Date(y, m + 1, 0, 15, 30); while (d.getDay() !== wd) d.setDate(d.getDate() - 1); return d }
// Time to expiry moves in whole minutes, so an option's price is stable between ticks (React selectors rely on that).
const nowMin = () => Math.floor(Date.now() / 60000) * 60000
const expObj = (dt: Date, weekly: boolean) => ({ label: dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }).toUpperCase(), date: dt, T: Math.max((dt.getTime() - nowMin()) / (365 * 864e5), 0.5 / 365), weekly })

/**
 * Expiry calendar per SEBI's 2024–25 rules: NSE keeps one weekly (NIFTY, Tuesday), BSE one weekly (SENSEX, Thursday).
 * BANKNIFTY, FINNIFTY and stock options are monthly, on the last Tuesday.
 */
export function nextExpiries(und = 'NIFTY'): { label: string; date: Date; T: number; weekly: boolean }[] {
  const now = new Date(); const out: Date[] = []
  const weeklyDay = und === 'NIFTY' ? 2 : und === 'SENSEX' ? 4 : -1
  if (weeklyDay >= 0) {
    const d = new Date(); d.setHours(15, 30, 0, 0)
    while (d.getDay() !== weeklyDay || d.getTime() < now.getTime()) d.setDate(d.getDate() + 1)
    for (let i = 0; i < 4; i++) { const x = new Date(d); x.setDate(d.getDate() + 7 * i); out.push(x) }
  }
  const monthlyDay = und === 'SENSEX' ? 4 : 2
  for (let m = 0, found = 0; found < (weeklyDay >= 0 ? 2 : 3); m++) {
    const dt = lastWeekday(now.getFullYear(), now.getMonth() + m, monthlyDay)
    if (dt.getTime() < now.getTime()) continue
    found++; if (!out.some((x) => x.toDateString() === dt.toDateString())) out.push(dt)
  }
  out.sort((x, y) => x.getTime() - y.getTime())
  return out.slice(0, 5).map((d) => expObj(d, weeklyDay >= 0 && lastWeekday(d.getFullYear(), d.getMonth(), monthlyDay).toDateString() !== d.toDateString()))
}
export const isExpiryDay = (und: string) => nextExpiries(und)[0].date.toDateString() === new Date().toDateString()

/** Exchange freeze quantity for index options; larger orders are sliced. */
export const FREEZE: Record<string, number> = { NIFTY: 1800, BANKNIFTY: 600, FINNIFTY: 1800, SENSEX: 1000 }

/**
 * Indian statutory charges for one order leg (rates as of Apr 2026; options STT 0.15% and futures 0.05% on sell).
 * Brokerage: ₹0 delivery, else lower of ₹20 or 0.03% (₹20 flat for options).
 */
export function charges(kind: 'DELIVERY' | 'INTRADAY' | 'OPTION', side: 'BUY' | 'SELL', turnover: number) {
  const brokerage = kind === 'DELIVERY' ? 0 : kind === 'OPTION' ? 20 : Math.min(20, turnover * 0.0003)
  const stt = kind === 'DELIVERY' ? turnover * 0.001 : side === 'SELL' ? turnover * (kind === 'OPTION' ? 0.0015 : 0.00025) : 0
  const exch = turnover * (kind === 'OPTION' ? 0.0003503 : 0.0000297)
  const sebi = turnover * 1e-6
  const stamp = side === 'BUY' ? turnover * (kind === 'DELIVERY' ? 0.00015 : 0.00003) : 0
  const gst = (brokerage + exch + sebi) * 0.18
  const total = brokerage + stt + exch + sebi + stamp + gst
  return { brokerage, stt, exch, sebi, stamp, gst, total }
}

export type Leg = { side: 'BUY' | 'SELL'; type: 'CE' | 'PE'; strike: number; lots: number }
export type ChainRow = { strike: number; ce: Quote; pe: Quote; atm: boolean }
export type Quote = { ltp: number; iv: number; delta: number; gamma: number; theta: number; vega: number; oi: number; chgOi: number; vol: number }

// Equity-index style skew: OTM puts richer than OTM calls, plus a smile
export const ivFor = (inst: Inst, m: number) => inst.vol * (1 - 2.5 * m + 60 * m * m) + 0.01

export function chain(und: string, spot: number, T: number, rows = 21): ChainRow[] {
  const inst = bySym(und)!; const atm = Math.round(spot / inst.step) * inst.step
  const out: ChainRow[] = []
  for (let k = -(rows - 1) / 2; k <= (rows - 1) / 2; k++) {
    const strike = atm + k * inst.step; const m = Math.log(strike / spot)
    const iv = ivFor(inst, m)
    const mk = (call: boolean): Quote => {
      const g = bs(spot, strike, T, iv, call)
      const rr = rng(strike * (call ? 3 : 7) + inst.lot)
      const dist = Math.abs(k); const oi = Math.round((1200000 * Math.exp(-dist / 6) * (0.6 + rr()) * (call === (k > 0) ? 1.4 : 0.8)) / 25) * 25
      return { ltp: +g.price.toFixed(2), iv: iv * 100, delta: g.delta, gamma: g.gamma, theta: g.theta, vega: g.vega, oi, chgOi: Math.round((rr() - 0.4) * oi * 0.2), vol: Math.round(oi * (0.3 + rr())) }
    }
    out.push({ strike, ce: mk(true), pe: mk(false), atm: k === 0 })
  }
  return out
}

export function legPrice(und: string, spot: number, T: number, l: Leg) {
  const row = chain(und, spot, T, 41).find((r) => r.strike === l.strike)
  return row ? (l.type === 'CE' ? row.ce : row.pe) : null
}

// Strategy payoff at expiry, per share multiplied by lot size
/** P&L of legs at underlying price `at`: at expiry, or now (optionally after `days` pass and IV shifts by `ivShift` points). */
export function payoff(und: string, spot: number, T: number, legs: Leg[], at: number, now = false, whatIf: { days?: number; ivShift?: number } = {}) {
  const inst = bySym(und)!; let tot = 0
  const Tn = Math.max(T - (whatIf.days ?? 0) / 365, 0.2 / 365)
  for (const l of legs) {
    const q = legPrice(und, spot, T, l); const entry = q ? q.ltp : 0
    const val = now
      ? bs(at, l.strike, Tn, Math.max(((q?.iv ?? 15) + (whatIf.ivShift ?? 0)) / 100, 0.02), l.type === 'CE').price
      : Math.max(l.type === 'CE' ? at - l.strike : l.strike - at, 0)
    tot += (l.side === 'BUY' ? 1 : -1) * (val - entry) * l.lots * inst.lot
  }
  return tot
}

export const STRATEGIES: Record<string, { desc: string; build: (atm: number, step: number, lots: number) => Leg[] }> = {
  'long straddle': { desc: 'Buy ATM CE+PE · profits from a big move', build: (a, _s, l) => [{ side: 'BUY', type: 'CE', strike: a, lots: l }, { side: 'BUY', type: 'PE', strike: a, lots: l }] },
  'short straddle': { desc: 'Sell ATM CE+PE · profits from range-bound', build: (a, _s, l) => [{ side: 'SELL', type: 'CE', strike: a, lots: l }, { side: 'SELL', type: 'PE', strike: a, lots: l }] },
  'long strangle': { desc: 'Buy OTM CE+PE · cheap volatility bet', build: (a, s, l) => [{ side: 'BUY', type: 'CE', strike: a + 3 * s, lots: l }, { side: 'BUY', type: 'PE', strike: a - 3 * s, lots: l }] },
  'short strangle': { desc: 'Sell OTM CE+PE · theta harvest, undefined risk', build: (a, s, l) => [{ side: 'SELL', type: 'CE', strike: a + 3 * s, lots: l }, { side: 'SELL', type: 'PE', strike: a - 3 * s, lots: l }] },
  'iron condor': { desc: 'Short strangle + long wings · defined-risk range play', build: (a, s, l) => [{ side: 'SELL', type: 'CE', strike: a + 3 * s, lots: l }, { side: 'BUY', type: 'CE', strike: a + 6 * s, lots: l }, { side: 'SELL', type: 'PE', strike: a - 3 * s, lots: l }, { side: 'BUY', type: 'PE', strike: a - 6 * s, lots: l }] },
  'iron butterfly': { desc: 'Short ATM straddle + long wings', build: (a, s, l) => [{ side: 'SELL', type: 'CE', strike: a, lots: l }, { side: 'SELL', type: 'PE', strike: a, lots: l }, { side: 'BUY', type: 'CE', strike: a + 4 * s, lots: l }, { side: 'BUY', type: 'PE', strike: a - 4 * s, lots: l }] },
  'bull call spread': { desc: 'Buy ATM CE, sell OTM CE · moderately bullish', build: (a, s, l) => [{ side: 'BUY', type: 'CE', strike: a, lots: l }, { side: 'SELL', type: 'CE', strike: a + 3 * s, lots: l }] },
  'bear put spread': { desc: 'Buy ATM PE, sell OTM PE · moderately bearish', build: (a, s, l) => [{ side: 'BUY', type: 'PE', strike: a, lots: l }, { side: 'SELL', type: 'PE', strike: a - 3 * s, lots: l }] },
  'bull put spread': { desc: 'Sell OTM PE, buy lower PE · credit, bullish', build: (a, s, l) => [{ side: 'SELL', type: 'PE', strike: a - 2 * s, lots: l }, { side: 'BUY', type: 'PE', strike: a - 5 * s, lots: l }] },
  'bear call spread': { desc: 'Sell OTM CE, buy higher CE · credit, bearish', build: (a, s, l) => [{ side: 'SELL', type: 'CE', strike: a + 2 * s, lots: l }, { side: 'BUY', type: 'CE', strike: a + 5 * s, lots: l }] },
}

export function optQuote(und: string, spot: number, T: number, strike: number, type: 'CE' | 'PE') {
  const inst = bySym(und)!; const m = Math.log(strike / spot)
  const iv = ivFor(inst, m)
  return { ...bs(spot, strike, T, iv, type === 'CE'), iv: iv * 100 }
}
export const keyOf = (und: string, strike?: number, type?: string, exp?: string) => (strike ? `${und}|${strike}|${type}|${exp}` : und)
export const parseKey = (k: string) => { const [und, s, t, e] = k.split('|'); return { und, strike: s ? +s : 0, type: t as 'CE' | 'PE' | undefined, exp: e } }
export const labelOf = (k: string) => { const p = parseKey(k); return p.strike ? (p.exp === 'PAST' ? `${p.und} ${p.strike} ${p.type} (expired)` : `${p.und} ${p.exp} ${p.strike} ${p.type}`) : p.und }

/**
 * Candles for an option contract, priced from the underlying's candles with Black-Scholes and the contract's
 * real time to expiry at each bar. The last close matches the live option quote.
 */
export function optionHistory(key: string, tf: TF, n: number, spot: number): Candle[] {
  const k = parseKey(key); const inst = bySym(k.und)!
  const exp = (nextExpiries(k.und).find((e) => e.label === k.exp) ?? nextExpiries(k.und)[0]).date.getTime()
  const call = k.type === 'CE'
  return history(inst, tf, n, spot).map((c) => {
    const T = Math.max((exp - c.time * 1000) / (365 * 864e5), 0.5 / 365)
    const px = (S: number) => bs(S, k.strike, T, ivFor(inst, Math.log(k.strike / S)), call).price
    const o = px(c.open), cl = px(c.close), hi = px(call ? c.high : c.low), lo = px(call ? c.low : c.high)
    return { time: c.time, open: o, close: cl, high: Math.max(hi, o, cl), low: Math.min(lo, o, cl), volume: Math.round(c.volume * 0.8) }
  })
}
