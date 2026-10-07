import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart, createSeriesMarkers, createTextWatermark, CandlestickSeries, BarSeries, LineSeries, AreaSeries, BaselineSeries, HistogramSeries,
  type IChartApi, type ISeriesApi, type IPriceLine, type UTCTimestamp, type SeriesMarker, type Time, type ISeriesMarkersPluginApi, type SeriesType, type Logical,
} from 'lightweight-charts'
import { bySym, history, optionHistory, atr, pivots, levels, TF_SEC, TF_LABEL, labelOf, parseKey, barStart, simNow, fmtIST, intraday, type Candle, type TF } from '../market'
import { useStore, type OType, type Drawing } from '../store'
import { useEntryGate, opensPosition, GateNote } from '../gate'
import { Badge, Button, IconButton, SegmentedControl, cn } from '../ds'
import { PlusIcon, XIcon } from '../ds/lib/icons'
import { inr, LabeledSwitch } from '../ui'
import { CostLine, LevelInput, TagPicker, priceBand, useOrderCost } from '../ticket'
import { indDef, instanceTitle, type IndInstance } from './indicators'
import { CLICKS, DEFAULT_COLOR, KIND_LABEL, applyHandle, hit, renderDrawing, translate, isDrawTool, type Mapper, type Tool } from './drawings'
import { EyeIcon, EyeOffIcon, SettingsGearIcon, TrashIcon, LockIcon, UnlockIcon, CloneIcon, BellIcon } from './icons'

