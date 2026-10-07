// Shared pieces of the order tickets (watchlist quick ticket and the chart ticket): what the order costs before you
// place it, and stop/target fields you can type in rupees or as a percentage from the entry.
import { useState } from 'react'
import { orderCost } from './store'
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
