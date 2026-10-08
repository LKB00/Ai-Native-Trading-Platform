// Positions and orders, up close. Row actions appear on hover so the table stays quiet; the drawer holds everything
// about one order or one position (timeline, fields, exit plan, related orders) without leaving the screen you're on.
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeftRight, LineChart, LogOut, PanelRight, Plus, Target, X } from 'lucide-react'
import { useStore, type Order } from './store'
import { labelOf, parseKey } from './market'
import { Badge, Button, cn } from './ds'
import { Money, inr, prodLabel } from './ui'
import { TagPicker } from './ticket'
import { isSetupTag, tagLabel } from './rules'
import { ask } from './ai'
import { useEntryGate, opensPosition } from './gate'

export type DrawerTarget = { kind: 'order'; id: number } | { kind: 'pos'; key: string; focus?: 'plan' } | null

const fmt = (n: number) => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const time = (ms?: number) => (ms ? new Date(ms).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : '')
const VIA: Record<string, string> = { manual: 'You, from the ticket', ai: 'The assistant, approved by you', chart: 'You, from the chart', gtt: 'A price trigger you set', bracket: 'Your exit plan (stop or target)', risk: 'Risk limits', sip: 'Your SIP' }
export const statusOf = (o: Order) => o.status === 'COMPLETE' ? 'Filled' : o.status === 'REJECTED' ? 'Rejected' : o.status === 'OPEN' ? 'Working' : o.status === 'TRIGGER_PENDING' ? 'Waiting for trigger' : 'Cancelled'
const toneOf = (o: Order) => o.status === 'COMPLETE' ? 'success' : o.status === 'REJECTED' ? 'danger' : o.status === 'CANCELLED' ? 'neutral' : 'info'
const goChart = (key: string) => { const s = useStore.getState(); s.setSym(parseKey(key).und); s.setView(parseKey(key).strike ? 'chain' : 'chart') }

/**
 * Actions for one position row, shown over the row's right end on hover or keyboard focus. Add and Convert respect
 * the entry gate; Exit always works.
 */
export function PositionActions({ k, onAdd, onOpen }: { k: string; onAdd: () => void; onOpen: (t: DrawerTarget) => void }) {
  const pos = useStore((s) => s.positions[k]); const gate = useEntryGate()
  if (!pos?.qty) return null
  const addSide = pos.qty > 0 ? 'BUY' : 'SELL'
  const canAdd = !gate || !opensPosition(k, addSide, 1, pos.product)
  const equity = !parseKey(k).strike
  const b = 'inline-flex h-6 items-center gap-1 rounded-md px-1.5 font-sans text-[11px] font-medium text-fg-muted transition-colors hover:bg-[var(--surface)] hover:text-fg disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <div role="group" aria-label={`Actions for ${labelOf(k)}`} className="absolute inset-y-0 right-0 hidden items-center gap-0.5 pl-6 pr-2 group-hover:flex group-focus-within:flex"
      style={{ backgroundImage: 'linear-gradient(to right, transparent, var(--surface-hover) 20px)' }}>
      <button type="button" className={b} disabled={!canAdd} title={canAdd ? `Add to ${labelOf(k)}` : `${gate!.short}. ${gate!.why}`} onClick={onAdd}><Plus size={12} strokeWidth={2} aria-hidden />Add</button>
      <button type="button" className={b} title="Set or change the stop and target" onClick={() => onOpen({ kind: 'pos', key: k, focus: 'plan' })}><Target size={12} strokeWidth={2} aria-hidden />Stop / target</button>
      {equity && <button type="button" className={b} title={pos.product === 'CNC' ? 'Convert to Intraday' : 'Convert to Delivery (carry overnight)'} onClick={() => { const st = useStore.getState(); st.setToast(st.convert(k)) }}><ArrowLeftRight size={12} strokeWidth={2} aria-hidden />{pos.product === 'CNC' ? 'To intraday' : 'To delivery'}</button>}
      <button type="button" className={b} aria-label={`Chart ${labelOf(k)}`} title="Open the chart" onClick={() => goChart(k)}><LineChart size={12} strokeWidth={2} aria-hidden /></button>
      <button type="button" className={b} aria-label={`Details for ${labelOf(k)}`} title="Details" onClick={() => onOpen({ kind: 'pos', key: k })}><PanelRight size={12} strokeWidth={2} aria-hidden /></button>
      <span className="mx-0.5 h-4 w-px bg-[var(--border)]" aria-hidden />
      <button type="button" className={cn(b, 'text-down hover:text-down')} title="Close at market" onClick={() => { const st = useStore.getState(); st.setToast(st.place(k, pos.qty > 0 ? 'SELL' : 'BUY', Math.abs(pos.qty), 'MARKET', 0, pos.product)) }}><LogOut size={12} strokeWidth={2} aria-hidden />Exit</button>
    </div>
  )
}

