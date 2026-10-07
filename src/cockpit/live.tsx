// Live market pieces for the cockpit: prices that flash on every tick, intraday sparklines, and the ticker tape.
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../ds'
import { useStore } from '../store'
import { INSTS, bySym, history, barStart, simNow, marketOpenNow, fmtIST } from '../market'

/** 'up' or 'down' for a moment after the value changes, so a tick is visible without reading digits. */
export function useFlash(v: number): 'up' | 'down' | null {
  const prev = useRef(v); const [f, setF] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    if (v === prev.current) return
    setF(v > prev.current ? 'up' : 'down'); prev.current = v
    const t = setTimeout(() => setF(null), 650); return () => clearTimeout(t)
  }, [v])
  return f
}

/**
 * A price whose digits briefly turn green or red when it ticks. Only the text changes colour: filled flashes on every
 * tick of every row turn a calm list into a strobe.
 */
export function FlashPrice({ v, className, digits = 2 }: { v: number; className?: string; digits?: number }) {
  const f = useFlash(+v.toFixed(digits))
  return <span className={cn('num transition-colors duration-700', f === 'up' ? 'text-up duration-0' : f === 'down' ? 'text-down duration-0' : '', className)}>
    {v.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}</span>
}

/** Today's 5-minute closes for a symbol plus the live price: the shape of the session so far. */
function useIntraday(sym: string) {
  const ltp = useStore((s) => s.prices[sym]?.ltp ?? 0)
  const bucket = barStart('5m', simNow())
  const base = useMemo(() => { const inst = bySym(sym); return inst ? history(inst, '5m', 76, useStore.getState().prices[sym].ltp).map((c) => c.close) : [] }, [sym, bucket]) // eslint-disable-line react-hooks/exhaustive-deps
  return base.length ? [...base.slice(0, -1), ltp] : []
}

/** Intraday sparkline, coloured by the day's direction against the previous close (dashed). */
export function Spark({ sym, w = 56, h = 20 }: { sym: string; w?: number; h?: number }) {
  const pts = useIntraday(sym); const prev = useStore((s) => s.prices[sym]?.prev ?? 0)
  if (pts.length < 2) return null
  const lo = Math.min(...pts, prev), hi = Math.max(...pts, prev); const y = (v: number) => h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)
  const d = pts.map((v, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const up = pts[pts.length - 1] >= prev
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden className="shrink-0 overflow-visible">
      <line x1="0" x2={w} y1={y(prev)} y2={y(prev)} stroke="var(--border-strong)" strokeDasharray="2 2" strokeWidth="1" />
      <path d={d} fill="none" stroke={up ? 'var(--success)' : 'var(--danger)'} strokeWidth="1.25" strokeLinejoin="round" />
    </svg>
  )
}

/** Market clock and session state, IST. */
export function MarketClock() {
  const [, tick] = useState(0); useEffect(() => { const id = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(id) }, [])
  const open = marketOpenNow()
  return (
    <span className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[11px] text-fg-muted">
      <span className={cn('size-1.5 rounded-full', open ? 'animate-pulse bg-success' : 'bg-attention')} aria-hidden />
      <span className="font-medium text-fg">{open ? 'Market open' : 'Market closed'}</span>
      <span className="num text-fg-subtle">{fmtIST(Date.now() / 1000, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} IST</span>
      {!open && <span className="text-fg-subtle">· replaying the last session</span>}
    </span>
  )
}

/** One index in the market strip: name, price, change. Click to chart it. */
function StripItem({ sym, label }: { sym: string; label?: string }) {
  const q = useStore((s) => s.prices[sym]); const setSym = useStore((s) => s.setSym); const cur = useStore((s) => s.sym === sym)
  const chg = (q.ltp / q.prev - 1) * 100; const up = chg >= 0
  return (
    <button type="button" onClick={() => { setSym(sym); useStore.getState().setView('chart') }} aria-current={cur || undefined}
      className={cn('flex h-full shrink-0 items-center gap-2 border-r border-line px-3 text-[12px] transition-colors hover:bg-hover', cur && 'bg-sunken')}>
      <span className="font-medium text-fg-muted">{label ?? sym}</span><FlashPrice v={q.ltp} className="text-fg" />
      <span className={cn('num', up ? 'text-up' : 'text-down')}>{up ? '+' : '−'}{Math.abs(chg).toFixed(2)}%</span>
    </button>
  )
}

/**
 * The market strip under the top bar: session state, the four indices in fixed places, and breadth. It used to be a
 * scrolling tape; a strip that holds still can be read at a glance, and only the numbers move.
 */
export function TickerTape() {
  const prices = useStore((s) => s.prices)
  const eq = INSTS.filter((i) => i.seg === 'EQ'); const adv = eq.filter((i) => prices[i.sym].ltp >= prices[i.sym].prev).length
  return (
    <div className="col-span-full flex h-[30px] min-w-0 items-center overflow-hidden border-b border-line bg-surface" aria-label="Market">
      <div className="flex h-full shrink-0 items-center border-r border-line px-3"><MarketClock /></div>
      {['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY'].map((s) => <StripItem key={s} sym={s} />)}
      <div className="ml-auto flex h-full shrink-0 items-center gap-2 border-l border-line px-3 text-[12px] max-xl:hidden" title={`${adv} of ${eq.length} stocks are up today`}>
        <span className="text-fg-muted">Breadth</span>
        <span className="num text-up">{adv}</span><span className="relative h-1 w-14 overflow-hidden rounded-full bg-danger/70" aria-hidden><span className="absolute inset-y-0 left-0 bg-success" style={{ width: `${adv / eq.length * 100}%` }} /></span><span className="num text-down">{eq.length - adv}</span>
      </div>
    </div>
  )
}
