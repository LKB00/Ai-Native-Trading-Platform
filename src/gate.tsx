// Locked mode. The store rejects new entries while the day is locked, in a cool-off, or past the trade limit; this
// module tells the interface the same thing up front, so no surface offers a Buy that is going to fail. Exits are
// never gated: closing, stops and targets keep working in every state.
import { useEffect, useState } from 'react'
import { Clock, Lock, Timer } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { useStore } from './store'
import { cn } from './ds'
import type { Action } from './actions'
import { secOfDay } from './market'
import { hhmm } from './rules'

export type Gate = {
  kind: 'locked' | 'cooloff' | 'trades' | 'rule'
  /** Short state for buttons and badges: "Locked today", "Paused · 12 min". */
  short: string
  /** One sentence on why, in the trader's terms. */
  why: string
  /** When entries come back, for a countdown. Undefined means the next session. */
  until?: number
}

type S = ReturnType<typeof useStore.getState>

const tradesToday = (s: Pick<S, 'orders'>) => s.orders.filter((o) => o.status === 'COMPLETE' && new Date(o.ts).toDateString() === new Date().toDateString() && o.via !== 'bracket' && o.via !== 'risk').length

/** Why new positions can't be opened right now, or null when they can. Same order of checks as the store's. */
export function entryGate(s: Pick<S, 'risk' | 'orders' | 'rules'>, now = Date.now()): Gate | null {
  const r = s.risk
  if (r.killed) return { kind: 'locked', short: 'Locked today', why: (r.reason ?? 'The kill switch is on').replace(/[.!]$/, '') + '.' }
  if (r.cooloffUntil && now < r.cooloffUntil) {
    const min = Math.ceil((r.cooloffUntil - now) / 60000)
    return { kind: 'cooloff', short: `Paused · ${min} min`, why: `${r.cooloffAfter} losses in a row, so new entries pause for ${min} more minute${min === 1 ? '' : 's'}.`, until: r.cooloffUntil }
  }
  if (tradesToday(s) >= r.maxTrades) return { kind: 'trades', short: 'Trade limit reached', why: `You've used all ${r.maxTrades} trades for today.` }
  const after = s.rules?.noEntryAfter
  if (after && secOfDay() >= after) return { kind: 'rule', short: `No entries after ${hhmm(after)}`, why: `Your rule: no new entries after ${hhmm(after)}. You can turn it off in your rules.` }
  return null
}

/** The gate, kept current: re-checks when risk or orders change, and every 15 s while a cool-off counts down. */
export function useEntryGate(): Gate | null {
  const s = useStore(useShallow((st) => ({ risk: st.risk, orders: st.orders, rules: st.rules })))
  const [now, setNow] = useState(Date.now())
  // Time-based states need a clock: the cool-off counts down, and a "no entries after" rule switches on mid-session.
  const timed = (!!s.risk.cooloffUntil && now < s.risk.cooloffUntil) || !!s.rules.noEntryAfter
  useEffect(() => { if (!timed) return; const t = setInterval(() => setNow(Date.now()), 15000); return () => clearInterval(t) }, [timed])
  return entryGate(s, now)
}

/** Does this action open or add to a position? Exits (an order that only reduces what you hold) are not entries. */
export function isEntry(a: Action, s: S = useStore.getState()): boolean {
  if (a.t === 'legs' || a.t === 'sip' || (a.t === 'trigger' && !!a.then)) return true
  if (a.t !== 'order') return false
  const { key, qty } = s.resolveOrder(a)
  return opensPosition(key, a.side, qty, a.product, s)
}

/** The store's own test for an entry: anything that doesn't only reduce an open position or a holding. */
export function opensPosition(key: string, side: 'BUY' | 'SELL', qty: number, product?: string, s: S = useStore.getState()): boolean {
  const pos = s.positions[key]
  const reduces = !!pos && ((pos.qty > 0 && side === 'SELL') || (pos.qty < 0 && side === 'BUY')) && qty <= Math.abs(pos.qty)
  const holding = !key.includes(' ') && product === 'CNC' && side === 'SELL' && s.holdings.some((h) => h.sym === key && h.qty >= qty)
  return !reduces && !holding
}

export const GateIcon = ({ g, size = 13 }: { g: Gate; size?: number }) => g.kind === 'cooloff' ? <Timer size={size} strokeWidth={1.75} aria-hidden /> : g.kind === 'rule' ? <Clock size={size} strokeWidth={1.75} aria-hidden /> : <Lock size={size} strokeWidth={1.75} aria-hidden />

/**
 * Stands where Buy and Sell would be. Calm, not an error: it says the state, and that exits still work.
 * `onReview` adds the way forward (a debrief in chat) where there's room for it.
 */
export function GatePill({ g, className, onReview }: { g: Gate; className?: string; onReview?: () => void }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)} title={`${g.why} Exits still work.`}>
      <span className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line bg-sunken px-3.5 text-[12px] font-medium text-fg-muted"><GateIcon g={g} />{g.short}</span>
      <span className="truncate text-[11px] text-fg-subtle max-[480px]:hidden">Exits still work</span>
      {onReview && <button type="button" onClick={onReview} className="inline-flex h-8 shrink-0 items-center rounded-full border border-line-strong bg-sunken px-3 text-[12px] font-medium text-fg shadow-xs transition-colors hover:bg-hover">Review today</button>}
    </span>
  )
}

/** A one-line notice for order tickets: why the submit button is off. */
export function GateNote({ g, className }: { g: Gate; className?: string }) {
  return <p className={cn('flex items-start gap-1.5 text-[12px] leading-5 text-fg-muted', className)}><span className="mt-[3px] shrink-0"><GateIcon g={g} size={12} /></span><span><b className="font-medium text-fg">{g.short}.</b> {g.why} Exits still work.</span></p>
}

/** Drafts that are actually waiting on you. A draft on hold behind the gate isn't, so it doesn't nag in badges. */
export const actionablePending = (s: S) => { const g = entryGate(s); return s.msgs.filter((m) => m.state === 'pending' && !(g && m.pending?.some((a) => isEntry(a, s)))).length }
export const usePendingCount = () => useStore(actionablePending)
