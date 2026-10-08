// Live cards inside chat replies. Each one reads the store, so prices, P&L and order status move in place.
// Cards never trade on their own: buttons either ask the agent something or turn into a draft to approve.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createChart, AreaSeries, CandlestickSeries, LineStyle, type IChartApi, type ISeriesApi, type UTCTimestamp, type IPriceLine } from 'lightweight-charts'
import { ArrowUpRight, Bell, Check, ChevronDown, Maximize2, Minus, Plus, X } from 'lucide-react'
import { Badge, Button, MeterBar, cn } from '../ds'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from '../store'
import { useEntryGate, isEntry, GatePill, GateIcon } from '../gate'
import { insights, ruleText, type Insight, type RuleId } from '../rules'
import { setupsFor } from '../setups'
import { STYLES, EXPERIENCE, THEMES, LIMITS, planFor, applySetup, skipSetup, styleOf, type Style, type Experience } from '../setup'
import type { Action, Card, Filter, OrderAction, ViewName } from '../actions'
import {
  SECTORS, STRATEGIES, bySym, chain, charges, history, levels, legPrice, nextExpiries, barStart, simNow, fmtIST,
  intraday, labelOf, parseKey, keyOf, isExpiryDay, atr, marketOpenNow, secOfDay, TF_SEC, type Candle, type Leg, type TF,
} from '../market'
import { allMetrics, applyFilters, describeFilter, metricsFor } from '../scan'
import { legsMargin } from '../store'
import { ask, confirm, dismiss, editDraft, misClosedNow, propose } from '../ai'
import { Chg, Dir, Money, inr, inrShort } from '../ui'
import { DepthView, useDepth } from '../depth'
import { TagPicker } from '../ticket'

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
/** Hex colour with transparency, for chart fills (the chart library can't read color-mix). */
const alpha = (hex: string, a: number) => { const h = hex.replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16); return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})` }
/** ₹ amounts with Indian digit grouping: 1,45,425.50. */
const fmt = (v: number, d = 2) => v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })
/** Signed whole rupees: +₹1,250 or −₹830. */
const signed = (v: number) => `${v < 0 ? '−' : '+'}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`
const sgn = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}`
const lower = (s: string) => s.toLowerCase()
export const say = (t: string) => { void ask(t) }
export const openCanvas = (view: ViewName, sym?: string) => {
  const s = useStore.getState(); if (sym && bySym(sym)) s.setSym(sym); s.setCanvas({ view })
}

/* ------------------------------------------------------------------ shell */

function Shell({ title, meta, children, foot, className, pad = true }: { title?: ReactNode; meta?: ReactNode; children: ReactNode; foot?: ReactNode; className?: string; pad?: boolean }) {
  return (
    // A block, not a bubble: hairline frame, small radius, compact header. Trading screens are made of panels.
    <section className={cn('premium overflow-hidden rounded-[10px] border border-line bg-surface', className)}>
      {(title || meta) && <header className="flex h-10 items-center gap-3 px-3.5">
        <h3 className="min-w-0 truncate font-sans text-[13px] font-semibold leading-5 text-fg">{title}</h3>
        <div className="ml-auto flex shrink-0 items-center gap-2 text-[11px] text-fg-subtle">{meta}</div>
      </header>}
      <div className={pad ? cn('px-3.5 pb-3.5', title || meta ? 'pt-0.5' : 'pt-3.5') : undefined}>{children}</div>
      {foot && <footer className="flex min-h-11 flex-wrap items-center gap-1.5 border-t border-line px-3.5 py-2">{foot}</footer>}
    </section>
  )
}
const Act = ({ children, onClick, icon, title }: { children: ReactNode; onClick: () => void; icon?: ReactNode; title?: string }) => (
  <button type="button" title={title} onClick={onClick} className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12px] font-medium text-fg max-md:h-10 max-md:px-3.5 max-md:text-[13px] transition-colors hover:border-line-strong hover:bg-hover active:translate-y-px [&>svg]:text-fg-muted">{icon}{children}</button>
)
const Stat = ({ label, children, className }: { label: string; children: ReactNode; className?: string }) => (
  <div className={cn('min-w-0', className)}><p className="text-[11px] text-fg-subtle">{label}</p><p className="num mt-0.5 truncate text-[14px] font-medium text-fg">{children}</p></div>
)

/* ------------------------------------------------------------------ hierarchy: every card reads in the same order */
// 1 the answer (Hero) → 2 the agent's read (Read) → 3 the picture → 4 supporting numbers (Facts) → 5 actions (Shell foot).

/** Small ₹ that sits on the baseline of a big number without competing with it. */
const Rs = () => <span className="mr-0.5 align-[0.1em] font-sans text-[0.6em] font-medium text-fg-subtle">₹</span>
/** The card's answer: one value in the biggest type on the card, with its context in a line underneath. */
const Hero = ({ label, children, aside, sub }: { label?: ReactNode; children: ReactNode; aside?: ReactNode; sub?: ReactNode }) => (
  <div className="min-w-0">
    {label && <p className="text-[11px] text-fg-subtle">{label}</p>}
    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div className="num text-[24px] font-semibold leading-8 tracking-[-0.02em] text-fg">{children}</div>{aside}
    </div>
    {sub && <div className="mt-1 text-[12px] text-fg-muted">{sub}</div>}
  </div>
)
/** The agent's read: what the numbers mean, in a sentence or two. Bold carries the lead clause. */
const Read = ({ children, tone }: { children: ReactNode; tone?: 'attention' }) => (
  // The agent's commentary: one or two muted lines behind a thin rule (amber when it needs you). No tinted box, so
  // the numbers stay the loudest thing on the card.
  <div className={cn('border-l-2 pl-2.5 text-[12px] leading-5 text-fg-muted [&_b]:font-medium [&_b]:text-fg', tone === 'attention' ? 'border-[var(--attention)]' : 'border-[var(--lime)]')}>{children}</div>
)
/**
 * Detail on demand: one full-width row that names what's inside, so the card stays short until you ask. The summary
 * says what you'd find (and, where it helps, a number), so opening it is a choice, not a guess.
 */
function More({ label, summary, children, defaultOpen = false }: { label: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-line">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-9 w-full items-center gap-2 px-3.5 text-left text-[12px] text-fg-muted transition-colors hover:bg-hover hover:text-fg">
        <span className="font-medium text-fg">{label}</span>{summary && <span className="min-w-0 truncate text-fg-subtle">{summary}</span>}
        <ChevronDown size={14} strokeWidth={1.75} className={cn('ml-auto shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="animate-rise">{children}</div>}
    </div>
  )
}

type Fact = { k: string; v: ReactNode; note?: ReactNode; warn?: boolean }
const FACT_COLS = { 2: '@lg:grid-cols-2', 3: '@lg:grid-cols-3', 4: '@lg:grid-cols-4' } as const
/** Supporting numbers as a ruled grid across the card: small label, value a step up, and a word on what it means. */
function Facts({ items, cols = 4, top = true }: { items: Fact[]; cols?: 2 | 3 | 4; top?: boolean }) {
  return (
    <dl className={cn('grid grid-cols-2 gap-px bg-[var(--border)]', FACT_COLS[cols], top && 'border-t border-line')}>
      {items.map(({ k, v, note, warn }, i) => (
        <div key={k} className={cn('min-w-0 bg-surface px-3.5 py-2', items.length % 2 === 1 && i === items.length - 1 && 'col-span-2 @lg:col-span-1')}>
          <dt className="truncate text-[11px] text-fg-subtle">{k}</dt>
          <dd className="mt-0.5 flex min-w-0 items-baseline gap-1.5"><span className="num truncate text-[13px] font-medium text-fg">{v}</span>
            {note && <span className={cn('truncate text-[11px]', warn ? 'text-[var(--attention-fg)]' : 'text-fg-subtle')}>{note}</span>}</dd>
        </div>))}
    </dl>
  )
}

/** Does this draft break a standing rule? Same numbers the order draft shows, so the reason and the disabled Place agree. */
function ruleBreak(a: Action): { kind: 'stop' } | { kind: 'risk'; risk: number; cap: number; fit: number } | { kind: 'setup'; tag: string } | null {
  const s = useStore.getState(); if (a.t !== 'order' || !isEntry(a, s)) return null
  if (a.tag && s.rules.pausedSetups?.includes(a.tag)) return { kind: 'setup', tag: a.tag }
  if (s.rules.stopRequired && !a.strike && a.sl == null) return { kind: 'stop' }
  if (s.rules.maxRiskPct && a.sl != null) {
    const { key, qty } = s.resolveOrder(a); const ref = a.otype === 'LIMIT' && a.price ? a.price : s.ltp(key)
    const unit = Math.abs(ref - a.sl) * (qty / a.qty); const risk = unit * a.qty; const cap = s.cash * s.rules.maxRiskPct / 100
    if (risk > cap) return { kind: 'risk', risk, cap, fit: Math.max(1, Math.floor(cap / unit)) }
  }
  return null
}

/**
 * The strongest finding from your trades with the rule that answers it, one tap to switch on. After the tap it stays
 * as a confirmation with Undo (instead of jumping straight to the next finding), so you see what changed.
 */
function InsightRead({ list, fallback = null }: { list: Insight[]; fallback?: ReactNode }) {
  const rules = useStore((s) => s.rules); const [done, setDone] = useState<RuleId | null>(null)
  if (done && rules[done] != null) return <Read><b>Rule on: {ruleText(done, rules)}.</b> I'll hold every new entry to it. <button type="button" onClick={() => { useStore.getState().setRules({ [done]: undefined }); setDone(null) }} className="font-medium text-fg underline underline-offset-2">Undo</button></Read>
  const it = list[0]; if (!it) return <>{fallback}</>
  return (
    <Read tone="attention"><b>{it.lead}.</b> {it.detail}
      <span className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => { useStore.getState().setRules(it.rule); setDone(it.id) }} className="inline-flex h-7 items-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-[var(--bg)] transition-opacity hover:opacity-90">Make it a rule: {ruleText(it.id, it.rule).replace(/^./, (c) => c.toLowerCase())}</button>
      </span></Read>
  )
}

/* ------------------------------------------------------------------ mini chart */

const BARS: Record<string, number> = { '1m': 120, '5m': 90, '15m': 90, '1h': 90, '1D': 130, '1W': 104 }

/** A compact live chart: candles, AI levels, and the lines of any position on it (entry, stop, target). */
export function MiniChart({ sym, tf: tf0 = '5m', levels: showLv, height = 200, kind = 'candles', controls = true, bars, session }: { sym: string; tf?: TF; levels?: boolean; height?: number; kind?: 'candles' | 'area'; controls?: boolean; bars?: number; session?: boolean }) {
  const el = useRef<HTMLDivElement>(null)
  const [own, setTf] = useState<TF>(tf0)
  const tf = controls ? own : tf0 // without its own controls the parent owns the timeframe
  const theme = useStore((s) => s.theme)
  const pos = useStore((s) => s.positions[sym]); const br = useStore((s) => s.brackets[sym])
  const lines = useRef<IPriceLine[]>([]); const series = useRef<ISeriesApi<'Candlestick'> | ISeriesApi<'Area'> | null>(null)
  useEffect(() => {
    const inst = bySym(sym); if (!inst || !el.current) return
    const c = { bg: css('--surface'), fg: css('--fg-subtle'), grid: css('--border'), up: css('--success'), dn: css('--danger'), font: css('--ds-font-sans'), muted: css('--border-strong') }
    const area = kind === 'area'
    const chart: IChartApi = createChart(el.current, {
      autoSize: true, layout: { background: { color: c.bg }, textColor: c.fg, fontFamily: c.font, fontSize: 10, attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { visible: !area, color: c.grid } },
      rightPriceScale: { borderVisible: false, entireTextOnly: true, scaleMargins: { top: area ? 0.18 : 0.12, bottom: area ? 0.04 : 0.08 } },
      timeScale: { borderVisible: false, timeVisible: intraday(tf), rightOffset: 4, tickMarkFormatter: (t: number, type: number) => fmtIST(t, type <= 1 ? { month: 'short' } : type === 2 ? { day: 'numeric', month: 'short' } : { hour: '2-digit', minute: '2-digit', hour12: false }) },
      localization: { timeFormatter: (t: number) => fmtIST(t, intraday(tf) ? { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false } : { day: '2-digit', month: 'short', year: '2-digit' }), priceFormatter: (p: number) => p.toFixed(2) },
      handleScroll: { mouseWheel: false, pressedMouseMove: true }, handleScale: { mouseWheel: false, pinch: true },
      crosshair: { mode: area ? 1 : 0, vertLine: { color: c.muted, labelBackgroundColor: css('--fg') }, horzLine: { color: c.muted, labelBackgroundColor: css('--fg') } },
    })
    const d: Candle[] = history(inst, tf, bars ?? BARS[tf] ?? 90, useStore.getState().prices[sym].ltp)
    // Area: one calm line in the direction of the move over the window, a soft fill, and the previous close dotted.
    const rising = d[d.length - 1].close >= (intraday(tf) ? useStore.getState().prices[sym].prev : d[0].open)
    const tone = rising ? c.up : c.dn
    const s = area
      ? chart.addSeries(AreaSeries, { lineColor: tone, lineWidth: 2, topColor: alpha(tone, 0.22), bottomColor: alpha(tone, 0), priceLineVisible: false, lastValueVisible: true, crosshairMarkerRadius: 3 })
      : chart.addSeries(CandlestickSeries, { upColor: c.up, downColor: c.dn, borderVisible: false, wickUpColor: c.up, wickDownColor: c.dn, priceLineVisible: true })
    series.current = s
    s.setData(d.map((x) => (area ? { time: x.time as UTCTimestamp, value: x.close } : { ...x, time: x.time as UTCTimestamp })) as never)
    if (area && intraday(tf)) s.createPriceLine({ price: useStore.getState().prices[sym].prev, color: c.muted, lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: false, title: 'Prev close' })
    if (showLv) for (const l of levels(d.slice(-120))) s.createPriceLine({ price: l.price, color: l.kind === 'support' ? c.up : c.dn, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: `${l.kind === 'support' ? 'S' : 'R'} ${l.touches}×` })
    chart.timeScale().fitContent()
    // A one-day view spans the whole session, so the empty space on the right is the part of the day still to come.
    if (session && intraday(tf)) { const left = Math.max(0, Math.ceil((15 * 3600 + 30 * 60 - secOfDay()) / TF_SEC[tf])); chart.timeScale().setVisibleLogicalRange({ from: 0, to: d.length - 1 + left }) }
    const unsub = useStore.subscribe((st) => {
      const ltp = st.prices[sym].ltp; const t = barStart(tf, simNow()); let bar = d[d.length - 1]
      if (t > bar.time) { bar = { time: t, open: bar.close, high: ltp, low: ltp, close: ltp, volume: 0 }; d.push(bar) }
      bar.close = ltp; bar.high = Math.max(bar.high, ltp); bar.low = Math.min(bar.low, ltp)
      s.update((area ? { time: bar.time as UTCTimestamp, value: bar.close } : { ...bar, time: bar.time as UTCTimestamp }) as never)
    })
    return () => { unsub(); series.current = null; lines.current = []; chart.remove() }
  }, [sym, tf, showLv, theme, kind, bars, session])
  // Position lines follow the position and its exit plan without rebuilding the chart.
  useEffect(() => {
    const s = series.current; if (!s) return
    lines.current.forEach((l) => s.removePriceLine(l)); lines.current = []
    const fg = css('--fg'), up = css('--success'), dn = css('--danger')
    // On the calm area chart the average is a light dashed guide; the card's position row carries the details.
    if (pos?.qty) lines.current.push(kind === 'area'
      ? s.createPriceLine({ price: pos.avg, color: css('--fg-subtle'), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: 'Avg' })
      : s.createPriceLine({ price: pos.avg, color: fg, lineWidth: 1, lineStyle: LineStyle.Solid, title: `${pos.qty > 0 ? 'Long' : 'Short'} ${Math.abs(pos.qty)}` }))
    if (pos?.qty && br?.sl) lines.current.push(s.createPriceLine({ price: br.sl, color: dn, lineWidth: 1, lineStyle: LineStyle.Dotted, title: br.trail ? 'Trail SL' : 'SL' }))
    if (pos?.qty && br?.tgt) lines.current.push(s.createPriceLine({ price: br.tgt, color: up, lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'Target' }))
  }, [pos?.qty, pos?.avg, br?.sl, br?.tgt, br?.trail, sym, tf, showLv, theme, kind, bars])
  return (
    <div className="relative">
      {controls && <><div className="absolute left-2 top-2 z-10 flex items-center gap-0.5 rounded-md border border-line bg-surface/90 p-0.5 backdrop-blur">
        {(['5m', '15m', '1h', '1D'] as TF[]).map((x) => <button key={x} type="button" aria-pressed={tf === x} onClick={() => setTf(x)} className={cn('num rounded-md px-2 py-0.5 text-[11px] text-fg-muted hover:text-fg', tf === x && 'bg-sunken text-fg')}>{x}</button>)}
      </div>
      <button type="button" title="Open the full chart in the canvas" onClick={() => openCanvas('chart', sym)} className="absolute right-14 top-2 z-10 inline-flex items-center gap-1 rounded-md border border-line bg-surface/90 px-2 py-0.5 text-[11px] text-fg-muted backdrop-blur hover:text-fg"><Maximize2 size={11} strokeWidth={1.5} />Full chart</button></>}
      <div ref={el} style={{ height }} />
    </div>
  )
}

/* ------------------------------------------------------------------ quote + chart */

function useQuote(sym: string) { return useStore((s) => s.prices[sym]) }

/** Draft a cash or futures-style equity order at a sensible size: about a tenth of free funds, at least one share. */
function draftEquity(sym: string, side: 'BUY' | 'SELL') {
  const s = useStore.getState(); const ltp = s.prices[sym].ltp; const free = s.pnl().avail
  const qty = Math.max(1, Math.floor(Math.min(100000, free * 0.1) / ltp))
  const delivery = misClosedNow() || ['swing', 'investing'].includes(styleOf(s.profile) ?? '')
  const a: OrderAction = { t: 'order', und: sym, side, qty, otype: 'MARKET', product: delivery ? 'CNC' : 'MIS' }
  propose(`${side === 'BUY' ? 'Buy' : 'Sell'} ${sym}`, `Draft below, sized at about ${inr(qty * ltp)}. ${s.rules.stopRequired ? 'Your rule added a stop and target; change anything, then place it.' : 'Change anything, add a stop, then place it.'}`, [a])
}

/**
 * Market depth in chat. The book is the picture; the agent's read sits above it. Tapping a price drafts a limit
 * order there, and the foot offers the two prices you'd most likely use: the best offer to buy, the best bid to sell.
 */
export function DepthCard({ sym }: { sym: string }) {
  const { d } = useDepth(sym); const gate = useEntryGate(); const open = marketOpenNow()
  const draft = (side: 'BUY' | 'SELL', price: number) => {
    const s = useStore.getState(); const free = s.pnl().avail
    const qty = Math.max(1, Math.floor(Math.min(100000, free * 0.1) / price))
    const delivery = misClosedNow() || ['swing', 'investing'].includes(styleOf(s.profile) ?? '')
    propose(`${side === 'BUY' ? 'Buy' : 'Sell'} ${sym} at ${fmt(price)}`, `Limit draft at ${fmt(price)}, sized at about ${inr(qty * price)}. ${s.rules.stopRequired ? 'Your rule added a stop and target; change anything, then place it.' : 'Change anything, add a stop, then place it.'}`,
      [{ t: 'order', und: sym, side, qty, otype: 'LIMIT', price, product: delivery ? 'CNC' : 'MIS' }])
  }
  return (
    <Shell title={<>{sym} <span className="font-normal text-fg-subtle">· Market depth</span></>}
      meta={<><span>Spread <span className="num">{d.spread.toFixed(2)}</span></span><span className="flex items-center gap-1.5"><span className={cn('size-1.5 rounded-full', open ? 'bg-success animate-pulse' : 'bg-[var(--border-strong)]')} aria-hidden />{open ? 'Live' : 'Simulated'}</span></>}
      foot={gate ? <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-sunken px-2.5 text-[12px] font-medium text-fg-muted" title={gate.why}><GateIcon g={gate} />{gate.short}</span>
        : <><Act onClick={() => draft('BUY', d.asks[0].price)}>Buy at <span className="num">{fmt(d.asks[0].price)}</span></Act><Act onClick={() => draft('SELL', d.bids[0].price)}>Sell at <span className="num">{fmt(d.bids[0].price)}</span></Act></>}>
      <DepthView sym={sym} onPrice={gate ? undefined : draft} />
    </Shell>
  )
}

/** Change as a soft pill with an arrow: green up, red down, never colour alone. */
function ChangePill({ pct, abs, className }: { pct: number; abs?: number; className?: string }) {
  const up = pct >= 0
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[12px] font-medium tabular-nums', up ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg', className)}>
    <Dir up={up} /> {abs != null && <>{up ? '+' : '−'}{fmt(Math.abs(abs))} </>}{abs != null ? '(' : ''}{up ? '+' : '−'}{Math.abs(pct).toFixed(2)}%{abs != null ? ')' : ''}</span>
}

