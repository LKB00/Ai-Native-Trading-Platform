import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { bySym, labelOf, parseKey, keyOf, nextExpiries, INSTS, TF_LABEL, fmtIST, simNow, marketOpenNow, type TF } from '../market'
import { LabeledSwitch } from '../ui'
import { useStore, type ChartLayout, type ChartType } from '../store'
import { useEntryGate, GateIcon } from '../gate'
import { Badge, Button, IconButton, KeyHint, Popover, cn } from '../ds'
import { SearchIcon, XIcon } from '../ds/lib/icons'
import Pane, { paneApi, type TicketReq } from './Pane'
import { INDICATOR_DEFS, newInstance, type IndCategory } from './indicators'
import type { Tool } from './drawings'
import * as I from './icons'

/** Where full-screen dialogs mount: the page body, or the chart itself while it is in browser full screen
 *  (only the full-screen element and its children are visible then). */
const portalRoot = () => (document.fullscreenElement as HTMLElement | null) ?? document.body
import { ChevronRight, Columns2, Grid2x2, LayoutPanelLeft, Rows2, Sparkles, Square } from 'lucide-react'

const TFS: TF[] = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '1D', '1W', '1M']
const TYPES: { v: ChartType; label: string; icon: (p: { width?: number; height?: number }) => ReactNode }[] = [
  { v: 'bars', label: 'Bars', icon: I.BarsIcon }, { v: 'candles', label: 'Candles', icon: I.CandlesIcon }, { v: 'hollow', label: 'Hollow candles', icon: I.HollowCandlesIcon },
  { v: 'heikin', label: 'Heikin Ashi', icon: I.HeikinIcon }, { v: 'line', label: 'Line', icon: I.LineChartIcon }, { v: 'area', label: 'Area', icon: I.AreaChartIcon }, { v: 'baseline', label: 'Baseline', icon: I.BaselineIcon },
]
const LAYOUTS: { value: ChartLayout; label: string; panes: number; grid: string; cells: string[] }[] = [
  { value: '1', label: 'Single chart', panes: 1, grid: 'grid-cols-1 grid-rows-1', cells: [''] },
  { value: '2v', label: 'Two side by side', panes: 2, grid: 'grid-cols-2 grid-rows-1', cells: ['', ''] },
  { value: '2h', label: 'Two stacked', panes: 2, grid: 'grid-cols-1 grid-rows-2', cells: ['', ''] },
  { value: '3', label: 'One large, two small', panes: 3, grid: 'grid-cols-[3fr_2fr] grid-rows-2', cells: ['row-span-2', '', ''] },
  { value: '4', label: 'Four in a grid', panes: 4, grid: 'grid-cols-2 grid-rows-2', cells: ['', '', '', ''] },
]
type ToolDef = { v: Tool; label: string; key?: string; icon: (p: { width?: number; height?: number }) => ReactNode }
const GROUPS: { id: string; label: string; tools: ToolDef[] }[] = [
  { id: 'cursor', label: 'Cursors', tools: [{ v: 'cross', label: 'Cross', icon: I.CursorCrossIcon }, { v: 'dot', label: 'Dot', icon: I.CursorDotIcon }, { v: 'arrow', label: 'Arrow', icon: I.CursorArrowIcon }] },
  { id: 'lines', label: 'Trend line tools', tools: [{ v: 'trend', label: 'Trend line', key: 'Alt+T', icon: I.TrendLineIcon }, { v: 'ray', label: 'Ray', icon: I.RayIcon }, { v: 'extended', label: 'Extended line', icon: I.ExtendedLineIcon }, { v: 'hline', label: 'Horizontal line', key: 'Alt+H', icon: I.HorizontalLineIcon }, { v: 'hray', label: 'Horizontal ray', key: 'Alt+J', icon: I.HorizontalRayIcon }, { v: 'vline', label: 'Vertical line', key: 'Alt+V', icon: I.VerticalLineIcon }, { v: 'channel', label: 'Parallel channel', icon: I.ChannelIcon }] },
  { id: 'fib', label: 'Fibonacci', tools: [{ v: 'fib', label: 'Fib retracement', key: 'Alt+F', icon: I.FibIcon }] },
  { id: 'shapes', label: 'Shapes', tools: [{ v: 'rect', label: 'Rectangle', icon: I.RectangleIcon }] },
  { id: 'text', label: 'Text', tools: [{ v: 'text', label: 'Text', icon: I.TextIcon }] },
  { id: 'predict', label: 'Forecasting and measurement', tools: [{ v: 'long', label: 'Long position', icon: I.LongPositionIcon }, { v: 'short', label: 'Short position', icon: I.ShortPositionIcon }, { v: 'measure', label: 'Measure', icon: I.MeasureIcon }] },
]
/** Date-range buttons, as on TradingView: each picks an interval and how many bars to show. */
const RANGES: { label: string; tf: TF; bars: number }[] = [
  { label: '1D', tf: '1m', bars: 375 }, { label: '5D', tf: '5m', bars: 375 }, { label: '1M', tf: '30m', bars: 22 * 13 }, { label: '3M', tf: '1h', bars: 63 * 7 },
  { label: '6M', tf: '2h', bars: 126 * 4 }, { label: 'YTD', tf: '1D', bars: 0 }, { label: '1Y', tf: '1D', bars: 250 }, { label: '5Y', tf: '1W', bars: 260 }, { label: 'All', tf: '1M', bars: 320 },
]

