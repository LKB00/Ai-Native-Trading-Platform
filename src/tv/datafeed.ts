// Datafeed adapter for TradingView's Advanced Charts / Trading Platform libraries. It serves the terminal's own
// market data (the simulated NSE/BSE feed in market.ts and the live ticks in the store) through the library's
// Datafeed API, plus the Quotes API that Trading Platform's watchlist and order ticket use.
//
// Usage, once the library is in public/charting_library/:
//   new TradingView.widget({ datafeed: createDatafeed(), symbol: 'NIFTY', interval: '5', timezone: 'Asia/Kolkata', ... })
//
// Symbols: equities and indices by NSE symbol ("RELIANCE", "NIFTY"; "NSE:RELIANCE" also resolves). Options by the
// terminal's position key ("NIFTY|24500|CE|13 OCT"), so a chart opened from a position or the chain needs no lookup.
import { useStore } from '../store'
import {
  INSTS, bySym, history, optionHistory, barStart, simNow, labelOf, parseKey, keyOf, nextExpiries, optQuote, intraday, IST,
  type Candle, type TF,
} from '../market'
import type {
  Bar, DatafeedConfiguration, IBasicDataFeed, IDatafeedQuotesApi, LibrarySymbolInfo, Mark, QuoteData, ResolutionString, SearchSymbolResultItem,
} from './types'

const R = (r: string) => r as ResolutionString
/** Library resolution → terminal timeframe. Every resolution is served natively, so the library never resamples. */
const RES: Record<string, TF> = { '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m', '60': '1h', '120': '2h', '240': '4h', '1D': '1D', D: '1D', '1W': '1W', W: '1W', '1M': '1M', M: '1M' }
const SUPPORTED = ['1', '3', '5', '15', '30', '60', '120', '240', '1D', '1W', '1M'].map(R)
const INTRADAY = ['1', '3', '5', '15', '30', '60', '120', '240']
/** How far back history goes, in bars. Older requests get noData, which stops the library paging further. */
const DEPTH: Record<TF, number> = { '1m': 3000, '3m': 3000, '5m': 3000, '15m': 2500, '30m': 2000, '1h': 2000, '2h': 1500, '4h': 1200, '1D': 2500, '1W': 520, '1M': 240 }
const OPTION_DEPTH = 600
/** NSE trading hours, Monday to Friday (library day numbers: 1 = Sunday). */
const SESSION = '0915-1530:23456'

// ---- symbols

type Parsed = { key: string; und: string; opt: boolean }
/** Accepts "RELIANCE", "NSE:RELIANCE", or an option key "NIFTY|24500|CE|13 OCT". */
function parse(name: string): Parsed | undefined {
  const bare = name.includes('|') ? name : name.replace(/^[A-Z]+:/i, '').toUpperCase()
  const k = parseKey(bare)
  if (!bySym(k.und)) return undefined
  if (!k.strike) return { key: k.und, und: k.und, opt: false }
  if (!bySym(k.und)!.fno || !k.type || !k.exp) return undefined
  return { key: keyOf(k.und, k.strike, k.type, k.exp), und: k.und, opt: true }
}
const exchangeOf = (und: string, opt: boolean) => (und === 'SENSEX' ? (opt ? 'BFO' : 'BSE') : opt ? 'NFO' : 'NSE')
const typeOf = (p: Parsed) => (p.opt ? 'option' : bySym(p.und)!.seg === 'IDX' ? 'index' : 'stock')

function symbolInfo(p: Parsed): LibrarySymbolInfo {
  const inst = bySym(p.und)!; const ex = exchangeOf(p.und, p.opt)
  return {
    name: p.opt ? labelOf(p.key) : p.key, ticker: p.key, full_name: `${ex}:${p.opt ? labelOf(p.key) : p.key}`,
    description: p.opt ? `${inst.name} ${parseKey(p.key).strike} ${parseKey(p.key).type === 'CE' ? 'call' : 'put'}, ${parseKey(p.key).exp} expiry` : inst.name,
    type: typeOf(p), session: SESSION, timezone: 'Asia/Kolkata', exchange: ex, listed_exchange: ex, format: 'price',
    pricescale: 100, minmov: 5,
    has_intraday: true, has_daily: true, has_weekly_and_monthly: true, supported_resolutions: SUPPORTED, intraday_multipliers: INTRADAY,
    volume_precision: 0, data_status: 'streaming', visible_plots_set: inst.seg === 'IDX' && !p.opt ? 'ohlc' : 'ohlcv',
    currency_code: 'INR', sector: p.opt ? 'Derivatives' : inst.sector, industry: inst.sector,
  }
}