/** The right-hand drawer. Esc or the close button dismisses it; it sits below the top bar and above the panels. */
export function Drawer({ target, onClose, onOpen, onAdd }: { target: DrawerTarget; onClose: () => void; onOpen: (t: DrawerTarget) => void; onAdd: (key: string) => void }) {
  useEffect(() => {
    if (!target) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role=dialog][aria-modal=true]')) onClose() }
    addEventListener('keydown', h); return () => removeEventListener('keydown', h)
  }, [target, onClose])
  if (!target) return null
  return (
    <aside role="dialog" aria-label={target.kind === 'order' ? 'Order details' : 'Position details'}
      className="fixed bottom-0 right-0 top-[86px] z-40 flex w-[380px] max-w-full flex-col border-l border-line bg-surface shadow-lg animate-rise max-md:top-0 max-md:z-50 max-md:w-full max-md:border-l-0 max-md:pb-[env(safe-area-inset-bottom)]">
      {target.kind === 'order' ? <OrderDetail id={target.id} onClose={onClose} onOpen={onOpen} /> : <PositionDetail k={target.key} focus={target.focus} onClose={onClose} onOpen={onOpen} onAdd={onAdd} />}
    </aside>
  )
}

function Head({ title, badge, onClose }: { title: ReactNode; badge?: ReactNode; onClose: () => void }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
      <h2 className="min-w-0 truncate text-[13px] font-semibold text-fg">{title}</h2>{badge}
      <button type="button" aria-label="Close details" onClick={onClose} className="ml-auto inline-flex size-7 items-center justify-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg"><X size={14} strokeWidth={1.75} /></button>
    </header>
  )
}
const Row = ({ k, children }: { k: string; children: ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-1.5 text-[12px]"><dt className="text-fg-subtle">{k}</dt><dd className="num min-w-0 truncate text-right text-fg">{children}</dd></div>
)
const Label = ({ children }: { children: ReactNode }) => <h3 className="mb-1.5 text-[11px] font-medium text-fg-subtle">{children}</h3>

/** Other orders in the same name, newest first: one line each, click to open. */
function Related({ k, except, onOpen }: { k: string; except?: number; onOpen: (t: DrawerTarget) => void }) {
  const orders = useStore((s) => s.orders).filter((o) => o.key === k && o.id !== except).slice(0, 8)
  if (!orders.length) return null
  return (
    <section className="border-t border-line px-4 py-3">
      <Label>{except != null ? 'Other orders in this name' : 'Orders in this name'}</Label>
      <ul>{orders.map((o) => (
        <li key={o.id}><button type="button" onClick={() => onOpen({ kind: 'order', id: o.id })} className="-mx-2 flex w-[calc(100%+16px)] items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] hover:bg-hover">
          <span className="num w-16 shrink-0 text-fg-subtle">{o.time}</span>
          <span className={cn('w-8 shrink-0 font-medium', o.side === 'BUY' ? 'text-up' : 'text-down')}>{o.side === 'BUY' ? 'Buy' : 'Sell'}</span>
          <span className="num min-w-0 flex-1 truncate text-fg">{o.qty} · {o.status === 'COMPLETE' ? `₹${fmt(o.fill ?? o.price)}` : o.otype === 'MARKET' ? 'market' : `₹${fmt(o.price)}`}</span>
          <span className="shrink-0 text-[11px] text-fg-muted">{statusOf(o)}</span>
        </button></li>))}</ul>
    </section>
  )
}

function OrderDetail({ id, onClose, onOpen }: { id: number; onClose: () => void; onOpen: (t: DrawerTarget) => void }) {
  const o = useStore((s) => s.orders.find((x) => x.id === id))
  const [px, setPx] = useState('')
  useEffect(() => { if (o) setPx(String(o.status === 'TRIGGER_PENDING' ? o.trigger ?? '' : o.price)) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return <><Head title="Order" onClose={onClose} /><p className="p-4 text-[13px] text-fg-muted">This order is no longer in today's book.</p></>
  const working = o.status === 'OPEN' || o.status === 'TRIGGER_PENDING'
  const buy = o.side === 'BUY'; const label = labelOf(o.key)
  // The order's life, step by step. Only the steps that happened (or are next) are shown.
  const steps: { t: string; when?: string; tone: 'done' | 'now' | 'bad' | 'off' }[] = [
    { t: `Placed: ${o.otype === 'MARKET' ? 'market' : o.otype === 'LIMIT' ? `limit ₹${fmt(o.price)}` : `stop entry, trigger ₹${fmt(o.trigger ?? o.price)}`}`, when: o.time, tone: 'done' },
    ...(o.trigger != null ? [{ t: o.status === 'TRIGGER_PENDING' ? `Waiting for ${label} to reach ₹${fmt(o.trigger)}` : `Trigger ₹${fmt(o.trigger)} reached`, tone: o.status === 'TRIGGER_PENDING' ? 'now' as const : 'done' as const }] : []),
    o.status === 'COMPLETE' ? { t: `Filled at ₹${fmt(o.fill ?? o.price)}`, when: time(o.filledAt) || (o.otype === 'MARKET' ? o.time : ''), tone: 'done' }
      : o.status === 'REJECTED' ? { t: `Rejected: ${o.note ?? 'not accepted'}`, tone: 'bad' }
      : o.status === 'CANCELLED' ? { t: 'Cancelled', tone: 'off' }
      : o.status === 'OPEN' ? { t: buy ? `Working: fills when the price is at or below ₹${fmt(o.price)}` : `Working: fills when the price is at or above ₹${fmt(o.price)}`, tone: 'now' } : { t: 'Fills at market once triggered', tone: 'off' },
  ]
  const dot = { done: 'bg-success', now: 'bg-[var(--attention)] animate-pulse', bad: 'bg-danger', off: 'bg-[var(--border-strong)]' }
  return (
    <>
      <Head title={<><span className={buy ? 'text-up' : 'text-down'}>{buy ? 'Buy' : 'Sell'}</span> {label}</>} badge={<Badge tone={toneOf(o)}>{statusOf(o)}</Badge>} onClose={onClose} />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <section className="px-4 pb-3 pt-4">
          <p className="num text-[22px] font-semibold leading-none text-fg">{o.qty}<span className="ml-1.5 text-[13px] font-normal text-fg-muted">{parseKey(o.key).strike ? 'qty' : o.qty === 1 ? 'share' : 'shares'}{o.status === 'COMPLETE' ? ` at ₹${fmt(o.fill ?? o.price)}` : ''}</span></p>
          {o.status === 'COMPLETE' && <p className="num mt-1.5 text-[12px] text-fg-muted">Value {inr((o.fill ?? o.price) * o.qty)}</p>}
        </section>
        <section className="border-t border-line px-4 py-3">
          <Label>Timeline</Label>
          <ol className="relative space-y-2.5 pl-4 before:absolute before:bottom-1.5 before:left-[3px] before:top-1.5 before:w-px before:bg-[var(--border)]">
            {steps.map((st, i) => <li key={i} className="relative text-[12px]"><span aria-hidden className={cn('absolute -left-4 top-1.5 size-[7px] rounded-full', dot[st.tone])} />
              <span className={st.tone === 'bad' ? 'text-danger-fg' : 'text-fg'}>{st.t}</span>{st.when && <span className="num ml-2 text-fg-subtle">{st.when}</span>}</li>)}
          </ol>
        </section>
        {working && <section className="border-t border-line px-4 py-3">
          <Label>{o.status === 'TRIGGER_PENDING' ? 'Change the trigger' : 'Change the limit price'}</Label>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const v = +px; if (!(v > 0)) return; const st = useStore.getState(); st.modify(o.id, o.status === 'TRIGGER_PENDING' ? { trigger: v } : { price: v }); st.setToast(`Order modified: ₹${fmt(v)}`) }}>
            <input aria-label="New price" type="number" step={0.05} value={px} onChange={(e) => setPx(e.target.value)} className="num h-8 w-32 rounded-md border border-line bg-surface px-2.5 text-right text-[12px] outline-none focus:border-fg-subtle" />
            <Button size="sm" variant="secondary" type="submit">Modify</Button>
            <Button size="sm" variant="ghost" className="ml-auto text-down" onClick={() => { useStore.getState().cancel(o.id); useStore.getState().setToast('Order cancelled') }}>Cancel order</Button>
          </form>
        </section>}
        <section className="border-t border-line px-4 py-3">
          <Label>Details</Label>
          <dl className="divide-y divide-[var(--border)]">
            <Row k="Order ID">#{o.id}</Row>
            <Row k="Type">{o.otype === 'SL-M' ? 'At trigger price' : o.otype === 'LIMIT' ? 'Limit' : 'Market'}</Row>
            <Row k="Type">{o.product === 'CNC' ? 'Delivery' : o.product === 'MIS' ? 'Intraday' : 'Carry forward (options)'}</Row>
            {o.otype !== 'MARKET' && <Row k={o.otype === 'LIMIT' ? 'Limit price' : 'Trigger'}>₹{fmt(o.otype === 'LIMIT' ? o.price : o.trigger ?? o.price)}</Row>}
            {(o.sl || o.tgt || o.trail) ? <Row k="Stop & target"><span className="text-down">{o.sl ? `Stop ₹${fmt(o.sl)}` : ''}</span>{o.sl && o.tgt ? ' · ' : ''}<span className="text-up">{o.tgt ? `Target ₹${fmt(o.tgt)}` : ''}</span>{o.trail ? ` · trail ${o.trail}` : ''}</Row> : null}
            {o.tag && <Row k={o.via === 'bracket' || o.via === 'risk' ? 'Reason' : 'Reason'}><span className="font-sans">{tagLabel(o.tag)}</span></Row>}
            <Row k="Placed by"><span className="font-sans">{VIA[o.via] ?? o.via}</span></Row>
          </dl>
        </section>
        <Related k={o.key} except={o.id} onOpen={onOpen} />
      </div>
      <footer className="flex shrink-0 items-center gap-2 border-t border-line px-4 py-3">
        <Button size="sm" variant="secondary" onClick={() => goChart(o.key)}>Chart</Button>
        <Button size="sm" variant="ghost" onClick={() => ask(o.status === 'REJECTED' ? `why was my ${label.toLowerCase()} order rejected: ${o.note ?? ''}` : `review my ${parseKey(o.key).und.toLowerCase()} trade`)}>{o.status === 'REJECTED' ? 'Ask the assistant why' : 'Ask the assistant'}</Button>
      </footer>
    </>
  )
}

function PositionDetail({ k, focus, onClose, onOpen, onAdd }: { k: string; focus?: 'plan'; onClose: () => void; onOpen: (t: DrawerTarget) => void; onAdd: (key: string) => void }) {
  const pos = useStore((s) => s.positions[k]); const b = useStore((s) => s.brackets[k]); const ltp = useStore((s) => s.ltp(k))
  const gate = useEntryGate()
  const [sl, setSl] = useState(''), [tg, setTg] = useState(''), [tr, setTr] = useState('')
  useEffect(() => { setSl(b?.sl?.toFixed(2) ?? ''); setTg(b?.tgt?.toFixed(2) ?? ''); setTr(b?.trail?.toString() ?? '') }, [k, b?.sl, b?.tgt, b?.trail])
  useEffect(() => { if (focus === 'plan') setTimeout(() => document.querySelector<HTMLInputElement>('#plan-sl')?.focus(), 50) }, [k, focus])
  if (!pos) return <><Head title="Position" onClose={onClose} /><p className="p-4 text-[13px] text-fg-muted">This position is closed.</p></>
  const open = !!pos.qty; const unreal = open ? (ltp - pos.avg) * pos.qty : 0; const net = pos.realized + unreal - pos.charges
  const pct = open && pos.avg ? (ltp / pos.avg - 1) * 100 * Math.sign(pos.qty) : 0
  const long = pos.qty > 0; const equity = !parseKey(k).strike
  const addSide = long ? 'BUY' : 'SELL'; const canAdd = open && (!gate || !opensPosition(k, addSide, 1, pos.product))
  const field = 'num h-8 w-full rounded-md border border-line bg-surface px-2.5 text-right text-[12px] outline-none focus:border-fg-subtle'
  const risk = b?.sl ? Math.abs(ltp - b.sl) * Math.abs(pos.qty) : 0
  return (
    <>
      <Head title={labelOf(k)} badge={<Badge tone="neutral">{pos.product === 'CNC' ? 'Delivery' : pos.product === 'MIS' ? 'Intraday' : 'F&O'}</Badge>} onClose={onClose} />
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <section className="px-4 pb-3 pt-4">
          <p className="text-[11px] text-fg-subtle">{open ? 'Open P&L' : 'Realised today'}</p>
          <p className="mt-1 flex items-baseline gap-2"><Money v={open ? unreal : pos.realized} className="text-[22px] font-semibold" />{open && <span className={cn('num text-[12px]', pct >= 0 ? 'text-up' : 'text-down')}>{pct >= 0 ? '+' : '−'}{Math.abs(pct).toFixed(2)}%</span>}</p>
          {open && <p className="num mt-1.5 text-[12px] text-fg-muted">{long ? 'Long' : 'Short'} {Math.abs(pos.qty)} at ₹{fmt(pos.avg)} · now ₹{fmt(ltp)}</p>}
        </section>
        {open && <section className="border-t border-line px-4 py-3">
          <Label>Stop &amp; target</Label>
          <form className="grid grid-cols-3 gap-2" onSubmit={(e) => { e.preventDefault(); const st = useStore.getState(); st.setBracket(k, { sl: sl ? +sl : undefined, tgt: tg ? +tg : undefined, trail: tr ? +tr : undefined, peak: undefined }); st.setToast(`Stop and target saved for ${labelOf(k)}`) }}>
            <label className="text-[11px] text-down">Stop<input id="plan-sl" type="number" step={0.05} placeholder="none" value={sl} onChange={(e) => setSl(e.target.value)} className={cn(field, 'mt-1')} /></label>
            <label className="text-[11px] text-up">Target<input type="number" step={0.05} placeholder="none" value={tg} onChange={(e) => setTg(e.target.value)} className={cn(field, 'mt-1')} /></label>
            <label className="text-[11px] text-fg-subtle">Trail (pts)<input type="number" step={0.05} placeholder="off" value={tr} onChange={(e) => setTr(e.target.value)} className={cn(field, 'mt-1')} /></label>
            <p className="col-span-3 text-[11px] text-fg-subtle">{b?.sl ? <>If the stop is hit you lose about <span className="num text-down">{inr(risk)}</span> from here.</> : 'No stop yet: nothing limits the loss if it turns.'}</p>
            <div className="col-span-3"><Button size="sm" variant="secondary" type="submit">Save stop & target</Button></div>
          </form>
        </section>}
        <section className="border-t border-line px-4 py-3">
          <Label>P&amp;L today</Label>
          <dl className="divide-y divide-[var(--border)]">
            {open && <Row k="Unrealised"><Money v={unreal} /></Row>}
            <Row k="Realised"><Money v={pos.realized} /></Row>
            <Row k="Charges"><span className="text-down">−{inr(pos.charges)}</span></Row>
            <Row k="Net after charges"><Money v={net} className="font-semibold" /></Row>
          </dl>
        </section>
        <section className="border-t border-line px-4 py-3">
          <Label>Reason</Label>
          {open ? <TagPicker value={isSetupTag(pos.tag) ? pos.tag : undefined} onChange={(t) => useStore.getState().tagPosition(k, t)} /> : <p className="text-[12px] text-fg">{isSetupTag(pos.tag) ? tagLabel(pos.tag!) : 'Untagged'}</p>}
        </section>
        <Related k={k} onOpen={onOpen} />
      </div>
      {open && <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-line px-4 py-3">
        <Button size="sm" variant="secondary" disabled={!canAdd} title={canAdd ? undefined : gate ? `${gate.short}. ${gate.why}` : undefined} onClick={() => onAdd(k)}>Add</Button>
        {equity && <Button size="sm" variant="ghost" onClick={() => { const st = useStore.getState(); st.setToast(st.convert(k)) }}>{pos.product === 'CNC' ? 'Convert to intraday' : 'Convert to delivery'}</Button>}
        <Button size="sm" variant="danger" className="ml-auto" onClick={() => { const st = useStore.getState(); st.setToast(st.place(k, long ? 'SELL' : 'BUY', Math.abs(pos.qty), 'MARKET', 0, pos.product)) }}>Exit at market</Button>
      </footer>}
    </>
  )
}

/**
 * Positions and orders on a phone. The day's net on top, then one card per position with P&L as its largest number.
 * Tapping a card opens it in place with the actions you'd take from here (exit, stop and target, add, chart), the
 * way broker apps' expanded position views work; Details opens everything about it.
 */
export function PhonePositions({ onOpen, onStock, onOrder, holdings }: { onOpen: (t: DrawerTarget) => void; onStock: (sym: string) => void; onOrder: (key: string, side: 'BUY' | 'SELL') => void; holdings?: ReactNode }) {
  const s = useStore(); const [tab, setTab] = useState<'pos' | 'ord' | 'hold'>('pos'); const gate = useEntryGate()
  const [openKey, setOpenKey] = useState<string | null>(null); const [confirm, setConfirm] = useState<string | null>(null)
  const pos = Object.values(s.positions).filter((p) => p.qty || p.realized).sort((a, b) => Math.abs(b.qty) - Math.abs(a.qty))
  const open = pos.filter((p) => p.qty).length; const p = s.pnl()
  const card = 'flex w-full items-center gap-3 px-4 py-3 text-left active:bg-hover'
  const act = 'flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-[13px] font-medium text-fg active:bg-hover disabled:opacity-40'
  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      <div className="shrink-0 border-b border-line px-4 py-3">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[12px] text-fg-subtle">Net today, after charges</p><Money v={p.net} className="text-[24px] font-semibold" /></div>
          {open > 0 && <button type="button" className="h-10 rounded-lg border border-[var(--danger)] px-3 text-[13px] font-medium text-down" onClick={() => setConfirm(confirm === '*' ? null : '*')}>{open === 1 ? 'Exit 1' : `Exit all ${open}`}</button>}
        </div>
        {confirm === '*' && <div className="mt-3 flex items-center gap-2 rounded-lg bg-danger-soft p-2.5 text-[13px] text-danger-fg">
          <span className="flex-1">Close {open} position{open > 1 ? 's' : ''} at market?</span>
          <button type="button" className="h-9 rounded-md px-3 font-medium" onClick={() => setConfirm(null)}>Keep</button>
          <button type="button" className="h-9 rounded-md bg-danger px-3 font-semibold text-white dark:text-[var(--bg)]" onClick={() => { s.setToast(`Closed ${s.squareoff()} position(s)`); setConfirm(null) }}>Exit all</button>
        </div>}
        <div role="tablist" aria-label="Positions or orders" className="mt-3 flex rounded-lg bg-sunken p-1">
          {([['pos', `Positions ${open}`], ['ord', `Orders ${s.orders.length}`], ['hold', `Holdings ${s.holdings.length}`]] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={tab === v} onClick={() => setTab(v)}
            className={cn('h-9 flex-1 rounded-md text-[14px] font-medium', tab === v ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted')}>{l}</button>)}
        </div>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {tab === 'pos' && (pos.length ? <ul className="divide-y divide-[var(--border)]">{pos.map((x) => { const l = s.ltp(x.key); const pl = (l - x.avg) * x.qty + x.realized; const expanded = openKey === x.key
          const b = s.brackets[x.key]; const equity = !parseKey(x.key).strike; const canAdd = !!x.qty && (!gate || !opensPosition(x.key, x.qty > 0 ? 'BUY' : 'SELL', 1, x.product))
          return <li key={x.key}>
            <button type="button" className={card} aria-expanded={expanded} onClick={() => { setOpenKey(expanded ? null : x.key); setConfirm(null) }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold text-fg">{labelOf(x.key)}</span>
                <span className="num block text-[12px] text-fg-subtle">{prodLabel(x.product)} · {x.qty ? `${x.qty > 0 ? '+' : ''}${x.qty} at ${fmt(x.avg)}` : 'closed'}{isSetupTag(x.tag) ? ` · ${tagLabel(x.tag!)}` : ''}</span>
                {x.qty ? <span className="num block text-[12px]">{b?.sl || b?.tgt ? <><span className="text-down">{b.sl ? `SL ${fmt(b.sl)}` : ''}</span>{b.sl && b.tgt ? ' · ' : ''}<span className="text-up">{b.tgt ? `T ${fmt(b.tgt)}` : ''}</span></> : <span className="font-sans text-[var(--attention-fg)]">No stop</span>}</span> : null}
              </span>
              <span className="shrink-0 text-right"><Money v={pl} className="block text-[16px] font-semibold" /><span className="num block text-[12px] text-fg-subtle">LTP {fmt(l)}</span></span>
            </button>
            {expanded && <div className="space-y-2 px-4 pb-3">
              {x.qty ? <>
                {confirm === x.key
                  ? <div className="flex items-center gap-2 rounded-lg bg-danger-soft p-2.5 text-[13px] text-danger-fg"><span className="flex-1">Exit {Math.abs(x.qty)} at market?</span>
                      <button type="button" className="h-9 rounded-md px-3 font-medium" onClick={() => setConfirm(null)}>Keep</button>
                      <button type="button" className="h-9 rounded-md bg-danger px-3 font-semibold text-white dark:text-[var(--bg)]" onClick={() => { s.setToast(s.place(x.key, x.qty > 0 ? 'SELL' : 'BUY', Math.abs(x.qty), 'MARKET', 0, x.product)); setConfirm(null) }}>Exit</button></div>
                  : <div className="flex gap-2">
                      <button type="button" className={cn(act, 'border-[var(--danger)] text-down')} onClick={() => setConfirm(x.key)}><LogOut size={15} strokeWidth={2} />Exit</button>
                      <button type="button" className={act} onClick={() => onOpen({ kind: 'pos', key: x.key, focus: 'plan' })}><Target size={15} strokeWidth={2} />{b?.sl || b?.tgt ? 'Edit SL/T' : 'Add SL/T'}</button>
                    </div>}
                <div className="flex gap-2">
                  <button type="button" className={act} disabled={!canAdd} onClick={() => onOrder(x.key, x.qty > 0 ? 'BUY' : 'SELL')}><Plus size={15} strokeWidth={2} />Add</button>
                  {equity && <button type="button" className={act} onClick={() => onStock(parseKey(x.key).und)}><LineChart size={15} strokeWidth={2} />Chart</button>}
                  <button type="button" className={act} onClick={() => onOpen({ kind: 'pos', key: x.key })}><PanelRight size={15} strokeWidth={2} />Details</button>
                </div>
              </> : <div className="flex gap-2">
                {equity && <button type="button" className={act} onClick={() => onStock(parseKey(x.key).und)}><LineChart size={15} strokeWidth={2} />Chart</button>}
                <button type="button" className={act} onClick={() => onOpen({ kind: 'pos', key: x.key })}><PanelRight size={15} strokeWidth={2} />Details</button>
              </div>}
            </div>}
          </li> })}</ul>
          : <p className="px-4 py-10 text-center text-[14px] text-fg-subtle">No positions today. Tap a stock in your watchlist, or ask the assistant.</p>)}
        {tab === 'hold' && holdings}
        {tab === 'ord' && (s.orders.length ? <ul className="divide-y divide-[var(--border)]">{s.orders.map((o) => <li key={o.id}><button type="button" className={card} onClick={() => onOpen({ kind: 'order', id: o.id })}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-fg"><span className={o.side === 'BUY' ? 'text-up' : 'text-down'}>{o.side === 'BUY' ? 'Buy' : 'Sell'}</span> {labelOf(o.key)}</span>
              <span className="num block text-[12px] text-fg-subtle">{o.time} · {o.qty} · {o.status === 'COMPLETE' ? `₹${fmt(o.fill ?? o.price)}` : o.otype === 'MARKET' ? 'market' : `₹${fmt(o.price)}`}</span>
            </span>
            <Badge tone={toneOf(o)}>{statusOf(o)}</Badge>
          </button></li>)}</ul>
          : <p className="px-4 py-10 text-center text-[14px] text-fg-subtle">No orders today.</p>)}
      </div>
    </div>
  )
}
