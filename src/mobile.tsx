// Phone pieces. On a phone you act with a thumb, one thing at a time: lists open sheets from the bottom, the chart keeps
// Sell and Buy in a bar at the bottom edge, and everything that isn't a main tab lives under More.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronsRight, X, BookOpen, Briefcase, Layers, MessageSquare, Moon, MoreHorizontal, Rows3, ScanSearch, Sun, TrendingUp, Workflow, List, Wallet } from 'lucide-react'
import { useStore, type View } from './store'
import { bySym } from './market'
import { cn } from './ds'
import { DepthView, useDepth } from './depth'
import { useEntryGate, opensPosition, GateIcon } from './gate'

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** A sheet from the bottom edge with a dimmed backdrop. Tap outside, the handle, or Esc to close. */
export function Sheet({ open, onClose, label, children, className }: { open: boolean; onClose: () => void; label: string; children: ReactNode; className?: string }) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  // Rendered at the top of the page, so no animated or scrolling parent can clip it or stack the tab bar over it.
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40 animate-fade" />
      <div role="dialog" aria-modal="true" aria-label={label}
        className={cn('relative max-h-[88dvh] overflow-y-auto rounded-t-[14px] border-t border-line bg-raised pb-[calc(12px+env(safe-area-inset-bottom))] shadow-lg animate-rise', className)}>
        <span aria-hidden className="mx-auto mt-2 block h-1 w-9 rounded-full bg-[var(--border-strong)]" />
        <button type="button" aria-label="Close" onClick={onClose} className="absolute right-2 top-2 flex size-10 items-center justify-center rounded-full text-fg-subtle active:bg-hover"><X size={18} strokeWidth={1.75} /></button>
        <div className="h-3" />
        {children}
      </div>
    </div>,
    document.body,
  )
}

/** Sell and Buy at the live bid and offer, full width, where the thumb is. Locked sides stay visible, greyed. */
export function TradeBar({ sym, onTrade, onDepth }: { sym: string; onTrade: (side: 'BUY' | 'SELL') => void; onDepth: () => void }) {
  const inst = bySym(sym); const gate = useEntryGate(); const { d } = useDepth(inst?.seg === 'EQ' ? sym : 'RELIANCE')
  useStore((s) => s.positions[sym]); useStore((s) => s.holdings)
  if (!inst || inst.seg !== 'EQ') return null
  const ok = (side: 'BUY' | 'SELL') => !gate || !opensPosition(sym, side, 1, 'MIS') || !opensPosition(sym, side, 1, 'CNC')
  const btn = (side: 'BUY' | 'SELL') => { const buy = side === 'BUY'; const live = ok(side); const px = buy ? d.asks[0].price : d.bids[0].price
    return <button type="button" aria-disabled={!live || undefined} onClick={() => live && onTrade(side)} title={live ? undefined : `${gate!.short}. ${gate!.why}`}
      className={cn('flex h-12 flex-1 flex-col items-center justify-center rounded-lg leading-tight', live ? (buy ? 'bg-success text-white dark:text-[var(--bg)]' : 'bg-danger text-white dark:text-[var(--bg)]') : 'bg-sunken text-fg-subtle')}>
      <span className="flex items-center gap-1 text-[12px] font-semibold">{!live && <GateIcon g={gate!} size={11} />}{buy ? 'Buy' : 'Sell'}</span><span className="num text-[13px] font-semibold">{fmt(px)}</span>
    </button> }
  return (
    <div className="flex shrink-0 items-center gap-2 border-t border-line bg-surface px-3 py-2">
      <button type="button" onClick={onDepth} aria-label="Market depth" className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border border-line text-[10px] text-fg-muted"><Rows3 size={16} strokeWidth={1.75} />Depth</button>
      {btn('SELL')}{btn('BUY')}
    </div>
  )
}