/** Solid Buy and Sell, the card's main actions. Labelled, so direction never rests on colour alone. */
function TradeButtons({ sym }: { sym: string }) {
  const g = useEntryGate()
  // The bar above the message box explains the lock and offers the review, so a card only needs the state.
  if (g) return <GatePill g={g} />
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => draftEquity(sym, 'BUY')} className="h-8 min-w-20 rounded-md bg-success px-4 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 dark:text-[var(--bg)]">Buy</button>
      <button type="button" onClick={() => draftEquity(sym, 'SELL')} className="h-8 min-w-20 rounded-md bg-danger px-4 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 dark:text-[var(--bg)]">Sell</button>
    </div>
  )
}

/** Low–high range with today's price marked: label on top, the bar between its two ends, so the eye reads lo → now → hi. */
function RangeBar({ label, lo, hi, v, digits = 2 }: { label: string; lo: number; hi: number; v: number; digits?: number }) {
  const at = Math.min(100, Math.max(0, ((v - lo) / (hi - lo || 1)) * 100))
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-fg-subtle">{label}</p>
      <div className="mt-1.5 flex items-center gap-2.5 text-[12px] tabular-nums text-fg-muted">
        <span>{fmt(lo, digits)}</span>
        <div className="relative h-1 min-w-12 flex-1 rounded-full bg-sunken">
          <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--border-strong)]" style={{ width: `${at}%` }} />
          <div className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-fg" style={{ left: `${at}%` }} aria-hidden />
        </div>
        <span>{fmt(hi, digits)}</span>
      </div>
    </div>
  )
}

/** Ranges as people read them, each with a timeframe and bar count that cover exactly that span. 1D is today's session so far. */
export const RANGES = [
  { l: '1D', tf: '5m' as TF, bars: () => Math.max(12, Math.ceil((secOfDay() - (9 * 3600 + 15 * 60)) / 300)) },
  { l: '5D', tf: '15m' as TF, bars: () => 125 }, { l: '1M', tf: '1h' as TF, bars: () => 147 }, { l: '6M', tf: '1D' as TF, bars: () => 126 },
]

/**
 * The agent's one-line read of a stock: what today's move is made of (volume, 52-week levels) and where it sits
 * (trend, momentum). Descriptive only; it never says buy or sell.
 */
function readOf(chg: number, m: NonNullable<ReturnType<typeof metricsFor>>, ltp: number, hi52: number, lo52: number): ReactNode {
  const move = `${chg >= 0 ? 'Up' : 'Down'} ${Math.abs(chg).toFixed(1)}% today`
  const vol = m.volx >= 1.5 ? ` on ${m.volx.toFixed(1)}× normal volume` : m.volx <= 0.7 ? ' on light volume' : ''
  const lvl = ltp >= hi52 * 0.99 ? ', at its 52-week high' : ltp <= lo52 * 1.03 ? ', near its 52-week low' : ''
  const trend = m.above50 > 0 && m.above200 > 0 ? 'In an uptrend, above its 50 and 200-day averages' : m.above50 < 0 && m.above200 < 0 ? 'In a downtrend, below its 50 and 200-day averages' : 'Trend is mixed around its 50 and 200-day averages'
  const mom = m.rsi >= 70 ? <>. RSI {m.rsi.toFixed(0)} is <b className="!text-[var(--attention-fg)]">overbought</b>, so chasing here risks a pullback</> : m.rsi <= 30 ? <>. RSI {m.rsi.toFixed(0)} is <b className="!text-[var(--attention-fg)]">oversold</b></> : null
  return <><b>{move}{vol}{lvl}.</b> {trend}{mom}.</>
}

/** The agent's read of a stock on its own, for the phone's stock page. */
export function StockRead({ sym }: { sym: string }) {
  const q = useQuote(sym); const m = useMemo(() => metricsFor(sym), [sym])
  if (!m) return null
  return <Read>{readOf((q.ltp / q.prev - 1) * 100, m, q.ltp, Math.max(m.hi52, q.high), Math.min(m.lo52, q.low))}</Read>
}

