// Draws the terminal's own layer on TradingView's Advanced Charts, through its chart API:
//   - working orders as order lines: drag to change the price, × to cancel
//   - the open position as a position line with live P&L, × to exit at market
//   - the exit plan (stop, target, trailing stop) as draggable lines, validated against the current price
//   - price alerts and GTTs as draggable lines, × to remove
//   - AI levels (support and resistance from daily swings) and candlestick patterns, when switched on
// With Trading Platform the library draws orders and positions itself from the broker (broker.ts), so only
// alerts and AI levels are drawn here. Everything is redrawn from the store, so chat, our chart and this one agree.
import { useStore } from '../store'
import { bySym, history, levels, labelOf } from '../market'
import { patterns } from '../chart/Pane'
import { candlesFor, chartSeconds, parseSymbol } from './datafeed'

// ---- the slice of the library's chart API used here (the library's typings replace these once installed)

interface Line<T> {
  setPrice(p: number): T; getPrice(): number; setText(t: string): T; setTooltip(t: string): T; setQuantity(q: string): T
  setLineColor(c: string): T; setLineStyle(s: number): T; setBodyTextColor(c: string): T; setBodyBorderColor(c: string): T; setBodyBackgroundColor(c: string): T
  setQuantityBackgroundColor(c: string): T; setQuantityBorderColor(c: string): T; setQuantityTextColor(c: string): T; remove(): void
}
interface OrderLine extends Line<OrderLine> { setEditable(b: boolean): OrderLine; setCancellable(b: boolean): OrderLine; setCancelButtonBorderColor(c: string): OrderLine; setCancelButtonIconColor(c: string): OrderLine; setExtendLeft(b: boolean): OrderLine; onMove(cb: () => void): OrderLine; onCancel(cb: () => void): OrderLine }
interface PositionLine extends Line<PositionLine> { setCloseTooltip(t: string): PositionLine; setCloseButtonBorderColor(c: string): PositionLine; setCloseButtonIconColor(c: string): PositionLine; onClose(cb: () => void): PositionLine }
type Sub = { subscribe(ctx: null, cb: () => void): void; unsubscribe(ctx: null, cb: () => void): void }
export type TVChartApi = {
  symbol(): string; resolution(): string
  createOrderLine(o?: { disableUndo?: boolean }): OrderLine
  createPositionLine(o?: { disableUndo?: boolean }): PositionLine
  createShape(point: { time: number; price: number }, options: Record<string, unknown>): Promise<string | null> | string | null
  removeEntity(id: string): void
  onSymbolChanged(): Sub; onIntervalChanged(): Sub
}

const css = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim()
const inr = (v: number) => `${v < 0 ? '−' : '+'}₹${Math.abs(Math.round(v)).toLocaleString('en-IN')}`
const LineStyle = { Solid: 0, Dotted: 1, Dashed: 2 }

type Drawn<T> = { line: T; sig: string }

/**
 * Attach the overlay to a chart. `brokerDraws` says whether Trading Platform's broker is drawing orders and
 * positions itself. Returns a function that removes everything and stops listening.
 */