/** Panes the "Spot + ATM options" preset opens for an F&O underlying. */
export function spotAndAtm(und: string) {
  const s = useStore.getState(); const inst = bySym(und)!; const atm = Math.round(s.prices[und].ltp / inst.step) * inst.step; const ex = nextExpiries(und)[0].label
  const tf = s.charts.panes[s.charts.active]?.tf ?? '5m'
  return [{ k: und, tf }, { k: keyOf(und, atm, 'CE', ex), tf }, { k: keyOf(und, atm, 'PE', ex), tf }]
}

export default function Workspace() {
  const charts = useStore((s) => s.charts); const cfg = useStore((s) => s.chart)
  const { setLayout, setPane, setChart } = useStore.getState()
  const aiLevels = useStore((s) => s.aiLevels); const history = useStore((s) => s.history)
  const [tool, setTool] = useState<Tool>('cross'); const [req, setReq] = useState<TicketReq>(null)
  const [search, setSearch] = useState<string | null>(null); const [indOpen, setIndOpen] = useState(false)
  const [full, setFull] = useState(false); const root = useRef<HTMLDivElement>(null)
  const layout = LAYOUTS.find((l) => l.value === charts.layout) ?? LAYOUTS[0]
  const active = Math.min(charts.active, layout.panes - 1)
  const pane = charts.panes[active]; const k = parseKey(pane.k); const inst = bySym(k.und)!
  const aiOn = !!aiLevels[pane.k]
  const ltp = useStore((s) => s.ltp(pane.k))
  const spread = Math.max(0.05, +(ltp * 0.0002).toFixed(2))
  const gate = useEntryGate()
  const h = history[pane.k]
  useEffect(() => { const f = () => setFull(!!document.fullscreenElement); document.addEventListener('fullscreenchange', f); return () => document.removeEventListener('fullscreenchange', f) }, [])
  const shot = () => { const api = paneApi[active]; if (!api) return; const c = api.chart.takeScreenshot(); const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `${labelOf(pane.k).replace(/\s+/g, '_')}_${pane.tf}.png`; a.click() }
  const typeDef = TYPES.find((t) => t.v === cfg.type)!
  const tb = 'flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-fg-muted hover:bg-hover hover:text-fg'
  const sep = <span aria-hidden className="mx-0.5 h-5 w-px bg-line" />

  return (
    <div ref={root} className="flex h-full flex-col bg-surface">
      {/* Top toolbar */}
      <div role="toolbar" aria-label="Chart toolbar" className="flex flex-wrap items-center gap-0.5 border-b border-line px-2 py-1">
        <button className={cn(tb, 'font-bold text-fg')} onClick={() => setSearch('')} aria-label={`Symbol: ${labelOf(pane.k)}. Change symbol`}><SearchIcon width={14} height={14} />{labelOf(pane.k)}</button>
        {sep}
        <Popover label="Interval" trigger={({ toggle, triggerProps }) => <button className={tb} onClick={toggle} {...triggerProps} aria-label={`Interval: ${TF_LABEL[pane.tf]}`}>{pane.tf}<I.ChevronDownIcon width={12} height={12} /></button>}>
          {({ close }) => <div className="w-48 p-1" role="listbox" aria-label="Interval">{TFS.map((t) => <button key={t} role="option" aria-selected={t === pane.tf} onClick={() => { setPane(active, { tf: t }); close() }} className={cn('flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-hover', t === pane.tf && 'bg-sunken font-bold')}>{TF_LABEL[t]}<span className="text-[11px] text-fg-subtle">{t}</span></button>)}
            <p className="px-3 py-2 text-[11px] text-fg-subtle">Tip: type a number on the chart (5, 15, 60) and press Enter.</p></div>}
        </Popover>
        {sep}
        <Popover label="Chart type" trigger={({ toggle, triggerProps }) => <button className={tb} onClick={toggle} {...triggerProps} aria-label={`Chart type: ${typeDef.label}`}>{typeDef.icon({ width: 18, height: 18 })}</button>}>
          {({ close }) => <div className="w-48 p-1" role="listbox" aria-label="Chart type">{TYPES.map((t) => <button key={t.v} role="option" aria-selected={t.v === cfg.type} onClick={() => { setChart({ type: t.v }); close() }} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-[13px] hover:bg-hover', t.v === cfg.type && 'bg-sunken font-bold')}>{t.icon({ width: 18, height: 18 })}{t.label}</button>)}</div>}
        </Popover>
        <button className={tb} onClick={() => setIndOpen(true)}><I.IndicatorsIcon width={18} height={18} />Indicators</button>
        <button className={tb} onClick={() => setTool(tool === 'alert' ? 'cross' : 'alert')} aria-pressed={tool === 'alert'} title="Add alert (Alt+A)"><I.BellIcon width={18} height={18} /><span className="max-xl:hidden">Alert</span></button>
        {!k.strike && <button className={cn(tb, aiOn && 'bg-sunken text-fg')} aria-pressed={aiOn} onClick={() => useStore.getState().set({ aiLevels: { ...aiLevels, [pane.k]: !aiOn } })} title="AI support and resistance, and candlestick patterns"><Sparkles size={18} strokeWidth={1.5} aria-hidden /><span className="max-xl:hidden">AI levels</span></button>}
        {sep}
        <IconButton size="sm" label="Undo (⌘Z)" disabled={!h?.undo.length} onClick={() => useStore.getState().undo(pane.k)}><I.UndoIcon /></IconButton>
        <IconButton size="sm" label="Redo (⇧⌘Z)" disabled={!h?.redo.length} onClick={() => useStore.getState().redo(pane.k)}><I.RedoIcon /></IconButton>
        <div className="ml-auto flex items-center gap-0.5">
          <Popover label="Chart layout" align="end" trigger={({ toggle, triggerProps }) => <IconButton size="sm" label={`Layout: ${layout.label}`} onClick={toggle} {...triggerProps}><LayoutGlyph l={layout.value} /></IconButton>}>
            {({ close }) => (
              <div className="w-64 space-y-2 p-2">
                <div role="radiogroup" aria-label="Layout" className="grid grid-cols-5 gap-1">
                  {LAYOUTS.map((l) => <button key={l.value} role="radio" aria-checked={l.value === layout.value} aria-label={l.label} title={l.label} onClick={() => { setLayout(l.value); close() }}
                    className={cn('flex h-10 items-center justify-center rounded-lg border', l.value === layout.value ? 'border-fg bg-sunken' : 'border-line hover:bg-hover')}><LayoutGlyph l={l.value} /></button>)}
                </div>
                {inst.fno && <Button size="sm" variant="secondary" className="w-full" onClick={() => { setLayout('3', spotAndAtm(k.und)); close() }}>{k.und} with ATM call and put</Button>}
              </div>)}
          </Popover>
          <Popover label="Chart settings" align="end" trigger={({ toggle, triggerProps }) => <IconButton size="sm" label="Chart settings" onClick={toggle} {...triggerProps}><I.SettingsGearIcon /></IconButton>}>
            <div className="w-64 space-y-1 p-2">
              <LabeledSwitch label="Symbol watermark" checked={cfg.watermark} onChange={(watermark) => setChart({ watermark })} />
              <LabeledSwitch label="Pivot points (CPR)" checked={cfg.pivots} onChange={(pivots) => setChart({ pivots })} />
              <LabeledSwitch label="Instant orders (Shift+B / S)" checked={useStore.getState().instant} onChange={(v) => useStore.getState().set({ instant: v })} />
            </div>
          </Popover>
          <IconButton size="sm" label="Take a snapshot (downloads a PNG)" onClick={shot}><I.CameraIcon /></IconButton>
          <IconButton size="sm" label={full ? 'Exit full screen' : 'Full screen'} onClick={() => (full ? document.exitFullscreen() : root.current?.requestFullscreen())}>{full ? <I.ExitFullscreenIcon /> : <I.FullscreenIcon />}</IconButton>
          {(inst.seg === 'EQ' || !!k.strike) && gate && <span className="ml-1 inline-flex h-7 items-center gap-1.5 rounded-md border border-line bg-sunken px-2.5 text-[12px] font-medium text-fg-muted" title={`${gate.why} Exits still work: close from the position line or the positions panel.`}><GateIcon g={gate} />{gate.short}</span>}
          {(inst.seg === 'EQ' || !!k.strike) && !gate && <div className="ml-1 flex items-center gap-1">
            <button onClick={() => setReq({ side: 'SELL', n: Date.now() })} className="flex h-8 flex-col items-center justify-center rounded-lg bg-danger-soft px-3 leading-none text-danger-fg" aria-label={`Sell ${labelOf(pane.k)} at ${(ltp - spread).toFixed(2)}`}><span className="text-[10px]">Sell</span><span className="num text-[12px] font-bold">{(ltp - spread).toFixed(2)}</span></button>
            <span className="num text-[10px] text-fg-subtle">{(spread * 2).toFixed(2)}</span>
            <button onClick={() => setReq({ side: 'BUY', n: Date.now() })} className="flex h-8 flex-col items-center justify-center rounded-lg bg-success-soft px-3 leading-none text-success-fg" aria-label={`Buy ${labelOf(pane.k)} at ${(ltp + spread).toFixed(2)}`}><span className="text-[10px]">Buy</span><span className="num text-[12px] font-bold">{(ltp + spread).toFixed(2)}</span></button>
          </div>}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Left drawing toolbar */}
        <div role="toolbar" aria-label="Drawing tools" aria-orientation="vertical" className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-line py-1.5 max-sm:hidden">
          {GROUPS.map((g) => <ToolGroup key={g.id} g={g} tool={tool} setTool={setTool} />)}
          <span aria-hidden className="my-1 h-px w-6 bg-line" />
          <RailBtn label="Magnet: snap to open, high, low or close" pressed={cfg.magnet} onClick={() => setChart({ magnet: !cfg.magnet })}><I.MagnetIcon /></RailBtn>
          <RailBtn label="Stay in drawing mode" pressed={cfg.keepDrawing} onClick={() => setChart({ keepDrawing: !cfg.keepDrawing })}><I.KeepDrawingIcon /></RailBtn>
          <RailBtn label={cfg.lockAll ? 'Unlock all drawings' : 'Lock all drawings'} pressed={cfg.lockAll} onClick={() => setChart({ lockAll: !cfg.lockAll })}>{cfg.lockAll ? <I.LockIcon /> : <I.UnlockIcon />}</RailBtn>
          <RailBtn label={cfg.hideAll ? 'Show all drawings' : 'Hide all drawings'} pressed={cfg.hideAll} onClick={() => setChart({ hideAll: !cfg.hideAll })}>{cfg.hideAll ? <I.EyeOffIcon /> : <I.EyeIcon />}</RailBtn>
          <Popover label="Remove drawings" trigger={({ toggle, triggerProps }) => <RailBtn label="Remove drawings" onClick={toggle} {...triggerProps}><I.TrashIcon /></RailBtn>}>
            {({ close }) => <div className="w-60 space-y-2 p-3 text-[12px]"><p>Remove every drawing on {labelOf(pane.k)}? You can undo this.</p>
              <Button size="sm" variant="danger" onClick={() => { const st = useStore.getState(); st.removeShape(pane.k); st.set({ drawings: { ...st.drawings, [pane.k]: [] } }); close() }}>Remove drawings on {labelOf(pane.k)}</Button></div>}
          </Popover>
        </div>

        <div className={cn('grid min-h-0 min-w-0 flex-1 gap-px bg-line', layout.grid)}>
          {layout.cells.map((cell, i) => (
            <Pane key={i} idx={i} k={charts.panes[i].k} tf={charts.panes[i].tf} active={i === active} multi={layout.panes > 1} className={cell}
              tool={i === active ? tool : 'cross'} setTool={setTool} req={i === active ? req : null} onSearch={(seed) => { useStore.getState().setActivePane(i); setSearch(seed) }} />))}
        </div>
      </div>

      <BottomBar tf={pane.tf} setTf={(tf) => setPane(active, { tf })} active={active} />
      {search != null && <SymbolSearch seed={search} onClose={() => setSearch(null)} onPick={(key) => { setPane(active, { k: key }); useStore.getState().setActivePane(active); setSearch(null) }} />}
      {indOpen && <IndicatorDialog onClose={() => setIndOpen(false)} />}
    </div>
  )
}

function RailBtn({ label, pressed, children, ...rest }: { label: string; pressed?: boolean; children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" aria-label={label} title={label} aria-pressed={pressed} {...rest} className={cn('flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg', pressed && 'bg-sunken text-fg')}>{children}</button>
}

/** A tool group on the left rail: the button uses the group's last tool, the corner arrow opens the full list. */
function ToolGroup({ g, tool, setTool }: { g: (typeof GROUPS)[number]; tool: Tool; setTool: (t: Tool) => void }) {
  const [last, setLast] = useState(g.tools[0]); const [open, setOpen] = useState(false)
  const cur = g.tools.find((t) => t.v === tool); const shown = cur ?? last; const on = !!cur
  useEffect(() => { if (cur) setLast(cur) }, [cur])
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(`[data-group="${g.id}"]`)) setOpen(false) }; addEventListener('pointerdown', h); return () => removeEventListener('pointerdown', h) }, [open, g.id])
  return (
    <div data-group={g.id} className="group relative">
      <button type="button" aria-label={`${shown.label}${shown.key ? ` (${shown.key})` : ''}`} title={`${shown.label}${shown.key ? ` (${shown.key})` : ''}`} aria-pressed={on}
        onClick={() => setTool(on && g.id !== 'cursor' ? 'cross' : shown.v)} className={cn('flex size-8 items-center justify-center rounded-lg text-fg-muted hover:bg-hover hover:text-fg', on && 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent')}>{shown.icon({ width: 18, height: 18 })}</button>
      {g.tools.length > 1 && <button type="button" aria-label={`More ${g.label.toLowerCase()}`} aria-expanded={open} onClick={() => setOpen(!open)}
        className="absolute -right-1 bottom-0 flex h-4 w-3 items-center justify-center text-fg-subtle opacity-0 group-hover:opacity-100 focus:opacity-100"><ChevronRight size={10} strokeWidth={2} aria-hidden /></button>}
      {open && <div role="menu" aria-label={g.label} className="absolute left-full top-0 z-40 ml-1 w-56 rounded-[10px] border border-line bg-raised p-1.5 shadow-lg animate-rise">
        <p className="px-2 py-1 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">{g.label}</p>
        {g.tools.map((t) => <button key={t.v} role="menuitemradio" aria-checked={tool === t.v} onClick={() => { setTool(t.v); setOpen(false) }} className={cn('flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-hover', tool === t.v && 'bg-sunken')}>
          {t.icon({ width: 18, height: 18 })}<span className="flex-1">{t.label}</span>{t.key && <span className="text-[11px] text-fg-subtle">{t.key}</span>}</button>)}
      </div>}
    </div>
  )
}

/** Bottom bar: date ranges, exchange clock and price-scale modes. */
function BottomBar({ tf, setTf, active }: { tf: TF; setTf: (t: TF) => void; active: number }) {
  const cfg = useStore((s) => s.chart); const setChart = useStore((s) => s.setChart)
  const [, tick] = useState(0); useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id) }, [])
  const [pending, setPending] = useState<number | null>(null)
  useEffect(() => { if (pending == null) return; const id = setTimeout(() => { paneApi[active]?.range(pending); setPending(null) }, 120); return () => clearTimeout(id) }, [pending, active, tf])
  const pick = (r: (typeof RANGES)[number]) => {
    let bars = r.bars
    if (r.label === 'YTD') { const now = simNow(); const jan1 = Date.UTC(new Date(now * 1000).getUTCFullYear(), 0, 1) / 1000; bars = Math.round((now - jan1) / 86400 * 5 / 7) }
    setTf(r.tf); setPending(bars)
  }
  const live = marketOpenNow()
  const tbtn = (on: boolean) => cn('h-6 rounded-md px-2 text-[12px]', on ? 'bg-sunken font-bold text-fg' : 'text-fg-muted hover:bg-hover hover:text-fg')
  return (
    <div className="flex items-center gap-1 border-t border-line px-2 py-1 text-[12px]">
      <div role="group" aria-label="Date range" className="flex items-center gap-0.5 overflow-x-auto">{RANGES.map((r) => <button key={r.label} className={tbtn(false)} onClick={() => pick(r)} title={`${r.label} · ${TF_LABEL[r.tf]} bars`}>{r.label}</button>)}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <span className="num text-fg-muted" title="Exchange time (IST)">{fmtIST(simNow(), { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} (UTC+5:30)</span>
        <span className="flex items-center gap-1.5 text-[11px] text-fg-subtle"><span className={cn('size-1.5 rounded-full', live ? 'bg-success' : 'bg-[var(--border-strong)]')} aria-hidden />{live ? 'Live' : 'Simulated'}</span>
        <span aria-hidden className="h-4 w-px bg-line" />
        <button className={tbtn(cfg.scale === 'percent')} aria-pressed={cfg.scale === 'percent'} onClick={() => setChart({ scale: cfg.scale === 'percent' ? 'normal' : 'percent' })} title="Percent scale (Alt+P)">%</button>
        <button className={tbtn(cfg.scale === 'log')} aria-pressed={cfg.scale === 'log'} onClick={() => setChart({ scale: cfg.scale === 'log' ? 'normal' : 'log' })} title="Log scale (Alt+L)">log</button>
        <button className={tbtn(cfg.autoScale)} aria-pressed={cfg.autoScale} onClick={() => setChart({ autoScale: !cfg.autoScale })} title="Auto-fit the price scale">auto</button>
      </div>
    </div>
  )
}

/** Symbol search, like TradingView's: filter by type, keyboard to pick. Typing a letter on the chart opens it. */
function SymbolSearch({ seed, onClose, onPick }: { seed: string; onClose: () => void; onPick: (k: string) => void }) {
  const [q, setQ] = useState(seed); const [tab, setTab] = useState<'All' | 'Stocks' | 'Indices' | 'Options' | 'ETF'>('All'); const [sel, setSel] = useState(0)
  const prices = useStore.getState().prices
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase(); const out: { k: string; name: string; ex: string; type: string }[] = []
    if (tab === 'All' || tab === 'Options') for (const i of INSTS.filter((x) => x.fno && (!t || x.sym.toLowerCase().startsWith(t)))) {
      if (tab === 'All' && i.seg !== 'IDX') continue
      const atm = Math.round(prices[i.sym].ltp / i.step) * i.step; const ex = nextExpiries(i.sym)[0].label
      for (const ty of ['CE', 'PE'] as const) out.push({ k: keyOf(i.sym, atm, ty, ex), name: `${i.name} ${atm} ${ty === 'CE' ? 'call' : 'put'} · ${ex}`, ex: 'NFO', type: 'Option' })
    }
    const base = INSTS.filter((i) => (tab === 'All' || (tab === 'Stocks' && i.seg === 'EQ' && i.sector !== 'ETF') || (tab === 'Indices' && i.seg === 'IDX') || (tab === 'ETF' && i.sector === 'ETF')) && (!t || i.sym.toLowerCase().includes(t) || i.name.toLowerCase().includes(t)))
    const list = base.map((i) => ({ k: i.sym, name: i.name, ex: i.seg === 'IDX' ? (i.sym === 'SENSEX' ? 'BSE' : 'NSE') : 'NSE', type: i.seg === 'IDX' ? 'Index' : i.sector === 'ETF' ? 'ETF' : 'Stock' }))
    return [...list.sort((a, b) => Number(!a.k.toLowerCase().startsWith(t)) - Number(!b.k.toLowerCase().startsWith(t))), ...out].slice(0, 40)
  }, [q, tab, prices])
  useEffect(() => setSel(0), [q, tab])
  // Portaled: inside the canvas or terminal content it would sit in their stacking context, under the top bar.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-scrim px-4 pt-[10vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Symbol search" className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-[10px] border border-line bg-raised shadow-lg animate-rise">
        <div className="flex items-center gap-3 border-b border-line px-4"><SearchIcon width={16} height={16} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Symbol, e.g. RELIANCE or NIFTY" aria-label="Search symbol" className="h-12 flex-1 bg-transparent text-[15px] outline-none"
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, rows.length - 1)) } if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) } if (e.key === 'Enter' && rows[sel]) onPick(rows[sel].k) }} />
          <IconButton size="sm" label="Close" onClick={onClose}><XIcon width={12} height={12} /></IconButton></div>
        <div role="tablist" aria-label="Type" className="flex gap-1 border-b border-line px-3 py-2">{(['All', 'Stocks', 'Indices', 'Options', 'ETF'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cn('h-7 rounded-md px-3 text-[12px]', tab === t ? 'bg-accent text-on-accent' : 'text-fg-muted hover:bg-hover')}>{t}</button>)}</div>
        <ul role="listbox" aria-label="Results" className="min-h-0 flex-1 overflow-auto p-1.5">
          {rows.map((r, i) => <li key={r.k} role="option" aria-selected={i === sel}><button onMouseEnter={() => setSel(i)} onClick={() => onPick(r.k)} className={cn('grid w-full grid-cols-[140px_1fr_auto] items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px]', i === sel && 'bg-sunken')}>
            <b className="truncate">{labelOf(r.k)}</b><span className="truncate text-fg-muted">{r.name}</span><span className="flex items-center gap-1.5 text-[11px] text-fg-subtle">{r.type}<Badge>{r.ex}</Badge></span></button></li>)}
          {!rows.length && <li className="px-3 py-6 text-center text-fg-subtle">No symbols match “{q}”.</li>}
        </ul>
      </div>
    </div>
  , portalRoot())
}