export function QuoteCard({ sym }: { sym: string }) {
  const q = useQuote(sym); const inst = bySym(sym)!; const watch = useStore((s) => s.watch.includes(sym))
  const pos = useStore((s) => s.positions[sym]); const ltpOf = useStore((s) => s.ltp)
  const m = useMemo(() => metricsFor(sym), [sym])
  const [range, setRange] = useState(0); const r = RANGES[range]
  const ch = q.ltp - q.prev; const chg = (q.ltp / q.prev - 1) * 100
  const idx = inst.seg === 'IDX'; const open = marketOpenNow()
  const pl = pos?.qty ? (ltpOf(sym) - pos.avg) * pos.qty : 0
  // Today's ticks can run past the stored 52-week extremes; the range must still contain the price.
  const hi52 = m ? Math.max(m.hi52, q.high) : 0, lo52 = m ? Math.min(m.lo52, q.low) : 0
  const iconBtn = 'inline-flex size-7 items-center justify-center rounded-md border border-line bg-surface text-fg-muted transition-colors hover:border-line-strong hover:bg-hover hover:text-fg active:translate-y-px'
  const stats: Fact[] = [
    { k: 'Open', v: fmt(q.open) }, { k: 'Prev close', v: fmt(q.prev) },
    ...(m ? [
      { k: 'Volume', v: `${m.volx.toFixed(1)}×`, note: m.volx >= 1.5 ? 'heavy' : m.volx <= 0.7 ? 'light' : 'normal' },
      { k: 'RSI (14)', v: m.rsi.toFixed(0), note: m.rsi >= 70 ? 'overbought' : m.rsi <= 30 ? 'oversold' : 'neutral', warn: m.rsi >= 70 || m.rsi <= 30 },
    ] : []),
  ]
  return (
    <section className="premium overflow-hidden rounded-[10px] border border-line bg-surface" aria-label={`${sym} quote`}>
      {/* 1 · The answer: what it is, what it costs, how it moved. Biggest type on the card. */}
      <div className="px-3.5 pt-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{sym}</h3>
          <p className="min-w-0 truncate text-[12px] text-fg-subtle">{inst.name}{!idx && ` · ${inst.sector}`} · {sym === 'SENSEX' ? 'BSE' : 'NSE'}{inst.fno ? ' · F&O' : ''}</p>
          <span className="ml-auto flex shrink-0 items-center gap-1.5 text-[11px] text-fg-subtle"><span className={cn('size-1.5 rounded-full', open ? 'bg-success animate-pulse' : 'bg-[var(--border-strong)]')} aria-hidden />{open ? 'Live' : 'Simulated'}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="num text-[24px] font-semibold leading-none tracking-[-0.02em] text-fg"><span className="mr-0.5 align-[0.12em] text-[20px] font-medium text-fg-subtle">₹</span>{fmt(q.ltp)}</p>
          <ChangePill pct={chg} abs={ch} className="text-[13px]" />
        </div>

        {/* 2 · The agent's read, the reason this card is in a chat and not a broker app. */}
        {m && <div className="mt-3.5"><Read>{readOf(chg, m, q.ltp, hi52, lo52)}</Read></div>}
      </div>

      {/* 3 · The picture. Range tabs sit as a quiet segmented control so the line stays the focus. */}
      <div className="mt-3 flex items-center justify-between px-3.5">
        <div role="radiogroup" aria-label="Chart range" className="flex rounded-md bg-sunken p-0.5">
          {RANGES.map((o, i) => <button key={o.l} type="button" role="radio" aria-checked={range === i} onClick={() => setRange(i)}
            className={cn('h-6 rounded-md px-2.5 text-[11px] font-medium transition-colors', range === i ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted hover:text-fg')}>{o.l}</button>)}
        </div>
        <button type="button" onClick={() => openCanvas('chart', sym)} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"><Maximize2 size={12} strokeWidth={1.75} />Full chart</button>
      </div>
      <div className="px-1"><MiniChart sym={sym} tf={r.tf} bars={r.bars()} session={range === 0} kind="area" controls={false} height={128} /></div>

      {/* 4 · Supporting numbers, folded: the read above already says what they add up to. */}
      <More label="Details" summary={`Day ${fmt(q.low, 0)}–${fmt(q.high, 0)}${m ? ` · volume ${m.volx.toFixed(1)}× · RSI ${m.rsi.toFixed(0)}` : ''}`}>
        <div className="grid gap-x-6 gap-y-3 border-t border-line px-3.5 py-3.5 @lg:grid-cols-2">
          <RangeBar label="Day range" lo={q.low} hi={q.high} v={q.ltp} />
          {m && <RangeBar label="52-week range" lo={lo52} hi={hi52} v={q.ltp} digits={0} />}
        </div>
        <Facts items={stats} />
      </More>

      {/* Your stake, when you have one */}
      {pos?.qty ? <button type="button" onClick={() => say(`${lower(sym)} position`)} className="mx-3.5 mb-3 flex w-[calc(100%-28px)] items-center gap-3 rounded-lg bg-sunken px-3.5 py-2.5 text-left transition-colors hover:bg-hover">
        <span className="text-[12px] text-fg-muted">Your position</span>
        <span className="text-[13px] font-medium tabular-nums text-fg">{pos.qty > 0 ? 'Long' : 'Short'} {Math.abs(pos.qty)} @ ₹{fmt(pos.avg)}</span>
        <Money v={pl} className="ml-auto text-[13px] font-semibold" />
      </button> : null}

      {/* 5 · What to do: Buy and Sell lead, everything else follows quietly. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-3">
        {idx ? <Button size="sm" onClick={() => say(`${lower(sym)} option chain`)}>Trade options</Button> : <TradeButtons sym={sym} />}
        <div className="ml-auto flex items-center gap-1.5">
          {inst.fno && !idx && <Act onClick={() => say(`${lower(sym)} option chain`)}>Options</Act>}
          <Act onClick={() => say(`analyse ${lower(sym)}`)}>Analyse</Act>
          <button type="button" className={iconBtn} title={`Alert when ${sym} crosses the day high (${fmt(q.high)})`} aria-label="Set an alert at the day high" onClick={() => say(`alert me if ${lower(sym)} crosses ${Math.ceil(q.high)}`)}><Bell size={14} strokeWidth={1.75} /></button>
          {!watch && <button type="button" className={iconBtn} title="Add to watchlist" aria-label="Add to watchlist" onClick={() => useStore.getState().watchOp('add', sym)}><Plus size={14} strokeWidth={1.75} /></button>}
        </div>
      </div>
    </section>
  )
}

export function ChartCard({ sym, tf, levels: lv }: { sym: string; tf?: TF; levels?: boolean }) {
  const q = useQuote(sym); const inst = bySym(sym); const m = useMemo(() => metricsFor(sym), [sym])
  const chg = (q.ltp / q.prev - 1) * 100
  return (
    <Shell pad={false} title={sym} meta={lv ? <Badge tone="info">AI levels</Badge> : <span className="truncate">{inst?.name}</span>}
      foot={<>
        {inst?.seg !== 'IDX' && <TradeButtons sym={sym} />}
        <span className="ml-auto flex gap-1.5">
          {inst?.fno && <Act onClick={() => say(`${lower(sym)} option chain`)}>Option chain</Act>}
          <Act onClick={() => say(`analyse ${lower(sym)}`)}>Analyse</Act>
        </span>
      </>}>
      <div className="space-y-3 px-3.5 pb-3">
        <Hero aside={<ChangePill pct={chg} abs={q.ltp - q.prev} className="text-[13px]" />}><Rs />{fmt(q.ltp)}</Hero>
        {lv ? <Read><b>Dashed lines are support and resistance</b> from recent daily swings. Markers flag candlestick patterns where they formed.</Read>
          : m && <Read>{readOf(chg, m, q.ltp, Math.max(m.hi52, q.high), Math.min(m.lo52, q.low))}</Read>}
      </div>
      <div className="border-t border-line px-1 pt-1"><MiniChart sym={sym} tf={tf ?? (lv ? '1D' : '5m')} levels={lv} height={240} /></div>
    </Shell>
  )
}

/* ------------------------------------------------------------------ market brief */

export function BriefCard() {
  const prices = useStore((s) => s.prices)
  const ms = useMemo(() => allMetrics(), [Math.floor(Date.now() / 5000)]) // eslint-disable-line react-hooks/exhaustive-deps
  const adv = ms.filter((m) => m.chg > 0).length; const dec = ms.length - adv; const share = adv / Math.max(ms.length, 1)
  const sec = SECTORS.filter((x) => x !== 'ETF').map((x) => { const r = ms.filter((m) => m.sector === x); return { x, c: r.reduce((a, m) => a + m.chg, 0) / r.length } }).filter((x) => Number.isFinite(x.c)).sort((a, b) => b.c - a.c)
  const shock = ms.filter((m) => m.volx >= 1.6).sort((a, b) => b.volx - a.volx).slice(0, 4)
  const movers = [...ms].sort((a, b) => Math.abs(b.chg) - Math.abs(a.chg)).slice(0, 4)
  const nifty = prices.NIFTY; const nChg = (nifty.ltp / nifty.prev - 1) * 100; const expiry = isExpiryDay('NIFTY')
  const mood = share >= 0.65 ? 'Broad rally' : share <= 0.35 ? 'Broad selling' : share >= 0.5 ? 'Mixed, leaning up' : 'Mixed, leaning down'
  const row = 'flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-[13px] transition-colors hover:bg-hover'
  return (
    <Shell pad={false} title="Market now" meta={<span>NIFTY expiry {expiry ? <b className="font-medium text-attention-fg">today</b> : <span className="font-medium text-fg">{nextExpiries('NIFTY')[0].label}</span>}</span>}
      foot={<><Act onClick={() => say('stocks with volume 2x')}>Unusual volume</Act><Act onClick={() => say('show my positions')}>My positions</Act><span className="ml-auto" /><Act icon={<ArrowUpRight size={13} strokeWidth={1.75} />} onClick={() => openCanvas('markets')}>Markets</Act></>}>
      <div className="space-y-3 px-3.5 pb-3">
        <Hero aside={<ChangePill pct={nChg} className="text-[13px]" />} sub={<span className="tabular-nums"><span className="text-up"><Dir up /> {adv} up</span><span className="mx-1.5 text-fg-subtle">·</span><span className="text-down"><Dir up={false} /> {dec} down</span><span className="text-fg-subtle"> across {ms.length} stocks · NIFTY {fmt(nifty.ltp)}</span></span>}>
          <span className="font-sans text-[20px] leading-8">{mood}</span></Hero>
        <div className="flex h-1.5 gap-0.5 overflow-hidden rounded-full" aria-hidden><div className="rounded-l-full bg-success" style={{ width: `${share * 100}%` }} /><div className="flex-1 rounded-r-full bg-danger opacity-70" /></div>
        {sec.length > 1 && <Read><b>{sec[0].x} lead ({sgn(sec[0].c, 1)}%), {sec.at(-1)!.x} lag ({sgn(sec.at(-1)!.c, 1)}%).</b>{shock.length > 0 && <> Unusual volume in {shock.slice(0, 3).map((m) => m.sym).join(', ')}.</>}{expiry && <> NIFTY weekly expiry is today, so expect sharper moves into the close.</>}</Read>}
      </div>
      <div className="grid grid-cols-1 gap-px border-t border-line bg-[var(--border)] @lg:grid-cols-3">
        {['NIFTY', 'BANKNIFTY', 'SENSEX'].map((k) => { const q = prices[k]; return (
          <button key={k} type="button" onClick={() => say(k.toLowerCase())} className="flex items-center justify-between gap-2 bg-surface px-3.5 py-3 text-left transition-colors hover:bg-hover @lg:block">
            <p className="text-[11px] text-fg-subtle">{k}</p>
            <p className="flex items-baseline gap-2 @lg:mt-0.5"><span className="text-[14px] font-medium tabular-nums text-fg">{fmt(q.ltp)}</span><Chg v={(q.ltp / q.prev - 1) * 100} className="text-[11px]" /></p>
          </button>) })}
      </div>
      <More label="Sectors and movers" summary={`${sec.length} sectors · ${shock.length ? `${shock.length} with unusual volume` : 'biggest moves'}`}>
      <div className="grid gap-x-6 gap-y-4 border-t border-line px-3 py-3 @lg:grid-cols-2">
        <div><p className="mb-1 px-2 text-[11px] text-fg-subtle">Sectors, best and worst</p>
          <ul>{[...sec.slice(0, 2), ...sec.slice(-2)].map((x) => <li key={x.x}><button type="button" onClick={() => say(`${x.x.toLowerCase()} stocks up today`)} className={row}><span className="text-fg">{x.x}</span><ChangePill pct={x.c} /></button></li>)}</ul></div>
        <div><p className="mb-1 px-2 text-[11px] text-fg-subtle">{shock.length ? 'Unusual volume' : 'Biggest movers'}</p>
          <ul>{(shock.length ? shock : movers).map((m) => <li key={m.sym}><button type="button" onClick={() => say(`why is ${lower(m.sym)} moving`)} className={row}><span className="font-medium text-fg">{m.sym}</span><span className="flex items-center gap-2">{shock.length > 0 && <span className="tabular-nums text-fg-subtle">{m.volx.toFixed(1)}× vol</span>}<ChangePill pct={m.chg} /></span></button></li>)}</ul></div>
      </div>
      </More>
    </Shell>
  )
}

/* ------------------------------------------------------------------ positions */

function ExitPlanEditor({ k, onDone }: { k: string; onDone: () => void }) {
  const s = useStore.getState(); const pos = s.positions[k]; const br = s.brackets[k]; const long = pos.qty > 0
  const step = (parseKey(k).strike ? 0.05 : 0.05)
  const ltp = s.ltp(k)
  const a = useMemo(() => { const u = parseKey(k); if (u.strike) return ltp * 0.25; const d = history(bySym(u.und)!, '15m', 60, s.prices[u.und].ltp); return atr(d).at(-1)! * 2 }, [k]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sl, setSl] = useState(String(br?.sl ?? +(long ? ltp - a : ltp + a).toFixed(1)))
  const [tg, setTg] = useState(String(br?.tgt ?? +(long ? ltp + 2 * a : ltp - 2 * a).toFixed(1)))
  const [tr, setTr] = useState(String(br?.trail ?? ''))
  const bad = sl && (long ? +sl >= ltp : +sl <= ltp)
  const risk = sl ? Math.abs(pos.avg - +sl) * Math.abs(pos.qty) : 0
  return (
    <div className="mt-3 rounded-lg bg-sunken p-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Stop" value={sl} onChange={setSl} step={step} />
        <Field label="Target" value={tg} onChange={setTg} step={step} />
        <Field label="Trail by (pts)" value={tr} onChange={setTr} step={step} placeholder="off" />
      </div>
      <p className={cn('mt-3 text-[12px] leading-5', bad ? 'text-danger-fg' : 'text-fg-muted')}>{bad ? `The stop is on the wrong side of the current price (${ltp.toFixed(2)}).` : `${sl ? `Stop risks ${inr(risk)} from your average.` : ''} Defaults are 2× and 4× the 15-minute ATR. Whichever is hit first closes the position.`}</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" variant="primary" disabled={!!bad} onClick={() => { s.setBracket(k, { sl: sl ? +sl : undefined, tgt: tg ? +tg : undefined, trail: tr ? +tr : undefined, peak: undefined }); s.log('user', `Exit plan on ${labelOf(k)} from chat`); onDone() }}>Save exit plan</Button>
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

/** A leg of a multi-leg options strategy: its risk is the structure's, so it doesn't need its own stop. */
export const hedgedLeg = (k: string, tag?: string) => !!parseKey(k).strike && !!tag && !!STRATEGIES[tag] && !/short (straddle|strangle)/.test(tag)

/** Symbol tile: a quiet monogram that gives each row an anchor, like a broker's app. */
const Tile = ({ sym, size = 36 }: { sym: string; size?: number }) => (
  <span aria-hidden className="inline-flex shrink-0 items-center justify-center rounded-lg bg-sunken font-semibold tracking-tight text-fg" style={{ width: size, height: size, fontSize: size * 0.34 }}>{sym.slice(0, 2)}</span>
)

/** Stop to target as one bar: where the price is now, and where you got in. */
function ExitBar({ sl, tgt, avg, ltp, qty }: { sl: number; tgt: number; avg: number; ltp: number; qty: number }) {
  const lo = Math.min(sl, tgt), hi = Math.max(sl, tgt); const at = (v: number) => Math.min(100, Math.max(0, ((v - lo) / (hi - lo || 1)) * 100))
  const stopLeft = sl < tgt
  return (
    <div className="mt-3">
      <div className="relative h-1.5 rounded-full" style={{ background: `linear-gradient(to right, var(${stopLeft ? '--danger' : '--success'}), var(--border) 50%, var(${stopLeft ? '--success' : '--danger'}))`, opacity: 0.85 }}>
        <span className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-fg-subtle" style={{ left: `${at(avg)}%` }} title={`Average ₹${fmt(avg)}`} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-fg shadow-sm" style={{ left: `${at(ltp)}%` }} title={`Now ₹${fmt(ltp)}`} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums">
        <span className="text-down">Stop ₹{fmt(sl)} · {signed((sl - avg) * qty)}</span>
        <span className="text-up">Target ₹{fmt(tgt)} · {signed((tgt - avg) * qty)}</span>
      </div>
    </div>
  )
}

/** One live position with what you'd do to it: exit, set or move the exit plan. */
export function PositionRow({ k, compact }: { k: string; compact?: boolean }) {
  const pos = useStore((s) => s.positions[k]); const br = useStore((s) => s.brackets[k]); const ltp = useStore((s) => s.ltp(k))
  const [edit, setEdit] = useState(false); const [sure, setSure] = useState(false)
  if (!pos) return null
  const open = pos.qty !== 0; const u = (ltp - pos.avg) * pos.qty; const pct = pos.avg ? ((ltp / pos.avg - 1) * 100 * Math.sign(pos.qty)) : 0
  const exit = () => { const s = useStore.getState(); const n = s.squareoff(k); setSure(false); s.addMsg({ role: 'user', text: `Exit ${labelOf(k)}` }); const tr = s.trades[0]; s.addMsg({ role: 'ai', text: n ? `Closed **${labelOf(k)}** at market${tr?.key === k ? `. Net on this trade after charges: ${tr.pnl - tr.charges < 0 ? '−' : '+'}${inr(Math.abs(tr.pnl - tr.charges)).replace('−', '')}` : ''}.` : 'Nothing to close.', follow: ['review my trades', 'show my positions'] }) }
  const hedged = hedgedLeg(k, pos.tag)
  return (
    <div className={cn(!compact && 'py-4')}>
      <div className="flex items-center gap-3">
        <Tile sym={parseKey(k).und} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-fg">{labelOf(k)}</p>
          <p className="num truncate text-[12px] text-fg-subtle">{open ? <>{pos.qty > 0 ? 'Long' : 'Short'} {Math.abs(pos.qty)} · avg ₹{fmt(pos.avg)} · now ₹{fmt(ltp)}</> : 'Closed today · realised'}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Money v={open ? u : pos.realized} className="text-[15px] font-semibold" />
          {open && <ChangePill pct={pct} className="px-1.5 text-[11px]" />}
        </div>
      </div>
      {open && br?.sl != null && br?.tgt != null && <ExitBar sl={br.sl} tgt={br.tgt} avg={pos.avg} ltp={ltp} qty={pos.qty} />}
      {open && <div className="mt-3 flex flex-wrap items-center gap-2">
        {br?.sl != null && br?.tgt != null ? (br.trail ? <span className="text-[12px] text-fg-muted">Stop trails ₹{br.trail} behind the best price</span> : null)
          : br?.sl != null || br?.tgt != null ? <span className="num text-[12px] text-fg-muted">{br?.sl != null ? `${br.trail ? 'Trailing stop' : 'Stop'} ₹${fmt(br.sl)}` : 'No stop'}{br?.tgt != null ? ` · Target ₹${fmt(br.tgt)}` : ''}</span>
          : hedged ? <span className="text-[12px] text-fg-muted">Leg of {pos.tag}; the hedge caps the risk</span> : <Badge tone="warning">No stop</Badge>}
        <span className="ml-auto flex items-center gap-1">
          {!edit && <Act onClick={() => setEdit(true)}>{br?.sl ? 'Edit exit plan' : 'Add stop and target'}</Act>}
          {u > 0 && br?.sl != null && (pos.qty > 0 ? br.sl < pos.avg : br.sl > pos.avg) && <Act onClick={() => useStore.getState().setBracket(k, { sl: +pos.avg.toFixed(2) })}>Move stop to cost</Act>}
          {sure
            ? <><Button size="sm" variant="danger" onClick={exit}>Exit at market</Button><Button size="sm" variant="ghost" onClick={() => setSure(false)}>Keep</Button></>
            : <button type="button" onClick={() => setSure(true)} className="inline-flex h-8 items-center rounded-md border border-line px-3.5 text-[12px] font-medium text-fg transition-colors hover:border-[var(--border-strong)] hover:bg-hover">Exit</button>}
        </span>
      </div>}
      {edit && <ExitPlanEditor k={k} onDone={() => setEdit(false)} />}
    </div>
  )
}

export function PositionsCard() {
  const positions = useStore((s) => s.positions); const pnl = useStore(useShallow((s) => s.pnl())); const risk = useStore((s) => s.risk)
  const brackets = useStore((s) => s.brackets); const ltp = useStore((s) => s.ltp); useStore((s) => s.prices)
  const open = Object.values(positions).filter((p) => p.qty); const closed = Object.values(positions).filter((p) => !p.qty && p.realized)
  const naked = open.filter((p) => brackets[p.key]?.sl == null && !hedgedLeg(p.key, p.tag))
  const pl = (p: (typeof open)[0]) => (p.qty ? (ltp(p.key) - p.avg) * p.qty : 0) + p.realized
  const top = [...open, ...closed].sort((a, b) => Math.abs(pl(b)) - Math.abs(pl(a)))[0]
  const used = Math.max(0, -pnl.net) / risk.maxLoss
  return (
    <Shell pad={false} title="Positions" meta={<span>{open.length} open{closed.length ? ` · ${closed.length} closed` : ''}</span>}
      foot={<>{open.length > 1 && <Act onClick={() => say('square off all')}>Exit all</Act>}<Act onClick={() => say('explain my pnl')}>Explain my P&L</Act><span className="ml-auto" /><Act icon={<ArrowUpRight size={13} strokeWidth={1.75} />} onClick={() => openCanvas('portfolio')}>Portfolio</Act></>}>
      <div className="space-y-3 px-3.5 pb-3">
        <Hero label="Today, after charges"><Money v={pnl.net} /></Hero>
        {naked.length > 0 ? <Read tone="attention"><b>{naked.length === 1 ? `${labelOf(naked[0].key)} has no stop.` : `${naked.length} open positions have no stop.`}</b> Add one so a bad move can't run past your plan.</Read>
          : used >= 0.6 && used < 1 ? <Read tone="attention"><b>You've used {(used * 100).toFixed(0)}% of today's {inr(risk.maxLoss)} loss limit.</b> At the limit I close everything automatically.</Read>
          : top && Math.abs(pl(top)) > 0 ? <Read><b>{labelOf(top.key)} {pl(top) >= 0 ? 'made' : 'cost'} the most today</b> ({signed(pl(top))}).{open.length > 0 ? ` ${open.length} still open, all with stops.` : ' Everything is closed.'}</Read> : null}
      </div>
      <Facts cols={3} items={[{ k: 'Realised', v: inr(pnl.realized) }, { k: 'Open', v: inr(pnl.unreal) }, { k: 'Charges', v: inr(pnl.charges) }]} />
      {open.length === 0 && closed.length === 0 && <p className="border-t border-line px-3.5 py-4 text-[13px] text-fg-muted">No positions today. Ask for a brief, a scan or a trade to get started.</p>}
      {/* Open positions need decisions, so they're up front. Closed ones are history: one summary row, open on demand. */}
      {open.length > 0 && <div className="divide-y divide-line border-t border-line px-3.5">{open.map((p) => <PositionRow key={p.key} k={p.key} />)}</div>}
      {closed.length > 0 && <More label={`${closed.length} closed today`} summary={closed.map((p) => labelOf(p.key)).join(', ')} defaultOpen={open.length === 0 && closed.length <= 2}>
        <ul className="divide-y divide-line border-t border-line">{closed.map((p) => (
          <li key={p.key} className="flex h-11 items-center gap-3 px-3.5 text-[13px]">
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{labelOf(p.key)}</span>
            <Money v={p.realized} className="font-semibold tabular-nums" />
          </li>))}</ul>
      </More>}
    </Shell>
  )
}

export function PositionCard({ k }: { k: string }) {
  const und = parseKey(k).und; const opt = !!parseKey(k).strike
  const exists = useStore((s) => !!s.positions[k])
  if (!exists) return <Shell title={labelOf(k)}><p className="text-[13px] text-fg-muted">This position is no longer in your book. The paper account was reset after it was opened.</p></Shell>
  return <Shell pad={false} title="Position" meta={<span className="flex items-center gap-1.5"><span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />Live</span>}>
    <div className="px-3.5 pb-1"><PositionRow k={k} compact /></div>
    {!opt && <div className="mt-3 border-t border-line px-1 pt-1"><MiniChart sym={und} kind="area" height={170} /></div>}
  </Shell>
}

/* ------------------------------------------------------------------ scan */

export function ScanCard({ filters, name }: { filters: Filter[]; name?: string }) {
  useStore((s) => s.prices.NIFTY.ltp) // refresh with the market
  const rows = applyFilters(allMetrics(), filters).sort((a, b) => b.chg - a.chg)
  const [n, setN] = useState(6); const gate = useEntryGate()
  const top = rows[0]
  const bySector = Object.entries(rows.reduce<Record<string, number>>((a, r) => ({ ...a, [r.sector]: (a[r.sector] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0]
  return (
    <Shell pad={false} title={name ?? 'Scan results'}
      foot={<><Act icon={<ArrowUpRight size={13} strokeWidth={1.75} />} onClick={() => { useStore.getState().setScan({ filters, name: name ?? 'Chat scan' }); openCanvas('scanner') }}>Edit in Scanner</Act>
        {rows.length > n && <Act icon={<ChevronDown size={13} strokeWidth={1.75} />} onClick={() => setN(n + 10)}>Show {Math.min(10, rows.length - n)} more</Act>}<span className="ml-auto text-[11px] text-fg-subtle">Sorted by today's change</span></>}>
      <div className="space-y-3 px-3.5 pb-3">
        <Hero aside={<span className="text-[13px] text-fg-muted">{rows.length === 1 ? 'stock matches' : 'stocks match'}</span>}
          sub={<span className="mt-1 flex flex-wrap gap-1.5">{filters.map((f, i) => <span key={i} className="rounded-md bg-sunken px-2.5 py-0.5 text-[12px] text-fg-muted">{describeFilter(f)}</span>)}</span>}>{rows.length}</Hero>
        {top && <Read><b>{top.sym} leads, {sgn(top.chg, 1)}% today on {top.volx.toFixed(1)}× volume.</b>{bySector && rows.length >= 4 && bySector[1] / rows.length >= 0.4 ? ` Most matches are ${bySector[0]} (${bySector[1]} of ${rows.length}), so this is a sector move as much as a stock one.` : ` Matches span ${new Set(rows.map((r) => r.sector)).size} sectors.`}</Read>}
      </div>
      {/* In a narrow panel the table keeps what decides a trade (stock, price, today) and drops volume and RSI. */}
      {rows.length > 0 && <div className="scroll-thin overflow-x-auto border-t border-line"><table className="tbl-card"><thead><tr><th>Stock</th><th>Price</th><th>Today</th><th className="@max-lg:hidden">Volume</th><th className="@max-lg:hidden">RSI</th><th><span className="sr-only">Trade</span></th></tr></thead>
        <tbody>{rows.slice(0, n).map((r) => <tr key={r.sym} className="cursor-pointer" onClick={() => say(`analyse ${lower(r.sym)}`)} title={`Analyse ${r.sym}`}>
          <td><span className="flex items-center gap-2.5"><span className="contents @max-lg:hidden"><Tile sym={r.sym} size={30} /></span><span className="min-w-0"><span className="block text-[13px] font-semibold">{r.sym}</span><span className="block text-[11px] text-fg-subtle">{r.sector}</span></span></span></td>
          <td className="font-medium">₹{fmt(r.ltp)}</td><td><ChangePill pct={r.chg} /></td><td className="text-fg-muted @max-lg:hidden">{r.volx.toFixed(1)}×</td>
          <td className="@max-lg:hidden"><span className="inline-flex items-center gap-2"><span className="relative h-1 w-10 rounded-full bg-sunken" aria-hidden><span className="absolute inset-y-0 left-0 rounded-full bg-[var(--fg-subtle)]" style={{ width: `${r.rsi}%` }} /></span><span className="w-5 text-right text-fg-muted">{r.rsi.toFixed(0)}</span></span></td>
          <td>{gate ? <span className="inline-flex size-7 items-center justify-center text-fg-subtle" title={`${gate.short}. ${gate.why}`}><GateIcon g={gate} /><span className="sr-only">{gate.short}</span></span>
            : <button type="button" className="h-7 rounded-md bg-success-soft px-3 text-[12px] font-semibold text-success-fg transition-colors hover:bg-success hover:text-white" onClick={(e) => { e.stopPropagation(); draftEquity(r.sym, 'BUY') }}>Buy</button>}</td>
        </tr>)}</tbody></table></div>}
      {rows.length === 0 && <p className="border-t border-line px-3.5 py-4 text-[13px] text-fg-muted">Nothing matches right now. Loosen a condition and ask again.</p>}
    </Shell>
  )
}

/* ------------------------------------------------------------------ options */

function draftOption(und: string, strike: number, ot: 'CE' | 'PE', side: 'BUY' | 'SELL', expiryIdx: number) {
  const ex = nextExpiries(und)[expiryIdx]; const a: OrderAction = { t: 'order', und, strike, ot, side, qty: 1, otype: 'MARKET', product: 'NRML', expiryIdx }
  propose(`${side === 'BUY' ? 'Buy' : 'Sell'} ${und} ${strike} ${ot} (${ex.label})`, side === 'SELL' ? `Draft below. **Selling an option has unlimited risk** and needs margin. A hedged spread caps it; ask for one if you want.` : 'Draft below. The most you can lose is the premium you pay.', [a])
}

export function ChainCard({ und, expiryIdx: e0 }: { und: string; expiryIdx: number }) {
  const q = useQuote(und); const spot = q.ltp; const [ei, setEi] = useState(e0); const [side, setSide] = useState<'BUY' | 'SELL'>('BUY'); const gate = useEntryGate()
  const [allStrikes, setAllStrikes] = useState(false)
  const exps = nextExpiries(und).slice(0, 4); const ex = exps[ei] ?? exps[0]
  const rows = useMemo(() => chain(und, spot, ex.T, 13), [und, Math.round(spot / bySym(und)!.step * 4), ex.label]) // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => chain(und, spot, ex.T, 41), [und, Math.round(spot), ex.label]) // eslint-disable-line react-hooks/exhaustive-deps
  const pcr = all.reduce((a, r) => a + r.pe.oi, 0) / all.reduce((a, r) => a + r.ce.oi, 0)
  const maxOi = Math.max(...rows.flatMap((r) => [r.ce.oi, r.pe.oi]))
  const callWall = all.reduce((a, r) => (r.ce.oi > a.ce.oi ? r : a)).strike, putWall = all.reduce((a, r) => (r.pe.oi > a.pe.oi ? r : a)).strike
  const atmIv = rows.find((r) => r.atm)?.ce.iv
  const cell = (r: (typeof rows)[0], t: 'CE' | 'PE') => {
    const v = t === 'CE' ? r.ce : r.pe
    if (gate) return <span className={cn('num block w-full px-2 py-1 font-medium', t === 'CE' ? 'text-right' : 'text-left')}>{fmt(v.ltp)}</span>
    return <button type="button" title={`${side === 'BUY' ? 'Buy' : 'Sell'} ${und} ${r.strike} ${t}`} onClick={() => draftOption(und, r.strike, t, side, ei)}
      className={cn('num w-full rounded-lg px-2 py-1 font-medium transition-colors', t === 'CE' ? 'text-right' : 'text-left', side === 'BUY' ? 'hover:bg-success-soft hover:text-success-fg' : 'hover:bg-danger-soft hover:text-danger-fg')}>{fmt(v.ltp)}</button>
  }
  const pill = (on: boolean, tone?: string) => cn('rounded-md px-3 text-[12px] font-medium transition-colors', on ? tone ?? 'bg-surface text-fg shadow-sm' : 'text-fg-muted hover:text-fg')
  return (
    <Shell pad={false} title={`${und} options`} meta={<span>{ex.label} expiry</span>}
      foot={<><Act onClick={() => say(`iron condor on ${lower(und)}`)}>Iron condor</Act><Act onClick={() => say(`bull call spread on ${lower(und)}`)}>Bull call spread</Act><Act onClick={() => say(`bear put spread on ${lower(und)}`)}>Bear put spread</Act><span className="ml-auto" /><Act icon={<ArrowUpRight size={13} strokeWidth={1.75} />} onClick={() => { useStore.getState().setExpiry(ei); openCanvas('chain', und) }}>Full chain</Act></>}>
      <div className="space-y-3 px-3.5 pb-3">
        <Hero label={`${und} spot`} aside={<ChangePill pct={(spot / q.prev - 1) * 100} abs={spot - q.prev} className="text-[13px]" />}><Rs />{fmt(spot)}</Hero>
        <Read>{putWall < callWall ? <><b>Writers are defending {putWall}–{callWall} into expiry</b>, the strikes with the most put and call open interest. </> : <><b>Open interest is stacked at {Math.min(putWall, callWall)}–{Math.max(putWall, callWall)}, right around spot</b>, so writers expect expiry to pin near there. </>}{pcr > 1.2 ? `Put/call ratio ${pcr.toFixed(2)}: put writing dominates, which traders read as support below.` : pcr < 0.8 ? `Put/call ratio ${pcr.toFixed(2)}: call writing dominates, which traders read as resistance overhead.` : `Put/call ratio ${pcr.toFixed(2)} is balanced, no strong lean either way.`}</Read>
      </div>
      {/* The read already gives the range and the lean; the exact numbers are one tap away. */}
      <More label="Details" summary={`PCR ${pcr.toFixed(2)} · walls ${putWall}/${callWall}${atmIv ? ` · ATM IV ${atmIv.toFixed(1)}%` : ''}`}>
        <Facts items={[
        { k: 'Put/call ratio', v: pcr.toFixed(2), note: pcr > 1.2 ? 'bullish lean' : pcr < 0.8 ? 'bearish lean' : 'balanced' },
        { k: 'Call wall', v: callWall, note: 'resistance' }, { k: 'Put wall', v: putWall, note: 'support' },
        { k: 'ATM IV', v: atmIv ? `${atmIv.toFixed(1)}%` : '–', note: atmIv ? (atmIv > 20 ? 'options rich' : atmIv < 12 ? 'options cheap' : 'normal') : undefined },
      ]} />
      </More>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-3">
        <div role="radiogroup" aria-label="Expiry" className="flex h-8 gap-0.5 rounded-lg bg-sunken p-0.5">{exps.map((x, i) => <button key={x.label} type="button" role="radio" aria-checked={i === ei} onClick={() => setEi(i)} className={pill(i === ei)}>{x.label}</button>)}</div>
        {gate ? <span className="ml-auto flex items-center gap-1.5 text-[12px] text-fg-subtle" title={gate.why}><GateIcon g={gate} size={12} />View only · {gate.short.toLowerCase()}</span> : <div className="ml-auto flex items-center gap-2 text-[12px] text-fg-subtle">Tap a price to
          <div role="radiogroup" aria-label="Side" className="flex h-8 gap-0.5 rounded-lg bg-sunken p-0.5">{(['BUY', 'SELL'] as const).map((s) => <button key={s} type="button" role="radio" aria-checked={side === s} onClick={() => setSide(s)} className={pill(side === s, s === 'BUY' ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg')}>{s === 'BUY' ? 'Buy' : 'Sell'}</button>)}</div>
        </div>}
      </div>
      <div className="scroll-thin overflow-x-auto">
      <table className="tbl-card chain">
        {/* Narrow panel: the prices you tap and the strike; open interest returns when there is room. */}
        <thead><tr><th className="!text-left @max-sm:hidden">Call OI</th><th>Call</th><th className="!text-center">Strike</th><th className="!text-left">Put</th><th className="@max-sm:hidden">Put OI</th></tr></thead>
        {/* Seven strikes around the money answer most questions; the rest are a tap away. */}
        <tbody>{rows.filter((_, i) => allStrikes || Math.abs(i - Math.max(0, rows.findIndex((x) => x.atm))) <= 3).map((r) => <tr key={r.strike} className={r.atm ? 'atm' : undefined}>
          <td className={cn('ce !text-left @max-sm:hidden', r.strike < spot && 'itm')}><span className="flex items-center gap-2"><span className="h-1.5 rounded-full bg-danger/50 @max-lg:hidden" style={{ width: `${Math.max(3, (r.ce.oi / maxOi) * 44)}px` }} /><span className="text-[12px] text-fg-subtle">{inrShort(r.ce.oi).replace('₹', '')}</span></span></td>
          <td className={cn('ce', r.strike < spot && 'itm')}>{cell(r, 'CE')}</td>
          <td className="k">{r.strike}{r.atm && <span className="ml-1.5 align-middle text-[10px] font-medium uppercase tracking-wide text-fg-muted">ATM</span>}</td>
          <td className={cn('pe !text-left', r.strike > spot && 'itm')}>{cell(r, 'PE')}</td>
          <td className={cn('pe @max-sm:hidden', r.strike > spot && 'itm')}><span className="flex items-center justify-end gap-2"><span className="text-[12px] text-fg-subtle">{inrShort(r.pe.oi).replace('₹', '')}</span><span className="h-1.5 rounded-full bg-success/50 @max-lg:hidden" style={{ width: `${Math.max(3, (r.pe.oi / maxOi) * 44)}px` }} /></span></td>
        </tr>)}</tbody>
      </table>
      </div>
      <button type="button" onClick={() => setAllStrikes(!allStrikes)} className="flex h-10 w-full items-center justify-center gap-1.5 border-t border-line text-[12px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg">{allStrikes ? 'Fewer strikes' : `All ${rows.length} strikes`}<ChevronDown size={14} strokeWidth={1.75} className={cn('transition-transform', allStrikes && 'rotate-180')} /></button>
    </Shell>
  )
}

/* ------------------------------------------------------------------ strategies */

type Curve = { x: number[]; y: number[]; maxP: number; maxL: number; unlP: boolean; unlL: boolean; be: number[] }
/** Expiry payoff from fixed entry prices, so a curve costs one chain lookup per leg instead of one per point. */
function curve(und: string, spot: number, T: number, legs: Leg[]): Curve & { entries: number[]; net: number } {
  const inst = bySym(und)!; const entries = legs.map((l) => legPrice(und, spot, T, l)?.ltp ?? 0)
  const at = (S: number) => legs.reduce((a, l, i) => a + (l.side === 'BUY' ? 1 : -1) * (Math.max(l.type === 'CE' ? S - l.strike : l.strike - S, 0) - entries[i]) * l.lots * inst.lot, 0)
  const x = Array.from({ length: 81 }, (_, i) => spot * (0.9 + i * 0.0025)); const y = x.map(at)
  const be: number[] = []; for (let i = 1; i < x.length; i++) if (Math.sign(y[i]) !== Math.sign(y[i - 1])) be.push(x[i - 1] + (x[i] - x[i - 1]) * (-y[i - 1] / (y[i] - y[i - 1])))
  const far = (S: number) => at(S); const slopeUp = far(spot * 3) - far(spot * 2), slopeDn = far(0.0001) - far(spot * 0.3)
  const net = legs.reduce((a, l, i) => a + (l.side === 'SELL' ? 1 : -1) * entries[i] * l.lots * inst.lot, 0)
  return { x, y, maxP: Math.max(...y), maxL: Math.min(...y), unlP: slopeUp > 1 || slopeDn > 1, unlL: slopeUp < -1 || slopeDn < -1, be, entries, net }
}

function Payoff({ c, spot, h = 96 }: { c: Curve; spot: number; h?: number }) {
  const W = 320; const lo = Math.min(...c.y, 0), hi = Math.max(...c.y, 0); const sx = (v: number) => ((v - c.x[0]) / (c.x.at(-1)! - c.x[0])) * W; const sy = (v: number) => h - 6 - ((v - lo) / (hi - lo || 1)) * (h - 12)
  const d = c.x.map((v, i) => `${i ? 'L' : 'M'}${sx(v).toFixed(1)},${sy(c.y[i]).toFixed(1)}`).join('')
  const area = `${d}L${W},${sy(0)}L0,${sy(0)}Z`; const id = useMemo(() => Math.random().toString(36).slice(2), [])
  return (
    <svg viewBox={`0 0 ${W} ${h}`} preserveAspectRatio="none" style={{ height: h }} className="w-full" role="img" aria-label={`Payoff at expiry. Max profit ${c.unlP ? 'unlimited' : inr(c.maxP)}, max loss ${c.unlL ? 'unlimited' : inr(c.maxL)}.`}>
      <defs><clipPath id={`p${id}`}><rect x="0" y="0" width={W} height={sy(0)} /></clipPath><clipPath id={`l${id}`}><rect x="0" y={sy(0)} width={W} height={h} /></clipPath></defs>
      <path d={area} clipPath={`url(#p${id})`} fill="var(--success-soft)" /><path d={area} clipPath={`url(#l${id})`} fill="var(--danger-soft)" />
      <line x1="0" x2={W} y1={sy(0)} y2={sy(0)} stroke="var(--border-strong)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <line x1={sx(spot)} x2={sx(spot)} y1="0" y2={h} stroke="var(--fg-subtle)" strokeDasharray="3 3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {/* Breakevens as ticks: the SVG stretches to the card, which would squash a dot into an oval. */}
      {c.be.map((b, i) => <line key={i} x1={sx(b)} x2={sx(b)} y1={sy(0) - 5} y2={sy(0) + 5} stroke="var(--fg)" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      <path d={d} fill="none" stroke="var(--fg)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

/** One leg as a compact chip: side tag (word, not just colour), strike, type and lots. */
const LegChip = ({ l }: { l: Leg }) => (
  <span className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1 text-[12px] tabular-nums text-fg">
    <span className={cn('rounded px-1 text-[10px] font-semibold uppercase', l.side === 'BUY' ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg')}>{l.side === 'BUY' ? 'Buy' : 'Sell'}</span>
    {l.strike} {l.type}<span className="text-fg-subtle">× {l.lots}</span>
  </span>
)

export function IdeasCard({ und, expiryIdx, view, maxLoss, picks }: { und: string; expiryIdx: number; view: string; maxLoss?: number; picks: string[] }) {
  const spot = useStore((s) => s.prices[und].ltp); const inst = bySym(und)!; const ex = nextExpiries(und)[expiryIdx] ?? nextExpiries(und)[0]
  const gate = useEntryGate()
  const atm = Math.round(spot / inst.step) * inst.step
  const ideas = useMemo(() => picks.map((name) => {
    const one = STRATEGIES[name].build(atm, inst.step, 1); const c1 = curve(und, spot, ex.T, one)
    const lots = maxLoss && c1.maxL < 0 ? Math.max(1, Math.floor(maxLoss / -c1.maxL)) : 1
    const legs = STRATEGIES[name].build(atm, inst.step, lots); return { name, lots, legs, c: curve(und, spot, ex.T, legs), margin: legsMargin(und, legs, expiryIdx) }
  }), [und, atm, ex.label, picks.join(), maxLoss]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid gap-3 @lg:grid-cols-2">
      {ideas.map((it, n) => { const over = !!maxLoss && (it.c.unlL || -it.c.maxL > maxLoss); return <Shell pad={false} key={it.name}
        title={<span className="capitalize">{it.name}</span>}
        meta={over ? <Badge tone="warning">Over your {inr(maxLoss!)} limit</Badge> : n === 0 ? <Badge tone="info">Closest fit</Badge> : undefined}
        foot={<>{gate ? <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-sunken px-3 text-[12px] font-medium text-fg-muted" title={gate.why}><GateIcon g={gate} />{gate.short}</span> : <Button size="sm" variant="primary" onClick={() => propose(`Draft the ${it.name} on ${und}`, `Here's the ${it.name}. Check the legs and payoff, change lots if you need to, then place it. Hedges go first.`, [{ t: 'legs', und, legs: it.legs, expiryIdx, name: it.name }])}>Draft this</Button>}
          <Act onClick={() => { const s = useStore.getState(); s.setSym(und); s.setLegs(it.legs, it.name); s.setExpiry(expiryIdx); openCanvas('strategy') }}>What-if</Act></>}>
        {/* Risk first: what you can lose is the answer, what you can make is next to it. */}
        <div className="grid grid-cols-2 gap-3 px-3.5">
          <div><p className="text-[12px] text-fg-subtle">Max loss</p><p className="num text-[18px] font-semibold leading-7 text-down">{it.c.unlL ? 'Unlimited' : inr(it.c.maxL)}</p></div>
          <div><p className="text-[12px] text-fg-subtle">Max profit</p><p className="num text-[18px] font-semibold leading-7 text-up">{it.c.unlP ? 'Unlimited' : inr(it.c.maxP)}</p></div>
        </div>
        <p className="mt-1.5 px-3.5 text-[12px] leading-5 text-fg-muted">{STRATEGIES[it.name].desc}</p>
        <div className="mx-3.5 mt-3 rounded-lg bg-sunken px-2 py-2"><Payoff c={it.c} spot={spot} h={84} /></div>
        <div className="flex flex-wrap gap-1.5 px-3.5 pb-3 pt-3">{it.legs.map((l, j) => <LegChip key={j} l={l} />)}</div>
        <Facts cols={3} items={[
          { k: 'Margin', v: inrShort(it.margin || it.c.net < 0 ? Math.max(it.margin, -it.c.net) : it.margin) },
          { k: it.c.net >= 0 ? 'Net credit' : 'Net debit', v: inrShort(Math.abs(it.c.net)) },
          { k: 'Size', v: `${it.lots} lot${it.lots > 1 ? 's' : ''}` },
        ]} />
      </Shell> })}
      <p className="px-1 text-[12px] text-fg-subtle @lg:col-span-2">{view.charAt(0).toUpperCase() + view.slice(1)} · {und} {ex.label} expiry{maxLoss ? ` · sized to a ${inr(maxLoss)} max loss` : ''}</p>
    </div>
  )
}

/** Quantity as one compact pill, − n unit +. Lives in the draft's summary line, since it's the edit people make most. */
function QtyPill({ value, onChange, unit, label }: { value: number; onChange: (n: number) => void; unit: string; label: string }) {
  return (
    <span className="inline-flex h-8 items-center rounded-md border border-line bg-surface">
      <button type="button" aria-label={`Fewer ${label}`} onClick={() => onChange(Math.max(1, value - 1))} className="flex h-full w-8 items-center justify-center rounded-l-full text-fg-muted hover:bg-hover hover:text-fg"><Minus size={13} strokeWidth={1.75} /></button>
      <span className="num min-w-8 px-1 text-center text-[13px] font-medium text-fg" aria-live="polite">{value}<span className="ml-1 font-sans text-[11px] font-normal text-fg-subtle">{unit}</span></span>
      <button type="button" aria-label={`More ${label}`} onClick={() => onChange(value + 1)} className="flex h-full w-8 items-center justify-center rounded-r-full text-fg-muted hover:bg-hover hover:text-fg"><Plus size={13} strokeWidth={1.75} /></button>
    </span>
  )
}
function Field({ label, value, onChange, step, placeholder, disabled }: { label: string; value: string; onChange: (v: string) => void; step?: number; placeholder?: string; disabled?: boolean }) {
  return (
    <label className="block"><span className="text-[11px] text-fg-subtle">{label}</span>
      <input type="number" step={step} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)}
        className="num mt-1 h-8 w-full rounded-md border border-line bg-surface px-2.5 text-[13px] font-medium outline-none transition-colors placeholder:font-normal placeholder:text-fg-subtle focus:border-fg-subtle disabled:bg-sunken disabled:opacity-70" /></label>
  )
}
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; l: string; tone?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-8 rounded-lg bg-sunken p-0.5">
      {options.map((o) => <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={cn('flex-1 rounded-md px-3 text-[12px] font-medium text-fg-muted transition-colors hover:text-fg', value === o.v && (o.tone ?? 'bg-surface text-fg shadow-sm'))}>{o.l}</button>)}
    </div>
  )
}

/* ------------------------------------------------------------------ drafts: order and strategy */

/** An order the agent drafted. Every field is editable here; nothing is sent until Place order. */
function OrderDraft({ msgId, i, a, live }: { msgId: number; i: number; a: OrderAction; live: boolean }) {
  const s = useStore.getState(); const inst = bySym(a.und)!; const opt = !!a.strike
  const key = useMemo(() => s.resolveOrder(a).key, [a.und, a.strike, a.ot, a.expiryIdx]) // eslint-disable-line react-hooks/exhaustive-deps
  const ltp = useStore((st) => st.ltp(key)); const avail = useStore((st) => st.pnl().avail)
  const set = (p: Partial<OrderAction>) => editDraft(msgId, i, { ...a, ...p })
  const shares = opt ? a.qty * inst.lot : a.qty
  const ref = a.otype === 'LIMIT' && a.price ? a.price : ltp
  const value = ref * shares
  const margin = opt ? (a.side === 'BUY' ? value : legsMargin(a.und, [{ side: 'SELL', type: a.ot!, strike: a.strike!, lots: a.qty }], a.expiryIdx ?? 0)) : a.product === 'CNC' ? value : value * 0.2
  const kind = opt ? 'OPTION' : a.product === 'CNC' ? 'DELIVERY' : 'INTRADAY'
  const fees = charges(kind, a.side, value).total + charges(kind, a.side === 'BUY' ? 'SELL' : 'BUY', value).total
  const long = a.side === 'BUY'
  const slBad = a.sl != null && (long ? a.sl >= ref : a.sl <= ref), tgBad = a.tgt != null && (long ? a.tgt <= ref : a.tgt >= ref)
  const risk = a.sl != null && !slBad ? Math.abs(ref - a.sl) * shares : 0, reward = a.tgt != null && !tgBad ? Math.abs(a.tgt - ref) * shares : 0
  const atrPts = useMemo(() => opt ? ltp * 0.25 : atr(history(inst, '15m', 60, s.prices[a.und].ltp)).at(-1)! * 2, [a.und, opt]) // eslint-disable-line react-hooks/exhaustive-deps
  const short = margin > avail
  const tone = long ? 'bg-success text-white shadow-sm dark:text-[var(--bg)]' : 'bg-danger text-white shadow-sm dark:text-[var(--bg)]'
  // Approve in one look: the summary is the decision; every field sits behind Adjust. Errors open it themselves.
  const [adjust, setAdjust] = useState(false); const open = adjust || slBad || tgBad
  const rules = useStore((st) => st.rules); const brk = ruleBreak(a); const gate = useEntryGate()
  const addPlan = () => set({ sl: +(long ? ref - atrPts : ref + atrPts).toFixed(1), tgt: +(long ? ref + 2 * atrPts : ref - 2 * atrPts).toFixed(1) })
  const chip = 'inline-flex h-8 items-center gap-1 rounded-md border border-line bg-surface px-3 text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:text-fg'
  if (!live) return null
  return (
    <div className="space-y-3">
      <Hero label={<>{long ? 'Buy' : 'Sell'} {shares} {opt ? 'qty' : shares === 1 ? 'share' : 'shares'} {a.otype === 'LIMIT' && a.price ? `at ₹${fmt(a.price)} limit` : 'at market'} · now ₹{fmt(ltp)}</>}
        sub={<span className="tabular-nums">Margin <span className={cn('font-medium text-fg', short && '!text-danger-fg')}>{inr(margin)}</span> of {inr(avail)} free · round-trip charges {inr(fees)}</span>}><Rs />{fmt(value, 0)}</Hero>
      {/* Check receipts: what this order was checked against, so "safe to place" is visible, not assumed. */}
      <ul aria-label="Checks" className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {[
          { ok: !short, t: short ? `Needs ${inr(margin - avail)} more margin` : 'Margin available' },
          { ok: a.sl != null, warn: a.sl == null, t: a.sl != null && risk > 0 ? `Risk ${(risk / Math.max(avail, 1) * 100).toFixed(risk / Math.max(avail, 1) < 0.001 ? 2 : 1)}% of funds` : 'No stop yet' },
          { ok: !brk, t: brk ? 'Breaks your rules' : Object.keys(rules).length ? 'Within your rules' : 'No rules set', muted: !brk && !Object.keys(rules).length },
          { ok: !gate, t: gate ? gate.short : 'Entries open' },
        ].map((c) => <li key={c.t} className={cn('flex items-center gap-1', c.muted ? 'text-fg-subtle' : c.ok ? 'text-fg-muted' : c.warn ? 'text-[var(--attention-fg)]' : 'text-danger-fg')}>
          {c.ok ? <Check size={12} strokeWidth={2.25} className={c.muted ? 'text-fg-subtle' : 'text-up'} aria-hidden /> : <X size={12} strokeWidth={2.25} aria-hidden />}{c.t}</li>)}
      </ul>
      {brk?.kind === 'setup'
        ? <Read tone="attention"><b>Your rule: {brk.tag} trades are paused.</b> You paused them because they kept losing. Tag this as something else if it's a different setup, or turn the pause off in your rules.</Read>
        : brk?.kind === 'stop'
        ? <Read tone="attention"><b>Your rule: every entry needs a stop.</b> Add one to place this.
            <span className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={addPlan} className="inline-flex h-7 items-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-[var(--bg)] transition-opacity hover:opacity-90">Add stop ₹{fmt(long ? ref - atrPts : ref + atrPts, 1)} · target ₹{fmt(long ? ref + 2 * atrPts : ref - 2 * atrPts, 1)}</button></span></Read>
        : brk?.kind === 'risk'
        ? <Read tone="attention"><b>Risking {inr(brk.risk)} breaks your rule of {rules.maxRiskPct}% per trade ({inr(brk.cap)}).</b>
            <span className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={() => set({ qty: brk.fit })} className="inline-flex h-7 items-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-[var(--bg)] transition-opacity hover:opacity-90">Size to {brk.fit} {opt ? (brk.fit === 1 ? 'lot' : 'lots') : 'qty'}</button><span className="text-[11px]">or move the stop closer</span></span></Read>
        : a.sl == null
        ? <Read tone="attention"><b>No stop on this order.</b> If it moves against you, nothing limits the loss.
            <span className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={addPlan} className="inline-flex h-7 items-center rounded-md bg-fg px-2.5 text-[12px] font-medium text-[var(--bg)] transition-opacity hover:opacity-90">Add stop ₹{fmt(long ? ref - atrPts : ref + atrPts, 1)} · target ₹{fmt(long ? ref + 2 * atrPts : ref - 2 * atrPts, 1)}</button><span className="text-[11px]">2× ATR away, 1 : 2</span></span></Read>
        : risk > 0 ? <Read><b>Risking {inr(risk)}{reward > 0 ? ` to make ${inr(reward)} (1 : ${(reward / risk).toFixed(1)})` : ''}.</b>{reward > 0 && reward / risk < 1.5 ? ' The target is close for the risk taken; 1 : 2 or better is the usual bar.' : ''}</Read> : null}

      {/* The order in one line. Quantity is the edit people make most, so it stays live here; the rest opens Adjust. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <QtyPill value={a.qty} onChange={(qty) => set({ qty })} unit={opt ? (a.qty === 1 ? 'lot' : 'lots') : 'qty'} label={opt ? 'lots' : 'shares'} />
        <button type="button" className={chip} onClick={() => setAdjust(true)}>{opt ? 'F&O carry' : a.product === 'CNC' ? 'Delivery' : 'Intraday'}</button>
        <button type="button" className={chip} onClick={() => setAdjust(true)}>{a.otype === 'LIMIT' && a.price ? `Limit ₹${fmt(a.price)}` : 'Market'}</button>
        {a.sl != null && <button type="button" className={chip} onClick={() => setAdjust(true)}><span className="text-down">Stop ₹{fmt(a.sl)}</span>{a.tgt != null && <><span className="text-fg-subtle">·</span><span className="text-up">Target ₹{fmt(a.tgt)}</span></>}{a.trail ? <span className="text-fg-subtle"> · trails {a.trail}</span> : null}</button>}
        {isEntry(a, useStore.getState()) && <TagPicker value={a.tag} onChange={(tag) => set({ tag })} className="[&>button]:h-8" />}
        <button type="button" aria-expanded={open} onClick={() => setAdjust(!adjust)} disabled={slBad || tgBad} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg disabled:opacity-60">
          Adjust<ChevronDown size={13} strokeWidth={1.75} className={cn('transition-transform', open && 'rotate-180')} /></button>
      </div>

      {open && <div className="space-y-3 rounded-lg border border-line p-3.5 animate-rise">
        <div className="grid grid-cols-2 gap-3 @lg:grid-cols-3">
          <div className="@max-lg:col-span-2"><p className="text-[11px] text-fg-subtle">Side</p><div className="mt-1"><Seg label="Side" value={a.side} onChange={(side) => set({ side, sl: undefined, tgt: undefined })} options={[{ v: 'BUY', l: 'Buy', tone }, { v: 'SELL', l: 'Sell', tone }]} /></div></div>
          {opt ? <Stat label="Product">F&O carry (NRML)</Stat>
            : <div><p className="text-[11px] text-fg-subtle">Product</p><div className="mt-1"><Seg label="Product" value={a.product === 'CNC' ? 'CNC' : 'MIS'} onChange={(product) => set({ product })} options={[{ v: 'MIS', l: 'Intraday' }, { v: 'CNC', l: 'Delivery' }]} /></div></div>}
          <div><p className="text-[11px] text-fg-subtle">Type</p><div className="mt-1"><Seg label="Order type" value={a.otype === 'LIMIT' ? 'LIMIT' : 'MARKET'} onChange={(v) => set(v === 'LIMIT' ? { otype: 'LIMIT', price: +ltp.toFixed(1) } : { otype: 'MARKET', price: undefined })} options={[{ v: 'MARKET', l: 'Market' }, { v: 'LIMIT', l: 'Limit' }]} /></div></div>
        </div>
        <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
          <Field label={a.otype === 'LIMIT' ? 'Limit price' : 'Price'} value={a.otype === 'LIMIT' ? String(a.price ?? '') : ''} placeholder={`Market · ${ltp.toFixed(2)}`} disabled={a.otype !== 'LIMIT'} onChange={(v) => set({ price: v ? +v : undefined })} step={0.05} />
          <Field label="Stop" value={a.sl != null ? String(a.sl) : ''} placeholder="none" onChange={(v) => set({ sl: v ? +v : undefined })} step={0.05} />
          <Field label="Target" value={a.tgt != null ? String(a.tgt) : ''} placeholder="none" onChange={(v) => set({ tgt: v ? +v : undefined })} step={0.05} />
          <Field label="Trail (pts)" value={a.trail != null ? String(a.trail) : ''} placeholder="off" onChange={(v) => set({ trail: v ? +v : undefined })} step={0.05} />
        </div>
        {(slBad || tgBad) && <p className="text-[12px] text-danger-fg">{slBad ? `The stop is on the wrong side of the entry (₹${fmt(ref)}).` : `The target is on the wrong side of the entry (₹${fmt(ref)}).`}</p>}
        {a.sl != null && <button type="button" onClick={() => set({ sl: undefined, tgt: undefined, trail: undefined })} className="text-[12px] text-fg-subtle underline-offset-2 hover:text-fg hover:underline">Remove the exit plan</button>}
      </div>}
      {!opt && a.product !== 'CNC' && misClosedNow() && <p className="text-[12px] text-danger-fg">Intraday entries stop at 3:20 pm. Switch to Delivery to place this today.</p>}
      {short && <p className="text-[12px] text-danger-fg">Needs {inr(margin - avail)} more than your free funds ({inr(avail)}). Reduce the quantity.</p>}
    </div>
  )
}

function StrategyDraft({ msgId, i, a }: { msgId: number; i: number; a: Extract<Action, { t: 'legs' }> }) {
  const spot = useStore((s) => s.prices[a.und].ltp); const inst = bySym(a.und)!; const ex = nextExpiries(a.und)[a.expiryIdx] ?? nextExpiries(a.und)[0]
  const lots = a.legs[0]?.lots ?? 1; const base = a.legs.map((l) => ({ ...l, lots: Math.max(1, Math.round(l.lots / lots)) }))
  const c = useMemo(() => curve(a.und, spot, ex.T, a.legs), [a.legs, Math.round(spot / inst.step * 2), ex.label]) // eslint-disable-line react-hooks/exhaustive-deps
  const margin = useMemo(() => legsMargin(a.und, a.legs, a.expiryIdx), [a.legs, Math.round(spot)]) // eslint-disable-line react-hooks/exhaustive-deps
  const avail = useStore((s) => s.pnl().avail); const [legs, setLegs] = useState(false)
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><p className="text-[12px] text-fg-subtle">Max loss</p><p className="num text-[20px] font-semibold leading-7 text-down">{c.unlL ? 'Unlimited' : inr(c.maxL)}</p></div>
        <div><p className="text-[12px] text-fg-subtle">Max profit</p><p className="num text-[20px] font-semibold leading-7 text-up">{c.unlP ? 'Unlimited' : inr(c.maxP)}</p></div>
      </div>
      {c.unlL ? <Read tone="attention"><b>Loss is unlimited on one side.</b> Buy a wing further out to cap it.</Read>
        : c.be.length > 0 && <Read><b>Profitable at expiry {c.be.length === 2 ? `between ${c.be[0].toFixed(0)} and ${c.be[1].toFixed(0)}` : c.y[0] > 0 ? `below ${c.be[0].toFixed(0)}` : `above ${c.be[0].toFixed(0)}`}</b> ({c.be.map((b) => sgn((b / spot - 1) * 100, 1) + '%').join(' / ')} from spot ₹{fmt(spot)}).</Read>}
      {/* One line for the structure: lots stay live, the legs fold into a chip row; the full table is behind Legs. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <QtyPill value={lots} onChange={(n) => editDraft(msgId, i, { ...a, legs: base.map((l) => ({ ...l, lots: l.lots * n })) })} unit={lots === 1 ? 'lot' : 'lots'} label="lots" />
        {a.legs.map((l, j) => <LegChip key={j} l={l} />)}
        <button type="button" aria-expanded={legs} onClick={() => setLegs(!legs)} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[12px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg">
          Legs<ChevronDown size={13} strokeWidth={1.75} className={cn('transition-transform', legs && 'rotate-180')} /></button>
      </div>
      {legs && <div className="overflow-hidden rounded-lg border border-line animate-rise">
        <table className="tbl-card"><thead><tr><th>Leg</th><th>Strike</th><th>Type</th><th>Lots</th><th>Price</th></tr></thead>
          <tbody>{a.legs.map((l, j) => <tr key={j}><td><span className={cn('rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase', l.side === 'BUY' ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg')}>{l.side === 'BUY' ? 'Buy' : 'Sell'}</span></td><td className="font-medium">{l.strike}</td><td>{l.type}</td><td>{l.lots}</td><td>₹{fmt(c.entries[j])}</td></tr>)}</tbody></table>
        <p className="border-t border-line px-4 py-2 text-[11px] text-fg-subtle">{a.und} {ex.label} expiry · {lots * inst.lot} qty per leg · buy legs are placed first, so hedges cut the margin</p>
      </div>}
      <div className="rounded-lg bg-sunken px-2 py-2"><Payoff c={c} spot={spot} /></div>
      <p className="text-[12px] tabular-nums text-fg-muted">{c.net >= 0 ? 'Net credit' : 'Net debit'} <span className="font-medium text-fg">{inr(Math.abs(c.net))}</span> · margin <span className={cn('font-medium text-fg', margin > avail && '!text-danger-fg')}>{inr(Math.max(margin, c.net < 0 ? -c.net : 0))}</span> of {inrShort(avail)} free · spot ₹{fmt(spot)}</p>
    </div>
  )
}

/** After approval the draft becomes a tracker: order status, then the live position it created. */
function OrderTracker({ ids }: { ids: number[] }) {
  const orders = useStore(useShallow((s) => s.orders.filter((o) => ids.includes(o.id))))
  const keys = [...new Set(orders.filter((o) => o.status === 'COMPLETE').map((o) => o.key))]
  const positions = useStore((s) => s.positions)
  return (
    <div className="space-y-3">
      {orders.map((o) => <div key={o.id} className="flex items-center gap-2.5 text-[13px]">
        {o.status === 'COMPLETE' ? <Badge tone="success">Filled</Badge> : o.status === 'REJECTED' ? <Badge tone="danger">Rejected</Badge> : o.status === 'CANCELLED' ? <Badge tone="neutral">Cancelled</Badge> : <Badge tone="info">{o.status === 'TRIGGER_PENDING' ? 'Waiting for trigger' : 'Working'}</Badge>}
        <span className="num min-w-0 flex-1 truncate text-fg-muted">{o.status === 'COMPLETE' ? (o.side === 'BUY' ? 'Bought' : 'Sold') : (o.side === 'BUY' ? 'Buy' : 'Sell')} {o.qty} {labelOf(o.key)}{o.status === 'COMPLETE' ? ` at ${o.fill?.toFixed(2)}` : o.status === 'REJECTED' ? ` · ${o.note}` : ` at ${o.otype === 'LIMIT' ? 'limit ' + o.price : 'trigger ' + o.trigger}`}</span>
        {(o.status === 'OPEN' || o.status === 'TRIGGER_PENDING') && <Act onClick={() => useStore.getState().cancel(o.id)}>Cancel</Act>}
      </div>)}
      {keys.length > 1 ? <StrategyLive keys={keys.filter((k) => positions[k])} /> : keys.filter((k) => positions[k]).map((k) => <div key={k} className="-mx-3.5 border-t border-line px-3.5"><PositionRow k={k} /></div>)}
    </div>
  )
}

/** A placed multi-leg strategy, tracked as one position: combined P&L and one exit for all legs. */
function StrategyLive({ keys }: { keys: string[] }) {
  const positions = useStore((s) => s.positions); const ltp = useStore((s) => s.ltp); useStore((s) => s.prices)
  const [sure, setSure] = useState(false)
  const open = keys.filter((k) => positions[k]?.qty)
  const total = keys.reduce((a, k) => { const p = positions[k]; return a + (p.qty ? (ltp(k) - p.avg) * p.qty : 0) + p.realized }, 0)
  const exit = () => { const s = useStore.getState(); const shorts = [...open].sort((a, b) => s.positions[a].qty - s.positions[b].qty); shorts.forEach((k) => s.squareoff(k)); setSure(false); s.addMsg({ role: 'user', text: `Exit ${positions[keys[0]].tag ?? 'strategy'}` }); s.addMsg({ role: 'ai', text: `Closed all ${open.length} legs at market, shorts first.`, follow: ['review my trades', 'explain my pnl'] }) }
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="tbl-card"><thead><tr><th>Leg</th><th>Qty</th><th>Avg</th><th>Now</th><th>P&L</th></tr></thead>
        <tbody>{keys.map((k) => { const p = positions[k]; const l = ltp(k); return <tr key={k}><td className="font-medium">{labelOf(k).replace(/^\w+ \d+ \w+ /, '')}</td><td className={p.qty > 0 ? 'text-up' : p.qty < 0 ? 'text-down' : ''}>{p.qty ? (p.qty > 0 ? '+' : '') + p.qty : 'closed'}</td><td>{p.avg ? `₹${fmt(p.avg)}` : '–'}</td><td>₹{fmt(l)}</td><td><Money v={p.qty ? (l - p.avg) * p.qty : p.realized} /></td></tr> })}</tbody></table>
      <div className="flex items-center gap-3 border-t border-line bg-sunken px-3.5 py-3">
        <span className="text-[12px] text-fg-muted">Strategy P&L</span><Money v={total} className="text-[18px] font-semibold" />
        <span className="ml-auto flex gap-1">{open.length > 0 && (sure ? <><Button size="sm" variant="danger" onClick={exit}>Exit {open.length} legs at market</Button><Button size="sm" variant="ghost" onClick={() => setSure(false)}>Keep</Button></> : <Act onClick={() => setSure(true)}>Exit strategy</Act>)}</span>
      </div>
    </div>
  )
}

const TITLE: Record<string, string> = { order: 'Order', legs: 'Strategy', squareoff: 'Exit', trigger: 'Conditional order', risk: 'Kill switch', sip: 'SIP' }
/** The draft's title as plain text, for one-line places like the discarded row. */
function plainTitle(a: Action) {
  if (a.t === 'order') return `${a.side === 'BUY' ? 'Buy' : 'Sell'} ${a.qty} ${a.strike ? `${a.und} ${a.strike} ${a.ot}` : a.und}`
  if (a.t === 'legs') return `${a.name ?? 'Strategy'} on ${a.und}`
  return TITLE[a.t] ?? a.t
}
function draftTitle(a: Action) {
  if (a.t === 'order') return <span className="flex items-center gap-2"><span className={a.side === 'BUY' ? 'text-up' : 'text-down'}>{a.side === 'BUY' ? 'Buy' : 'Sell'}</span><span className="font-semibold">{a.strike ? labelOf(keyOf(a.und, a.strike, a.ot, (nextExpiries(a.und)[a.expiryIdx ?? 0] ?? nextExpiries(a.und)[0]).label)) : a.und}</span></span>
  if (a.t === 'legs') return <span className="capitalize">{a.name ?? 'Strategy'} · {a.und}</span>
  return TITLE[a.t] ?? a.t
}
function describeOther(a: Action) {
  switch (a.t) {
    case 'squareoff': return a.key ? `Close ${labelOf(a.key)} at market.` : 'Close every open position at market and cancel working orders.'
    case 'trigger': return `When ${a.sym} goes ${a.dir} ${a.price}: ${a.then ? `${a.then.side.toLowerCase()} ${a.then.qty} ${a.then.und}${a.then.sl ? `, stop ${a.then.sl}` : ''}${a.then.tgt ? `, target ${a.then.tgt}` : ''}` : 'notify me'}.`
    case 'risk': return 'Close all positions, cancel orders and block new entries for the rest of today.'
    case 'sip': return `Buy ${inr(a.amount)} of ${a.sym} at market on day ${a.day ?? 5} of every month.`
    default: return ''
  }
}

/** The approval surface for everything the agent drafted in one message. */
export function DraftCard({ msgId }: { msgId: number }) {
  const m = useStore((s) => s.msgs.find((x) => x.id === msgId))!; const gate = useEntryGate(); useStore((s) => s.rules)
  const known = useStore((s) => !!m.orderIds?.some((id) => s.orders.some((o) => o.id === id)))
  if (!m.pending) return null
  const live = m.state === 'pending'
  const risky = m.pending.some((a) => (a.t === 'order' && a.side === 'SELL' && a.strike) || (a.t === 'squareoff' && !a.key) || (a.t === 'risk' && a.kill))
  const invalid = m.pending.some((a) => a.t === 'order' && ((a.sl != null && (a.side === 'BUY' ? a.sl >= useStore.getState().ltp(useStore.getState().resolveOrder(a).key) : a.sl <= useStore.getState().ltp(useStore.getState().resolveOrder(a).key))) || a.qty < 1))
  const blocked = live && gate && m.pending.some((a) => isEntry(a))
  const broken = live && m.pending.some((a) => !!ruleBreak(a))
  // Discarded: nothing happened, so it shrinks to a single quiet line instead of a full card.
  if (m.state === 'dismissed') return (
    <div className="flex h-10 items-center gap-2 rounded-lg border border-dashed border-line px-4 text-[12px] text-fg-subtle">
      <X size={13} strokeWidth={1.75} aria-hidden /><span className="min-w-0 truncate"><span className="text-fg-muted">Discarded</span> · {m.pending.length === 1 ? plainTitle(m.pending[0]) : `${m.pending.length} actions`}</span><span className="ml-auto shrink-0">nothing was sent</span>
    </div>
  )
  const verb = m.pending[0].t === 'order' ? 'Place order' : m.pending[0].t === 'legs' ? `Place ${m.pending[0].legs.length} orders` : m.pending[0].t === 'squareoff' ? 'Exit' : m.pending[0].t === 'risk' ? 'Turn on kill switch' : m.pending[0].t === 'sip' ? 'Start SIP' : 'Confirm'
  return (
    <Shell className={cn(live && !blocked && '!border-[var(--attention)] ring-1 ring-[var(--attention)]', blocked && 'opacity-80')}
      title={m.pending.length === 1 ? draftTitle(m.pending[0]) : `${m.pending.length} actions`}
      meta={blocked ? <Badge tone="neutral">On hold</Badge> : live ? <Badge tone="warning">Needs your approval</Badge> : m.state === 'confirmed' ? <Badge tone="success">Approved</Badge> : <Badge tone="neutral">Cancelled</Badge>}
      foot={live ? <>
        <Button size="sm" variant={risky ? 'danger' : 'primary'} disabled={invalid || !!blocked || broken} onClick={() => confirm(msgId)}>{verb}</Button>
        <Button size="sm" variant="ghost" leading={<X size={12} strokeWidth={1.5} />} onClick={() => dismiss(msgId)}>Discard</Button>
        {blocked && gate ? <span className="ml-auto flex min-w-0 items-center gap-1.5 text-[12px] text-fg-muted" title={gate.why}><GateIcon g={gate} size={12} /><span className="truncate">{gate.short}. This draft can't be placed until entries reopen.</span></span>
          : broken ? <span className="ml-auto text-[12px] text-fg-muted">Breaks one of your rules. Fix it above, or change your rules.</span>
          : <span className="ml-auto text-[11px] text-fg-subtle">Paper trade · checks run again when you place it</span>}
      </> : undefined}>
      {live
        ? <div className="space-y-4">{m.pending.map((a, i) => a.t === 'order' ? <OrderDraft key={i} msgId={msgId} i={i} a={a} live /> : a.t === 'legs' ? <StrategyDraft key={i} msgId={msgId} i={i} a={a} /> : <p key={i} className="text-[13px] text-fg">{describeOther(a)}</p>)}</div>
        : m.state === 'confirmed' && m.orderIds?.length && !known ? <p className="text-[12px] text-fg-subtle">These orders are no longer in your book. The paper account was reset after they were placed.</p>
        : m.state === 'confirmed' && m.orderIds?.length ? <OrderTracker ids={m.orderIds} />
        : <p className="text-[12px] text-fg-subtle">{m.state === 'confirmed' ? m.pending.map(describeOther).filter(Boolean).join(' ') || 'Done.' : 'Nothing was sent.'}</p>}
    </Shell>
  )
}

/* ------------------------------------------------------------------ account */

export function AlertsCard() {
  const triggers = useStore((s) => s.triggers); const prices = useStore((s) => s.prices)
  const open = triggers.filter((t) => !t.done).map((t) => ({ t, l: prices[t.sym].ltp, dist: (t.price / prices[t.sym].ltp - 1) * 100 })).sort((a, b) => Math.abs(a.dist) - Math.abs(b.dist))
  const near = open[0]
  return (
    <Shell pad={false} title="Alerts">
      <div className="space-y-3 px-3.5 pb-3">
        {open.length > 0 && <Hero aside={<span className="text-[13px] text-fg-muted">{open.length === 1 ? 'alert working' : 'alerts working'}</span>}>{open.length}</Hero>}
        {near ? <Read><b>Closest: {near.t.sym}, {Math.abs(near.dist).toFixed(1)}% from ₹{fmt(near.t.price)}.</b> {near.t.then ? `When it crosses, I'll draft the ${near.t.then.side.toLowerCase()} for you to approve.` : "I'll tell you here when it crosses."}</Read>
          : <p className="text-[13px] text-fg-muted">No alerts set. Try “alert me if sbin crosses 900”.</p>}
      </div>
      {open.length > 0 && <ul className="divide-y divide-line border-t border-line">{open.map(({ t, l, dist }) => (
        <li key={t.id} className="flex items-center gap-3 px-3.5 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-fg"><b className="font-semibold">{t.sym}</b> crosses {t.dir} <b className="font-semibold tabular-nums">₹{fmt(t.price)}</b></span>
            <span className="block text-[12px] text-fg-subtle">{t.then ? `Then ${t.then.side.toLowerCase()} ${t.then.qty}${t.then.sl ? `, stop ₹${t.then.sl}` : ''}` : 'Notify me'} · now ₹{fmt(l)}</span>
          </span>
          <span className="text-[12px] font-medium tabular-nums text-fg-muted">{sgn(dist, 1)}%</span>
          <button type="button" aria-label={`Remove alert on ${t.sym}`} onClick={() => useStore.getState().removeTrigger(t.id)} className="inline-flex size-8 items-center justify-center rounded-md border border-line-strong bg-sunken text-fg-muted shadow-xs transition-colors hover:bg-hover hover:text-fg"><X size={13} strokeWidth={1.75} /></button>
        </li>))}</ul>}
    </Shell>
  )
}

export function JournalCard() {
  const trades = useStore((s) => s.trades)
  const t = trades.filter((x) => x.close > Date.now() - 30 * 864e5).sort((a, b) => a.close - b.close)
  const net = (x: (typeof t)[0]) => x.pnl - x.charges
  const tot = t.reduce((a, x) => a + net(x), 0); const winners = t.filter((x) => net(x) > 0); const losers = t.filter((x) => net(x) <= 0)
  const avgW = winners.length ? winners.reduce((a, x) => a + net(x), 0) / winners.length : 0
  const avgL = losers.length ? -losers.reduce((a, x) => a + net(x), 0) / losers.length : 0
  const winRate = t.length ? winners.length / t.length : 0; const need = avgW + avgL ? avgL / (avgW + avgL) : 0
  const worst = losers.length ? Math.min(...losers.map(net)) : 0
  const rules = useStore((s) => s.rules); const cash = useStore((s) => s.cash)
  const found = useMemo(() => insights(trades, rules, cash), [trades, rules, cash])
  let run = 0; const eq = [0, ...t.map((x) => (run += net(x)))]
  const lo = Math.min(0, ...eq), hi = Math.max(0, ...eq); const W = 320, H = 84
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12); const x = (i: number) => (i / Math.max(eq.length - 1, 1)) * W
  const line = eq.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const tone = tot >= 0 ? 'var(--success)' : 'var(--danger)'; const id = useMemo(() => 'eq' + Math.random().toString(36).slice(2), [])
  return (
    <Shell pad={false} title="Your last 30 days" foot={<><span className="text-[12px] text-fg-subtle">Includes sample history</span><span className="ml-auto" /><Act icon={<ArrowUpRight size={13} strokeWidth={1.75} />} onClick={() => openCanvas('journal')}>Open the journal</Act></>}>
      <div className="space-y-3 px-3.5 pb-3">
        <Hero label="Net after charges" aside={<span className="rounded-md bg-sunken px-2.5 py-1 text-[12px] font-medium text-fg-muted">{(winRate * 100).toFixed(0)}% of trades won</span>}><Money v={tot} /></Hero>
        <InsightRead list={found} fallback={winners.length > 0 && losers.length > 0 && <Read tone={winRate < need ? 'attention' : undefined}><b>{avgL > avgW ? `Your average loss (${inr(avgL)}) is ${(avgL / avgW).toFixed(1)}× your average win (${inr(avgW)}).` : `Your average win (${inr(avgW)}) is ${(avgW / avgL).toFixed(1)}× your average loss (${inr(avgL)}).`}</b> That needs a {(need * 100).toFixed(0)}% win rate to break even; you're at {(winRate * 100).toFixed(0)}%.{winRate < need && avgL > avgW ? ' Tighter stops would close the gap faster than more wins.' : ''}</Read>} />
        {eq.length > 2 && <div className="rounded-lg bg-sunken px-2 py-2">
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height: H }} className="w-full" role="img" aria-label={`Equity curve over ${t.length} trades, ending at ${inr(tot)}`}>
            <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={tone} stopOpacity="0.22" /><stop offset="1" stopColor={tone} stopOpacity="0" /></linearGradient></defs>
            <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <path d={`${line}L${W},${H}L0,${H}Z`} fill={`url(#${id})`} />
            <path d={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          </svg>
        </div>}
      </div>
      <Facts items={[
        { k: 'Trades', v: t.length }, { k: 'Per trade', v: inr(t.length ? tot / t.length : 0) },
        { k: 'Largest loss', v: inr(worst), note: avgL ? `${(-worst / avgL).toFixed(1)}× avg` : undefined, warn: avgL > 0 && -worst / avgL >= 3 },
        { k: 'Charges paid', v: inr(t.reduce((a, x) => a + x.charges, 0)) },
      ]} />
    </Shell>
  )
}

export function RiskCard() {
  const risk = useStore((s) => s.risk); const pnl = useStore(useShallow((s) => s.pnl())); const orders = useStore((s) => s.orders)
  const used = orders.filter((o) => o.status === 'COMPLETE' && new Date(o.ts).toDateString() === new Date().toDateString() && o.via !== 'bracket' && o.via !== 'risk').length
  const loss = Math.max(0, -pnl.net); const left = Math.max(0, risk.maxLoss - loss)
  return (
    <Shell pad={false} title="Today's limits" meta={risk.killed ? <Badge tone="danger">Trading locked</Badge> : <span className="flex items-center gap-1.5 font-medium text-success-fg"><span className="size-1.5 rounded-full bg-success" aria-hidden />Active</span>}>
      <div className="space-y-4 px-3.5 pb-5">
        <Hero label={risk.killed ? 'New trades are blocked for today' : 'Loss you can still take today'} sub={`${Math.max(0, risk.maxTrades - used)} of ${risk.maxTrades} trades left`}><Rs />{fmt(left, 0)}</Hero>
        {risk.killed ? <Read tone="attention"><b>{(risk.reason ?? 'Trading is locked').replace(/[.!]?$/, '.')}</b> It unlocks at the next session.</Read>
          : <Read><b>At {inr(risk.maxLoss)} loss I close everything</b>, and profits lock at {inr(risk.maxProfit)}. After {risk.cooloffAfter} losses in a row, new entries pause for 15 minutes.</Read>}
        {/* The meter is a bare bar, so each one gets its label and reading above it. */}
        {[{ l: 'Loss used', v: loss, max: risk.maxLoss, t: `${inr(loss)} of ${inr(risk.maxLoss)}` }, { l: 'Trades used', v: used, max: risk.maxTrades, t: `${used} of ${risk.maxTrades}` }].map((m) => (
          <div key={m.l}><p className="mb-1.5 flex justify-between text-[12px]"><span className="text-fg-subtle">{m.l}</span><span className="font-medium tabular-nums text-fg">{m.t}</span></p>
            <MeterBar label={m.l} value={m.v} max={m.max} warnAt={0.8} valueText={m.t} /></div>))}
      </div>
    </Shell>
  )
}

export function FundsCard() {
  const pnl = useStore(useShallow((s) => s.pnl())); const cash = useStore((s) => s.cash); const holdings = useStore((s) => s.holdings); const prices = useStore((s) => s.prices)
  const hv = holdings.reduce((a, h) => a + (prices[h.sym]?.ltp ?? h.avg) * h.qty, 0), hc = holdings.reduce((a, h) => a + h.avg * h.qty, 0)
  const inUse = pnl.used / Math.max(pnl.used + pnl.avail, 1)
  return (
    <Shell pad={false} title="Funds and holdings" foot={<><span className="ml-auto" /><Act icon={<ArrowUpRight size={13} strokeWidth={1.75} />} onClick={() => openCanvas('portfolio')}>Open portfolio</Act></>}>
      <div className="space-y-3 px-3.5 pb-3">
        <Hero label="Free to trade"><Rs />{fmt(pnl.avail, 0)}</Hero>
        <Read tone={inUse > 0.8 ? 'attention' : undefined}><b>{inUse > 0 ? `${(inUse * 100).toFixed(0)}% of your trading capital is in use.` : 'All of your trading capital is free.'}</b>{holdings.length > 0 && <> Holdings are {hv >= hc ? 'up' : 'down'} {sgn(((hv / hc) - 1) * 100, 1).replace(/^[+−]/, '')}% overall.</>}{inUse > 0.8 && ' Little room for new margin trades.'}</Read>
      </div>
      <Facts cols={3} items={[{ k: 'Margin used', v: inr(pnl.used) }, { k: 'Cash', v: inr(cash) }, { k: 'Today, net', v: <Money v={pnl.net} /> }]} />
      {holdings.length > 0 && <button type="button" onClick={() => openCanvas('portfolio')} className="flex w-full items-center gap-3 border-t border-line px-3.5 py-3 text-left transition-colors hover:bg-hover">
        <span className="flex -space-x-2" aria-hidden>{holdings.slice(0, 4).map((h) => <span key={h.sym} className="inline-flex size-7 items-center justify-center rounded-lg border-2 border-[var(--surface)] bg-sunken text-[10px] font-semibold text-fg">{h.sym.slice(0, 2)}</span>)}</span>
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-fg">{holdings.length} holdings</span><span className="block text-[12px] tabular-nums text-fg-subtle">Worth ₹{fmt(hv, 0)}</span></span>
        <span className="flex flex-col items-end"><Money v={hv - hc} className="text-[14px] font-semibold" /><span className="text-[11px] tabular-nums text-fg-subtle">{sgn(((hv / hc) - 1) * 100, 1)}% overall</span></span>
      </button>}
    </Shell>
  )
}

export function RulesCard() {
  const rules = useStore((s) => s.rules); const trades = useStore((s) => s.trades); const cash = useStore((s) => s.cash)
  const on = Object.keys(rules) as RuleId[]
  const sugg = useMemo(() => insights(trades, rules, cash), [trades, rules, cash])
  return (
    <Shell pad={false} title="Your rules" meta={<span>{on.length} on</span>}>
      <div className="px-3.5 pb-3">
        {sugg[0] ? <InsightRead list={sugg} />
          : <Read><b>{on.length ? 'Nothing new in your trades to add.' : 'No rules yet.'}</b> {on.length ? 'I check every draft and order against the rules below.' : 'Say one in plain words, like “always use a stop”, “no trades after 2 pm” or “risk 1% per trade”.'}</Read>}
      </div>
      {on.length > 0 && <ul className="divide-y divide-line border-t border-line">{on.map((id) => (
        <li key={id} className="flex items-center gap-3 px-3.5 py-3">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success-soft text-success-fg" aria-hidden><Check size={13} strokeWidth={2} /></span>
          <span className="min-w-0 flex-1 text-[13px] text-fg">{ruleText(id, rules)}</span>
          <Act onClick={() => useStore.getState().setRules({ [id]: undefined })}>Turn off</Act>
        </li>))}</ul>}
      {sugg.length > 1 && <div className="border-t border-line px-3.5 py-3">
        <p className="text-[11px] text-fg-subtle">Also suggested by your trades</p>
        <ul className="mt-1">{sugg.slice(1).map((it) => (
          <li key={it.id} className="flex items-center gap-3 py-1.5">
            <span className="min-w-0 flex-1 text-[13px] text-fg-muted"><span className="text-fg">{ruleText(it.id, it.rule)}</span> · {it.lead.replace(/^./, (c) => c.toLowerCase())}</span>
            <Act onClick={() => useStore.getState().setRules(it.rule)}>Turn on</Act>
          </li>))}</ul>
      </div>}
    </Shell>
  )
}

/** One setup question: number, prompt, and its answers as chips. */
const Q = ({ n, q, children }: { n: number; q: string; children: ReactNode }) => (
  <div className="px-3.5 py-4"><p className="text-[12px] text-fg-subtle"><span className="mr-1.5 tabular-nums">{n}</span>{q}</p><div className="mt-2 flex flex-wrap gap-1.5">{children}</div></div>
)

/**
 * Desk setup: four questions, then a summary of exactly what they change. Nothing is applied until "Set up my desk".
 * Shown on the first visit, and any time you ask to "set up my desk".
 */
export function SetupCard({ first, onFinish }: { first?: boolean; onFinish?: () => void }) {
  // Running setup again starts from the current answers and limit, so it reads as "change", not "start over".
  const prev = useStore((st) => (st.profile && 'style' in st.profile ? st.profile : null)); const curLoss = useStore((st) => st.risk.maxLoss)
  const [style, setStyle] = useState<Style | null>(prev?.style ?? null); const [exp, setExp] = useState<Experience | null>(prev?.experience ?? null)
  const [themes, setThemes] = useState<string[]>(prev?.themes ?? ['Banks', 'IT'].filter((t) => THEMES.includes(t)))
  const [loss, setLoss] = useState<number | null>(prev && LIMITS.includes(curLoss) ? curLoss : null); const [done, setDone] = useState(false)
  const maxLoss = loss ?? (exp === 'new' ? 2000 : exp === 'pro' ? 10000 : 5000)
  const plan = style && exp ? planFor(style, exp, themes, maxLoss) : null
  const chip = (on: boolean) => cn('rounded-md border px-3 py-1.5 text-left text-[13px] transition-colors', on ? 'border-fg bg-fg text-[var(--bg)]' : 'border-line bg-surface text-fg hover:border-line-strong hover:bg-hover')
  if (done) return <Shell title="Desk set up"><p className="text-[13px] text-fg-muted">Done. Your limits, rules and watchlist are in place; ask to “set up my desk” any time to change them.</p></Shell>
  return (
    <Shell pad={false} title={first ? 'Set up your desk' : 'Desk setup'} meta={<span>30 seconds</span>}
      foot={<><Button size="sm" variant="primary" disabled={!plan} onClick={() => { applySetup(style!, exp!, themes, maxLoss); setDone(true); onFinish?.() }}>Set up my desk</Button>
        {first && <Button size="sm" variant="ghost" onClick={() => { skipSetup(); setDone(true); onFinish?.() }}>Skip for now</Button>}
        <span className="ml-auto text-[11px] text-fg-subtle">You can change all of this later</span></>}>
      <div className="px-3.5 pb-3"><Read><b>Four quick questions, so I can set limits and rules that fit how you trade.</b> Paper money, simulated prices, nothing real at stake.</Read></div>
      <div className="divide-y divide-line border-t border-line">
        <Q n={1} q="How do you trade?">{STYLES.map((o) => <button key={o.v} type="button" aria-pressed={style === o.v} onClick={() => setStyle(o.v)} className={chip(style === o.v)}><span className="block font-medium">{o.l}</span><span className={cn('block text-[11px]', style === o.v ? 'opacity-70' : 'text-fg-subtle')}>{o.d}</span></button>)}</Q>
        <Q n={2} q="How long have you been trading?">{EXPERIENCE.map((o) => <button key={o.v} type="button" aria-pressed={exp === o.v} onClick={() => setExp(o.v)} className={chip(exp === o.v)}>{o.l}</button>)}</Q>
        <Q n={3} q="Most you're willing to lose in a day">{LIMITS.map((v) => <button key={v} type="button" aria-pressed={maxLoss === v} onClick={() => setLoss(v)} className={chip(maxLoss === v)}>₹{v.toLocaleString('en-IN')}</button>)}</Q>
        <Q n={4} q="What do you follow? Pick a few for your watchlist">{THEMES.map((t) => <button key={t} type="button" aria-pressed={themes.includes(t)} onClick={() => setThemes(themes.includes(t) ? themes.filter((x) => x !== t) : [...themes, t])} className={chip(themes.includes(t))}>{t}</button>)}</Q>
      </div>
      {/* What the answers change, before anything is applied. */}
      {plan && <div className="border-t border-line bg-sunken px-3.5 py-3.5 text-[12px] leading-5 text-fg-muted">
        <p className="mb-1 font-medium text-fg">I'll set</p>
        <ul className="space-y-0.5">
          <li>Daily loss limit <b className="font-medium text-fg">₹{plan.maxLoss.toLocaleString('en-IN')}</b>, at most <b className="font-medium text-fg">{plan.maxTrades} trades</b> a day</li>
          <li>{plan.rules.stopRequired ? <>Every entry gets a stop; risk per trade at most <b className="font-medium text-fg">{plan.rules.maxRiskPct}%</b> of capital</> : 'No standing rules; your journal will suggest some'}</li>
          <li>Watchlist of <b className="font-medium text-fg">{plan.watch.length}</b>: {plan.watch.slice(0, 6).join(', ')}{plan.watch.length > 6 ? ` and ${plan.watch.length - 6} more` : ''}</li>
        </ul>
      </div>}
    </Shell>
  )
}

/**
 * Today's setups: watchlist stocks at a decision point, each with entry, stop and target and a quantity sized to your
 * risk per trade, so the next step is one tap (a GTT you approve), not more research.
 */
export function SetupsCard() {
  const watch = useStore((s) => s.watch); const ltp = useStore((s) => s.ltp); const cash = useStore((s) => s.cash); const rules = useStore((s) => s.rules)
  useStore((s) => Math.floor(s.prices.NIFTY.ltp)) // refresh as the market moves
  const list = setupsFor(watch, ltp)
  const pct = rules.maxRiskPct ?? 0.5; const budget = cash * pct / 100
  return (
    <Shell pad={false} title="Today's setups" meta={<span>from your watchlist</span>}>
      <div className="px-3.5 pb-3"><Read><b>{list.length ? `${list.length} of your ${watch.length} watchlist names are at a decision point.` : 'Nothing on your watchlist is at a decision point right now.'}</b> {list.length ? `Price structure only, not advice. Quantities risk about ${inr(budget)} each (${pct}% of capital) if the stop is hit.` : 'Add names to your watchlist, or ask again later in the session.'}</Read></div>
      {list.length > 0 && <ul className="divide-y divide-line border-t border-line">{list.map((x) => {
        const qty = Math.max(1, Math.floor(budget / Math.max(x.entry - x.stop, 0.05)))
        const order: OrderAction = { t: 'order', und: x.sym, side: 'BUY', qty, otype: 'MARKET', product: 'CNC', sl: x.stop, tgt: x.target, tag: x.kind.toLowerCase() }
        return (
          <li key={x.sym} className="px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-fg">{x.sym}</span>
              <span className="rounded bg-sunken px-1.5 py-px text-[10px] font-medium text-fg-muted">{x.kind}</span>
              <span className="ml-auto flex gap-1.5">
                <Act onClick={() => say(`${lower(x.sym)} chart`)}>Chart</Act>
                <Act onClick={() => propose(`Set a GTT on ${x.sym}`, `When ${x.sym} goes above ₹${fmt(x.entry)}, buy ${qty} with a stop at ₹${fmt(x.stop)} and a target at ₹${fmt(x.target)}. Approve to set it; it then places itself, inside your limits and rules.`, [{ t: 'trigger', sym: x.sym, dir: x.dir, price: x.entry, then: order }])}>Set GTT</Act>
              </span>
            </div>
            <p className="mt-0.5 truncate text-[12px] text-fg-subtle">{x.why}</p>
            <p className="num mt-1 flex flex-wrap gap-x-3 text-[12px] text-fg-muted"><span>Entry <span className="text-fg">{fmt(x.entry)}</span></span><span>Stop <span className="text-down">{fmt(x.stop)}</span></span><span>Target <span className="text-up">{fmt(x.target)}</span></span><span>{qty} qty · risk {inr((x.entry - x.stop) * qty)}</span></p>
          </li>)
      })}</ul>}
    </Shell>
  )
}

/* ------------------------------------------------------------------ router */

export function CardView({ c }: { c: Card }) {
  switch (c.k) {
    case 'quote': return <QuoteCard sym={c.sym} />
    case 'depth': return <DepthCard sym={c.sym} />
    case 'chart': return <ChartCard sym={c.sym} tf={c.tf} levels={c.levels} />
    case 'brief': return <BriefCard />
    case 'positions': return <PositionsCard />
    case 'position': return <PositionCard k={c.key} />
    case 'scan': return <ScanCard filters={c.filters} name={c.name} />
    case 'chain': return <ChainCard und={c.und} expiryIdx={c.expiryIdx} />
    case 'ideas': return <IdeasCard {...c} />
    case 'alerts': return <AlertsCard />
    case 'journal': return <JournalCard />
    case 'risk': return <RiskCard />
    case 'rules': return <RulesCard />
    case 'setup': return <SetupCard />
    case 'setups': return <SetupsCard />
    case 'funds': return <FundsCard />
  }
}

