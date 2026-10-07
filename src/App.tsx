import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useStore, resetBook, type View } from './store'
import { INSTS, bySym, labelOf, parseKey } from './market'
import { ask } from './ai'
import type { Action } from './actions'
import { AIMark, Badge, Button, IconButton, MeterBar, Popover, SegmentedControl, KeyHint, cn } from './ds'
import { ChevronIcon, EyeIcon, MoonIcon, SunIcon, SettingsIcon, SearchIcon, XIcon, PlusIcon, CheckIcon, ShieldIcon, ArrowRightIcon } from './ds/lib/icons'
import { inr, pct, Chg, Dir, Money, LabeledSwitch } from './ui'
import { FlashPrice, Spark, TickerTape } from './cockpit/live'
import Chart from './Chart'
import Chain from './Chain'
import Strategy from './Strategy'
import Scanner from './Scanner'
import Markets from './Markets'
import Portfolio from './Portfolio'
import Journal from './Journal'
import { ChatPanel } from './chat/Chat'

export { inr, Chg, Money }

const NAV: { value: string; label: string; views: View[] }[] = [
  { value: 'chart', label: 'Trade', views: ['chart'] },
  { value: 'chain', label: 'Options', views: ['chain', 'strategy'] },
  { value: 'scanner', label: 'Scanner', views: ['scanner'] },
  { value: 'markets', label: 'Markets', views: ['markets'] },
  { value: 'portfolio', label: 'Portfolio', views: ['portfolio'] },
  { value: 'journal', label: 'Journal', views: ['journal'] },
]
const TRADING: View[] = ['chart', 'chain', 'strategy']

/** Matches a media query and follows changes. */
function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => { const mq = matchMedia(q); const h = () => setM(mq.matches); mq.addEventListener('change', h); return () => mq.removeEventListener('change', h) }, [q])
  return m
}

export default function App() {
  const tick = useStore((s) => s.tick)
  useEffect(() => { const id = setInterval(tick, 1000); return () => clearInterval(id) }, [tick])
  return <Cockpit />
}

/**
 * The cockpit: one trading screen. Live watchlist on the left, the chart (or chain, scanner, portfolio…) in the
 * middle with positions and orders below it, and the AI agent docked on the right, where every trade is drafted
 * and approved. A ticker tape and the market clock run under the top bar.
 */
function Cockpit() {
  const panels = useStore((s) => s.panels)
  const narrow = useMedia('(max-width: 1099px)'); const mobile = useMedia('(max-width: 839px)')
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); useStore.setState({ palette: !useStore.getState().palette }); return }
      const t = document.activeElement?.tagName; if (t === 'INPUT' || t === 'TEXTAREA' || t === 'SELECT' || e.metaKey || e.ctrlKey || e.altKey) return
      const st = useStore.getState()
      if (e.key === '/') { e.preventDefault(); if (!st.panels.copilot) st.setPanels({ copilot: true, focus: false }); setTimeout(() => document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus(), 50) }
      else if (e.key === '[') { e.preventDefault(); st.togglePanel('watch') }
      else if (e.key === ']') { e.preventDefault(); st.togglePanel('copilot') }
      else if (e.key === '\\') { e.preventDefault(); st.togglePanel('bottom') }
      else if (e.key === 'F' && e.shiftKey) { e.preventDefault(); st.togglePanel('focus') }
      else if (e.key === 'Escape' && st.panels.copilot && matchMedia('(max-width: 1099px)').matches && !document.querySelector('[role=dialog]')) st.setPanels({ copilot: false })
    }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [])
  // Side panels are columns on wide screens. On narrow screens the agent becomes an overlay drawer instead of squeezing the chart.
  // Below 1360px the side panels slim down so the chart keeps a usable width; dragging still resizes them.
  const compact = useMedia('(max-width: 1359px)')
  const wl = panels.watch ? (compact ? Math.min(panels.watchW, 232) : panels.watchW) : 48
  const cp = panels.copilot && !narrow ? (compact ? Math.min(panels.copilotW, 360) : panels.copilotW) : 48
  const bh = panels.bottom ? panels.bottomH : 49 // folded: the 48px header plus its 1px top rule
  if (mobile) return <PhoneCockpit />
  // Expanded agent: the conversation fills the screen, with the ticker above and positions below.
  if (panels.chatFull) return (
    <div className="grid h-full grid-cols-1 grid-rows-[56px_30px_minmax(0,1fr)_var(--bh)]" style={{ '--bh': `${bh}px` } as React.CSSProperties}>
      <Top /><TickerTape />
      <ChatPanel overlay={false} full />
      <Bottom />
      <Toast /><Palette /><FnoDisclosure />
    </div>
  )
  return (
    <div className="grid h-full grid-rows-[56px_30px_minmax(0,1fr)] grid-cols-1 md:grid-cols-[var(--wl)_minmax(0,1fr)_var(--cp)] max-md:h-auto max-md:grid-rows-[auto]"
      style={{ '--wl': `${wl}px`, '--cp': `${cp}px` } as React.CSSProperties}>
      <Top />
      <TickerTape />
      <Watchlist />
      <main className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_var(--bh)] overflow-hidden max-md:grid-rows-[auto_520px_auto]"
        style={{ '--bh': `${bh}px` } as React.CSSProperties}>
        <SubBar /><Main /><Bottom />
      </main>
      {(panels.copilot && (!narrow || mobile)) ? <ChatPanel overlay={false} resize={!mobile && <Splitter dir="x" sign={-1} value={panels.copilotW} min={340} max={640} label="Agent panel width" onSize={(copilotW) => useStore.getState().setPanels({ copilotW })} onToggle={() => useStore.getState().togglePanel('copilot')} className="-left-1" />} /> : null}
      {panels.copilot && narrow && !mobile && <ChatPanel overlay />}
      {(!panels.copilot || (narrow && !mobile)) && <CopilotRail />}
      <Toast /><Palette /><FnoDisclosure />
    </div>
  )
}

type PhoneTab = 'agent' | 'chart' | 'watch' | 'positions'
/**
 * Phones get one pane at a time and a tab bar, opening on the agent: on a small screen you mostly talk and
 * approve, and look at the chart, list or positions when you need them.
 */
