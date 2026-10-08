// The desk rail: the agent view's live column. It answers "where do I stand?" without the terminal: today's result,
// money free, open positions and how close each is to its stop, everything the agent is watching for you (with how
// much it may do on its own), and the watchlist. Every row hands off to the agent instead of opening a screen.
import { useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Bell, Shield, X, Clock, Pause, Play, Zap, ChevronDown } from 'lucide-react'
import { useStore } from '../store'
import { bySym, labelOf, parseKey } from '../market'
import { progress } from '../watch'
import { useEntryGate, GateIcon } from '../gate'
import { ruleText, type RuleId } from '../rules'
import { cn } from '../ds'
import { say } from '../chat/cards'

const inr = (n: number, sign = false) => `${n < 0 ? '−' : sign && n > 0 ? '+' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
const px = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const tone = (n: number) => (n > 0 ? 'text-up' : n < 0 ? 'text-down' : 'text-fg-muted')

/** A rail section: a quiet label with its count, then tight rows. */
function Section({ label, count, children, empty, action }: { label: string; count?: number; children?: ReactNode; empty?: string; action?: ReactNode }) {
  return (
    <section className="border-b border-line px-3 py-3">
      <h3 className="mb-1.5 flex items-center px-1 text-[11px] font-medium text-fg-subtle">{label}{count != null && <span className="ml-1.5 tabular-nums">{count}</span>}{action}</h3>
      {count === 0 && empty ? <p className="px-1 text-[12px] leading-5 text-fg-subtle">{empty}</p> : children}
    </section>
  )
}
const row = 'group flex h-8 w-full items-center gap-2 rounded-md px-1 text-left text-[12px] transition-colors hover:bg-hover'

/**
 * How far the agent may go on its own for each thing it watches, said plainly. Notify: it tells you. Auto: it places
 * the order itself when the condition is met (still inside your limits and rules). Placed: an order already resting
 * at the exchange. Rule: a rule checked on every entry. Paused: kept, but not watched.
 */
type L = 'Notify' | 'Auto' | 'Placed' | 'Rule' | 'Paused'
const Level = ({ l }: { l: L }) => (
  <span className={cn('shrink-0 rounded px-1.5 py-px text-[10px] font-medium', l === 'Auto' ? 'bg-attention-soft text-[var(--attention-fg)]' : l === 'Rule' || l === 'Placed' ? 'bg-sunken text-fg-muted' : 'bg-sunken text-fg-subtle')}>{l}</span>
)
const hoverBtn = 'hidden size-6 shrink-0 items-center justify-center rounded text-fg-subtle hover:bg-surface hover:text-fg group-hover:inline-flex'

/** One watch: the condition on top, what happens below, then its level; pause and stop on hover. */
function WatchRow({ icon, title, sub, level, onPause, onStop, paused }: { icon: ReactNode; title: ReactNode; sub: ReactNode; level: L; onPause?: () => void; onStop: () => void; paused?: boolean }) {
  return (
    <div className={cn('group flex min-h-11 items-center gap-2 rounded-md px-1 py-1 text-[12px] transition-colors hover:bg-hover', paused && 'opacity-60')}>
      <span className="shrink-0 text-fg-subtle">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block truncate text-fg">{title}</span><span className="block truncate text-[11px] text-fg-subtle">{sub}</span></span>
      <span className="flex shrink-0 items-center gap-0.5">
        <span className="group-hover:hidden"><Level l={paused ? 'Paused' : level} /></span>
        {onPause && <button type="button" aria-label={paused ? 'Resume' : 'Pause'} title={paused ? 'Resume' : 'Pause'} onClick={onPause} className={hoverBtn}>{paused ? <Play size={12} /> : <Pause size={12} />}</button>}
        <button type="button" aria-label="Stop" title="Stop and remove" onClick={onStop} className={hoverBtn}><X size={13} /></button>
      </span>
    </div>
  )
}

export function DeskRail() {
  const pnl = useStore(useShallow((s) => s.pnl())); const gate = useEntryGate()
  const open = useStore(useShallow((s) => Object.values(s.positions).filter((p) => p.qty)))
  const brackets = useStore((s) => s.brackets); const ltp = useStore((s) => s.ltp); const prices = useStore((s) => s.prices)
  const triggers = useStore(useShallow((s) => s.triggers.filter((t) => !t.done)))
  const working = useStore(useShallow((s) => s.orders.filter((o) => o.status === 'OPEN' || o.status === 'TRIGGER_PENDING')))
  const rules = useStore((s) => s.rules)
  // Indices sit in the market strip above, so the list is only your names, the same as the terminal watchlist.
  const watch = useStore(useShallow((s) => s.watch.filter((w) => bySym(w)?.seg !== 'IDX')))
  const ruleIds = Object.keys(rules) as RuleId[]
  const watching = triggers.length + working.length + ruleIds.length
  return (
    <aside aria-label="Your account" className="scroll-thin flex min-h-0 flex-col overflow-y-auto border-r border-line bg-surface">
      {/* Today: the one number that matters most, then what's free, then whether you can trade. */}
      <section className="border-b border-line px-4 py-4">
        <p className="text-[11px] font-medium text-fg-subtle">Today, after charges</p>
        <p className={cn('num mt-1 text-[22px] font-semibold leading-7 tracking-[-0.01em]', tone(pnl.net))}>{inr(pnl.net, true)}</p>
        <dl className="mt-2.5 space-y-1 text-[12px]">
          <div className="flex justify-between"><dt className="text-fg-subtle">Free to trade</dt><dd className="num text-fg">{inr(pnl.avail)}</dd></div>
          <div className="flex justify-between"><dt className="text-fg-subtle">Open P&L</dt><dd className={cn('num', tone(pnl.unreal))}>{inr(pnl.unreal, true)}</dd></div>
        </dl>
        {gate && <button type="button" onClick={() => say('review today')} title={`${gate.why} Exits still work.`} className="mt-3 flex h-8 w-full items-center gap-1.5 rounded-md bg-sunken px-2 text-left text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg"><GateIcon g={gate} size={12} />{gate.short}<span className="ml-auto font-normal text-fg-subtle">Review today →</span></button>}
      </section>

      <Section label="Open" count={open.length} empty="No open positions.">
        {open.map((p) => {
          const l = ltp(p.key); const pl = (l - p.avg) * p.qty; const br = brackets[p.key]
          const { toStop, toTarget } = progress(p.avg, l, p.qty > 0, br?.sl, br?.tgt)
          const near = toStop != null && toStop >= 0.7, nearT = toTarget != null && toTarget >= 0.75
          const sub = nearT ? `${(Math.abs(br!.tgt! - l) / l * 100).toFixed(1)}% to target` : br?.sl != null ? `${(Math.abs(l - br.sl) / l * 100).toFixed(1)}% to stop` : parseKey(p.key).strike && p.tag ? 'hedged' : 'no stop'
          return (
            <button key={p.key} type="button" onClick={() => say(`manage ${parseKey(p.key).und.toLowerCase()}`)} className={cn(row, 'h-11')}>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-fg">{labelOf(p.key)}</span>
                <span className={cn('num block text-[11px]', near || sub === 'no stop' ? 'text-[var(--attention-fg)]' : nearT ? 'text-up' : 'text-fg-subtle')}>{p.qty > 0 ? 'L' : 'S'} {Math.abs(p.qty)} · {sub}</span>
              </span>
              <span className={cn('num shrink-0 font-medium', tone(pl))}>{inr(pl, true)}</span>
            </button>)
        })}
      </Section>

      {/* Everything the agent is doing for you, with how far it may go on its own. */}
      <Section label="Watching" count={watching} empty="Nothing yet. Try “alert me if sbin crosses 900”, “if nifty falls 2% buy 1 lot nifty atm ce”, or “always use a stop”.">
        {triggers.map((t) => {
          const dist = (t.price / prices[t.sym].ltp - 1) * 100
          return <WatchRow key={`t${t.id}`} paused={t.paused} icon={t.then ? <Zap size={13} strokeWidth={1.75} /> : <Bell size={13} strokeWidth={1.75} />}
            title={<>{t.sym} {t.note ?? <span className="num">{t.dir === 'above' ? 'above' : 'below'} {px(t.price)}</span>}</>}
            sub={<span className="num">{t.then ? `then ${t.then.side.toLowerCase()} ${t.then.qty}${t.then.strike ? ` lot${t.then.qty > 1 ? 's' : ''} ${t.then.strike} ${t.then.ot}` : ''}` : 'tell me'} · {Math.abs(dist).toFixed(1)}% away</span>}
            level={t.then ? 'Auto' : 'Notify'} onPause={() => useStore.getState().pauseTrigger(t.id, !t.paused)} onStop={() => useStore.getState().removeTrigger(t.id)} />
        })}
        {working.map((o) => (
          <WatchRow key={`o${o.id}`} icon={<Clock size={13} strokeWidth={1.75} />} title={<span className="num">{o.side === 'BUY' ? 'Buy' : 'Sell'} {o.qty} {labelOf(o.key)}</span>}
            sub={<span className="num">{o.otype === 'LIMIT' ? 'limit' : 'stop'} {px(o.otype === 'LIMIT' ? o.price : o.trigger ?? o.price)}</span>} level="Placed" onStop={() => useStore.getState().cancel(o.id)} />))}
        {ruleIds.map((id) => (
          <WatchRow key={id} icon={<Shield size={13} strokeWidth={1.75} />} title={ruleText(id, rules)} sub="checked on every entry" level="Rule" onStop={() => useStore.getState().setRules({ [id]: undefined })} />))}
      </Section>

      <Section label="Watchlist" count={watch.length} action={<button type="button" onClick={() => say('trade ideas for today')} className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-medium text-fg-muted transition-colors hover:bg-hover hover:text-fg">Trade ideas →</button>}>
        {watch.map((w) => { const q = prices[w]; if (!q) return null; const c = (q.ltp / q.prev - 1) * 100; return (
          <button key={w} type="button" onClick={() => say(w.toLowerCase())} className={row}>
            <span className="min-w-0 flex-1 truncate font-medium text-fg">{w}</span>
            <span className="num text-fg">{px(q.ltp)}</span>
            <span className={cn('num w-14 text-right text-[11px]', tone(c))}>{c >= 0 ? '+' : '−'}{Math.abs(c).toFixed(2)}%</span>
          </button>) })}
      </Section>
    </aside>
  )
}

/**
 * Narrow screens: the desk as one line (today, open, watching, lock) above the agent log. Tap it and the full rail
 * drops down; tap again to fold it.
 */
export function DeskBar() {
  const [open, setOpen] = useState(false)
  const net = useStore((s) => s.pnl().net); const gate = useEntryGate()
  const nOpen = useStore((s) => Object.values(s.positions).filter((p) => p.qty).length)
  const nWatch = useStore((s) => s.triggers.filter((t) => !t.done).length + s.orders.filter((o) => o.status === 'OPEN' || o.status === 'TRIGGER_PENDING').length + Object.keys(s.rules).length)
  return (
    <div className="relative z-20 shrink-0 border-b border-line bg-surface">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex h-10 w-full items-center gap-3 px-4 text-left text-[12px]">
        <span className="text-fg-subtle">Today</span><span className={cn('num font-semibold', tone(net))}>{inr(net, true)}</span>
        <span className="text-fg-subtle">· {nOpen} open · {nWatch} watching</span>
        {gate && <span className="flex items-center gap-1 text-fg-muted"><GateIcon g={gate} size={12} />{gate.short}</span>}
        <ChevronDown size={14} strokeWidth={1.75} className={cn('ml-auto text-fg-subtle transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="absolute inset-x-0 top-full flex max-h-[70vh] border-b border-line shadow-lg [&>aside]:flex-1 [&>aside]:border-r-0">{<DeskRail />}</div>}
    </div>
  )
}
