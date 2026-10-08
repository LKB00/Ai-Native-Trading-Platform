// Shared pieces of the order tickets (watchlist quick ticket and the chart ticket): what the order costs before you
// place it, and stop/target fields you can type in rupees or as a percentage from the entry.
import { useMemo, useState } from 'react'
import { orderCost, useStore } from './store'
import { SETUP_TAGS, isSetupTag, tagLabel } from './rules'
import { Popover, cn } from './ds'
import { inr } from './ui'

const PART: Record<string, string> = { brokerage: 'Brokerage', stt: 'STT', exch: 'Exchange', gst: 'GST', stamp: 'Stamp duty', sebi: 'SEBI fee' }
const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** The limit price band the exchange (and `place`) accepts for equity: within 20% of the last price. */
export const priceBand = (ltp: number) => [+(ltp * 0.8).toFixed(2), +(ltp * 1.2).toFixed(2)] as const

/** Cost of the order as it stands. `short` is how much more you'd need; when it's positive the order would be rejected. */
export function useOrderCost(k: string, side: 'BUY' | 'SELL', qty: number, entry: number, product: string) {
  const c = orderCost(k, side, qty, entry, product)
  return { ...c, short: Math.max(0, c.needs - c.free) }
}

/**
 * One line above the button: the funds this takes against what's free, and round-trip charges with a breakup on click.
 * Turns red, with the shortfall, when the order can't be afforded.
 */
export function CostLine({ cost, className }: { cost: ReturnType<typeof useOrderCost>; className?: string }) {
  const { needs, free, charges, parts, short } = cost
  return (
    <div className={cn('text-[11px]', className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-fg-subtle" title="Funds this order takes, of the funds free to trade">
          {needs >= 0 ? <>Needs <span className={cn('num font-medium', short ? 'text-down' : 'text-fg')}>{inr(needs)}</span></>
            : <>Frees <span className="num font-medium text-fg">{inr(-needs)}</span></>}
          <span className="num"> of {inr(free)} free</span>
        </span>
        <Popover label="Charges breakup" align="end" side="top" trigger={({ toggle, triggerProps }) => (
          <button type="button" onClick={toggle} {...triggerProps} className="shrink-0 whitespace-nowrap text-fg-subtle underline decoration-dotted underline-offset-2 hover:text-fg">
            Charges <span className="num">{inr(charges)}</span>
          </button>)}>
          <div className="w-[220px] p-3 text-[12px]">
            <p className="mb-2 text-fg-muted">Round trip at this price: entry plus exit.</p>
            {parts.filter(([, v]) => v >= 0.005).map(([p, v]) => (
              <div key={p} className="flex justify-between py-0.5"><span className="text-fg-subtle">{PART[p]}</span><span className="num">{fmt(v)}</span></div>))}
            <div className="mt-1.5 flex justify-between border-t border-line pt-1.5 font-medium"><span>Total</span><span className="num">{fmt(charges)}</span></div>
          </div>
        </Popover>
      </div>
      {short > 0 && <p className="mt-1 text-down">Short by <span className="num">{inr(short)}</span>. Lower the quantity or free up funds.</p>}
    </div>
  )
}

/**
 * Stop or target. Type a price, or switch the unit to % and type the distance from the entry; the other unit shows
 * alongside so you always see both. The parent keeps the price; the % is only a way of entering it.
 */
export function LevelInput({ label, kind, side, entry, value, onChange, className }: {
  label: string; kind: 'sl' | 'tgt'; side: 'BUY' | 'SELL'; entry: number; value: number | null; onChange: (p: number | null) => void; className?: string
}) {
  const [unit, setUnit] = useState<'₹' | '%'>('₹')
  // Stops sit against the trade, targets with it.
  const sign = (side === 'BUY' ? 1 : -1) * (kind === 'tgt' ? 1 : -1)
  const pctOf = (p: number) => +((Math.abs(p - entry) / entry) * 100).toFixed(2)
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value == null ? '' : unit === '₹' ? String(value) : String(pctOf(value)))
  const set = (raw: string) => {
    setDraft(raw)
    if (raw.trim() === '') return onChange(null)
    const n = +raw; if (!isFinite(n) || n <= 0) return
    onChange(unit === '₹' ? n : +(entry * (1 + (sign * n) / 100)).toFixed(2))
  }
  const other = value == null ? '' : unit === '₹' ? `${sign > 0 ? '+' : '−'}${pctOf(value).toFixed(2)}%` : fmt(value)
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="flex h-8 w-28 items-center rounded-md border border-line bg-surface focus-within:border-fg-subtle">
        <button type="button" onClick={() => { setDraft(null); setUnit(unit === '₹' ? '%' : '₹') }} aria-label={`${label} in ${unit === '₹' ? 'rupees' : 'percent'}. Switch to ${unit === '₹' ? 'percent' : 'rupees'}`}
          title={`Switch to ${unit === '₹' ? '% from entry' : 'price'}`}
          className="flex h-full w-7 shrink-0 items-center justify-center border-r border-line text-[11px] text-fg-muted hover:bg-hover hover:text-fg">{unit}</button>
        <input aria-label={`${label}${unit === '%' ? ' (% from entry)' : ' price'}`} type="number" step={unit === '₹' ? 0.05 : 0.1} min={0} placeholder="—"
          value={shown} onChange={(e) => set(e.target.value)} onBlur={() => setDraft(null)}
          className="num h-full min-w-0 flex-1 bg-transparent px-2 text-right text-[12px] outline-none" />
      </span>
      <span className="num text-[11px] text-fg-subtle">{other}</span>
    </span>
  )
}