function PhoneCockpit() {
  const [tab, setTab] = useState<PhoneTab>('agent')
  const open = useStore((s) => Object.values(s.positions).filter((p) => p.qty).length); const pending = useStore((s) => s.msgs.filter((m) => m.state === 'pending').length)
  useEffect(() => { if (tab === 'positions' && !useStore.getState().panels.bottom) useStore.getState().setPanels({ bottom: true }) }, [tab])
  const tabs: { id: PhoneTab; label: string; badge?: number }[] = [{ id: 'agent', label: 'Agent', badge: pending || undefined }, { id: 'chart', label: 'Chart' }, { id: 'watch', label: 'Watchlist' }, { id: 'positions', label: 'Positions', badge: open || undefined }]
  return (
    <div className="grid h-[100dvh] grid-cols-1 grid-rows-[56px_30px_minmax(0,1fr)_56px]">
      <Top />
      <TickerTape />
      <div className="min-h-0 overflow-hidden">
        {tab === 'agent' && <div className="flex h-full flex-col [&>aside]:h-full [&>aside]:border-0"><ChatPanel overlay={false} /></div>}
        {tab === 'chart' && <div className="grid h-full grid-rows-[auto_minmax(0,1fr)] overflow-hidden"><SubBar /><Main /></div>}
        {tab === 'watch' && <div className="flex h-full flex-col overflow-hidden bg-surface"><WatchBody header={null} onPicked={() => setTab('chart')} /></div>}
        {tab === 'positions' && <div className="flex h-full flex-col overflow-hidden [&>section]:h-full"><Bottom /></div>}
      </div>
      <nav aria-label="Sections" className="grid grid-cols-4 border-t border-line bg-surface">
        {tabs.map((t) => <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => setTab(t.id)}
          className={cn('relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium', tab === t.id ? 'text-fg' : 'text-fg-subtle')}>
          <span className={cn('h-1 w-6 rounded-full', tab === t.id ? 'bg-[var(--accent)]' : 'bg-transparent')} aria-hidden />{t.label}
          {t.badge ? <span className="num absolute right-[22%] top-1.5 rounded-full bg-attention px-1.5 text-[10px] font-bold text-[var(--ref-charcoal)]">{t.badge}</span> : null}
        </button>)}
      </nav>
      <Toast /><Palette /><FnoDisclosure />
    </div>
  )
}

/**
 * Drag handle between panels. Drag to resize, double-click or Enter to fold, arrow keys to step.
 * `sign` is +1 when dragging right/down grows the panel, −1 when it shrinks it.
 */
function Splitter({ dir, value, min, max, sign, label, onSize, onToggle, className }: {
  dir: 'x' | 'y'; value: number; min: number; max: number; sign: 1 | -1; label: string; onSize: (v: number) => void; onToggle: () => void; className?: string
}) {
  const start = useRef<{ p: number; v: number } | null>(null)
  const clamp = (v: number) => Math.round(Math.max(min, Math.min(max, v)))
  return (
    <div role="separator" aria-orientation={dir === 'x' ? 'vertical' : 'horizontal'} aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max} tabIndex={0}
      title={`${label}: drag to resize, double-click to fold`}
      onPointerDown={(e) => { e.preventDefault(); start.current = { p: dir === 'x' ? e.clientX : e.clientY, v: value }; (e.target as HTMLElement).setPointerCapture(e.pointerId) }}
      onPointerMove={(e) => { if (!start.current) return; const d = (dir === 'x' ? e.clientX : e.clientY) - start.current.p; onSize(clamp(start.current.v + sign * d)) }}
      onPointerUp={() => { start.current = null }}
      onDoubleClick={onToggle}
      onKeyDown={(e) => { const step = e.shiftKey ? 64 : 16; const inc = dir === 'x' ? (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0) : (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0); if (inc) { e.preventDefault(); onSize(clamp(value + sign * inc * step)) } if (e.key === 'Enter') onToggle() }}
      className={cn('group absolute z-30 flex items-center justify-center touch-none focus-visible:outline-none max-md:hidden', dir === 'x' ? 'inset-y-0 w-2 cursor-col-resize' : 'inset-x-0 h-2 cursor-row-resize', className)}>
      <span className={cn('rounded-full bg-line-strong opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100', dir === 'x' ? 'h-10 w-1' : 'h-1 w-10')} />
    </div>
  )
}

/** The copilot when folded: a quiet rail that mirrors the watchlist rail, and still flags trades waiting for approval. */
function CopilotRail() {
  const pending = useStore((s) => s.msgs.filter((m) => m.state === 'pending').length); const busy = useStore((s) => s.busy)
  const openIt = () => { useStore.getState().setPanels({ copilot: true, focus: false }); setTimeout(() => document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus(), 50) }
  return (
    <aside aria-label="AI agent (folded)" className="flex min-h-0 flex-col items-center gap-3 border-l border-line bg-surface py-3 max-md:flex-row max-md:border-l-0 max-md:border-t max-md:px-3 max-md:py-2">
      <IconButton size="sm" label="Show the AI agent ( ] )" onClick={openIt}><ChevronIcon width={14} height={14} className="rotate-180" /></IconButton>
      <button onClick={openIt} aria-label={pending ? `Open the AI agent, ${pending} waiting for your approval` : busy ? 'Open the AI agent, thinking' : 'Open the AI agent'}
        className="flex items-center gap-2 rounded-full px-1.5 py-3 text-[11px] uppercase tracking-[0.12em] text-fg-subtle hover:bg-hover hover:text-fg md:[writing-mode:vertical-rl] max-md:px-3 max-md:py-1">
        <span className="inline-flex size-6 items-center justify-center rounded-full bg-lime text-on-lime [writing-mode:horizontal-tb]"><AIMark size={16} /></span>
        AI agent
        {busy && <span aria-hidden className="size-1.5 rounded-full bg-fg animate-pulse-dot" />}
      </button>
      {pending > 0 && <button onClick={openIt} aria-label={`${pending} waiting for your approval`} title={`${pending} waiting for your approval`}
        className="num flex size-6 items-center justify-center rounded-full bg-attention text-[11px] font-bold text-[var(--ref-charcoal)] animate-pop">{pending}</button>}
    </aside>
  )
}


/**
 * Switch between Chat (the conversation fills the screen) and Terminal (the cockpit: chart, watchlist and the
 * agent beside them). The content crossfades; the top bar is named in CSS so it holds still.
 */
export function switchLayout(full: boolean) {
  if (useStore.getState().panels.chatFull === full) return
  const root = document.documentElement
  const go = () => { root.classList.add('switching'); flushSync(() => useStore.getState().setPanels({ chatFull: full, copilot: true })) }
  const done = () => requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('switching')))
  type VT = { ready: Promise<void>; finished: Promise<void>; updateCallbackDone: Promise<void> }
  const d = document as Document & { startViewTransition?: (cb: () => void) => VT }
  if (!d.startViewTransition || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) { go(); done(); return }
  // The browser skips the animation (and rejects these promises) when the tab is hidden or switches overlap.
  const t = d.startViewTransition(go); t.ready.catch(() => {}); t.updateCallbackDone.catch(() => {}); t.finished.catch(() => {}).finally(done)
}

/**
 * The top bar: logo and the Chat/Terminal switch pinned left, workspace tabs, then risk, AI engine and theme
 * pinned right. In Chat, picking a workspace tab switches to Terminal on that tab. Index prices live in the
 * ticker tape below it. Sits at z-40 so its popovers open above the panels.
 */