function search(input: string, exchange: string, type: string): SearchSymbolResultItem[] {
  const q = input.trim().toUpperCase().replace(/^[A-Z]+:/, '')
  const item = (p: Parsed): SearchSymbolResultItem => { const i = symbolInfo(p); return { symbol: i.name, full_name: i.full_name, description: i.description, exchange: i.exchange, ticker: i.ticker, type: i.type } }
  const out: SearchSymbolResultItem[] = []
  // "NIFTY 24500 CE", "NIFTY24500PE", "BANKNIFTY CE": option contracts around the asked strike (or ATM).
  const m = /^([A-Z&-]+?)\s*(\d{3,6})?\s*(CE|PE|CALL|PUT)?$/.exec(q.replace(/\s+/g, ' '))
  const und = m && bySym(m[1])
  if (und?.fno && (m![2] || m![3] || type === 'option')) {
    const spot = useStore.getState().prices[und.sym].ltp; const center = m![2] ? +m![2] : Math.round(spot / und.step) * und.step
    const types = m![3] ? [/^(CE|CALL)$/.test(m![3]) ? 'CE' : 'PE'] : ['CE', 'PE']
    for (const ex of nextExpiries(und.sym).slice(0, 2)) for (let d = -3; d <= 3; d++) for (const t of types) out.push(item({ key: keyOf(und.sym, center + d * und.step, t, ex.label), und: und.sym, opt: true }))
  }
  if (type !== 'option') for (const i of INSTS) if (!q || i.sym.includes(q) || i.name.toUpperCase().includes(q)) out.push(item({ key: i.sym, und: i.sym, opt: false }))
  return out.filter((x) => (!exchange || x.exchange === exchange) && (!type || x.type === type))
    .sort((a, b) => Number(!a.ticker.startsWith(q)) - Number(!b.ticker.startsWith(q))).slice(0, 50)
}

// ---- bars

/**
 * One generated series per symbol and timeframe, kept for the session so paging back and live updates agree.
 * Times here are the terminal's: epoch seconds, daily-and-up bars at IST midnight.
 */
type Series = { p: Parsed; tf: TF; bars: Candle[]; vol: number }
const series = new Map<string, Series>()
function getSeries(p: Parsed, tf: TF): Candle[] {
  const id = `${p.key}@${tf}`; let s = series.get(id)
  if (!s) {
    const st = useStore.getState(); const inst = bySym(p.und)!
    const bars = p.opt ? optionHistory(p.key, tf, OPTION_DEPTH, st.prices[p.und].ltp) : history(inst, tf, DEPTH[tf], st.prices[p.und].ltp)
    s = { p, tf, bars, vol: st.prices[p.und].vol }; series.set(id, s)
    ensureLive() // every cached series keeps up with the market, so returning to a timeframe later has no gap
  }
  return s.bars
}
/** The bars the chart is showing for a symbol and resolution (terminal times), for overlays that read them. */
export function candlesFor(name: string, resolution: string): { candles: Candle[]; tf: TF } | undefined {
  const p = parse(name); const tf = RES[resolution]; return p && tf ? { candles: getSeries(p, tf), tf } : undefined
}
/** A terminal bar time as the library's chart time in seconds (daily and up at 00:00 UTC). */
export const chartSeconds = (t: number, tf: TF) => libTime(t, tf) / 1000

/** The library wants UTC ms, and daily/weekly/monthly bars at 00:00 UTC of their trading date. */
const libTime = (t: number, tf: TF) => (intraday(tf) ? t : t + IST) * 1000
const toBar = (c: Candle, tf: TF): Bar => ({ time: libTime(c.time, tf), open: +c.open.toFixed(2), high: +c.high.toFixed(2), low: +c.low.toFixed(2), close: +c.close.toFixed(2), volume: Math.round(c.volume) })