export function attachOverlays(chart: TVChartApi, brokerDraws: () => boolean): () => void {
  const orders = new Map<string, Drawn<OrderLine>>()  // working orders, exit-plan legs ("<key>#sl"/"#tp") and alerts ("a<id>")
  let position: Drawn<PositionLine> | undefined
  let shapes: string[] = []; let shapeSig = ''; let gen = 0
  let shownKey = ''

  const colors = () => ({ up: css('--success'), down: css('--danger'), fg: css('--fg'), muted: css('--fg-subtle'), bg: css('--surface'), ai: css('--chart-5') || css('--fg') })
  const style = (l: OrderLine, color: string, dashed = false) => {
    const c = colors()
    return l.setLineColor(color).setLineStyle(dashed ? LineStyle.Dashed : LineStyle.Solid).setBodyBorderColor(color).setBodyTextColor(color).setBodyBackgroundColor(c.bg)
      .setQuantityBackgroundColor(color).setQuantityBorderColor(color).setQuantityTextColor(c.bg).setCancelButtonBorderColor(color).setCancelButtonIconColor(color).setExtendLeft(false)
  }
  const note = (text: string) => useStore.getState().addMsg({ role: 'ai', text })

  function clear() {
    for (const d of orders.values()) d.line.remove(); orders.clear()
    position?.line.remove(); position = undefined
    for (const id of shapes) chart.removeEntity(id); shapes = []; shapeSig = ''; gen++
  }

  /** Create, update or remove one order-style line so it matches `want` (undefined removes it). */
  function syncLine(id: string, want: { price: number; text: string; qty: string; color: string; dashed?: boolean; tooltip: string; onMove: (price: number, line: OrderLine) => void; onCancel: () => void } | undefined) {
    const have = orders.get(id)
    if (!want) { if (have) { have.line.remove(); orders.delete(id) } return }
    const sig = `${want.price}|${want.text}|${want.qty}|${want.color}`
    if (have) { if (have.sig !== sig) { have.line.setPrice(want.price).setText(want.text).setQuantity(want.qty); style(have.line, want.color, want.dashed); have.sig = sig } return }
    const line = chart.createOrderLine({ disableUndo: true })
    style(line, want.color, want.dashed).setPrice(want.price).setText(want.text).setQuantity(want.qty).setTooltip(want.tooltip).setEditable(true).setCancellable(true)
      .onMove(() => want.onMove(line.getPrice(), line)).onCancel(want.onCancel)
    orders.set(id, { line, sig })
  }

  function render() {
    const s = useStore.getState(); const p = parseSymbol(chart.symbol()); const c = colors()
    if (!p) { clear(); shownKey = ''; return }
    if (p.key !== shownKey) { clear(); shownKey = p.key }
    const key = p.key; const live = new Set<string>()

    if (!brokerDraws()) {
      // Working orders.
      for (const o of s.orders.filter((x) => x.key === key && (x.status === 'OPEN' || x.status === 'TRIGGER_PENDING'))) {
        const id = String(o.id); live.add(id); const buy = o.side === 'BUY'; const isLimit = o.otype === 'LIMIT'
        syncLine(id, {
          price: isLimit ? o.price : o.trigger ?? o.price, text: `${buy ? 'Buy' : 'Sell'} ${isLimit ? 'limit' : o.otype === 'SL' ? 'stop-limit' : 'stop'}`, qty: String(o.qty),
          color: buy ? c.up : c.down, tooltip: 'Drag to change the price, × to cancel',
          onMove: (price) => { useStore.getState().modify(o.id, isLimit ? { price } : { trigger: price }); note(`Moved your ${labelOf(key)} ${buy ? 'buy' : 'sell'} order to ₹${price.toFixed(2)} on the chart.`) },
          onCancel: () => { useStore.getState().cancel(o.id); note(`Cancelled your ${labelOf(key)} ${buy ? 'buy' : 'sell'} ${o.otype.toLowerCase()} order on the chart.`) },
        })
      }
      // Position and its exit plan.
      const pos = s.positions[key]; const br = s.brackets[key]
      if (pos?.qty) {
        const long = pos.qty > 0; const pl = (s.ltp(key) - pos.avg) * pos.qty; const sig = `${pos.avg}|${pos.qty}|${Math.round(pl)}|${c.fg}`
        if (!position) {
          const line = chart.createPositionLine({ disableUndo: true })
            .setCloseTooltip('Exit at market').onClose(() => { const n = useStore.getState().squareoff(key); if (n) note(`Closed your ${labelOf(key)} position at market from the chart.`) })
          position = { line, sig: '' }
        }
        if (position.sig !== sig) {
          const col = pl >= 0 ? c.up : c.down
          position.line.setPrice(pos.avg).setText(`${long ? 'Long' : 'Short'} · ${inr(pl)}`).setQuantity(String(Math.abs(pos.qty)))
            .setLineColor(c.fg).setBodyTextColor(col).setBodyBorderColor(c.fg).setBodyBackgroundColor(c.bg).setQuantityBackgroundColor(c.fg).setQuantityBorderColor(c.fg).setQuantityTextColor(c.bg)
            .setCloseButtonBorderColor(c.fg).setCloseButtonIconColor(c.fg)
          position.sig = sig
        }
        const leg = (which: 'sl' | 'tp', price: number | undefined) => {
          const id = `${key}#${which}`; if (price == null) return syncLine(id, undefined)
          live.add(id); const isStop = which === 'sl'
          const risk = (price - pos.avg) * pos.qty
          syncLine(id, {
            price, text: `${isStop ? (br?.trail ? `Trailing stop (₹${br.trail})` : 'Stop') : 'Target'} · ${inr(risk)}`, qty: String(Math.abs(pos.qty)), color: isStop ? c.down : c.up, dashed: true,
            tooltip: isStop ? 'Your stop. Drag to move it, × to remove it' : 'Your target. Drag to move it, × to remove it',
            onMove: (np, line) => {
              const st = useStore.getState(); const l = st.ltp(key)
              const wrong = isStop ? (long ? np >= l : np <= l) : (long ? np <= l : np >= l)
              if (wrong) { line.setPrice(price); st.setToast(`That ${isStop ? 'stop' : 'target'} is on the wrong side of the current price (${l.toFixed(2)}).`); return }
              st.setBracket(key, isStop ? { sl: +np.toFixed(2) } : { tgt: +np.toFixed(2) })
            },
            onCancel: () => useStore.getState().setBracket(key, isStop ? { sl: undefined, trail: undefined } : { tgt: undefined }),
          })
        }
        leg('sl', br?.sl); leg('tp', br?.tgt)
      } else if (position) { position.line.remove(); position = undefined }
    } else if (position) { position.line.remove(); position = undefined }

    // Alerts and GTTs on the underlying (option charts show their underlying's alerts only on the underlying).
    if (!p.opt) for (const t of s.triggers.filter((x) => !x.done && x.sym === key)) {
      const id = `a${t.id}`; live.add(id)
      syncLine(id, {
        price: t.price, text: t.then ? `GTT ${t.dir} · ${t.then.side.toLowerCase()} ${t.then.qty}` : `Alert ${t.dir}`, qty: '', color: c.muted, dashed: true,
        tooltip: 'Price alert. Drag to move it, × to remove it',
        onMove: (np) => useStore.setState({ triggers: useStore.getState().triggers.map((x) => (x.id === t.id ? { ...x, price: +np.toFixed(2), dir: np >= useStore.getState().prices[key].ltp ? 'above' : 'below' } : x)) }),
        onCancel: () => useStore.getState().removeTrigger(t.id),
      })
    }
    for (const id of [...orders.keys()]) if (!live.has(id)) syncLine(id, undefined)

    // AI levels and patterns: redrawn only when the symbol, timeframe, switch or theme changes.
    const on = !p.opt && !!s.aiLevels[key]; const res = chart.resolution(); const sig = `${key}|${res}|${on}|${c.ai}`
    if (sig !== shapeSig) {
      for (const id of shapes) chart.removeEntity(id); shapes = []; shapeSig = sig; const g = ++gen
      if (on) {
        const inst = bySym(key)!; const add = (r: Promise<string | null> | string | null) => void Promise.resolve(r).then((id) => { if (!id) return; if (g === gen) shapes.push(id); else chart.removeEntity(id) })
        const daily = history(inst, '1D', 160, s.prices[key].ltp).slice(-120); const now = Math.floor(Date.now() / 1000)
        for (const l of levels(daily)) add(chart.createShape({ time: now, price: l.price }, {
          shape: 'horizontal_line', lock: true, disableSave: true, disableUndo: true, disableSelection: true, text: `AI ${l.kind} · ${l.touches} touches`,
          overrides: { linecolor: l.kind === 'support' ? c.up : c.down, linestyle: LineStyle.Dashed, linewidth: 1, showLabel: true, textcolor: l.kind === 'support' ? c.up : c.down, horzLabelsAlign: 'right', vertLabelsAlign: 'bottom', fontsize: 11 },
        }))
        const bars = candlesFor(key, res)
        if (bars) for (const pt of patterns(bars.candles)) {
          const bar = bars.candles.find((b) => b.time === pt.time); if (!bar) continue
          add(chart.createShape({ time: chartSeconds(pt.time, bars.tf), price: pt.bull ? bar.low : bar.high }, {
            shape: pt.bull ? 'arrow_up' : 'arrow_down', lock: true, disableSave: true, disableUndo: true, text: pt.name,
            overrides: { color: c.ai, arrowColor: c.ai, fontsize: 11 },
          }))
        }
      }
    }
  }

  render()
  const unsub = useStore.subscribe((s, prev) => {
    if (s.orders !== prev.orders || s.positions !== prev.positions || s.brackets !== prev.brackets || s.triggers !== prev.triggers || s.aiLevels !== prev.aiLevels || s.theme !== prev.theme || s.prices !== prev.prices) render()
  })
  const onChange = () => render()
  chart.onSymbolChanged().subscribe(null, onChange); chart.onIntervalChanged().subscribe(null, onChange)
  return () => { unsub(); chart.onSymbolChanged().unsubscribe(null, onChange); chart.onIntervalChanged().unsubscribe(null, onChange); clear() }
}

/** Whether AI levels are on for the chart's symbol, and a switch for the chart header's button. */
export const aiLevelsOn = (name: string) => { const p = parseSymbol(name); return !!p && !p.opt && !!useStore.getState().aiLevels[p.key] }
export function toggleAiLevels(name: string) {
  const p = parseSymbol(name); if (!p || p.opt) return
  const s = useStore.getState(); s.set({ aiLevels: { ...s.aiLevels, [p.key]: !s.aiLevels[p.key] } })
}