export function TopBar({ left, extras }: { left?: ReactNode; extras?: ReactNode }) {
  const net = useStore((s) => s.pnl().net); const chatFull = useStore((s) => s.panels.chatFull)
  const apiKey = useStore((s) => s.apiKey); const setApiKey = useStore((s) => s.setApiKey); const theme = useStore((s) => s.theme)
  return (
    <header className="relative z-40 col-span-full flex h-14 min-w-0 items-center gap-3 border-b border-line bg-surface px-3 [view-transition-name:topbar] sm:px-4">
      <div className="flex shrink-0 items-center gap-2">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-lime text-on-lime"><AIMark size={16} /></span>
        <span className="whitespace-nowrap font-serif text-[17px] tracking-tight max-lg:hidden">Prompt Terminal</span>
      </div>
      <SegmentedControl size="sm" label="Layout" className="max-md:hidden" value={chatFull ? 'chat' : 'terminal'} onChange={(v) => switchLayout(v === 'chat')} options={[{ value: 'chat', label: 'Chat' }, { value: 'terminal', label: 'Terminal' }]} />
      <span aria-hidden className="h-5 w-px shrink-0 bg-line max-md:hidden" />
      <div className="flex min-w-0 shrink-0 items-center gap-2 max-md:hidden">{left}</div>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        {extras}
        <RiskCenter net={net} />
        <Popover label="AI engine" align="end" trigger={({ toggle, triggerProps }) => (
          <IconButton label={apiKey ? 'AI engine: Claude' : 'AI engine: built-in'} onClick={toggle} {...triggerProps}><SettingsIcon /></IconButton>)}>
          {({ close }) => (
            <div className="w-80 space-y-3 p-3">
              <p className="font-serif text-base">AI engine</p>
              <p className="text-[13px] text-fg-muted">The built-in engine understands trading commands offline. Add an Anthropic API key and Claude reads free-form requests. Every number still comes from the terminal's own data, and every trade still needs your approval. The key stays in this browser.</p>
              <input type="password" aria-label="Anthropic API key" placeholder="sk-ant-…" defaultValue={apiKey} onBlur={(e) => setApiKey(e.target.value.trim())}
                className="h-9 w-full rounded-full border border-line bg-surface px-4 text-[13px] outline-none focus:border-fg-subtle" />
              <div className="flex gap-2"><Button size="sm" onClick={close}>Done</Button>{apiKey && <Button size="sm" variant="ghost" onClick={() => setApiKey('')}>Remove key</Button>}</div>
            </div>)}
        </Popover>
        <IconButton label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => useStore.getState().toggleTheme()}>{theme === 'dark' ? <SunIcon /> : <MoonIcon />}</IconButton>
      </div>
    </header>
  )
}

function Top() {
  const { setView, view } = useStore()
  const nav = NAV.find((n) => n.views.includes(view))?.value ?? 'chart'
  return (
    <TopBar
      left={<nav aria-label="Workspaces"><SegmentedControl size="sm" label="Workspace" value={nav} onChange={(v) => { setView(v as View); switchLayout(false) }} options={NAV.map((n) => ({ value: n.value, label: n.label }))} /></nav>}
      extras={<>
        <button onClick={() => useStore.setState({ palette: true })} className="flex h-8 items-center gap-2 rounded-full border border-line bg-sunken px-3 text-[12px] text-fg-subtle hover:border-line-strong max-2xl:hidden" aria-label="Open command palette">
          <SearchIcon width={13} height={13} />Search<KeyHint>⌘K</KeyHint></button>
        <FocusToggle />
      </>} />
  )
}

/** Focus mode: hide watchlist, copilot and positions in one go; restores the previous layout when turned off. */
function FocusToggle() {
  const focus = useStore((s) => s.panels.focus)
  return <IconButton label={focus ? 'Leave focus mode (Shift+F)' : 'Focus mode: hide side panels (Shift+F)'} active={focus} onClick={() => useStore.getState().togglePanel('focus')}><EyeIcon /></IconButton>
}

/** Daily risk limits, kill switch and cool-off: the controls traders said they need most. */
function RiskCenter({ net }: { net: number }) {
  const { risk, setRisk, run, setToast, orders, instant, set } = useStore()
  const trades = orders.filter((o) => o.status === 'COMPLETE' && new Date(o.ts).toDateString() === new Date().toDateString() && o.via !== 'bracket' && o.via !== 'risk').length
  const cooling = risk.cooloffUntil && Date.now() < risk.cooloffUntil
  const lossUsed = Math.max(0, -net)
  const num = 'num h-8 w-28 rounded-full border border-line bg-surface px-3 text-right text-[12px] outline-none focus:border-fg-subtle'
  return (
    <Popover label="Risk limits" align="end" trigger={({ toggle, triggerProps }) => (
      <button onClick={toggle} {...triggerProps} className={cn('flex h-8 items-center gap-2 rounded-full border px-3 text-[12px]', risk.killed ? 'border-danger bg-danger-soft text-danger-fg' : cooling ? 'border-attention bg-attention-soft text-attention-fg' : 'border-line bg-surface')}>
        <ShieldIcon width={14} height={14} />
        <span className="max-sm:hidden">{risk.killed ? 'Locked' : cooling ? 'Cool-off' : 'Day'}</span>
        <Money v={net} className="font-bold" />
      </button>)}>
      <div className="w-[320px] space-y-4 p-3">
        <div><p className="font-serif text-base">Risk limits for today</p><p className="text-[12px] text-fg-subtle">Checked every second. When a limit is hit, positions close and new entries lock until tomorrow. Exits always work.</p></div>
        {risk.killed && <div className="rounded-xl bg-danger-soft p-3 text-[12px] text-danger-fg"><b>Trading locked.</b> {risk.reason}. <button className="underline" onClick={() => setRisk({ killed: false, reason: undefined })}>Unlock (paper mode)</button></div>}
        {cooling && <div className="rounded-xl bg-attention-soft p-3 text-[12px] text-attention-fg"><b>Cool-off.</b> {risk.cooloffAfter} losses in a row. New entries resume in {Math.ceil((risk.cooloffUntil! - Date.now()) / 60000)} min. <button className="underline" onClick={() => setRisk({ cooloffUntil: undefined })}>End now</button></div>}
        <div>
          <div className="mb-1 flex justify-between text-[12px]"><span className="text-fg-muted">Loss used today</span><span className="num">{inr(lossUsed)} of {inr(risk.maxLoss)}</span></div>
          <MeterBar label="Daily loss used" value={lossUsed} max={risk.maxLoss} warnAt={0.7} valueText={`${inr(lossUsed)} of ${inr(risk.maxLoss)}`} />
          <div className="mb-1 mt-3 flex justify-between text-[12px]"><span className="text-fg-muted">Trades today</span><span className="num">{trades} of {risk.maxTrades}</span></div>
          <MeterBar label="Trades used" value={trades} max={risk.maxTrades} warnAt={0.8} valueText={`${trades} of ${risk.maxTrades}`} />
        </div>
        <div className="grid grid-cols-[1fr_auto] items-center gap-2 text-[12px]">
          <label htmlFor="r-loss">Max loss a day (₹)</label><input id="r-loss" type="number" step={1000} className={num} defaultValue={risk.maxLoss} onBlur={(e) => setRisk({ maxLoss: Math.max(500, +e.target.value) })} />
          <label htmlFor="r-prof">Lock profit at (₹)</label><input id="r-prof" type="number" step={1000} className={num} defaultValue={risk.maxProfit} onBlur={(e) => setRisk({ maxProfit: Math.max(500, +e.target.value) })} />
          <label htmlFor="r-tr">Max trades a day</label><input id="r-tr" type="number" className={num} defaultValue={risk.maxTrades} onBlur={(e) => setRisk({ maxTrades: Math.max(1, +e.target.value) })} />
          <label htmlFor="r-co">Cool-off after losses in a row</label><input id="r-co" type="number" className={num} defaultValue={risk.cooloffAfter} onBlur={(e) => setRisk({ cooloffAfter: Math.max(1, +e.target.value) })} />
        </div>
        <LabeledSwitch label="Instant orders from the chart (Shift+B / Shift+S, no ticket)" checked={instant} onChange={(v) => set({ instant: v })} />
        <Button variant="danger" size="sm" className="w-full" disabled={risk.killed} onClick={() => setToast(run({ t: 'risk', kill: true }, 'manual'))}>Kill switch: close everything and stop for today</Button>
      </div>
    </Popover>
  )
}