export const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
const alpha = (hex: string, a: number) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})` }
const T = (t: number) => t as UTCTimestamp
const SWATCHES = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5', '--fg', '--success', '--danger']

type Kind = 'position' | 'order' | 'sl' | 'tgt' | 'alert' | 'draw' | 'ai' | 'pivot' | 'g-entry' | 'g-sl' | 'g-tgt'
type LineSpec = { id: string; price: number; kind: Kind; label: string; color: string; style: 0 | 1 | 2 | 3; drag: boolean; ref?: number | string }
type Ticket = { side: 'BUY' | 'SELL'; entry: number; sl: number; tgt: number; market: boolean; /** Opened from a price in the order book: a limit at that price even when it would fill now. */ lmt?: boolean }
export type TicketReq = { side: 'BUY' | 'SELL'; n: number; entry?: number; sl?: number; tgt?: number; limit?: boolean } | null
/** Imperative handles the workspace uses: screenshot, reset view, date ranges. */
export const paneApi: Record<number, { chart: IChartApi; reset: () => void; range: (bars: number) => void } | undefined> = {}

function heikin(c: Candle[]): Candle[] {
  const out: Candle[] = []
  c.forEach((x, i) => { const close = (x.open + x.high + x.low + x.close) / 4; const open = i ? (out[i - 1].open + out[i - 1].close) / 2 : (x.open + x.close) / 2; out.push({ ...x, open, close, high: Math.max(x.high, open, close), low: Math.min(x.low, open, close) }) })
  return out
}

/** Candlestick patterns on the last bars, shown as chart markers. Deterministic, so the AI can cite them. */
/** Short codes for pattern markers: they sit beside one candle without covering its neighbours. */
export const PATTERN_CODE: Record<string, string> = { 'Bullish engulfing': 'E', 'Bearish engulfing': 'E', Hammer: 'H', 'Inside bar': 'IB' }

export function patterns(c: Candle[]) {
  const out: { time: number; name: string; bull: boolean }[] = []
  for (let i = Math.max(1, c.length - 60); i < c.length; i++) {
    const a = c[i - 1], b = c[i], body = Math.abs(b.close - b.open), range = b.high - b.low || 1
    if (b.close > b.open && a.close < a.open && b.close >= a.open && b.open <= a.close) out.push({ time: b.time, name: 'Bullish engulfing', bull: true })
    else if (b.close < b.open && a.close > a.open && b.open >= a.close && b.close <= a.open) out.push({ time: b.time, name: 'Bearish engulfing', bull: false })
    else if (body / range < 0.3 && Math.min(b.open, b.close) - b.low > 2 * body && b.high - Math.max(b.open, b.close) < body) out.push({ time: b.time, name: 'Hammer', bull: true })
    else if (b.high < a.high && b.low > a.low && range / (a.high - a.low || 1) < 0.5) out.push({ time: b.time, name: 'Inside bar', bull: b.close > b.open })
  }
  return out.slice(-6)
}

export default function Pane({ idx, k: key, tf, active, multi, className, tool, setTool, req, onSearch }: {
  idx: number; k: string; tf: TF; active: boolean; multi: boolean; className?: string; tool: Tool; setTool: (t: Tool) => void; req: TicketReq; onSearch: (seed: string) => void
}) {
  const cfg = useStore((s) => s.chart); const theme = useStore((s) => s.theme)
  const pk = parseKey(key); const und = pk.und; const opt = !!pk.strike
  const aiOn = useStore((s) => !!s.aiLevels[key]) && !opt
  const inst = bySym(und)!
  const tradable = inst.seg === 'EQ' || opt
  const wrap = useRef<HTMLDivElement>(null), el = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null), mainRef = useRef<ISeriesApi<SeriesType> | null>(null)
  const dataRef = useRef<Candle[]>([]); const lines = useRef(new Map<string, IPriceLine>())
  const specsRef = useRef<LineSpec[]>([]); const dragRef = useRef<{ spec: LineSpec; price: number } | null>(null)
  const shapeDrag = useRef<{ id: string; part: number | 'body'; t0: number; p0: number; orig: Drawing } | null>(null)
  const [, force] = useState(0); const rerender = () => force((n) => (n + 1) % 1e6)
  const [hover, setHover] = useState<{ y: number; x: number; price: number; time?: number; idx?: number } | null>(null)
  const hoverRef = useRef(hover); hoverRef.current = hover
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [draft, setDraft] = useState<{ pts: { t: number; p: number }[] } | null>(null); const draftRef = useRef(draft); draftRef.current = draft
  const [selected, setSelected] = useState<string | null>(null)
  const [vals, setVals] = useState<Record<string, number[]>>({})
  const [menu, setMenu] = useState<{ x: number; y: number; price: number; time?: number } | null>(null)
  const [interval, setIntervalDraft] = useState('')
  const [editInd, setEditInd] = useState<string | null>(null)
  const [paneTops, setPaneTops] = useState<{ id: string; top: number }[]>([])

  const buildData = (spot: number) => { const n = intraday(tf) ? Math.max(400, Math.ceil(22500 / TF_SEC[tf]) * 2) : tf === '1D' ? 500 : 320; return opt ? optionHistory(key, tf, n, spot) : history(inst, tf, n, spot) }
  const magnet = (t: number | undefined, y: number, price: number) => {
    if (!cfg.magnet || t == null) return price
    const bar = dataRef.current.find((x) => x.time === t); const m = mainRef.current; if (!bar || !m) return price
    const near = [bar.open, bar.high, bar.low, bar.close].map((v) => ({ v, d: Math.abs((m.priceToCoordinate(v) ?? 1e9) - y) })).sort((a, b) => a.d - b.d)[0]
    return near.d < 14 ? near.v : price
  }

  // ---- Time ↔ logical index, with extrapolation past the last bar so drawings can extend into the future ----
  const toLogical = (t: number) => {
    const d = dataRef.current; const n = d.length; if (!n) return 0; const sec = TF_SEC[tf]
    if (t <= d[0].time) return (t - d[0].time) / sec
    if (t >= d[n - 1].time) return n - 1 + (t - d[n - 1].time) / sec
    let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (d[m].time <= t) lo = m; else hi = m }
    return lo + (t - d[lo].time) / (d[hi].time - d[lo].time)
  }
  const fromLogical = (l: number) => {
    const d = dataRef.current; const n = d.length; const sec = TF_SEC[tf]
    if (l <= 0) return d[0].time + l * sec
    if (l >= n - 1) return d[n - 1].time + (l - (n - 1)) * sec
    const i = Math.floor(l); return d[i].time + (l - i) * (d[i + 1].time - d[i].time)
  }
  const mapper = (): Mapper | null => {
    const c = chartRef.current, m = mainRef.current; if (!c || !m) return null
    const ts = c.timeScale(); let h = 0; try { h = c.panes()[0].getHeight() } catch { h = el.current?.clientHeight ?? 0 }
    return {
      x: (t) => ts.logicalToCoordinate(toLogical(t) as Logical), y: (p) => m.priceToCoordinate(p),
      t: (x) => { const l = ts.coordinateToLogical(x); return l == null ? null : fromLogical(l) }, p: (y) => m.coordinateToPrice(y),
      w: ts.width(), h, barSec: TF_SEC[tf], barsBetween: (a, b) => Math.abs(toLogical(b) - toLogical(a)),
    }
  }

  // ---- Build chart, main series, indicators ----
  useEffect(() => {
    const c = { bg: css('--chart-bg'), fg: css('--chart-text'), grid: css('--chart-grid'), edge: css('--chart-border'), up: css('--success'), dn: css('--danger'), font: css('--ds-font-sans') }
    const chart = createChart(el.current!, {
      autoSize: true, layout: { background: { color: c.bg }, textColor: c.fg, fontFamily: c.font, fontSize: multi ? 10 : 11, attributionLogo: false, panes: { separatorColor: c.edge, enableResize: true } },
      grid: { vertLines: { color: c.grid }, horzLines: { color: c.grid } },
      crosshair: { mode: 0, vertLine: { visible: tool !== 'arrow', labelVisible: true }, horzLine: { visible: tool !== 'arrow' } },
      localization: { timeFormatter: (t: number) => fmtIST(t, intraday(tf) ? { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false } : { weekday: 'short', day: '2-digit', month: 'short', year: '2-digit' }), priceFormatter: (p: number) => p.toFixed(2) },
      timeScale: { timeVisible: intraday(tf), borderColor: c.edge, rightOffset: 8, barSpacing: multi ? 5 : 7,
        tickMarkFormatter: (t: number, type: number) => fmtIST(t, type === 0 ? { year: 'numeric' } : type === 1 ? { month: 'short' } : type === 2 ? { day: 'numeric', month: 'short' } : { hour: '2-digit', minute: '2-digit', hour12: false }) },
      rightPriceScale: { borderColor: c.edge, mode: cfg.scale === 'log' ? 1 : cfg.scale === 'percent' ? 2 : 0, autoScale: cfg.autoScale },
    })
    chartRef.current = chart
    dataRef.current = buildData(useStore.getState().prices[und].ltp)
    const ohlc = () => (cfg.type === 'heikin' ? heikin(dataRef.current) : dataRef.current)
    let main: ISeriesApi<SeriesType>
    if (cfg.type === 'line') main = chart.addSeries(LineSeries, { color: css('--chart-1'), lineWidth: 2 })
    else if (cfg.type === 'area') main = chart.addSeries(AreaSeries, { lineColor: css('--chart-1'), topColor: alpha(css('--chart-1'), 0.3), bottomColor: alpha(css('--chart-1'), 0.02), lineWidth: 2 })
    else if (cfg.type === 'baseline') main = chart.addSeries(BaselineSeries, { baseValue: { type: 'price', price: dataRef.current[0].close }, topLineColor: c.up, bottomLineColor: c.dn, topFillColor1: alpha(c.up, 0.25), topFillColor2: alpha(c.up, 0.02), bottomFillColor1: alpha(c.dn, 0.02), bottomFillColor2: alpha(c.dn, 0.25) })
    else if (cfg.type === 'bars') main = chart.addSeries(BarSeries, { upColor: c.up, downColor: c.dn, thinBars: false })
    else main = chart.addSeries(CandlestickSeries, cfg.type === 'hollow'
      ? { upColor: 'rgba(0,0,0,0)', downColor: c.dn, borderUpColor: c.up, borderDownColor: c.dn, wickUpColor: c.up, wickDownColor: c.dn, borderVisible: true }
      : { upColor: c.up, downColor: c.dn, borderVisible: false, wickUpColor: c.up, wickDownColor: c.dn })
    mainRef.current = main
    const single = cfg.type === 'line' || cfg.type === 'area' || cfg.type === 'baseline'
    const setMain = () => main.setData(single ? dataRef.current.map((x) => ({ time: T(x.time), value: x.close })) : ohlc().map((x) => ({ ...x, time: T(x.time) })))
    setMain()
    if (cfg.watermark) createTextWatermark(chart.panes()[0], { horzAlign: 'center', vertAlign: 'center', lines: [{ text: labelOf(key), color: alpha(css('--fg'), 0.06), fontSize: multi ? 28 : 56, fontStyle: 'bold' }, { text: `${opt ? 'NFO' : inst.seg === 'IDX' ? 'NSE INDEX' : 'NSE'} · ${TF_LABEL[tf]}`, color: alpha(css('--fg'), 0.07), fontSize: multi ? 12 : 18 }] })

    // Indicators: overlays on the price pane, oscillators each in their own pane (resizable).
    type Live = { inst: IndInstance; series: ISeriesApi<SeriesType>[] }
    const live: Live[] = []; let paneN = 1; const tops: { id: string; pane: number }[] = []
    for (const ins of cfg.inds) {
      const def = indDef(ins.type); if (!def || !ins.visible) continue
      const pane = def.overlay ? 0 : paneN++
      if (!def.overlay) tops.push({ id: ins.id, pane })
      const plots = def.compute(dataRef.current.slice(0, 50), ins.params)
      const series = plots.map((pl, i) => {
        const color = css(i === 0 && ins.color ? ins.color : pl.color)
        const common = { priceLineVisible: false, lastValueVisible: !def.overlay || def.ownScale ? false : true, crosshairMarkerVisible: false, ...(def.ownScale ? { priceScaleId: 'vol-' + ins.id } : {}) }
        if (pl.kind === 'histogram') return chart.addSeries(HistogramSeries, { ...common, color, priceFormat: def.ownScale ? { type: 'volume' } : undefined, lastValueVisible: false }, pane)
        return chart.addSeries(LineSeries, { ...common, color, lineWidth: pl.width ?? 1, lineStyle: pl.dashed ? 2 : 0, ...(pl.kind === 'dots' ? { lineVisible: false, pointMarkersVisible: true, pointMarkersRadius: 1.5 } : {}) }, pane)
      })
      if (def.ownScale) chart.priceScale('vol-' + ins.id, pane).applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })
      if (def.levels && series[0]) for (const lv of def.levels) series[0].createPriceLine({ price: lv, color: css('--border-strong'), lineStyle: 2, lineWidth: 1, axisLabelVisible: false })
      live.push({ inst: ins, series })
    }
    const setIndicators = () => {
      const out: Record<string, number[]> = {}; const d = dataRef.current
      for (const { inst: ins, series } of live) {
        const def = indDef(ins.type)!; const plots = def.compute(d, ins.params)
        plots.forEach((pl, i) => {
          const s = series[i]; if (!s) return
          const base = css(i === 0 && ins.color ? ins.color : pl.color)
          const colored = pl.colors ? (j: number) => { const cv = pl.colors![j]; const col = cv ? css(cv) : base; return def.ownScale ? alpha(col, 0.35) : col } : null
          s.setData(d.map((x, j) => (Number.isFinite(pl.values[j]) ? { time: T(x.time), value: pl.values[j], ...(colored ? { color: colored(j) } : {}) } : { time: T(x.time) })))
        })
        out[ins.id] = plots.map((pl) => pl.values[pl.values.length - 1])
        out[ins.id + ':all'] = [] // marker key; per-bar values read on hover below
        ;(out as Record<string, unknown>)[ins.id + ':plots'] = plots
      }
      setVals(out)
    }
    chart.panes().forEach((p, i) => i > 0 && p.setHeight(multi ? 70 : 100))
    setIndicators()
    const measureTops = () => { let y = 0; const ps = chart.panes(); const res: { id: string; top: number }[] = []; ps.forEach((p, i) => { const tp = tops.find((x) => x.pane === i); if (tp) res.push({ id: tp.id, top: y }); y += p.getHeight() + 1 }); setPaneTops(res) }
    requestAnimationFrame(measureTops)

    const markers: ISeriesMarkersPluginApi<Time> = createSeriesMarkers(main, [])
    let lastBar = dataRef.current.at(-1)!.time, n = 0
    const unsub = useStore.subscribe((s) => {
      const ltp = s.ltp(key); const t = barStart(tf, simNow())
      const d = dataRef.current; let bar = d[d.length - 1]
      if (t > bar.time) { bar = { time: t, open: bar.close, high: ltp, low: ltp, close: ltp, volume: 0 }; d.push(bar) }
      bar.close = ltp; bar.high = Math.max(bar.high, ltp); bar.low = Math.min(bar.low, ltp); bar.volume += Math.round(Math.random() * 400 * (intraday(tf) ? 1 : 20))
      if (single) main.update({ time: T(bar.time), value: ltp })
      else { const v = cfg.type === 'heikin' ? heikin(d.slice(-2)).at(-1)! : bar; main.update({ ...v, time: T(bar.time) }) }
      if (bar.time !== lastBar || ++n % 3 === 0) { lastBar = bar.time; setIndicators() }
      const fills = s.orders.filter((o) => o.key === key && o.status === 'COMPLETE')
      const m: SeriesMarker<Time>[] = fills.map((o) => ({ time: T(barStart(tf, o.st ?? o.ts / 1000)), position: o.side === 'BUY' ? 'belowBar' : 'aboveBar', color: o.side === 'BUY' ? c.up : c.dn, shape: o.side === 'BUY' ? 'arrowUp' : 'arrowDown', text: `${o.side === 'BUY' ? 'B' : 'S'} ${o.qty}` }))
      // Patterns as a short code beside the bar (full name in the legend when that bar is hovered), not a sentence
      // printed across the candles next to it.
      if (s.aiLevels[key] && !opt) for (const p of patterns(d)) m.push({ time: T(p.time), position: p.bull ? 'belowBar' : 'aboveBar', color: css('--chart-5'), shape: p.bull ? 'arrowUp' : 'arrowDown', size: 0.6, text: PATTERN_CODE[p.name] ?? '' })
      markers.setMarkers(m.sort((a, b) => (a.time as number) - (b.time as number)))
      rerender()
    })
    chart.subscribeCrosshairMove((p) => {
      if (!p.point || dragRef.current || shapeDrag.current) { if (!p.point) setHover(null); else rerender(); return }
      const price = main.coordinateToPrice(p.point.y); if (price == null) return
      const i = p.logical != null ? Math.round(p.logical) : undefined
      setHover({ y: p.point.y, x: p.point.x, price, time: p.time as number | undefined, idx: i })
    })
    chart.timeScale().subscribeVisibleLogicalRangeChange(rerender)
    const d = dataRef.current
    paneApi[idx] = {
      chart,
      reset: () => { chart.timeScale().resetTimeScale(); chart.priceScale('right').applyOptions({ autoScale: true }); chart.timeScale().scrollToRealTime() },
      range: (bars) => { const n2 = d.length; chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n2 - bars), to: n2 + 4 }) },
    }
    const lm = lines.current
    return () => { unsub(); lm.clear(); chart.remove(); chartRef.current = null; mainRef.current = null; paneApi[idx] = undefined }
  }, [key, tf, cfg.type, JSON.stringify(cfg.inds), cfg.scale, cfg.autoScale, cfg.watermark, theme, multi, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { chartRef.current?.applyOptions({ crosshair: { vertLine: { visible: tool !== 'arrow' }, horzLine: { visible: tool !== 'arrow' } } }) }, [tool])

  // ---- Price lines: position, exit plan, working orders, alerts, horizontal lines, AI levels, pivots, ticket ghosts ----
  const s = useStore()
  const ltp = s.ltp(key)
  const lvl = useMemo(() => (aiOn ? levels(history(inst, '1D', 160, s.prices[und].ltp).slice(-120)) : []), [aiOn, key]) // eslint-disable-line react-hooks/exhaustive-deps
  const piv = useMemo(() => { const d = history(inst, '1D', 3, s.prices[und].prev); const y = d[d.length - 2]; return pivots(y.high, y.low, y.close) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const col = { up: css('--success'), dn: css('--danger'), fg: css('--fg'), info: css('--info'), ai: css('--chart-5'), sub: css('--fg-subtle'), draw: css('--chart-1') }
  const specs: LineSpec[] = []
  const pos = s.positions[key]
  if (pos?.qty) {
    const pl = (ltp - pos.avg) * pos.qty
    specs.push({ id: 'pos', price: pos.avg, kind: 'position', label: `${pos.qty > 0 ? 'Long' : 'Short'} ${Math.abs(pos.qty)} · ${pl >= 0 ? '+' : ''}${inr(pl)}`, color: col.fg, style: 0, drag: false })
    const b = s.brackets[key]
    if (b?.sl != null) specs.push({ id: 'sl', price: b.sl, kind: 'sl', label: `${b.trail ? 'Trailing stop' : 'Stop'} · ${inr((b.sl - pos.avg) * pos.qty)}`, color: col.dn, style: 2, drag: true })
    if (b?.tgt != null) specs.push({ id: 'tgt', price: b.tgt, kind: 'tgt', label: `Target · +${inr(Math.abs((b.tgt - pos.avg) * pos.qty))}`, color: col.up, style: 2, drag: true })
  }
  for (const o of s.orders) if (o.key === key && (o.status === 'OPEN' || o.status === 'TRIGGER_PENDING')) specs.push({ id: 'o' + o.id, price: o.status === 'TRIGGER_PENDING' ? o.trigger! : o.price, kind: 'order', label: `${o.side === 'BUY' ? 'Buy' : 'Sell'} ${o.qty} ${o.otype === 'LIMIT' ? 'limit' : 'stop'}`, color: col.info, style: 0, drag: true, ref: o.id })
  if (!opt) for (const t of s.triggers) if (t.sym === key && !t.done) specs.push({ id: 't' + t.id, price: t.price, kind: 'alert', label: t.then ? `GTT ${t.then.side.toLowerCase()} ${t.then.qty}` : 'Alert', color: col.info, style: 1, drag: true, ref: t.id })
  if (!cfg.hideAll) for (const p of s.drawings[key] ?? []) specs.push({ id: 'd' + p, price: p, kind: 'draw', label: 'Line', color: col.draw, style: 0, drag: !cfg.lockAll, ref: p })
  for (const l of lvl) specs.push({ id: 'ai' + l.price.toFixed(1), price: l.price, kind: 'ai', label: `${l.kind === 'resistance' ? 'R' : 'S'} ${l.touches}×`, color: col.ai, style: 2, drag: false })
  if (cfg.pivots && !opt) for (const [k2, v] of Object.entries(piv)) specs.push({ id: 'pv' + k2, price: v, kind: 'pivot', label: k2 === 'P' ? 'Pivot' : k2, color: col.sub, style: 3, drag: false })
  if (ticket) {
    specs.push({ id: 'g-entry', price: ticket.market ? ltp : ticket.entry, kind: 'g-entry', label: 'Entry', color: col.info, style: 0, drag: !ticket.market })
    specs.push({ id: 'g-sl', price: ticket.sl, kind: 'g-sl', label: 'Stop', color: col.dn, style: 2, drag: true })
    specs.push({ id: 'g-tgt', price: ticket.tgt, kind: 'g-tgt', label: 'Target', color: col.up, style: 2, drag: true })
  }
  specsRef.current = specs
  const myShapes = cfg.hideAll ? [] : s.shapes[key] ?? []
  const shapesRef = useRef(myShapes); shapesRef.current = myShapes

  useEffect(() => {
    const main = mainRef.current; if (!main) return
    const seen = new Set<string>()
    for (const sp of specs) {
      seen.add(sp.id)
      const price = dragRef.current?.spec.id === sp.id ? dragRef.current.price : sp.price
      const opts = { price, color: sp.color, lineStyle: sp.style, lineWidth: (sp.kind === 'position' ? 2 : 1) as 1 | 2, axisLabelVisible: sp.kind !== 'pivot', title: sp.kind === 'pivot' || sp.kind === 'ai' ? sp.label : '', axisLabelColor: sp.color, axisLabelTextColor: css('--surface') }
      const ex = lines.current.get(sp.id)
      if (ex) ex.applyOptions(opts); else lines.current.set(sp.id, main.createPriceLine(opts))
    }
    for (const [id, l] of lines.current) if (!seen.has(id)) { try { main.removePriceLine(l) } catch { /* series gone */ } lines.current.delete(id) }
  })

  // ---- Pointer: drawings first (handles, then bodies), then draggable price lines ----
  useEffect(() => {
    const w = wrap.current!; const chart = () => chartRef.current; const main = () => mainRef.current
    const pos2 = (e: PointerEvent) => { const r = el.current!.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
    const lock = (on: boolean) => chart()?.applyOptions({ handleScroll: !on, handleScale: !on })
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || (e.target as HTMLElement).closest('[data-overlay]')) return
      setMenu(null)
      const m = main(); const mp = mapper(); if (!m || !mp) return; const p = pos2(e)
      if (useStore.getState().chart.lockAll) { /* locked drawings can still be selected below */ }
      for (const sh of [...shapesRef.current].reverse()) {
        const h = hit(sh, mp, p); if (h == null) continue
        e.preventDefault(); e.stopPropagation(); setSelected(sh.id)
        if (sh.locked || useStore.getState().chart.lockAll) return
        const t0 = mp.t(p.x), p0 = mp.p(p.y); if (t0 == null || p0 == null) return
        useStore.getState().snapshot(key)
        shapeDrag.current = { id: sh.id, part: h, t0, p0, orig: sh }; lock(true); w.setPointerCapture?.(e.pointerId); return
      }
      const hitLine = specsRef.current.filter((sp) => sp.drag).find((sp) => { const c = m.priceToCoordinate(sp.price); return c != null && Math.abs(c - p.y) < 7 })
      if (!hitLine) { if (!draftRef.current) setSelected(null); return }
      e.preventDefault(); e.stopPropagation()
      dragRef.current = { spec: hitLine, price: hitLine.price }; lock(true); w.setPointerCapture?.(e.pointerId); rerender()
    }
    const move = (e: PointerEvent) => {
      const m = main(); const mp = mapper(); if (!m || !mp) return; const p = pos2(e)
      const sd = shapeDrag.current
      if (sd) {
        const t = mp.t(p.x), pr = mp.p(p.y); if (t == null || pr == null) return
        const upd = sd.part === 'body' ? translate(sd.orig, t - sd.t0, pr - sd.p0) : applyHandle(sd.orig, sd.part, t, magnet(hoverRef.current?.time, p.y, pr))
        useStore.getState().updateShape(key, sd.id, upd); return
      }
      if (!dragRef.current) {
        const overShape = shapesRef.current.some((sh) => hit(sh, mp, p) != null)
        const near = specsRef.current.some((sp) => sp.drag && Math.abs((m.priceToCoordinate(sp.price) ?? -99) - p.y) < 7)
        w.style.cursor = overShape ? 'pointer' : near ? 'ns-resize' : ''; return
      }
      const pr = m.coordinateToPrice(p.y); if (pr == null) return
      dragRef.current.price = +pr.toFixed(2)
      lines.current.get(dragRef.current.spec.id)?.applyOptions({ price: dragRef.current.price }); rerender()
    }
    const up = () => {
      if (shapeDrag.current) { shapeDrag.current = null; lock(false); return }
      const d = dragRef.current; if (!d) return
      dragRef.current = null; lock(false)
      const st = useStore.getState(); const p = d.price
      switch (d.spec.kind) {
        case 'order': { const o = st.orders.find((x) => x.id === d.spec.ref); if (o) { st.modify(o.id, o.status === 'TRIGGER_PENDING' ? { trigger: p } : { price: p }); st.setToast(`Order moved to ₹${p.toFixed(2)}`) } break }
        case 'sl': st.setBracket(key, { sl: p, trail: undefined }); st.setToast(`Stop moved to ₹${p.toFixed(2)}`); break
        case 'tgt': st.setBracket(key, { tgt: p }); st.setToast(`Target moved to ₹${p.toFixed(2)}`); break
        case 'alert': { const t = st.triggers.find((x) => x.id === d.spec.ref); if (t) st.set({ triggers: st.triggers.map((x) => (x.id === t.id ? { ...x, price: +p.toFixed(2), dir: p >= st.prices[key].ltp ? 'above' : 'below' } : x)) }); break }
        case 'draw': { st.toggleDrawing(key, d.spec.ref as number); st.toggleDrawing(key, p); break }
        case 'g-entry': setTicket((t) => t && { ...t, entry: p }); break
        case 'g-sl': setTicket((t) => t && { ...t, sl: p }); break
        case 'g-tgt': setTicket((t) => t && { ...t, tgt: p }); break
      }
      rerender()
    }
    const ctx = (e: MouseEvent) => {
      e.preventDefault(); const m = main(); if (!m) return; const r = el.current!.getBoundingClientRect(); const y = e.clientY - r.top, x = e.clientX - r.left
      const price = m.coordinateToPrice(y); if (price == null) return
      setMenu({ x, y, price, time: mapper()?.t(x) ?? undefined })
    }
    w.addEventListener('pointerdown', down, true); w.addEventListener('pointermove', move); w.addEventListener('pointerup', up); w.addEventListener('pointercancel', up); w.addEventListener('contextmenu', ctx)
    return () => { w.removeEventListener('pointerdown', down, true); w.removeEventListener('pointermove', move); w.removeEventListener('pointerup', up); w.removeEventListener('pointercancel', up); w.removeEventListener('contextmenu', ctx) }
  }, [key, tf, cfg.magnet]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Clicks: one-click tools, and multi-click drawings (2 for lines/fib/rect/measure, 3 for channels) ----
  useEffect(() => {
    const chart = chartRef.current; if (!chart) return
    const h = (p: { point?: { x: number; y: number }; time?: Time }) => {
      if (!p.point || ['cross', 'dot', 'arrow'].includes(tool)) return
      const m = mainRef.current!; const mp = mapper(); const raw = m.coordinateToPrice(p.point.y); if (raw == null || !mp) return
      const st = useStore.getState()
      const price = magnet(p.time as number | undefined, p.point.y, raw)
      const t = (p.time as number | undefined) ?? mp.t(p.point.x); if (t == null) return
      const done = () => { setDraft(null); if (!st.chart.keepDrawing) setTool('cross') }
      if (tool === 'hline') { st.toggleDrawing(key, price); done(); return }
      if (tool === 'alert') { if (!opt) { st.addTrigger({ sym: key, dir: price >= st.prices[key].ltp ? 'above' : 'below', price: +price.toFixed(2) }); st.setToast(`Alert set at ₹${price.toFixed(2)}`) } done(); return }
      const kind = tool as Drawing['kind']; const need = CLICKS[tool] ?? 2
      const pts = [...(draftRef.current?.pts ?? []), { t, p: price }]
      if (pts.length < need) { setDraft({ pts }); return }
      const a = pts[0], b = pts[1] ?? pts[0]
      if (kind === 'long' || kind === 'short') {
        const r = (atr(dataRef.current).at(-1) || a.p * 0.005) * 1.5; const dir = kind === 'long' ? 1 : -1
        const id = st.addShape(key, { kind, t1: a.t, p1: a.p, t2: a.t + 25 * TF_SEC[tf], p2: a.p + dir * 2 * r, p3: a.p - dir * r }); setSelected(id)
      } else if (kind === 'text') { const id = st.addShape(key, { kind, t1: a.t, p1: a.p, t2: a.t, p2: a.p, text: 'Text' }); setSelected(id) }
      else if (kind === 'hray' || kind === 'vline') st.addShape(key, { kind, t1: a.t, p1: a.p, t2: a.t, p2: a.p })
      else { if (a.t === b.t && kind !== 'rect' && kind !== 'measure') return; const id = st.addShape(key, { kind, t1: a.t, p1: a.p, t2: b.t, p2: b.p, ...(kind === 'channel' ? { p3: pts[2].p - (a.p + (b.p - a.p) * (toLogical(pts[2].t) - toLogical(a.t)) / ((toLogical(b.t) - toLogical(a.t)) || 1)) } : {}) }); if (kind !== 'measure') setSelected(id) }
      done()
    }
    chart.subscribeClick(h); return () => chart.unsubscribeClick(h)
  }, [tool, key, tf, cfg.type, JSON.stringify(cfg.inds), cfg.scale, theme, multi, cfg.magnet, cfg.keepDrawing]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!isDrawTool(tool)) setDraft(null) }, [tool])

  // ---- Ticket ----
  const openTicket = (side: 'BUY' | 'SELL', price?: number, plan?: { sl: number; tgt: number }, lmt?: boolean) => {
    if (!tradable) { s.setToast('Indices trade through options. Pick the ATM call or put from the symbol search, or open the option chain.'); return }
    const a = atr(dataRef.current).at(-1)! * 1.5 || ltp * 0.01
    const market = price == null; const entry = +(price ?? ltp).toFixed(2); const dir = side === 'BUY' ? 1 : -1
    setTicket({ side, entry, market, lmt, sl: plan?.sl ?? +Math.max(0.05, entry - dir * a).toFixed(2), tgt: plan?.tgt ?? +Math.max(0.05, entry + dir * 2 * a).toFixed(2) })
  }
  useEffect(() => { if (req) openTicket(req.side, req.entry, req.sl != null && req.tgt != null ? { sl: req.sl, tgt: req.tgt } : undefined, req.limit) }, [req?.n]) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Keyboard (active pane only), TradingView-style ----
  useEffect(() => {
    if (!active) return
    const h = (e: KeyboardEvent) => {
      const tg = document.activeElement?.tagName; if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT' || document.querySelector('[role=dialog][aria-modal=true]')) return
      const st = useStore.getState(); const kk = e.key.toLowerCase(); const hv = hoverRef.current
      if ((e.metaKey || e.ctrlKey) && kk === 'z') { e.preventDefault(); if (e.shiftKey) st.redo(key); else st.undo(key); return }
      if ((e.metaKey || e.ctrlKey) && kk === 'y') { e.preventDefault(); st.redo(key); return }
      if (e.metaKey || e.ctrlKey) return
      if (e.altKey) {
        const map: Record<string, Tool> = { KeyT: 'trend', KeyH: 'hline', KeyJ: 'hray', KeyV: 'vline', KeyF: 'fib', KeyA: 'alert' }
        if (e.code === 'KeyR') { e.preventDefault(); paneApi[idx]?.reset(); return }
        if (e.code === 'KeyL') { e.preventDefault(); st.setChart({ scale: st.chart.scale === 'log' ? 'normal' : 'log' }); return }
        if (e.code === 'KeyP') { e.preventDefault(); st.setChart({ scale: st.chart.scale === 'percent' ? 'normal' : 'percent' }); return }
        const tl = map[e.code]; if (!tl) return
        e.preventDefault()
        if (hv && (tl === 'hline' || tl === 'alert')) { if (tl === 'hline') st.toggleDrawing(key, hv.price); else if (!opt) { st.addTrigger({ sym: key, dir: hv.price >= ltp ? 'above' : 'below', price: +hv.price.toFixed(2) }); st.setToast(`Alert set at ₹${hv.price.toFixed(2)}`) } }
        else setTool(tool === tl ? 'cross' : tl)
        return
      }
      if ((kk === 'delete' || kk === 'backspace') && selected) { e.preventDefault(); st.removeShape(key, selected); setSelected(null); return }
      if (kk === 'escape') { setTicket(null); setTool('cross'); setSelected(null); setDraft(null); setMenu(null); setIntervalDraft(''); return }
      if ((kk === 'b' || kk === 's') && e.shiftKey && st.instant && tradable) { e.preventDefault(); st.setToast(st.place(key, kk === 'b' ? 'BUY' : 'SELL', opt ? inst.lot : 1, 'MARKET', 0, opt ? 'NRML' : 'MIS', { via: 'chart' })); return }
      if (kk === 'b' || kk === 's') { e.preventDefault(); openTicket(kk === 'b' ? 'BUY' : 'SELL'); return }
      // Typing a number changes the interval (TradingView): 1, 3, 5, 15, 30, 60, 120, 240, then D / W / M.
      if (/^\d$/.test(e.key) || (interval && /^[dwm]$/.test(kk))) { e.preventDefault(); setIntervalDraft((v) => (v + e.key).slice(0, 4).toUpperCase()); return }
      if (kk === 'enter' && interval) {
        const map: Record<string, TF> = { '1': '1m', '3': '3m', '5': '5m', '15': '15m', '30': '30m', '60': '1h', '120': '2h', '240': '4h', D: '1D', '1D': '1D', W: '1W', '1W': '1W', M: '1M', '1M': '1M' }
        const tfN = map[interval]; if (tfN) st.setPane(idx, { tf: tfN }); else st.setToast(`Interval ${interval} isn't available`); setIntervalDraft(''); return
      }
      if (kk === 'tab' && multi && !e.shiftKey && document.activeElement === document.body) { e.preventDefault(); st.setActivePane((idx + 1) % st.charts.panes.filter((_, i) => document.querySelector(`[data-pane="${i}"]`)).length); return }
      // Any other letter opens symbol search, like TradingView.
      if (/^[a-z]$/.test(kk) && !e.shiftKey && !e.altKey) { e.preventDefault(); onSearch(e.key.toUpperCase()) }
    }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  })

  const mp = mapper()
  const yFor = (p: number) => mainRef.current?.priceToCoordinate(p) ?? null
  const removeLine = (sp: LineSpec) => {
    const st = useStore.getState()
    if (sp.kind === 'position') st.setToast(st.place(key, pos!.qty > 0 ? 'SELL' : 'BUY', Math.abs(pos!.qty), 'MARKET', 0, pos!.product, { via: 'chart' }))
    else if (sp.kind === 'order') st.cancel(sp.ref as number)
    else if (sp.kind === 'sl') st.setBracket(key, { sl: undefined, trail: undefined })
    else if (sp.kind === 'tgt') st.setBracket(key, { tgt: undefined })
    else if (sp.kind === 'alert') st.removeTrigger(sp.ref as number)
    else if (sp.kind === 'draw') st.toggleDrawing(key, sp.ref as number)
  }
  const removeLabel: Partial<Record<Kind, string>> = { position: 'Exit position at market', order: 'Cancel order', sl: 'Remove stop', tgt: 'Remove target', alert: 'Delete alert', draw: 'Delete line' }
  const d = dataRef.current
  const bar = hover?.idx != null && hover.idx >= 0 && hover.idx < d.length ? d[hover.idx] : d.at(-1)
  const prevBar = bar ? d[d.indexOf(bar) - 1] : undefined
  const barChg = bar && prevBar ? bar.close - prevBar.close : 0
  const barPattern = aiOn && bar ? patterns(d).find((p) => p.time === bar.time) : undefined
  const sel = myShapes.find((x) => x.id === selected)
  const preview: Drawing | null = draft && hover && mp ? (() => {
    const a = draft.pts[0]; const b = draft.pts[1] ?? { t: hover.time ?? mp.t(hover.x) ?? a.t, p: hover.price }; const kind = tool as Drawing['kind']
    if (kind === 'channel' && draft.pts.length === 2) { const off = hover.price - (a.p + (b.p - a.p) * ((toLogical(mp.t(hover.x) ?? b.t) - toLogical(a.t)) / ((toLogical(b.t) - toLogical(a.t)) || 1))); return { id: 'preview', kind, t1: a.t, p1: a.p, t2: b.t, p2: b.p, p3: off } }
    return { id: 'preview', kind: kind === 'channel' ? 'trend' : kind, t1: a.t, p1: a.p, t2: b.t, p2: b.p }
  })() : null
  const legendFor = (id: string, i: number) => { const plots = (vals as Record<string, unknown>)[id + ':plots'] as { values: number[] }[] | undefined; const j = hover?.idx != null && hover.idx < d.length ? hover.idx : d.length - 1; return plots?.[i]?.values[j] }
  const fmtV = (v: number | undefined, compact = false) => (v == null || !Number.isFinite(v) ? '—' : !compact ? v.toFixed(2) : Math.abs(v) >= 1e7 ? `${(v / 1e7).toFixed(2)}Cr` : Math.abs(v) >= 1e5 ? `${(v / 1e5).toFixed(2)}L` : Math.abs(v) >= 1e4 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(2))
  const toolHint = draft ? (tool === 'channel' && draft.pts.length === 2 ? 'Click to set the channel width' : 'Click the next point') : isDrawTool(tool) ? `Click to place: ${KIND_LABEL[tool as Drawing['kind']]}` : tool === 'hline' ? 'Click to draw a horizontal line' : tool === 'alert' ? 'Click to set a price alert' : ''
  const exch = opt ? 'NFO' : inst.seg === 'IDX' ? 'INDEX' : 'NSE'

  return (
    <div data-pane={idx} className={cn('relative min-h-0 min-w-0 bg-[var(--chart-bg)]', multi && active && 'outline outline-2 -outline-offset-2 outline-fg', className)}
      onPointerDownCapture={() => !active && useStore.getState().setActivePane(idx)} aria-label={`Chart ${idx + 1}: ${labelOf(key)}${active ? ', active' : ''}`} role="region">
      <div ref={wrap} className={cn('absolute inset-0', (isDrawTool(tool) || tool === 'hline' || tool === 'alert') && 'cursor-crosshair', tool === 'dot' && 'cursor-none')}>
        <div ref={el} className="absolute inset-0" />

        {/* Drawings layer */}
        {mp && <svg className="pointer-events-none absolute left-0 top-0 z-[5] overflow-visible" width={mp.w} height={mp.h} aria-hidden>
          <defs><clipPath id={`clip-${idx}`}><rect x={0} y={0} width={mp.w} height={mp.h} /></clipPath><marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
          <g clipPath={`url(#clip-${idx})`}>
            {myShapes.map((sh) => renderDrawing(sh, mp, sh.id === selected))}
            {preview && renderDrawing(preview, mp, false, 'preview')}
            {tool === 'dot' && hover && <circle cx={hover.x} cy={hover.y} r={3} fill="var(--fg)" />}
          </g>
        </svg>}

        {/* Legend: symbol line, then one row per indicator with hide / settings / remove on hover */}
        <div data-overlay className="pointer-events-none absolute left-2 top-1.5 z-10 max-w-[80%] space-y-0.5 text-[11px]">
          <div className="pointer-events-auto flex flex-wrap items-center gap-x-2 text-fg-muted">
            <button onClick={() => onSearch('')} className="rounded px-1 font-sans text-[13px] font-bold text-fg hover:bg-hover">{labelOf(key)}</button>
            <span>· {tf} · {exch}</span>
            {bar && <span className="num flex flex-wrap gap-x-2"><span>O<span className={barChg >= 0 ? 'text-up' : 'text-down'}>{bar.open.toFixed(2)}</span></span><span>H<span className={barChg >= 0 ? 'text-up' : 'text-down'}>{bar.high.toFixed(2)}</span></span><span>L<span className={barChg >= 0 ? 'text-up' : 'text-down'}>{bar.low.toFixed(2)}</span></span><span>C<span className={barChg >= 0 ? 'text-up' : 'text-down'}>{bar.close.toFixed(2)}</span></span>
              <span className={barChg >= 0 ? 'text-up' : 'text-down'}>{barChg >= 0 ? '+' : '−'}{Math.abs(barChg).toFixed(2)} ({barChg >= 0 ? '+' : '−'}{prevBar ? Math.abs(barChg / prevBar.close * 100).toFixed(2) : '0.00'}%)</span></span>}
            {barPattern && <span className="font-sans" style={{ color: 'var(--chart-5)' }}>· {barPattern.name}</span>}
          </div>
          {cfg.inds.filter((ins) => indDef(ins.type)?.overlay).map((ins) => <IndRow key={ins.id} ins={ins} values={[0, 1, 2].map((i) => legendFor(ins.id, i)).filter((x) => x !== undefined).map((v) => fmtV(v, !!indDef(ins.type)?.ownScale || ins.type === 'obv'))} editing={editInd === ins.id} setEditing={(v) => setEditInd(v ? ins.id : null)} />)}
          {toolHint && active && <Badge tone="info">{toolHint} · Esc to cancel</Badge>}
          {/* A switch that changes what you see should say so on the chart, with the way back one click away. */}
          {active && (cfg.hideAll || cfg.lockAll) && ((s.shapes[key]?.length ?? 0) + (s.drawings[key]?.length ?? 0)) > 0 && (
            <span className="pointer-events-auto inline-flex items-center gap-2 rounded border border-line bg-raised px-2 py-0.5 text-[11px] text-fg-muted">
              {cfg.hideAll ? 'Drawings hidden' : 'Drawings locked'}
              <button type="button" className="font-medium text-fg hover:underline" onClick={() => s.setChart(cfg.hideAll ? { hideAll: false } : { lockAll: false })}>{cfg.hideAll ? 'Show' : 'Unlock'}</button>
            </span>)}
          {interval && <span className="pointer-events-auto inline-flex items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-[13px] shadow-md"><b className="num">{interval}</b><span className="text-fg-subtle">Enter to change interval</span></span>}
        </div>
        {/* Legends for indicator panes */}
        {paneTops.map((pt) => { const ins = cfg.inds.find((x) => x.id === pt.id); if (!ins) return null; return (
          <div key={pt.id} data-overlay className="pointer-events-none absolute left-2 z-10 text-[11px]" style={{ top: pt.top + 4 }}>
            <IndRow ins={ins} values={[0, 1, 2].map((i) => legendFor(ins.id, i)).filter((x) => x !== undefined).map((v) => fmtV(v, ins.type === 'obv'))} editing={editInd === ins.id} setEditing={(v) => setEditInd(v ? ins.id : null)} />
          </div>) })}

        {/* Price-line labels with inline actions */}
        {specs.filter((sp) => sp.kind !== 'pivot' && sp.kind !== 'ai' && !sp.kind.startsWith('g-')).map((sp) => {
          const y = yFor(dragRef.current?.spec.id === sp.id ? dragRef.current.price : sp.price); if (y == null || y < 4) return null
          return (
            <div key={sp.id} data-overlay className="absolute right-[70px] z-10 flex -translate-y-1/2 items-center gap-1 rounded-md border bg-surface py-0.5 pl-2.5 pr-1 text-[11px]" style={{ top: y, borderColor: sp.color }}>
              <span className="num whitespace-nowrap" style={{ color: sp.kind === 'position' ? undefined : sp.color }}>{sp.label}</span>
              {sp.kind === 'position' && !s.brackets[key]?.sl && !multi && <button className="rounded-md px-1.5 text-fg-muted hover:bg-hover" onClick={() => { const a = atr(d).at(-1)! * 1.5; s.setBracket(key, { sl: +(pos!.avg - Math.sign(pos!.qty) * a).toFixed(2), tgt: +(pos!.avg + Math.sign(pos!.qty) * 2 * a).toFixed(2) }) }}>Add stop and target</button>}
              {sp.kind === 'sl' && !multi && <button className="rounded-md px-1.5 text-fg-muted hover:bg-hover" onClick={() => s.setBracket(key, { trail: Math.abs(ltp - sp.price), peak: ltp })}>{s.brackets[key]?.trail ? 'Trailing' : 'Trail'}</button>}
              {removeLabel[sp.kind] && <IconButton size="sm" label={removeLabel[sp.kind]!} onClick={() => removeLine(sp)}><XIcon width={10} height={10} /></IconButton>}
            </div>)
        })}

        {/* Floating toolbar for the selected drawing (TradingView style) */}
        {sel && active && <DrawingToolbar sh={sel} k={key} onDelete={() => { s.removeShape(key, sel.id); setSelected(null) }}
          onTrade={(sel.kind === 'long' || sel.kind === 'short') && tradable ? () => openTicket(sel.kind === 'long' ? 'BUY' : 'SELL', sel.p1 === +ltp.toFixed(2) ? undefined : sel.p1, { sl: +(sel.p3 ?? sel.p1).toFixed(2), tgt: +sel.p2.toFixed(2) }) : undefined}
          onAlert={!opt ? () => { const p = sel.kind === 'fib' ? sel.p2 + (sel.p1 - sel.p2) * 0.618 : sel.kind === 'long' || sel.kind === 'short' ? sel.p2 : sel.p2; s.addTrigger({ sym: key, dir: p >= ltp ? 'above' : 'below', price: +p.toFixed(2) }); s.setToast(`Alert set at ₹${p.toFixed(2)}`) } : undefined} />}

        {/* "+" on the price axis: trade at that price */}
        {hover && !ticket && !draft && !isDrawTool(tool) && tool !== 'hline' && tool !== 'alert' && tradable && active && (
          <button data-overlay onClick={() => openTicket(hover.price <= ltp ? 'BUY' : 'SELL', hover.price)} aria-label={`Place an order at ${hover.price.toFixed(2)}`}
            className="absolute right-[56px] z-20 flex size-5 -translate-y-1/2 items-center justify-center rounded-md bg-accent text-on-accent" style={{ top: hover.y }}>
            <PlusIcon width={12} height={12} /></button>)}

        {/* Right-click menu */}
        {menu && <div data-overlay role="menu" aria-label="Chart actions" className="absolute z-40 w-64 overflow-hidden rounded-[10px] border border-line bg-raised p-1.5 text-[13px] shadow-lg animate-rise" style={{ left: Math.min(menu.x, (wrap.current?.clientWidth ?? 400) - 270), top: Math.min(menu.y, (wrap.current?.clientHeight ?? 400) - 280) }}>
          {[
            ...(tradable ? [{ label: `Buy ${menu.price < ltp ? 'limit' : 'stop'} at ${menu.price.toFixed(2)}`, run: () => openTicket('BUY', menu.price) }, { label: `Sell ${menu.price > ltp ? 'limit' : 'stop'} at ${menu.price.toFixed(2)}`, run: () => openTicket('SELL', menu.price) }] : []),
            ...(!opt ? [{ label: `Add alert at ${menu.price.toFixed(2)}`, run: () => { s.addTrigger({ sym: key, dir: menu.price >= ltp ? 'above' : 'below', price: +menu.price.toFixed(2) }); s.setToast(`Alert set at ₹${menu.price.toFixed(2)}`) } }] : []),
            { label: `Draw horizontal line at ${menu.price.toFixed(2)}`, run: () => s.toggleDrawing(key, menu.price) },
            { label: 'Reset chart view', hint: 'Alt+R', run: () => paneApi[idx]?.reset() },
            { label: cfg.hideAll ? 'Show drawings' : 'Hide drawings', run: () => s.setChart({ hideAll: !cfg.hideAll }) },
            { label: 'Remove all drawings', run: () => { s.removeShape(key); s.set({ drawings: { ...s.drawings, [key]: [] } }) } },
            { label: `Copy price ${menu.price.toFixed(2)}`, run: () => navigator.clipboard?.writeText(menu.price.toFixed(2)) },
          ].map((it) => <button key={it.label} role="menuitem" onClick={() => { it.run(); setMenu(null) }} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-hover"><span>{it.label}</span>{'hint' in it && it.hint && <span className="text-[11px] text-fg-subtle">{it.hint}</span>}</button>)}
        </div>}

        {ticket && <ChartTicket k={key} t={ticket} ltp={ltp} lot={opt ? inst.lot : 1} onChange={setTicket} onClose={() => setTicket(null)} />}
      </div>
    </div>
  )
}

const firstColor = (ins: IndInstance) => { try { return indDef(ins.type)?.compute([], ins.params)[0]?.color ?? '--chart-1' } catch { return '--chart-1' } }

/** One indicator in the legend. Hover shows hide, settings and remove, like TradingView. */
function IndRow({ ins, values, editing, setEditing }: { ins: IndInstance; values: string[]; editing: boolean; setEditing: (v: boolean) => void }) {
  const def = indDef(ins.type); const st = useStore()
  // Close the settings on a press anywhere outside this legend row, or on Escape. pointerdown, because the chart
  // canvas cancels pointerdown and so suppresses mousedown.
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!editing) return
    const out = (e: PointerEvent) => { if (!row.current?.contains(e.target as Node)) setEditing(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(false) }
    document.addEventListener('pointerdown', out); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', out); document.removeEventListener('keydown', key) }
  }, [editing, setEditing])
  if (!def) return null
  const update = (p: Partial<IndInstance>) => st.setChart({ inds: st.chart.inds.map((x) => (x.id === ins.id ? { ...x, ...p } : x)) })
  const color = `var(${ins.color ?? firstColor(ins)})`
  return (
    <div ref={row} className="group pointer-events-auto relative flex items-center gap-1.5">
      <span className={cn('rounded px-1', !ins.visible && 'opacity-50')} style={{ color }}>{instanceTitle(ins)}</span>
      {ins.visible && <span className="num text-fg-muted">{values.join(' ')}</span>}
      <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button aria-label={ins.visible ? `Hide ${def.name}` : `Show ${def.name}`} onClick={() => update({ visible: !ins.visible })} className="rounded p-0.5 text-fg-subtle hover:bg-hover hover:text-fg">{ins.visible ? <EyeIcon width={14} height={14} /> : <EyeOffIcon width={14} height={14} />}</button>
        <button aria-label={`${def.name} settings`} onClick={() => setEditing(!editing)} className="rounded p-0.5 text-fg-subtle hover:bg-hover hover:text-fg"><SettingsGearIcon width={14} height={14} /></button>
        <button aria-label={`Remove ${def.name}`} onClick={() => st.setChart({ inds: st.chart.inds.filter((x) => x.id !== ins.id) })} className="rounded p-0.5 text-fg-subtle hover:bg-hover hover:text-fg"><XIcon width={11} height={11} /></button>
      </span>
      {editing && <div role="dialog" aria-label={`${def.name} settings`} className="absolute left-0 top-full z-40 mt-1 w-64 space-y-3 rounded-[10px] border border-line bg-raised p-3 text-[12px] shadow-lg">
        <p className="font-semibold text-[15px]">{def.name}</p>
        <p className="text-fg-subtle">{def.desc}</p>
        {def.params.map((p) => <label key={p.key} className="flex items-center justify-between gap-2">{p.label}<input type="number" min={p.min} max={p.max} step={p.step ?? 1} defaultValue={ins.params[p.key] ?? p.def} onBlur={(e) => update({ params: { ...ins.params, [p.key]: +e.target.value } })} className="num h-8 w-20 rounded-md border border-line bg-surface px-3 text-right outline-none focus:border-fg-subtle" /></label>)}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Color">{SWATCHES.map((c) => <button key={c} role="radio" aria-checked={ins.color === c} aria-label={c.replace('--', '')} onClick={() => update({ color: c })} className={cn('size-6 rounded-md border-2', ins.color === c ? 'border-fg' : 'border-transparent')} style={{ background: `var(${c})` }} />)}</div>
        <div className="flex gap-2"><Button size="sm" onClick={() => setEditing(false)}>Done</Button><Button size="sm" variant="ghost" onClick={() => update({ params: Object.fromEntries(def.params.map((p) => [p.key, p.def])), color: undefined })}>Defaults</Button></div>
      </div>}
    </div>
  )
}

