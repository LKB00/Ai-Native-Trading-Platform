// Live market pieces for the cockpit: prices that flash on every tick, intraday sparklines, and the ticker tape.
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../ds'
import { useStore } from '../store'
import { INSTS, bySym, history, barStart, simNow, marketOpenNow, fmtIST } from '../market'
import { Dir } from '../ui'

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

/** A price that briefly tints green or red when it ticks. */
export function FlashPrice({ v, className, digits = 2 }: { v: number; className?: string; digits?: number }) {
  const f = useFlash(+v.toFixed(digits))
  return <span className={cn('num rounded px-1 transition-colors duration-500', f === 'up' ? 'bg-success-soft text-success-fg duration-0' : f === 'down' ? 'bg-danger-soft text-danger-fg duration-0' : '', className)}>
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

function TapeItem({ sym }: { sym: string }) {
  const q = useStore((s) => s.prices[sym]); const setSym = useStore((s) => s.setSym)
  const chg = (q.ltp / q.prev - 1) * 100; const up = chg >= 0
  return (
    <button type="button" onClick={() => { setSym(sym); useStore.getState().setView('chart') }} className="flex shrink-0 items-baseline gap-1.5 px-3 text-[12px] hover:text-fg">
      <span className="font-semibold text-fg">{sym}</span><FlashPrice v={q.ltp} className="text-fg" />
      <span className={cn('num', up ? 'text-up' : 'text-down')}><Dir up={up} /> {up ? '+' : '−'}{Math.abs(chg).toFixed(2)}%</span>
    </button>
  )
}

/** The moving tape under the top bar: indices, your watchlist and the day's biggest movers. Pauses on hover. */
export function TickerTape() {
  const watch = useStore((s) => s.watch); const prices = useStore((s) => s.prices)
  const movers = useMemo(() => INSTS.filter((i) => i.seg === 'EQ' && !watch.includes(i.sym)).map((i) => ({ s: i.sym, c: Math.abs(prices[i.sym].ltp / prices[i.sym].prev - 1) })).sort((a, b) => b.c - a.c).slice(0, 6).map((x) => x.s),
    [Math.floor(Date.now() / 30000), watch.join()]) // eslint-disable-line react-hooks/exhaustive-deps
  const syms = [...new Set(['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', ...watch, ...movers])]
  return (
    <div className="col-span-full flex h-[30px] min-w-0 items-center border-b border-line bg-surface" aria-label="Market ticker">
      <div className="flex h-full shrink-0 items-center border-r border-line px-3"><MarketClock /></div>
      <div className="group relative min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
        <div className="flex w-max animate-[tape_90s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
          {[0, 1].map((k) => <div key={k} className="flex" aria-hidden={k === 1 || undefined}>{syms.map((s) => <TapeItem key={s + k} sym={s} />)}</div>)}
        </div>
      </div>
    </div>
  )
}