function Watchlist() {
  const { watch, panels, setPanels, togglePanel } = useStore()
  const [peek, setPeek] = useState(false); const timer = useRef(0)
  const open = (v: boolean, delay = 0) => { clearTimeout(timer.current); timer.current = window.setTimeout(() => setPeek(v), delay) }
  useEffect(() => { if (panels.watch) setPeek(false) }, [panels.watch])
  useEffect(() => { if (!peek) return; const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setPeek(false) }; addEventListener('keydown', h); return () => removeEventListener('keydown', h) }, [peek])
  if (!panels.watch) return (
    // Folded: a quiet rail. Hovering or clicking it peeks the full list over the chart without changing the layout.
    <aside aria-label="Watchlist (folded)" className="relative z-30 flex min-h-0 flex-col items-center gap-3 border-r border-line bg-surface py-3 max-md:flex-row max-md:border-b max-md:px-3 max-md:py-2"
      onMouseEnter={() => open(true, 180)} onMouseLeave={() => open(false, 250)}>
      <IconButton size="sm" label="Show watchlist ( [ )" onClick={() => togglePanel('watch')}><ChevronIcon width={14} height={14} /></IconButton>
      <button onClick={() => open(!peek)} aria-expanded={peek} aria-controls="watch-peek"
        className="flex items-center gap-2 rounded-full px-1.5 py-3 text-[11px] uppercase tracking-[0.12em] text-fg-subtle hover:bg-hover hover:text-fg md:[writing-mode:vertical-rl] md:rotate-180 max-md:px-3 max-md:py-1">
        Watchlist<span className="num rounded-full bg-sunken px-1.5 py-0.5 text-[10px] tracking-normal text-fg-muted">{watch.length}</span>
      </button>
      {peek && (
        <div id="watch-peek" role="dialog" aria-label="Watchlist" className="absolute left-full top-0 bottom-0 flex w-[260px] flex-col border-r border-line bg-surface shadow-lg animate-fade max-md:top-full max-md:left-0 max-md:bottom-auto max-md:h-[60vh]">
          <WatchBody onPicked={() => setPeek(false)} header={
            <Button size="sm" variant="ghost" onClick={() => togglePanel('watch')}>Keep open</Button>} />
        </div>)}
    </aside>
  )
  return (
    <aside className="relative flex min-h-0 flex-col border-r border-line bg-surface max-md:max-h-72 max-md:border-b" aria-label="Watchlist">
      <Splitter dir="x" sign={1} value={panels.watchW} min={200} max={400} label="Watchlist width" onSize={(watchW) => setPanels({ watchW })} onToggle={() => togglePanel('watch')} className="-right-1" />
      <WatchBody header={<IconButton size="sm" label="Hide watchlist ( [ )" onClick={() => togglePanel('watch')}><ChevronIcon width={14} height={14} className="rotate-180" /></IconButton>} />
    </aside>
  )
}

const INDICES = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY']

/** One dense watchlist row: symbol, intraday sparkline, a price that flashes on each tick, change, and your position. */
function WatchRow({ w, sel, pick, onTrade, onRemove }: { w: string; sel: boolean; pick: () => void; onTrade?: (side: 'BUY' | 'SELL') => void; onRemove?: () => void }) {
  const p = useStore((s) => s.prices[w]); const pos = useStore((s) => s.positions[w])
  const chg = pct(p.ltp, p.prev); const up = chg >= 0
  return (
    <li className={cn('group relative flex h-11 items-center gap-2 border-l-2 pl-3.5 pr-3', sel ? 'border-[var(--accent)] bg-sunken' : 'border-transparent hover:bg-hover')}>
      <button className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={pick} aria-current={sel || undefined} title={bySym(w)!.name}>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold leading-4 text-fg">{w}{pos?.qty ? <span className={cn('rounded px-1 text-[10px] font-semibold leading-4', pos.qty > 0 ? 'bg-success-soft text-success-fg' : 'bg-danger-soft text-danger-fg')} title={`Your position: ${pos.qty > 0 ? 'long' : 'short'} ${Math.abs(pos.qty)}`}>{pos.qty > 0 ? '+' : ''}{pos.qty}</span> : null}</span>
          <span className="block truncate text-[11px] leading-4 text-fg-subtle">{bySym(w)!.name}</span>
        </span>
        <Spark sym={w} w={44} h={18} />
      </button>
      {onTrade && <div className="absolute right-[92px] flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button aria-label={`Buy ${w}`} onClick={() => onTrade('BUY')} className="h-6 rounded-md bg-success px-2 text-[11px] font-bold text-white dark:text-[var(--bg)]">B</button>
        <button aria-label={`Sell ${w}`} onClick={() => onTrade('SELL')} className="h-6 rounded-md bg-danger px-2 text-[11px] font-bold text-white dark:text-[var(--bg)]">S</button>
      </div>}
      <div className="w-[82px] shrink-0 text-right leading-4">
        <FlashPrice v={p.ltp} className="-mr-1 text-[13px] font-medium" />
        <div className={cn('num text-[11px]', up ? 'text-up' : 'text-down')}><Dir up={up} /> {up ? '+' : '−'}{Math.abs(chg).toFixed(2)}%</div>
      </div>
      {onRemove && <button aria-label={`Remove ${w} from watchlist`} onClick={onRemove} className="absolute right-0.5 top-0.5 text-fg-subtle opacity-0 group-hover:opacity-100"><XIcon width={10} height={10} /></button>}
    </li>
  )
}