/** Floating toolbar for a selected drawing: color, width, style, extend, text, lock, clone, alert, trade, delete. */
function DrawingToolbar({ sh, k, onDelete, onTrade, onAlert }: { sh: Drawing; k: string; onDelete: () => void; onTrade?: () => void; onAlert?: () => void }) {
  const st = useStore(); const upd = (p: Partial<Drawing>) => { st.snapshot(k); st.updateShape(k, sh.id, p) }
  const btn = 'flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-fg-muted hover:bg-hover hover:text-fg'
  const color = sh.color ?? DEFAULT_COLOR[sh.kind]
  return (
    <div data-overlay role="toolbar" aria-label={`${KIND_LABEL[sh.kind]} options`} className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-md border border-line bg-raised p-1 shadow-md">
      <span className="px-2 text-[12px] font-bold">{KIND_LABEL[sh.kind]}</span>
      {sh.kind !== 'long' && sh.kind !== 'short' && sh.kind !== 'measure' && <span className="flex items-center gap-1 px-1" role="radiogroup" aria-label="Color">{SWATCHES.slice(0, 6).map((c) => <button key={c} role="radio" aria-checked={color === c} aria-label={c.replace('--', '')} onClick={() => upd({ color: c })} className={cn('size-4 rounded-md border-2', color === c ? 'border-fg' : 'border-transparent')} style={{ background: `var(${c})` }} />)}</span>}
      {!['text', 'long', 'short', 'measure'].includes(sh.kind) && <>
        <button className={btn} aria-label="Line width" onClick={() => upd({ width: (((sh.width ?? 1) % 3) + 1) as 1 | 2 | 3 })}>{sh.width ?? 1}px</button>
        <button className={btn} aria-label="Line style" onClick={() => upd({ dash: (((sh.dash ?? 0) + 1) % 3) as 0 | 1 | 2 })}>{['Solid', 'Dashed', 'Dotted'][sh.dash ?? 0]}</button>
      </>}
      {(sh.kind === 'trend' || sh.kind === 'channel' || sh.kind === 'fib') && <button className={btn} aria-pressed={!!sh.extendRight} onClick={() => upd({ extendRight: !sh.extendRight })}>Extend right</button>}
      {sh.kind === 'text' && <input aria-label="Text" defaultValue={sh.text} onChange={(e) => st.updateShape(k, sh.id, { text: e.target.value || 'Text' })} className="h-7 w-36 rounded-md border border-line bg-surface px-3 text-[12px] outline-none focus:border-fg-subtle" autoFocus />}
      {onTrade && <Button size="sm" variant="primary" onClick={onTrade}>Trade this</Button>}
      {onAlert && <button className={btn} onClick={onAlert} aria-label="Alert at this drawing"><BellIcon width={14} height={14} /></button>}
      <button className={btn} onClick={() => st.addShape(k, { ...sh, t1: sh.t1 + 5 * 60, t2: sh.t2 + 5 * 60 })} aria-label="Clone"><CloneIcon width={14} height={14} /></button>
      <button className={btn} onClick={() => upd({ locked: !sh.locked })} aria-label={sh.locked ? 'Unlock' : 'Lock'}>{sh.locked ? <LockIcon width={14} height={14} /> : <UnlockIcon width={14} height={14} />}</button>
      <button className={btn} onClick={onDelete} aria-label="Delete drawing"><TrashIcon width={14} height={14} /></button>
    </div>
  )
}