/** Depth for one stock, as a sheet. Tapping a price opens the ticket at that limit. */
export function DepthSheet({ sym, onClose, onPrice }: { sym: string | null; onClose: () => void; onPrice: (side: 'BUY' | 'SELL', price: number) => void }) {
  const gate = useEntryGate()
  if (!sym) return null
  return (
    <Sheet open onClose={onClose} label={`${sym} market depth`}>
      <div className="px-4">
        <p className="mb-3 text-[14px] font-semibold text-fg">{sym} · Market depth</p>
        <DepthView sym={sym} onPrice={gate ? undefined : onPrice} />
        {!gate && <p className="mt-3 text-[11px] text-fg-subtle">Tap a price to open the ticket at that limit.</p>}
      </div>
    </Sheet>
  )
}

const PAGES: { v: View; label: string; sub: string; icon: ReactNode }[] = [
  { v: 'markets', label: 'Markets', sub: 'Indices, breadth, sectors', icon: <TrendingUp size={18} strokeWidth={1.75} /> },
  { v: 'scanner', label: 'Scanner', sub: 'Find stocks by conditions', icon: <ScanSearch size={18} strokeWidth={1.75} /> },
  { v: 'chain', label: 'Option chain', sub: 'Strikes, OI and Greeks', icon: <Layers size={18} strokeWidth={1.75} /> },
  { v: 'strategy', label: 'Strategy builder', sub: 'Multi-leg payoffs', icon: <Workflow size={18} strokeWidth={1.75} /> },
  { v: 'journal', label: 'Journal', sub: 'Every closed trade, and what it says', icon: <BookOpen size={18} strokeWidth={1.75} /> },
]

/** Everything that isn't a main tab: the other workspaces, then settings. */
export function MoreSheet({ open, onClose, onPage }: { open: boolean; onClose: () => void; onPage: (v: View) => void }) {
  const theme = useStore((s) => s.theme)
  const row = 'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-hover'
  return (
    <Sheet open={open} onClose={onClose} label="More">
      <nav aria-label="Workspaces" className="px-2">
        {PAGES.map((p) => <button key={p.v} type="button" className={row} onClick={() => onPage(p.v)}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-muted">{p.icon}</span>
          <span className="min-w-0"><span className="block text-[14px] font-medium text-fg">{p.label}</span><span className="block text-[12px] text-fg-subtle">{p.sub}</span></span>
        </button>)}
      </nav>
      <div className="mx-4 my-2 h-px bg-line" />
      <div className="px-2">
        <button type="button" className={row} onClick={() => useStore.getState().toggleTheme()}>
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-muted">{theme === 'dark' ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}</span>
          <span className="text-[14px] font-medium text-fg">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
        </button>
      </div>
    </Sheet>
  )
}

export type PhoneTab = 'watch' | 'positions' | 'agent' | 'portfolio' | 'more'
/** Five destinations, navigation only (no actions in the tab bar). A stock's chart opens from the stock, not a tab. */
export const PHONE_TABS: { id: PhoneTab; label: string; icon: ReactNode }[] = [
  { id: 'watch', label: 'Watchlist', icon: <List size={20} strokeWidth={1.75} /> },
  { id: 'positions', label: 'Positions', icon: <Wallet size={20} strokeWidth={1.75} /> },
  { id: 'agent', label: 'Agent', icon: <MessageSquare size={20} strokeWidth={1.75} /> },
  { id: 'portfolio', label: 'Portfolio', icon: <Briefcase size={20} strokeWidth={1.75} /> },
  { id: 'more', label: 'More', icon: <MoreHorizontal size={20} strokeWidth={1.75} /> },
]

/* ------------------------------------------------------------------ screens and the back button */

/**
 * Layers on top of the tabs (a stock page, an order pad, a sheet), each with a browser history entry, so the phone's
 * Back gesture closes the top one, as people expect from every other app. Closing from the UI goes through history too.
 */
export function useBackStack<T>() {
  const [stack, setStack] = useState<T[]>([])
  useEffect(() => {
    const h = () => setStack((s) => s.slice(0, -1))
    addEventListener('popstate', h); return () => removeEventListener('popstate', h)
  }, [])
  const push = (l: T) => { history.pushState({ layer: true }, ''); setStack((s) => [...s, l]) }
  const pop = () => history.back()
  /** Swap the top layer without growing history (for example More → a page). */
  const replace = (l: T) => setStack((s) => [...s.slice(0, -1), l])
  const clear = (n: number) => { if (n) history.go(-n) }
  return { stack, top: stack[stack.length - 1], push, pop, replace, clear }
}

