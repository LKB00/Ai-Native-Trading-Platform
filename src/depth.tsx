// Market depth: the five best bids and offers, with a size bar on each level, the buyer/seller split across the
// whole book, and the agent's one-line read. Used in the terminal (popover from the instrument header) and in chat.
import { useStore } from './store'
import { depth, depthRead, type DepthLevel } from './market'
import { cn } from './ds'

const qtyFmt = (n: number) => n.toLocaleString('en-IN')

export function useDepth(sym: string) {
  const q = useStore((s) => s.prices[sym])
  const d = depth(sym, q.ltp, q.prev, q.avgVol)
  return { d, read: depthRead(d, q.ltp), ltp: q.ltp }
}

/** Five levels a side. Bids on the left, offers on the right, best prices meeting in the middle. */
export function DepthView({ sym, read = true, onPrice, className }: { sym: string; read?: boolean; onPrice?: (side: 'BUY' | 'SELL', price: number) => void; className?: string }) {
  const { d, read: text } = useDepth(sym)
  const sizes = [...d.bids, ...d.asks].map((l) => l.qty); const max = Math.max(...sizes)
  // Same test as the agent's read: a level at 3× the median size is a large resting order, so it gets weight.
  const med = [...sizes].sort((a, b) => a - b)[Math.floor(sizes.length / 2)]
  const buyPct = Math.round((d.totalBid / (d.totalBid + d.totalAsk)) * 100)
  const level = (l: DepthLevel, side: 'bid' | 'ask') => {
    const w = (l.qty / max) * 100; const big = l.qty >= med * 3
    const price = (
      <button type="button" disabled={!onPrice} onClick={() => onPrice?.(side === 'bid' ? 'SELL' : 'BUY', l.price)}
        title={onPrice ? `${side === 'bid' ? 'Sell' : 'Buy'} at ${l.price.toFixed(2)}` : undefined}
        className={cn('num relative tabular-nums', side === 'bid' ? 'text-up' : 'text-down', onPrice && 'hover:underline')}>{l.price.toFixed(2)}</button>
    )
    const qty = <span className={cn('num relative text-fg', big && 'font-semibold')} title={`${qtyFmt(l.orders)} orders`}>{qtyFmt(l.qty)}</span>
    return (
      <div className={cn('relative flex h-6 items-center justify-between px-2', side === 'bid' ? '' : 'flex-row-reverse')}>
        {/* Size bar grows outward from the middle, so the two sides read as a mirror. */}
        <span aria-hidden className={cn('absolute inset-y-0.5', side === 'bid' ? 'right-0 bg-[color-mix(in_srgb,var(--success)_14%,transparent)]' : 'left-0 bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]')} style={{ width: `${w}%` }} />
        {qty}{price}
      </div>
    )
  }
  return (
    <div className={cn('text-[12px]', className)}>
      {read && <p className="mb-3 border-l-2 border-[var(--lime)] pl-2.5 text-[12px] leading-[18px] text-fg-muted">{text}</p>}
      <div className="grid grid-cols-2 border-b border-line pb-1 text-[11px] text-fg-subtle">
        <div className="flex justify-between px-2"><span>Qty</span><span>Bid</span></div>
        <div className="flex justify-between px-2"><span>Offer</span><span>Qty</span></div>
      </div>
      <div className="grid grid-cols-2 divide-x divide-[var(--border)] pt-1" role="table" aria-label={`${sym} market depth`}>
        <div>{d.bids.map((l) => <div key={l.price} role="row">{level(l, 'bid')}</div>)}</div>
        <div>{d.asks.map((l) => <div key={l.price} role="row">{level(l, 'ask')}</div>)}</div>
      </div>
      <div className="mt-3">
        <div className="flex h-1 overflow-hidden rounded-full" aria-hidden>
          <span className="bg-success" style={{ width: `${buyPct}%` }} /><span className="flex-1 bg-danger" />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px]">
          <span className="text-fg-subtle">Buyers <span className="num text-fg">{buyPct}%</span> <span className="num">· {qtyFmt(d.totalBid)}</span></span>
          <span className="text-fg-subtle"><span className="num">{qtyFmt(d.totalAsk)} ·</span> <span className="num text-fg">{100 - buyPct}%</span> Sellers</span>
        </div>
      </div>
    </div>
  )
}
