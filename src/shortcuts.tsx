// Every keyboard shortcut in one place, grouped by where you use it. Opened with ? from anywhere outside a text
// field, or from the command palette. The list is the source of truth for the sheet only; each shortcut is
// handled where it lives (the app shell, the chart, the watchlist, the composer).
import { useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useStore } from './store'
import { KeyHint, cn } from './ds'

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
const MOD = MAC ? '⌘' : 'Ctrl'
const ALT = MAC ? '⌥' : 'Alt'

type Item = { keys: string[][]; what: string; note?: string }
/** keys: alternatives (outer), each a chord of keys pressed together (inner). */
const GROUPS: { title: string; where: string; items: Item[] }[] = [
  { title: 'General', where: 'Anywhere', items: [
    { keys: [[MOD, 'K']], what: 'Search, commands and questions' },
    { keys: [['/']], what: 'Ask the agent', note: 'Focuses the composer' },
    { keys: [['?']], what: 'Show these shortcuts' },
    { keys: [['Esc']], what: 'Close what is open' },
  ] },
  { title: 'Layout', where: 'Terminal view', items: [
    { keys: [['[']], what: 'Show or hide the watchlist' },
    { keys: [[']']], what: 'Show or hide the agent' },
    { keys: [['\\']], what: 'Show or hide positions and orders' },
    { keys: [['Shift', 'F']], what: 'Focus mode: hide every panel' },
  ] },
  { title: 'Trading', where: 'On the chart', items: [
    { keys: [['B']], what: 'Buy: open the chart ticket' },
    { keys: [['S']], what: 'Sell: open the chart ticket' },
    { keys: [['Shift', 'B'], ['Shift', 'S']], what: 'Instant market order, no ticket', note: 'Only when Instant orders is on in chart settings' },
    { keys: [['D']], what: 'Market depth' },
  ] },
  { title: 'Chart', where: 'On the chart', items: [
    { keys: [['1'], ['5'], ['15'], ['D']], what: 'Change interval: type it, then Enter', note: '1, 3, 5, 15, 30, 60, 120, 240, D, W, M' },
    { keys: [[ALT, 'R']], what: 'Reset the view' },
    { keys: [[ALT, 'L']], what: 'Log scale' },
    { keys: [[ALT, 'P']], what: 'Percent scale' },
    { keys: [['Tab']], what: 'Next chart', note: 'In multi-chart layouts' },
    { keys: [[MOD, 'Z']], what: 'Undo' },
    { keys: [[MOD, 'Shift', 'Z'], [MOD, 'Y']], what: 'Redo' },
  ] },
  { title: 'Drawing', where: 'On the chart', items: [
    { keys: [[ALT, 'T']], what: 'Trend line' },
    { keys: [[ALT, 'H']], what: 'Horizontal line', note: 'At the price under the cursor' },
    { keys: [[ALT, 'J']], what: 'Horizontal ray' },
    { keys: [[ALT, 'V']], what: 'Vertical line' },
    { keys: [[ALT, 'F']], what: 'Fibonacci retracement' },
    { keys: [[ALT, 'A']], what: 'Price alert', note: 'At the price under the cursor' },
    { keys: [['Delete']], what: 'Remove the selected drawing' },
  ] },
  { title: 'Watchlist', where: 'Click into the list first', items: [
    { keys: [['↑'], ['↓']], what: 'Move between stocks' },
    { keys: [['Enter']], what: 'Open the chart' },
    { keys: [['B'], ['S']], what: 'Buy or sell the highlighted stock' },
    { keys: [['D']], what: 'Its market depth' },
    { keys: [['C']], what: 'Its option chain', note: 'F&O stocks' },
    { keys: [['Delete']], what: 'Remove it from the list' },
  ] },
  { title: 'Agent', where: 'In the composer', items: [
    { keys: [['Enter']], what: 'Send' },
    { keys: [['Shift', 'Enter']], what: 'New line' },
    { keys: [['@']], what: 'Pick a symbol' },
    { keys: [['/']], what: 'Commands', note: 'At the start of a message' },
    { keys: [['↑'], ['↓'], ['Enter']], what: 'Move through and pick a suggestion' },
  ] },
]

const chord = (c: string[]) => <span className="inline-flex items-center gap-0.5">{c.map((k, i) => <KeyHint key={i} className="h-6 min-w-6 text-[11px]">{k}</KeyHint>)}</span>

export function ShortcutsSheet() {
  const open = useStore((s) => s.shortcuts); const close = () => useStore.setState({ shortcuts: false })
  const [q, setQ] = useState(''); const input = useRef<HTMLInputElement>(null)
  useEffect(() => { if (open) { setQ(''); setTimeout(() => input.current?.focus(), 0) } }, [open])
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close() } }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [open])
  const groups = useMemo(() => {
    const t = q.trim().toLowerCase(); if (!t) return GROUPS
    return GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => `${g.title} ${i.what} ${i.note ?? ''} ${i.keys.flat().join(' ')}`.toLowerCase().includes(t)) })).filter((g) => g.items.length)
  }, [q])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 px-4 pt-[8vh] animate-fade max-md:hidden" onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
      <div role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" className="flex max-h-[80vh] w-full max-w-[760px] flex-col overflow-hidden rounded-[10px] border border-line bg-raised shadow-lg animate-rise">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
          <h2 className="text-[15px] font-semibold text-fg">Keyboard shortcuts</h2>
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a shortcut" aria-label="Find a shortcut"
            className="ml-auto h-8 w-56 rounded-md border border-line bg-surface px-2.5 text-[13px] outline-none focus:border-fg-subtle" />
          <button type="button" aria-label="Close" onClick={close} className="flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg"><X size={16} strokeWidth={1.75} /></button>
        </header>
        <div className="scroll-thin min-h-0 overflow-y-auto px-4 py-3">
          {groups.length ? <div className="columns-2 gap-8 max-[640px]:columns-1">
            {groups.map((g) => <section key={g.title} className="mb-5 break-inside-avoid">
              <h3 className="flex items-baseline gap-2 pb-1.5 text-[12px] font-semibold text-fg">{g.title}<span className="font-normal text-fg-subtle">{g.where}</span></h3>
              <ul className="divide-y divide-[var(--border)]">{g.items.map((i) => (
                <li key={i.what} className="flex items-start justify-between gap-4 py-1.5">
                  <span className="min-w-0 text-[13px] text-fg">{i.what}{i.note && <span className="block text-[11px] text-fg-subtle">{i.note}</span>}</span>
                  <span className="flex shrink-0 flex-wrap items-center justify-end gap-1 text-[11px] text-fg-subtle">{i.keys.map((c, j) => <span key={j} className="inline-flex items-center gap-1">{j > 0 && <span>or</span>}{chord(c)}</span>)}</span>
                </li>))}</ul>
            </section>)}
          </div> : <p className="py-8 text-center text-[13px] text-fg-subtle">No shortcut matches “{q}”.</p>}
        </div>
        <footer className={cn('shrink-0 border-t border-line px-4 py-2 text-[11px] text-fg-subtle')}>Shortcuts don't fire while you're typing in a field. Press <KeyHint>?</KeyHint> any time to open this list.</footer>
      </div>
    </div>
  )
}