/** A full-screen page pushed over the tabs: back on the left, title, an optional action, a scrolling body, a fixed footer. */
export function Screen({ title, sub, onBack, right, children, footer }: { title: ReactNode; sub?: ReactNode; onBack: () => void; right?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-40 flex flex-col bg-surface animate-fade">
      <header className="flex h-14 shrink-0 items-center gap-1 border-b border-line px-1 pt-[env(safe-area-inset-top)]">
        <button type="button" onClick={onBack} aria-label="Back" className="flex size-11 shrink-0 items-center justify-center rounded-full text-fg active:bg-hover"><ChevronLeft size={22} strokeWidth={1.75} /></button>
        <div className="min-w-0 flex-1"><p className="truncate text-[16px] font-semibold leading-5 text-fg">{title}</p>{sub && <p className="truncate text-[12px] leading-4 text-fg-subtle">{sub}</p>}</div>
        {right}
      </header>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      {footer && <div className="shrink-0 border-t border-line bg-surface px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5">{footer}</div>}
    </div>,
    document.body,
  )
}

/**
 * Deliberate confirm for placing an order: drag the knob to the end. A tap can't place a trade by accident (pocket,
 * scroll, mis-tap), which matters more on a phone than anywhere else. Keyboard and screen readers get a plain button.
 */
export function SlideToConfirm({ label, tone, onConfirm }: { label: string; tone: 'buy' | 'sell'; onConfirm: () => void }) {
  const track = useRef<HTMLDivElement>(null); const [x, setX] = useState(0); const [drag, setDrag] = useState(false)
  const start = useRef(0); const dragging = useRef(false); const pos = useRef(0)
  const max = () => (track.current ? track.current.clientWidth - 56 : 200)
  const move = (v: number) => { pos.current = Math.max(0, Math.min(max(), v)); setX(pos.current) }
  const end = () => {
    if (!dragging.current) return; dragging.current = false; setDrag(false)
    if (pos.current >= max() * 0.9) { move(max()); navigator.vibrate?.(15); onConfirm() } else move(0)
  }
  const bg = tone === 'buy' ? 'bg-success' : 'bg-danger'
  return (
    <div ref={track} className={cn('relative h-14 select-none overflow-hidden rounded-full', tone === 'buy' ? 'bg-success-soft' : 'bg-danger-soft')}>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 rounded-full opacity-25', bg)} style={{ width: x + 56 }} />
      <span aria-hidden className={cn('pointer-events-none absolute inset-0 flex items-center justify-center pl-10 text-[14px] font-semibold', tone === 'buy' ? 'text-success-fg' : 'text-danger-fg')} style={{ opacity: 1 - x / Math.max(1, max()) }}>{label}</span>
      <button type="button" aria-label={label.replace(/^Slide to/, 'Confirm:')}
        // Keyboard and screen-reader activation (detail 0) confirms directly; a pointer has to slide.
        onClick={(e) => { if (e.detail === 0) onConfirm() }}
        onPointerDown={(e) => { try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) } catch { /* synthetic pointer */ } dragging.current = true; start.current = e.clientX - pos.current; setDrag(true) }}
        onPointerMove={(e) => { if (dragging.current) move(e.clientX - start.current) }}
        onPointerUp={end} onPointerLeave={end} onPointerCancel={() => { dragging.current = false; setDrag(false); move(0) }}
        className={cn('absolute left-1 top-1 flex size-12 touch-none items-center justify-center rounded-full text-white shadow-md dark:text-[var(--bg)]', bg, !drag && 'transition-transform duration-200')}
        style={{ transform: `translateX(${x}px)` }}><ChevronsRight size={22} strokeWidth={2} /></button>
    </div>
  )
}