/** Search, list and quick ticket. Shared by the open panel and the peek from the folded rail. */
function WatchBody({ header, onPicked }: { header: ReactNode; onPicked?: () => void }) {
  const { watch, sym, setSym, watchOp, setView, view } = useStore()
  const list = watch.filter((w) => !INDICES.includes(w))
  const pick = (w: string) => { setSym(w); if (!TRADING.includes(view)) setView('chart'); onPicked?.() }
  const [q, setQ] = useState(''); const [ticket, setTicket] = useState<{ sym: string; side: 'BUY' | 'SELL' } | null>(null)
  const results = q ? INSTS.filter((i) => (i.sym + i.name).toLowerCase().includes(q.toLowerCase()) && !watch.includes(i.sym)).slice(0, 8) : []
  return (
    <>
      <div className="flex h-12 shrink-0 items-center border-b border-line px-3">
        <label className="flex h-8 w-full items-center gap-2 rounded-full border border-line bg-sunken px-3 text-fg-subtle focus-within:border-fg-subtle">
          <SearchIcon width={14} height={14} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search and add" aria-label="Search instruments" className="w-full bg-transparent text-[13px] text-fg outline-none" />
        </label>
      </div>
      {results.length > 0 && <ul className="mx-3 mb-2 overflow-hidden rounded-xl border border-line">
        {results.map((i) => <li key={i.sym}><button onClick={() => { watchOp('add', i.sym); setQ('') }} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-hover">
          <span className="min-w-0 truncate"><b>{i.sym}</b> <span className="text-fg-subtle">{i.name}</span></span><PlusIcon width={14} height={14} /></button></li>)}
      </ul>}
      <div className="flex items-center gap-1 px-4 pb-1 pt-3"><p className="flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Indices</p>{header}</div>
      <ul className="border-b border-line pb-1">{INDICES.map((w) => <WatchRow key={w} w={w} sel={w === sym} pick={() => pick(w)} />)}</ul>
      <div className="flex items-center px-4 pb-1 pt-2.5"><p className="flex-1 text-[11px] font-medium uppercase tracking-[0.08em] text-fg-subtle">Watchlist · {list.length}</p></div>
      <ul className="scroll-thin min-h-0 flex-1 overflow-auto">
        {list.map((w) => <WatchRow key={w} w={w} sel={w === sym} pick={() => pick(w)} onTrade={(side) => setTicket({ sym: w, side })} onRemove={() => watchOp('remove', w)} />)}
      </ul>
      {ticket && <Ticket {...ticket} close={() => setTicket(null)} />}
    </>
  )
}

function Ticket({ sym, side: s0, close }: { sym: string; side: 'BUY' | 'SELL'; close: () => void }) {
  const { prices, place, setToast, setView, setSym } = useStore(); const inst = bySym(sym)!
  const ltp = prices[sym].ltp
  const [side, setSide] = useState(s0); const [qty, setQty] = useState(1); const [ot, setOt] = useState<'MARKET' | 'LIMIT' | 'SL-M'>('MARKET')
  const [px, setPx] = useState(+ltp.toFixed(1)); const [prod, setProd] = useState<'MIS' | 'CNC'>('MIS')
  const [sl, setSl] = useState(''); const [tg, setTg] = useState('')
  const box = 'absolute left-full top-16 z-30 ml-2 w-[320px] rounded-2xl border border-line bg-raised p-4 shadow-lg animate-rise max-md:left-3 max-md:ml-0'
  const field = 'h-9 rounded-full border border-line bg-surface px-3 text-[13px] num outline-none focus:border-fg-subtle'
  if (inst.seg === 'IDX') return <div role="dialog" aria-label="Index order" className={box}><p className="mb-3 text-[13px] text-fg-muted">Indices trade through options.</p><div className="flex gap-2"><Button size="sm" onClick={() => { setSym(sym); setView('chain'); close() }}>Open option chain</Button><Button size="sm" variant="ghost" onClick={close}>Cancel</Button></div></div>
  const entry = ot === 'MARKET' ? ltp : px; const val = qty * entry
  const risk = sl ? Math.abs(entry - +sl) * qty : 0
  return (
    <div role="dialog" aria-label={`${side} ${sym}`} className={box}>
      <div className="flex items-baseline justify-between"><p className="font-serif text-lg">{side === 'BUY' ? 'Buy' : 'Sell'} {sym}</p><span className="num text-fg-muted">{ltp.toFixed(2)}</span></div>
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <SegmentedControl size="sm" label="Side" value={side} onChange={setSide} options={[{ value: 'BUY', label: 'Buy' }, { value: 'SELL', label: 'Sell' }]} />
          <SegmentedControl size="sm" label="Product" value={prod} onChange={setProd} options={[{ value: 'MIS', label: 'Intraday' }, { value: 'CNC', label: 'Delivery' }]} />
        </div>
        <SegmentedControl size="sm" label="Order type" value={ot} onChange={setOt} options={[{ value: 'MARKET', label: 'Market' }, { value: 'LIMIT', label: 'Limit' }, { value: 'SL-M', label: 'Stop entry' }]} />
        <div className="grid grid-cols-2 gap-2 text-[12px] text-fg-subtle">
          <label>Quantity<input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, +e.target.value))} className={cn(field, 'mt-1 w-full')} /></label>
          {ot !== 'MARKET' && <label>{ot === 'LIMIT' ? 'Limit price' : 'Trigger price'}<input type="number" step={0.05} value={px} onChange={(e) => setPx(+e.target.value)} className={cn(field, 'mt-1 w-full')} /></label>}
          <label className="text-down">Stop (optional)<input type="number" step={0.05} placeholder="—" value={sl} onChange={(e) => setSl(e.target.value)} className={cn(field, 'mt-1 w-full')} /></label>
          <label className="text-up">Target (optional)<input type="number" step={0.05} placeholder="—" value={tg} onChange={(e) => setTg(e.target.value)} className={cn(field, 'mt-1 w-full')} /></label>
        </div>
        <p className="text-[12px] text-fg-subtle">Value <span className="num text-fg">{inr(val)}</span>{risk > 0 && <> · risk if stopped <span className="num text-down">{inr(risk)}</span></>}{risk > 0 && tg && <> · 1 : {(Math.abs(+tg - entry) / Math.abs(entry - +sl)).toFixed(1)}</>}</p>
        <div className="flex gap-2">
          <Button size="sm" variant={side === 'BUY' ? 'primary' : 'danger'} onClick={() => { setToast(place(sym, side, qty, ot, ot === 'LIMIT' ? px : 0, prod, { trigger: ot === 'SL-M' ? px : undefined, sl: sl ? +sl : undefined, tgt: tg ? +tg : undefined })); close() }}>{side === 'BUY' ? 'Buy' : 'Sell'} {qty} {sym}</Button>
          <Button size="sm" variant="ghost" onClick={close}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