/**
 * Bars before `to`: all of [from, to), or the last `countBack` before `to` when that range holds fewer, as the
 * library's paging expects. Nothing before the start of the series means noData.
 */
export function barsFor(name: string, resolution: string, from: number, to: number, countBack: number): { bars: Bar[]; noData: boolean } {
  const p = parse(name); const tf = RES[resolution]
  if (!p || !tf) return { bars: [], noData: true }
  const s = getSeries(p, tf); const toMs = to * 1000, fromMs = from * 1000
  const upto = s.filter((c) => libTime(c.time, tf) < toMs)
  const inRange = upto.filter((c) => libTime(c.time, tf) >= fromMs)
  const pick = inRange.length >= countBack ? inRange : upto.slice(-countBack)
  return { bars: pick.map((c) => toBar(c, tf)), noData: pick.length === 0 }
}

// ---- live updates: one store subscription feeds every chart and quote listener

type BarSub = { p: Parsed; tf: TF; onTick: (b: Bar) => void; onReset: () => void }
type QuoteSub = { keys: string[]; onData: (d: QuoteData[]) => void }
const barSubs = new Map<string, BarSub>(); const quoteSubs = new Map<string, QuoteSub>()
let unsub: (() => void) | undefined

function ensureLive() {
  if (unsub) return
  let lastPrices = useStore.getState().prices
  unsub = useStore.subscribe((st) => {
    if (st.prices === lastPrices) return // only market ticks, not every store change
    lastPrices = st.prices
    const now = simNow()
    for (const ser of series.values()) {
      const s = ser.bars; const ltp = st.ltp(ser.p.key); const t = barStart(ser.tf, now)
      const q = st.prices[ser.p.und]; const dv = Math.max(0, q.vol - ser.vol); ser.vol = q.vol
      let bar = s[s.length - 1]
      if (t > bar.time) { bar = { time: t, open: bar.close, high: ltp, low: ltp, close: ltp, volume: 0 }; s.push(bar) }
      else if (t < bar.time) continue // the simulated clock never runs backwards within a session; ignore if it did
      bar.close = ltp; bar.high = Math.max(bar.high, ltp); bar.low = Math.min(bar.low, ltp); bar.volume += ser.p.opt ? dv * 0.8 : dv
    }
    for (const sub of barSubs.values()) { const s = getSeries(sub.p, sub.tf); sub.onTick(toBar(s[s.length - 1], sub.tf)) }
    for (const sub of quoteSubs.values()) sub.onData(quotes(sub.keys))
  })
}
function maybeStop() { if (!barSubs.size && !quoteSubs.size && !series.size && unsub) { unsub(); unsub = undefined } }

// ---- quotes (watchlist, order ticket, legend)

function quotes(names: string[]): QuoteData[] {
  const st = useStore.getState()
  return names.map((n) => {
    const p = parse(n); if (!p) return { s: 'error', n, v: {} }
    const q = st.prices[p.und]; const lp = st.ltp(p.key)
    let prev = q.prev, open = q.open, high = q.high, low = q.low
    if (p.opt) {
      const k = parseKey(p.key); const ex = nextExpiries(p.und).find((e) => e.label === k.exp) ?? nextExpiries(p.und)[0]
      const at = (S: number) => optQuote(p.und, S, ex.T, k.strike, k.type!).price
      prev = at(q.prev); open = at(q.open); const a = at(q.high), b = at(q.low); high = Math.max(a, b, lp); low = Math.min(a, b, lp)
    }
    const tick = 0.05; const info = symbolInfo(p)
    return { s: 'ok', n, v: { ch: +(lp - prev).toFixed(2), chp: +((lp / prev - 1) * 100).toFixed(2), short_name: info.name, exchange: info.exchange, description: info.description, lp: +lp.toFixed(2), bid: +(lp - tick).toFixed(2), ask: +(lp + tick).toFixed(2), spread: +(2 * tick).toFixed(2), open_price: +open.toFixed(2), high_price: +high.toFixed(2), low_price: +low.toFixed(2), prev_close_price: +prev.toFixed(2), volume: Math.round(q.vol * (p.opt ? 0.8 : 1)) } }
  })
}

// ---- marks: your fills on the chart

