// Mounts TradingView's Advanced Charts (or Trading Platform) library with the terminal's datafeed and, for
// Trading Platform, the paper broker. The library is not on npm: after TradingView grants access, copy its
// charting_library/ folder into public/ and this chart takes over from the Lightweight Charts workspace
// automatically. Until then advancedChartsAvailable() is false and nothing here loads.
import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { createDatafeed, parseSymbol } from './datafeed'
import { BROKER_CONFIG, PaperBroker } from './broker'
import type { IBrokerConnectionAdapterHost } from './types'
import { attachOverlays, aiLevelsOn, toggleAiLevels, type TVChartApi as OverlayChartApi } from './overlays'

const LIB = '/charting_library/'
const SCRIPT = LIB + 'charting_library.standalone.js'

/** The few widget methods used here. The library's own typings replace this once it is installed. */
type TVChartApi = OverlayChartApi & { setSymbol(symbol: string, cb?: () => void): void }
type TVWidget = {
  onChartReady(cb: () => void): void; headerReady(): Promise<void>; createButton(o?: { align?: 'left' | 'right' }): HTMLElement
  activeChart(): TVChartApi; changeTheme(theme: 'light' | 'dark'): Promise<void>; remove(): void
}
declare global { interface Window { TradingView?: { widget: new (options: Record<string, unknown>) => TVWidget } } }

let available: Promise<boolean> | undefined
/**
 * Whether the library files are deployed. Checks the script's content type, because a dev server or SPA host
 * answers a missing file with index.html and status 200.
 */
export function advancedChartsAvailable(): Promise<boolean> {
  return (available ??= fetch(SCRIPT, { method: 'HEAD' })
    .then((r) => r.ok && /javascript/.test(r.headers.get('content-type') ?? ''))
    .catch(() => false))
}

function loadLibrary(): Promise<void> {
  if (window.TradingView) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = SCRIPT; s.async = true
    s.onload = () => resolve(); s.onerror = () => reject(new Error('Could not load the TradingView library'))
    document.head.appendChild(s)
  })
}

export default function AdvancedChart() {
  const el = useRef<HTMLDivElement>(null); const widget = useRef<TVWidget | undefined>(undefined); const ready = useRef(false)
  const sym = useStore((s) => s.sym); const theme = useStore((s) => s.theme)

  useEffect(() => {
    let dead = false; let broker: PaperBroker | undefined; let detach: (() => void) | undefined; let unsubBtn: (() => void) | undefined
    loadLibrary().then(() => {
      if (dead || !el.current || !window.TradingView) return
      const w = new window.TradingView.widget({
        container: el.current, library_path: LIB, datafeed: createDatafeed(),
        symbol: useStore.getState().sym, interval: '5', timezone: 'Asia/Kolkata', locale: 'en',
        theme: useStore.getState().theme, autosize: true, debug: false,
        // Settings stay in this browser like the rest of the terminal; nothing is sent to a charts storage server.
        enabled_features: ['use_localstorage_for_settings'],
        // Trading Platform only (Advanced Charts ignores these): its order ticket, chart order lines, account
        // manager and DOM trade the paper account through the same checks as chat and our own chart.
        broker_factory: (host: IBrokerConnectionAdapterHost) => (broker = new PaperBroker(host)),
        broker_config: BROKER_CONFIG,
      })
      widget.current = w
      w.onChartReady(() => {
        ready.current = true
        // Our orders, position, exit plan, alerts and AI levels on its chart. With Trading Platform the broker
        // draws orders and positions, so the overlay keeps to alerts and AI levels.
        detach = attachOverlays(w.activeChart(), () => !!broker)
        // A symbol picked in the chart becomes the terminal's focus symbol, so chat, ticket and book follow it.
        w.activeChart().onSymbolChanged().subscribe(null, () => {
          const p = parseSymbol(w.activeChart().symbol())
          if (p && !p.opt && p.key !== useStore.getState().sym) useStore.getState().setSym(p.key)
        })
      })
      // "AI levels" switch in the chart's own header, same as the toolbar button on our chart.
      w.headerReady().then(() => {
        if (dead) return
        const btn = w.createButton({ align: 'left' })
        btn.textContent = 'AI levels'; btn.title = 'Support and resistance from daily swings, and candlestick patterns'
        btn.setAttribute('role', 'switch'); btn.style.cursor = 'pointer'
        const paint = () => { const on = aiLevelsOn(w.activeChart().symbol()); btn.setAttribute('aria-checked', String(on)); btn.style.fontWeight = on ? '600' : '400'; btn.style.opacity = on ? '1' : '0.7' }
        btn.addEventListener('click', () => toggleAiLevels(w.activeChart().symbol()))
        paint(); unsubBtn = useStore.subscribe((st, prev) => { if (st.aiLevels !== prev.aiLevels || st.sym !== prev.sym) paint() })
      })
    }).catch((e) => useStore.getState().setToast((e as Error).message))
    return () => { dead = true; ready.current = false; unsubBtn?.(); detach?.(); broker?.destroy(); widget.current?.remove(); widget.current = undefined }
  }, [])

  // The terminal's focus symbol drives the chart (chat, watchlist and positions all set it).
  useEffect(() => {
    const w = widget.current; if (!w || !ready.current) return
    const cur = parseSymbol(w.activeChart().symbol())
    if (cur?.key !== sym) w.activeChart().setSymbol(sym)
  }, [sym])
  useEffect(() => { if (ready.current) void widget.current?.changeTheme(theme) }, [theme])

  return <div ref={el} className="h-full min-h-[420px] w-full" aria-label="TradingView chart" />
}