function SubBar() {
  const { view, setView, sym, prices } = useStore(); const p = prices[sym]
  if (!TRADING.includes(view)) return <div />
  return (
    <div className="flex h-12 min-w-0 items-center gap-x-4 overflow-hidden border-b border-line bg-surface px-4">
      <div className="flex min-w-0 items-baseline gap-3">
        <h1 className="text-xl tracking-tight">{sym}</h1>
        <span className="num text-[15px] font-bold">{p.ltp.toFixed(2)}</span><Chg v={pct(p.ltp, p.prev)} />
        <span className="num text-[11px] text-fg-subtle max-lg:hidden">H {p.high.toFixed(1)} · L {p.low.toFixed(1)} · {bySym(sym)!.name}{bySym(sym)!.seg === 'EQ' ? ` · ${bySym(sym)!.sector}` : ''}</span>
      </div>
      {view !== 'chart' && <SegmentedControl className="ml-auto" size="sm" label="Options view" value={view} onChange={setView} options={[{ value: 'chain', label: 'Option chain' }, { value: 'strategy', label: 'Strategy builder' }]} />}
      {view === 'chart' && bySym(sym)!.fno && <Button size="sm" variant="ghost" className="ml-auto" trailing={<ArrowRightIcon width={12} height={12} />} onClick={() => setView('chain')}>{sym} option chain</Button>}
    </div>
  )
}

function Main() {
  const { view, sym, setSym } = useStore()
  const optSym = bySym(sym)!.fno ? sym : 'NIFTY'
  useEffect(() => { if ((view === 'chain' || view === 'strategy') && optSym !== sym) setSym(optSym) }, [view, sym, optSym, setSym])
  return (
    <section key={view} className="scroll-thin relative min-h-0 overflow-auto bg-surface animate-fade" aria-label={view}>
      {view === 'chart' && <Chart />}
      {view === 'chain' && optSym === sym && <Chain />}
      {view === 'strategy' && <Strategy />}
      {view === 'scanner' && <Scanner />}
      {view === 'markets' && <Markets />}
      {view === 'portfolio' && <Portfolio />}
      {view === 'journal' && <Journal />}
    </section>
  )
}

function ExitPlan({ k }: { k: string }) {
  const { brackets, setBracket, positions, setToast } = useStore(); const b = brackets[k]; const pos = positions[k]
  const [open, setOpen] = useState(false); const [sl, setSl] = useState(''); const [tg, setTg] = useState(''); const [tr, setTr] = useState('')
  if (!pos?.qty) return <span className="text-fg-subtle">—</span>
  if (!open) return (
    <button onClick={() => { setSl(b?.sl?.toFixed(2) ?? ''); setTg(b?.tgt?.toFixed(2) ?? ''); setTr(b?.trail?.toString() ?? ''); setOpen(true) }} className="rounded-full px-2 py-0.5 text-left hover:bg-hover">
      {b?.sl || b?.tgt ? <span className="num text-[11px]"><span className="text-down">{b.sl ? `SL ${b.sl.toFixed(1)}` : ''}</span>{b.sl && b.tgt ? ' · ' : ''}<span className="text-up">{b.tgt ? `T ${b.tgt.toFixed(1)}` : ''}</span>{b.trail ? ' · trail' : ''}</span>
        : parseKey(k).strike ? <span className="text-[11px] text-fg-muted">Add exit plan</span> : <Badge tone="warning">No stop · add</Badge>}
    </button>)
  const f = 'num h-7 w-20 rounded-full border border-line bg-surface px-2 text-right text-[11px] outline-none'
  return (
    <span className="inline-flex items-center gap-1 font-sans">
      <input aria-label="Stop" placeholder="Stop" className={f} value={sl} onChange={(e) => setSl(e.target.value)} />
      <input aria-label="Target" placeholder="Target" className={f} value={tg} onChange={(e) => setTg(e.target.value)} />
      <input aria-label="Trail by points" placeholder="Trail" className={cn(f, 'w-14')} value={tr} onChange={(e) => setTr(e.target.value)} />
      <IconButton size="sm" label="Save exit plan" onClick={() => { setBracket(k, { sl: sl ? +sl : undefined, tgt: tg ? +tg : undefined, trail: tr ? +tr : undefined, peak: undefined }); setToast(`Exit plan saved for ${labelOf(k)}`); setOpen(false) }}><CheckIcon width={12} height={12} /></IconButton>
      <IconButton size="sm" label="Cancel" onClick={() => setOpen(false)}><XIcon width={10} height={10} /></IconButton>
    </span>
  )
}