/** Indicator dialog, like TradingView's: search, categories, click to add. Instances can repeat (EMA 20 and EMA 50). */
function IndicatorDialog({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState(''); const [cat, setCat] = useState<'All' | IndCategory>('All')
  const inds = useStore((s) => s.chart.inds); const setChart = useStore((s) => s.setChart)
  const list = INDICATOR_DEFS.filter((d) => (cat === 'All' || d.category === cat) && (!q || (d.name + d.short + d.desc).toLowerCase().includes(q.toLowerCase())))
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [onClose])
  // Portaled: inside the canvas or terminal content it would sit in their stacking context, under the top bar.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-scrim px-4 pt-[8vh]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Indicators" className="flex max-h-[76vh] w-full max-w-2xl flex-col overflow-hidden rounded-[10px] border border-line bg-raised shadow-lg animate-rise">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3"><h2 className="flex-1 text-lg">Indicators</h2><IconButton size="sm" label="Close" onClick={onClose}><XIcon width={12} height={12} /></IconButton></div>
        <label className="mx-4 mt-3 flex h-9 items-center gap-2 rounded-md border border-line bg-sunken px-3"><SearchIcon width={14} height={14} /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search, e.g. RSI or moving average" aria-label="Search indicators" className="w-full bg-transparent text-[13px] outline-none" /></label>
        <div className="flex min-h-0 flex-1">
          <div role="tablist" aria-orientation="vertical" aria-label="Category" className="flex w-36 shrink-0 flex-col gap-0.5 p-3">{(['All', 'Trend', 'Momentum', 'Volatility', 'Volume'] as const).map((c) => <button key={c} role="tab" aria-selected={cat === c} onClick={() => setCat(c)} className={cn('rounded-lg px-3 py-1.5 text-left text-[13px]', cat === c ? 'bg-sunken font-bold' : 'text-fg-muted hover:bg-hover')}>{c}</button>)}</div>
          <ul className="min-h-0 flex-1 overflow-auto p-2">{list.map((d) => { const n = inds.filter((x) => x.type === d.type).length; return (
            <li key={d.type}><button onClick={() => setChart({ inds: [...useStore.getState().chart.inds, newInstance(d.type)] })} className="flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left hover:bg-hover">
              <span className="min-w-0 flex-1"><span className="block text-[13px] font-bold">{d.name} {n > 0 && <Badge tone="info">{n} on chart</Badge>}</span><span className="block text-[12px] text-fg-subtle">{d.desc}</span></span>
              <span className="shrink-0 text-[11px] text-fg-subtle">{d.overlay ? 'On price' : 'New pane'}</span></button></li>) })}</ul>
        </div>
        <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-[12px] text-fg-subtle">{inds.length} on chart · hover an indicator in the legend to hide, edit or remove it<KeyHint className="ml-auto">Esc</KeyHint></div>
      </div>
    </div>
  , portalRoot())
}

function LayoutGlyph({ l }: { l: ChartLayout }) {
  const G = { '1': Square, '2v': Columns2, '2h': Rows2, '3': LayoutPanelLeft, '4': Grid2x2 }[l]
  return <G size={18} strokeWidth={1.5} aria-hidden />
}