/** Setups to offer: the ones you use most, then the standard list. */
export function useSetupOptions() {
  const trades = useStore((s) => s.trades)
  return useMemo(() => {
    const n = new Map<string, number>()
    for (const t of trades) if (isSetupTag(t.tag)) n.set(t.tag!, (n.get(t.tag!) ?? 0) + 1)
    const mine = [...n.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    return [...new Set([...mine, ...SETUP_TAGS])].slice(0, 10)
  }, [trades])
}

/**
 * Why you're taking the trade, in one word. Optional, one click, and remembered on the position and in the journal,
 * so "which setups make me money" has an answer. Paused setups show as such and can't be picked.
 */
export function TagPicker({ value, onChange, className }: { value?: string; onChange: (t: string | undefined) => void; className?: string }) {
  const opts = useSetupOptions(); const paused = useStore((s) => s.rules.pausedSetups) ?? []
  const [draft, setDraft] = useState('')
  return (
    <Popover label="Reason" align="start" side="top" className={className} trigger={({ toggle, triggerProps }) => (
      <button type="button" onClick={toggle} {...triggerProps} className={cn('inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[12px] transition-colors hover:border-line-strong',
        value ? 'border-line bg-sunken text-fg' : 'border-dashed border-line text-fg-subtle hover:text-fg')}>
        {value ? <><span className="text-fg-subtle">Reason</span>{tagLabel(value)}</> : '+ Reason'}
      </button>)}>
      {({ close }) => <div className="w-56 p-1.5 text-[12px]">
        <p className="px-2 pb-1.5 pt-1 text-[11px] text-fg-subtle">Why this trade? The journal groups results by it.</p>
        <div role="listbox" aria-label="Reason" className="flex flex-wrap gap-1 px-1">
          {opts.map((t) => { const off = paused.includes(t)
            return <button key={t} type="button" role="option" aria-selected={value === t} disabled={off} title={off ? `${tagLabel(t)} trades are paused by your rule` : undefined}
              onClick={() => { onChange(value === t ? undefined : t); close() }}
              className={cn('h-7 rounded-md border px-2', value === t ? 'border-fg bg-sunken text-fg' : 'border-line text-fg-muted hover:border-line-strong hover:text-fg', off && 'cursor-not-allowed line-through opacity-50')}>{tagLabel(t)}</button> })}
        </div>
        <form className="mt-2 flex gap-1 px-1 pb-1" onSubmit={(e) => { e.preventDefault(); const t = draft.trim().toLowerCase(); if (t && isSetupTag(t)) { onChange(t); setDraft(''); close() } }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 24))} placeholder="Your own…" aria-label="New setup tag" className="h-7 min-w-0 flex-1 rounded-md border border-line bg-surface px-2 outline-none focus:border-fg-subtle" />
          {value && <button type="button" onClick={() => { onChange(undefined); close() }} className="h-7 rounded-md px-2 text-fg-subtle hover:bg-hover hover:text-fg">Clear</button>}
        </form>
      </div>}
    </Popover>
  )
}