/** Order ticket on the chart: entry, stop and target are lines you can drag; size comes from the rupees you are willing to risk. */
function ChartTicket({ k, t, ltp, lot, onChange, onClose }: { k: string; t: Ticket; ltp: number; lot: number; onChange: (t: Ticket) => void; onClose: () => void }) {
  const st = useStore(); const gate = useEntryGate()
  // Selling stock you hold while entries are paused is an exit from delivery: start there.
  const holding = t.side === 'SELL' && !st.positions[k]?.qty ? st.holdings.find((h) => h.sym === k && h.qty > 0) : undefined
  const [risk, setRisk] = useState(2000); const [product, setProduct] = useState<'MIS' | 'CNC'>(gate && holding ? 'CNC' : 'MIS'); const [trail, setTrail] = useState(false); const [tag, setTag] = useState<string>()
  const opt = lot > 1
  const entry = t.market ? ltp : t.entry; const dir = t.side === 'BUY' ? 1 : -1
  const perUnit = Math.abs(entry - t.sl)
  const sized = Math.max(lot, Math.floor(risk / Math.max(perUnit, 0.05) / lot) * lot)
  // While entries are paused only exits go through, so a closing ticket never asks for more than you hold.
  const pos = st.positions[k]; const closing = !!pos?.qty && (pos.qty > 0) === (t.side === 'SELL')
  const qty = gate && closing ? Math.min(sized, Math.abs(pos.qty)) : gate && holding && product === 'CNC' ? Math.min(sized, holding.qty) : sized
  // An exit doesn't need a reason; the position already has one.
  const closingOnly = closing || (!!holding && product === 'CNC')
  const reward = Math.abs(t.tgt - entry) * qty; const rr = Math.abs(t.tgt - entry) / Math.max(perUnit, 0.05)
  const held = gate && opensPosition(k, t.side, qty, opt ? 'NRML' : product)
  const valid = (t.sl - entry) * dir < 0 && (t.tgt - entry) * dir > 0
  const otype: OType = t.market ? 'MARKET' : t.lmt || (t.side === 'BUY') === (entry < ltp) ? 'LIMIT' : 'SL-M'
  const field = 'num h-8 w-28 rounded-md border border-line bg-surface px-3 text-right text-[12px] outline-none focus:border-fg-subtle'
  const cost = useOrderCost(k, t.side, qty, entry, opt ? 'NRML' : product)
  const [lo, hi] = priceBand(ltp); const outBand = !t.market && !opt && (t.entry < lo || t.entry > hi)
  const place = () => {
    const msg = st.place(k, t.side, qty, otype, otype === 'LIMIT' ? entry : 0, opt ? 'NRML' : product, { trigger: otype === 'SL-M' ? entry : undefined, sl: t.sl, tgt: t.tgt, trail: trail ? +perUnit.toFixed(2) : undefined, tag, via: 'chart' })
    st.setToast(msg); if (!msg.startsWith('Rejected')) onClose()
  }
  return (
    <div data-overlay role="dialog" aria-label={`${t.side === 'BUY' ? 'Buy' : 'Sell'} ${labelOf(k)} from the chart`} className="absolute bottom-3 left-3 z-30 w-[328px] max-w-[calc(100%-24px)] rounded-[10px] border border-line bg-raised p-3 shadow-lg animate-rise max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:left-0 max-md:z-50 max-md:max-h-[85dvh] max-md:w-auto max-md:max-w-none max-md:overflow-y-auto max-md:rounded-b-none max-md:pb-[calc(12px+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <SegmentedControl size="sm" label="Side" value={t.side} onChange={(side) => { const a = Math.abs(entry - t.sl) || ltp * 0.01; const d = side === 'BUY' ? 1 : -1; onChange({ ...t, side, sl: +Math.max(0.05, entry - d * a).toFixed(2), tgt: +Math.max(0.05, entry + d * 2 * a).toFixed(2) }) }} options={[{ value: 'BUY', label: 'Buy' }, { value: 'SELL', label: 'Sell' }]} />
        {!opt && <SegmentedControl size="sm" label="Product" value={product} onChange={setProduct} options={[{ value: 'MIS', label: 'Intraday' }, { value: 'CNC', label: 'Delivery' }]} />}
        {opt && <Badge>Lot {lot}</Badge>}
        <IconButton size="sm" label="Close ticket" className="ml-auto" onClick={onClose}><XIcon width={12} height={12} /></IconButton>
      </div>
      <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[12px]">
        <span className="text-fg-subtle">Entry</span>
        <span className="flex items-center gap-2">{t.market ? <span className="num">Market · {ltp.toFixed(2)}</span> : <input aria-label="Entry price" type="number" step={0.05} className={cn(field, outBand && 'border-danger')} value={t.entry} onChange={(e) => onChange({ ...t, entry: +e.target.value })} />}
          <button className="text-[11px] text-fg-muted underline" onClick={() => onChange({ ...t, market: !t.market, entry: +ltp.toFixed(2) })}>{t.market ? 'Use a price' : 'Use market'}</button></span>
        {!t.market && !opt && <><span /><span className={cn('-mt-1 text-[11px]', outBand ? 'text-down' : 'text-fg-subtle')}>{outBand ? 'Outside the allowed range ' : 'Allowed '}<span className="num">{lo.toFixed(2)} – {hi.toFixed(2)}</span></span></>}
        <span className="text-down">Stop</span><LevelInput label="Stop" kind="sl" side={t.side} entry={entry} value={t.sl} onChange={(p) => p != null && onChange({ ...t, sl: p })} />
        <span className="text-up">Target</span><LevelInput label="Target" kind="tgt" side={t.side} entry={entry} value={t.tgt} onChange={(p) => p != null && onChange({ ...t, tgt: p })} />
        <span className="text-fg-subtle">Risk ₹</span><input aria-label="Rupees to risk" type="number" step={500} className={field} value={risk} onChange={(e) => setRisk(Math.max(100, +e.target.value))} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-sunken p-2 text-center text-[11px]">
        <div><div className="text-fg-subtle">Quantity</div><b className="num text-[13px]">{qty}</b>{opt && <div className="text-fg-subtle">{qty / lot} lot{qty / lot > 1 ? 's' : ''}</div>}</div>
        <div><div className="text-fg-subtle">Risk / reward</div><b className="num text-[13px]">1 : {rr.toFixed(1)}</b></div>
        <div><div className="text-fg-subtle">Reward</div><b className="num text-[13px] text-up">{inr(reward)}</b></div>
      </div>
      {opt && perUnit * lot > risk && <p className="mt-2 text-[11px] text-fg-muted">One lot already risks {inr(perUnit * lot)}, more than your {inr(risk)}.</p>}
      <div className="mt-2"><LabeledSwitch label="Trail the stop as price moves" checked={trail} onChange={setTrail} /></div>
      {!closingOnly && <div className="mt-2"><TagPicker value={tag} onChange={setTag} /></div>}
      {!valid && <p className="mt-2 text-[11px] text-down">The stop must be on the losing side and the target on the winning side of the entry.</p>}
      <CostLine cost={cost} className="mt-3 border-t border-line pt-2.5" />
      {held && gate && <GateNote g={gate} className="mt-2" />}
      <div className="mt-2.5 flex items-center gap-2">
        <Button size="sm" variant={t.side === 'BUY' ? 'primary' : 'danger'} disabled={!valid || !!held || cost.short > 0 || outBand} onClick={place}>{t.side === 'BUY' ? 'Buy' : 'Sell'} {qty} · {otype === 'MARKET' ? 'market' : otype === 'LIMIT' ? 'limit' : 'stop entry'}</Button>
        <span className="text-[11px] text-fg-subtle">Drag the lines to adjust</span>
      </div>
    </div>
  )
}