function fillMarks(name: string, from: number, to: number): Mark[] {
  const p = parse(name); if (!p) return []
  return useStore.getState().orders
    .filter((o) => o.key === p.key && o.status === 'COMPLETE' && o.st != null && o.st >= from && o.st <= to)
    .map((o) => ({
      id: o.id, time: Math.floor(o.st!), color: o.side === 'BUY' ? 'green' as const : 'red' as const,
      text: `${o.side === 'BUY' ? 'Bought' : 'Sold'} ${o.qty} at ₹${(o.fill ?? o.price).toFixed(2)}${o.tag ? ` · ${o.tag}` : ''}${o.via === 'ai' ? ' · drafted by AI, approved by you' : ''}`,
      label: o.side === 'BUY' ? 'B' : 'S', labelFontColor: '#ffffff', minSize: 14,
    }))
}

// ---- the adapter

/** Parse a library symbol name back to the terminal's key: "NSE:RELIANCE" → RELIANCE, option names → their key. */
export const parseSymbol = (name: string) => parse(name) ?? parseLabel(name)
/** Option symbols come back from the library as their display name ("NIFTY 13 OCT 24500 CE"). */
function parseLabel(name: string): Parsed | undefined {
  const m = /^(?:[A-Z]+:)?([A-Z&-]+) (\d{1,2} [A-Z]{3}) (\d+) (CE|PE)$/.exec(name.trim().toUpperCase())
  return m ? parse(keyOf(m[1], +m[3], m[4], m[2])) : undefined
}

const later = (f: () => void) => setTimeout(f, 0) // the library expects callbacks to arrive asynchronously

export function createDatafeed(): IBasicDataFeed & IDatafeedQuotesApi & { resetCache: () => void } {
  return {
    onReady(cb) {
      const config: DatafeedConfiguration = {
        supported_resolutions: SUPPORTED,
        exchanges: [{ value: '', name: 'All', desc: '' }, { value: 'NSE', name: 'NSE', desc: 'National Stock Exchange' }, { value: 'BSE', name: 'BSE', desc: 'BSE' }, { value: 'NFO', name: 'NFO', desc: 'NSE F&O' }, { value: 'BFO', name: 'BFO', desc: 'BSE F&O' }],
        symbols_types: [{ name: 'All', value: '' }, { name: 'Stock', value: 'stock' }, { name: 'Index', value: 'index' }, { name: 'Option', value: 'option' }],
        supports_marks: true, supports_timescale_marks: false, supports_time: true, currency_codes: ['INR'],
      }
      later(() => cb(config))
    },
    searchSymbols(input, exchange, type, onResult) { later(() => onResult(search(input, exchange, type))) },
    resolveSymbol(name, onResolve, onError) {
      const p = parse(name)
      later(() => (p ? onResolve(symbolInfo(p)) : onError(`Unknown symbol: ${name}`)))
    },
    getBars(info, resolution, { from, to, countBack }, onResult, onError) {
      later(() => {
        try { const { bars, noData } = barsFor(info.ticker, resolution, from, to, countBack); onResult(bars, { noData }) }
        catch (e) { onError((e as Error).message) }
      })
    },
    subscribeBars(info, resolution, onTick, guid, onReset) {
      const p = parse(info.ticker); const tf = RES[resolution]; if (!p || !tf) return
      barSubs.set(guid, { p, tf, onTick, onReset }); ensureLive()
    },
    unsubscribeBars(guid) { barSubs.delete(guid); maybeStop() },
    getServerTime(cb) { later(() => cb(Math.floor(simNow()))) },
    getMarks(info, from, to, onData) { later(() => onData(fillMarks(info.ticker, from, to))) },
    getQuotes(names, onData) { later(() => onData(quotes(names))) },
    subscribeQuotes(names, fast, onData, guid) { quoteSubs.set(guid, { keys: [...new Set([...names, ...fast])], onData }); ensureLive() },
    unsubscribeQuotes(guid) { quoteSubs.delete(guid); maybeStop() },
    /** Drop generated history and ask every open chart to reload it, e.g. after the paper account is reset. */
    resetCache() { series.clear(); for (const s of barSubs.values()) s.onReset(); maybeStop() },
  }
}