function Bottom() {
  const s = useStore(); const [tab, setTab0] = useState<'pos' | 'ord' | 'gtt' | 'log'>('pos')
  const open_ = s.panels.bottom
  // Picking a tab while folded opens the panel on that tab.
  const setTab = (t: typeof tab) => { setTab0(t); if (!open_) s.setPanels({ bottom: true, focus: false }) }
  const pos = Object.values(s.positions).filter((p) => p.qty || p.realized)
  const open = pos.filter((p) => p.qty).length
  const working = s.orders.filter((o) => o.status === 'OPEN' || o.status === 'TRIGGER_PENDING').length
  const active = s.triggers.filter((t) => !t.done).length
  const p = s.pnl()
  const empty = (cols: number, text: ReactNode) => <tr><td colSpan={cols} className="!py-8 !text-center !font-sans text-fg-subtle">{text}</td></tr>
  return (
    <section className="relative flex min-h-0 flex-col border-t border-line bg-surface" aria-label="Positions and orders">
      {open_ && <Splitter dir="y" sign={-1} value={s.panels.bottomH} min={120} max={Math.round(innerHeight * 0.7)} label="Positions panel height" onSize={(bottomH) => s.setPanels({ bottomH })} onToggle={() => s.togglePanel('bottom')} className="-top-1" />}
      <div className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto px-4">
        <SegmentedControl size="sm" label="Panel" value={tab} onChange={setTab} options={[
          { value: 'pos', label: `Positions ${open}` }, { value: 'ord', label: `Orders${working ? ` · ${working} working` : ''}` }, { value: 'gtt', label: `Alerts and GTT ${active}` }, { value: 'log', label: 'Activity' }]} />
        {tab === 'pos' && <span className="shrink-0 whitespace-nowrap text-[12px] text-fg-subtle">Net after charges <Money v={p.net} className="font-bold" /> · charges <span className="num">{inr(p.charges)}</span></span>}
        {tab === 'pos' && open > 0 && <Button size="sm" variant="danger" className="ml-auto shrink-0" onClick={() => s.setToast(`Closed ${s.squareoff()} position(s)`)}>{open === 1 ? 'Exit 1 position' : `Exit all ${open} positions`}</Button>}
        <IconButton size="sm" className={cn('shrink-0', !(tab === 'pos' && open > 0) && 'ml-auto')} label={open_ ? 'Fold positions panel ( \\ )' : 'Open positions panel ( \\ )'} onClick={() => s.togglePanel('bottom')}><ChevronIcon width={14} height={14} className={open_ ? 'rotate-90' : '-rotate-90'} /></IconButton>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-auto" hidden={!open_}>
        {tab === 'pos' && <table className="tbl"><thead><tr><th>Instrument</th><th>Product</th><th>Qty</th><th>Avg</th><th>LTP</th><th>P&amp;L</th><th>Exit plan</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {pos.map((x) => { const l = s.ltp(x.key); const pl = (l - x.avg) * x.qty + x.realized; return <tr key={x.key}>
            <td className="!font-sans"><button className="hover:underline" onClick={() => { s.setSym(parseKey(x.key).und); s.setView(parseKey(x.key).strike ? 'chain' : 'chart') }}>{labelOf(x.key)}</button>{x.tag && <span className="ml-2 text-[11px] text-fg-subtle">{x.tag}</span>}</td><td><Badge>{x.product}</Badge></td>
            <td className={x.qty > 0 ? 'text-up' : x.qty < 0 ? 'text-down' : 'text-fg-subtle'}>{x.qty > 0 ? '+' : ''}{x.qty}</td>
            <td>{x.avg ? x.avg.toFixed(2) : '—'}</td><td>{l.toFixed(2)}</td><td><Money v={pl} /></td><td><ExitPlan k={x.key} /></td>
            <td>{x.qty !== 0 && <Button size="sm" variant="secondary" onClick={() => s.setToast(s.place(x.key, x.qty > 0 ? 'SELL' : 'BUY', Math.abs(x.qty), 'MARKET', 0, x.product))}>Exit</Button>}</td></tr> })}
          {!pos.length && empty(8, <>No positions yet. Press <KeyHint>B</KeyHint> on the chart, or ask the copilot: <i>buy 50 sbi with sl 850</i>.</>)}
        </tbody></table>}
        {tab === 'ord' && <table className="tbl"><thead><tr><th>Time</th><th>Instrument</th><th>Side</th><th>Qty</th><th>Type</th><th>Price</th><th>Status</th><th>Source</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {s.orders.map((o) => <tr key={o.id}><td>{o.time}</td><td className="!font-sans">{labelOf(o.key)}{o.tag && <span className="ml-2 text-[11px] text-fg-subtle">{o.tag}</span>}</td><td className={o.side === 'BUY' ? 'text-up' : 'text-down'}>{o.side}</td><td>{o.qty}</td><td>{o.otype} · {o.product}</td>
            <td>{o.status === 'TRIGGER_PENDING' ? `trg ${o.trigger?.toFixed(2)}` : (o.fill ?? o.price).toFixed(2)}</td>
            <td><Badge tone={o.status === 'COMPLETE' ? 'success' : o.status === 'REJECTED' ? 'danger' : 'neutral'} title={o.note}>{o.status === 'COMPLETE' ? 'Filled' : o.status === 'REJECTED' ? 'Rejected' : o.status === 'OPEN' ? 'Working' : o.status === 'TRIGGER_PENDING' ? 'Waiting for trigger' : 'Cancelled'}</Badge>{o.note && <span className="ml-2 font-sans text-[11px] text-down">{o.note}</span>}</td>
            <td className="!font-sans text-fg-subtle">{o.via === 'ai' ? <span className="inline-flex items-center gap-1"><AIMark size={16} />AI</span> : o.via}</td>
            <td>{(o.status === 'OPEN' || o.status === 'TRIGGER_PENDING') && <Button size="sm" variant="ghost" onClick={() => s.cancel(o.id)}>Cancel</Button>}</td></tr>)}
          {!s.orders.length && empty(9, 'No orders today.')}
        </tbody></table>}
        {tab === 'gtt' && <table className="tbl"><thead><tr><th>Symbol</th><th>Condition</th><th>Then</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
          {s.triggers.map((t) => <tr key={t.id}><td className="!font-sans font-bold">{t.sym}</td><td>LTP {t.dir} {t.price}</td><td className="!font-sans">{t.then ? describe(t.then) : 'Notify me'}</td><td><Badge tone={t.done ? 'success' : 'info'}>{t.done ? 'Triggered' : 'Active'}</Badge></td>
            <td><IconButton size="sm" label={`Delete alert on ${t.sym}`} onClick={() => s.removeTrigger(t.id)}><XIcon width={10} height={10} /></IconButton></td></tr>)}
          {!s.triggers.length && empty(5, <>No alerts. Press <KeyHint>Alt</KeyHint>+<KeyHint>A</KeyHint> on the chart, or ask: <i>alert me when nifty crosses 25000</i>.</>)}
        </tbody></table>}
        {tab === 'log' && <table className="tbl"><thead><tr><th>Time</th><th>Who</th><th>What</th></tr></thead><tbody>
          {s.audit.map((a, i) => <tr key={i}><td>{new Date(a.ts).toLocaleTimeString('en-IN', { hour12: false })}</td><td className="!font-sans">{a.source === 'ai' ? <span className="inline-flex items-center gap-1"><AIMark size={16} />AI</span> : a.source === 'user' ? 'You' : 'System'}</td><td className="!whitespace-normal !text-left !font-sans">{a.text}</td></tr>)}
          {!s.audit.length && empty(3, 'Every AI suggestion, approval and order is logged here.')}
        </tbody></table>}
      </div>
    </section>
  )
}


function describe(a: Action): string {
  switch (a.t) {
    case 'order': return `${a.side === 'BUY' ? 'Buy' : 'Sell'} ${a.qty}${a.strike ? ` lot${a.qty > 1 ? 's' : ''} ${a.und} ${a.strike} ${a.ot}` : ` ${a.und}`} · ${a.otype === 'LIMIT' ? `limit ₹${a.price}` : a.otype === 'SL-M' ? `stop entry ₹${a.trigger}` : 'market'} · ${a.product}${a.sl ? ` · SL ${a.sl}` : ''}${a.tgt ? ` · target ${a.tgt}` : ''}${a.trail ? ` · trail ${a.trail}` : ''}`
    case 'legs': return `${a.name ?? 'Strategy'} on ${a.und}: ` + a.legs.map((l) => `${l.side === 'BUY' ? 'buy' : 'sell'} ${l.lots}× ${l.strike} ${l.type}`).join(', ')
    case 'squareoff': return a.key ? `Close ${labelOf(a.key)} at market` : 'Close every open position at market and cancel working orders'
    case 'trigger': return `When ${a.sym} goes ${a.dir} ${a.price}: ${a.then ? describe(a.then).toLowerCase() : 'notify me'}`
    case 'risk': return a.kill ? 'Kill switch: close all positions, cancel orders, block new entries today' : 'Update risk limits'
    case 'sip': return `Monthly SIP ₹${a.amount.toLocaleString('en-IN')} into ${a.sym} on day ${a.day ?? 5}`
    default: return a.t
  }
}


/** ⌘K: one box for symbols, screens, commands and questions. */
export function Palette() {
  const open = useStore((s) => s.palette); const [q, setQ] = useState(''); const [sel, setSel] = useState(0); const input = useRef<HTMLInputElement>(null)
  const close = () => { useStore.setState({ palette: false }); setQ(''); setSel(0) }
  const items = useMemo(() => {
    const st = useStore.getState(); const t = q.toLowerCase().trim()
    const cmds: { label: string; hint: string; run: () => void }[] = [
      ...NAV.map((n) => ({ label: `Go to ${n.label}`, hint: 'View', run: () => st.setView(n.value as View) })),
      { label: 'Morning brief', hint: 'AI', run: () => ask('brief me') },
      { label: 'Review my trades', hint: 'AI', run: () => ask('review my trades') },
      { label: 'Explain my P&L', hint: 'AI', run: () => ask('explain my pnl') },
      { label: 'Exit all positions', hint: 'Command', run: () => ask('square off all') },
      { label: 'Kill switch', hint: 'Command', run: () => ask('kill switch') },
      { label: 'Toggle dark theme', hint: 'Command', run: () => st.toggleTheme() },
      { label: 'Reset paper account (cash, positions, orders)', hint: 'Account', run: () => { if (window.confirm('Reset the paper account? Positions, orders, alerts and trade history go back to the starting state. Chat and settings stay.')) resetBook() } },
      { label: 'New conversation (clear chat history)', hint: 'Chat', run: () => { if (window.confirm('Clear the conversation? Positions and orders are not affected.')) st.clearChat() } },
      { label: st.panels.watch ? 'Hide watchlist' : 'Show watchlist', hint: '[', run: () => st.togglePanel('watch') },
      { label: st.panels.copilot ? 'Hide the AI agent' : 'Show the AI agent', hint: ']', run: () => st.togglePanel('copilot') },
      { label: st.panels.chatFull ? 'Switch to Terminal' : 'Switch to Chat', hint: 'Layout', run: () => switchLayout(!st.panels.chatFull) },
      { label: st.panels.bottom ? 'Fold positions panel' : 'Open positions panel', hint: '\\', run: () => st.togglePanel('bottom') },
      { label: st.panels.focus ? 'Leave focus mode' : 'Focus mode: hide all panels', hint: 'Shift+F', run: () => st.togglePanel('focus') },
      { label: 'Reset layout', hint: 'Command', run: () => { st.setPanels({ watch: true, copilot: true, bottom: true, watchW: 240, copilotW: 380, bottomH: 240, focus: false, chips: true }); try { localStorage.removeItem('sections') } catch { /* storage unavailable */ } st.set({ sections: {} }) } },
      { label: 'Chart layout: single', hint: 'Chart', run: () => { st.setLayout('1'); st.setView('chart') } },
      { label: 'Chart layout: four charts', hint: 'Chart', run: () => { st.setLayout('4'); st.setView('chart') } },
    ]
    const syms = INSTS.filter((i) => !t || i.sym.toLowerCase().includes(t) || i.name.toLowerCase().includes(t)).slice(0, 6).map((i) => ({ label: `${i.sym}  ·  ${i.name}`, hint: 'Chart', run: () => { st.setSym(i.sym); st.setView('chart') } }))
    const matched = cmds.filter((c) => !t || c.label.toLowerCase().includes(t))
    const out = [...syms, ...matched]
    if (t) out.unshift({ label: `Ask the copilot: “${q}”`, hint: 'AI', run: () => ask(q) })
    return out.slice(0, 12)
  }, [q])
  useEffect(() => { if (open) setTimeout(() => input.current?.focus(), 0) }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-scrim px-4 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-label="Command palette" className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-raised shadow-lg animate-rise">
        <label className="flex items-center gap-3 border-b border-line px-4"><SearchIcon width={16} height={16} className="text-fg-subtle" />
          <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setSel(0) }} placeholder="Symbol, command or question…" aria-label="Command"
            onKeyDown={(e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, items.length - 1)) } if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) } if (e.key === 'Enter' && items[sel]) { items[sel].run(); close() } }}
            className="h-12 flex-1 bg-transparent text-[15px] outline-none" /><KeyHint>Esc</KeyHint></label>
        <ul role="listbox" aria-label="Results" className="max-h-[50vh] overflow-auto p-1.5">
          {items.map((it, i) => <li key={it.label} role="option" aria-selected={i === sel}>
            <button onMouseEnter={() => setSel(i)} onClick={() => { it.run(); close() }} className={cn('flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-[13px]', i === sel && 'bg-sunken')}>
              <span className="truncate">{it.label}</span><span className="shrink-0 text-[11px] text-fg-subtle">{it.hint}</span></button></li>)}
        </ul>
      </div>
    </div>
  )
}

/** SEBI requires the F&O risk disclosure before derivatives trading. Shown once, before the first option order. */
export function FnoDisclosure() {
  const need = useStore((s) => s.needAck)
  if (!need) return null
  const accept = () => { try { localStorage.setItem('fnoAck', 'true') } catch { /* storage unavailable */ } useStore.setState({ fnoAck: true, needAck: false }); useStore.getState().setToast('Disclosure accepted. Place the order again.') }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-scrim px-4">
      <div role="alertdialog" aria-label="Risk disclosure on derivatives" className="w-full max-w-lg rounded-2xl border border-line bg-raised p-6 shadow-lg animate-rise">
        <h2 className="text-xl">Risk disclosure on derivatives</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-[14px] text-fg-muted">
          <li><b className="text-fg">9 out of 10 individual traders in equity F&amp;O lost money</b> in FY25, according to SEBI's study. The average net loss was about ₹1.1 lakh per person.</li>
          <li>Loss-makers also paid transaction costs on top of their losses. Option STT is 0.15% of premium on the sell side.</li>
          <li>Selling options can lose far more than the premium you collect.</li>
          <li>This terminal is paper trading on simulated prices. Nothing reaches an exchange.</li>
        </ul>
        <div className="mt-5 flex gap-2"><Button onClick={accept}>I understand the risks</Button><Button variant="ghost" onClick={() => useStore.setState({ needAck: false })}>Not now</Button></div>
      </div>
    </div>
  )
}

export function Toast() {
  const t = useStore((s) => s.toast); const chat = useStore((s) => s.mode === 'chat')
  // In chat the composer owns the bottom edge, so notices drop in under the top bar instead.
  return <div role="status" aria-live="polite" className={cn('pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4', chat ? 'top-16' : 'bottom-5')}>
    {t && <div className="pointer-events-auto max-w-xl whitespace-pre-line rounded-2xl border border-line bg-code px-4 py-3 text-[13px] text-code-fg shadow-lg animate-sheet">{t}</div>}
  </div>
}
