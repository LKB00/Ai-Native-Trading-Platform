// The phone's two main pushed screens: a stock's page and the order pad. Both follow the same rules as the rest of the
// phone layout: the decision on top (price, what the agent sees), the details below, and the action at the bottom
// edge where the thumb rests.
import { useMemo, useState, type ReactNode } from 'react'
import { Bell, Bookmark, BookmarkCheck, ChevronRight, Layers, LineChart, MessageSquare, Minus, Plus, Rows3 } from 'lucide-react'
import { useStore } from './store'
import { bySym, marketOpenNow } from './market'
import { cn } from './ds'
import { Money, inr } from './ui'
import { MiniChart, RANGES, StockRead } from './chat/cards'
import { CostLine, LevelInput, TagPicker, priceBand, useOrderCost } from './ticket'
import { useEntryGate, opensPosition, GateIcon } from './gate'
import { Screen, SlideToConfirm, TradeBar } from './mobile'

const fmt = (n: number, d = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

const Row = ({ icon, label, sub, onClick }: { icon: ReactNode; label: string; sub?: string; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-hover">
    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-fg-muted">{icon}</span>
    <span className="min-w-0 flex-1"><span className="block text-[14px] text-fg">{label}</span>{sub && <span className="block truncate text-[12px] text-fg-subtle">{sub}</span>}</span>
    <ChevronRight size={16} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />
  </button>
)

/**
 * A stock's page. Price and the agent's read first, then the chart, your stake, the day's numbers and the other
 * things you can do with it. Sell and Buy stay fixed at the bottom at the live bid and offer.
 */
export function StockScreen({ sym, onBack, onOrder, onDepth, onOptions, onFullChart, onAsk }: {
  sym: string; onBack: () => void; onOrder: (side: 'BUY' | 'SELL') => void; onDepth: () => void; onOptions: () => void; onFullChart: () => void; onAsk: (q: string) => void
}) {
  const q = useStore((s) => s.prices[sym]); const inst = bySym(sym)!
  const pos = useStore((s) => s.positions[sym]); const hold = useStore((s) => s.holdings.find((h) => h.sym === sym && h.qty > 0))
  const inWatch = useStore((s) => s.watch.includes(sym)); const ltpOf = useStore((s) => s.ltp)
  const [range, setRange] = useState(0); const r = RANGES[range]
  const chg = q.ltp - q.prev; const pct = (chg / q.prev) * 100; const up = chg >= 0; const idx = inst.seg === 'IDX'; const live = marketOpenNow()
  const lower = sym.toLowerCase()
  return (
    <Screen title={sym} sub={`${inst.name}${idx ? '' : ` · ${inst.sector}`}`} onBack={onBack}
      right={<button type="button" aria-label={inWatch ? 'Remove from watchlist' : 'Add to watchlist'} onClick={() => useStore.getState().watchOp(inWatch ? 'remove' : 'add', sym)}
        className="flex size-11 items-center justify-center rounded-full text-fg-muted active:bg-hover">{inWatch ? <BookmarkCheck size={20} strokeWidth={1.75} className="text-fg" /> : <Bookmark size={20} strokeWidth={1.75} />}</button>}
      footer={idx ? <button type="button" onClick={onOptions} className="h-12 w-full rounded-lg bg-fg text-[14px] font-semibold text-[var(--bg)]">Trade {sym} options</button>
        : <div className="-mx-4 -my-2.5 [&>div]:border-t-0"><TradeBar sym={sym} onTrade={onOrder} onDepth={onDepth} /></div>}>
      <section className="px-4 pt-4">
        <p className="num text-[30px] font-semibold leading-none tracking-[-0.02em] text-fg">{fmt(q.ltp)}</p>
        <p className={cn('num mt-1.5 text-[14px] font-medium', up ? 'text-up' : 'text-down')}>{up ? '+' : '−'}{fmt(Math.abs(chg))} ({up ? '+' : '−'}{Math.abs(pct).toFixed(2)}%) <span className="ml-1 font-sans text-[12px] font-normal text-fg-subtle">today · {live ? 'live' : 'simulated'}</span></p>
        <div className="mt-3 text-[13px]"><StockRead sym={sym} /></div>
      </section>
      <section className="mt-3">
        <div className="px-1"><MiniChart sym={sym} tf={r.tf} bars={r.bars()} session={range === 0} kind="area" controls={false} height={200} /></div>
        <div className="flex items-center gap-1 px-4 pt-1">
          <div role="radiogroup" aria-label="Chart range" className="flex flex-1 rounded-lg bg-sunken p-0.5">
            {RANGES.map((o, i) => <button key={o.l} type="button" role="radio" aria-checked={range === i} onClick={() => setRange(i)}
              className={cn('h-9 flex-1 rounded-md text-[13px] font-medium', range === i ? 'bg-surface text-fg shadow-xs' : 'text-fg-muted')}>{o.l}</button>)}
          </div>
          <button type="button" onClick={onFullChart} aria-label="Full chart with indicators and drawings" className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-fg-muted active:bg-hover"><LineChart size={16} strokeWidth={1.75} />Full</button>
        </div>
      </section>
      {(pos?.qty || hold) ? <section className="mx-4 mt-4 divide-y divide-[var(--border)] rounded-[10px] border border-line">
        {pos?.qty ? <div className="flex items-center justify-between px-3.5 py-3"><span><span className="block text-[12px] text-fg-subtle">Open position · {pos.product === 'CNC' ? 'Delivery' : pos.product === 'MIS' ? 'Intraday' : 'F&O'}</span><span className="num text-[14px] text-fg">{pos.qty > 0 ? 'Long' : 'Short'} {Math.abs(pos.qty)} at {fmt(pos.avg)}</span></span><Money v={(ltpOf(sym) - pos.avg) * pos.qty} className="text-[15px] font-semibold" /></div> : null}
        {hold ? <div className="flex items-center justify-between px-3.5 py-3"><span><span className="block text-[12px] text-fg-subtle">In holdings</span><span className="num text-[14px] text-fg">{hold.qty} at {fmt(hold.avg)}</span></span><Money v={(q.ltp - hold.avg) * hold.qty} className="text-[15px] font-semibold" /></div> : null}
      </section> : null}
      <section className="mx-4 mt-4 grid grid-cols-2 gap-x-4 gap-y-3 rounded-[10px] bg-sunken px-3.5 py-3 text-[12px]">
        {([['Open', q.open], ['Prev close', q.prev], ['Day high', q.high], ['Day low', q.low]] as const).map(([k, v]) => <div key={k}><p className="text-fg-subtle">{k}</p><p className="num mt-0.5 text-[14px] text-fg">{fmt(v)}</p></div>)}
      </section>
      <nav aria-label={`More for ${sym}`} className="mt-3 divide-y divide-[var(--border)] border-y border-line">
        <Row icon={<MessageSquare size={18} strokeWidth={1.75} />} label={`Ask the assistant about ${sym}`} sub="Trend, levels, volume and news in plain words" onClick={() => onAsk(`analyse ${lower}`)} />
        {!idx && <Row icon={<Rows3 size={18} strokeWidth={1.75} />} label="Market depth" sub="Best bids and offers, and who's heavier" onClick={onDepth} />}
        {inst.fno && <Row icon={<Layers size={18} strokeWidth={1.75} />} label="Option chain" sub="Strikes, open interest and Greeks" onClick={onOptions} />}
        <Row icon={<Bell size={18} strokeWidth={1.75} />} label="Set a price alert" sub={`Tell me when it crosses the day high (${fmt(q.high)})`} onClick={() => onAsk(`alert me if ${lower} crosses ${Math.ceil(q.high)}`)} />
      </nav>
      <p className="px-4 py-4 text-[11px] text-fg-subtle">Simulated prices for practice trading. Not investment advice.</p>
    </Screen>
  )
}

/**
 * The order pad, full screen. Side, quantity and product are the decisions, so they're large and first; price type,
 * stop, target and setup follow; cost and the slide-to-confirm sit at the bottom. Exits prefill what you hold.
 */
export function OrderPad({ sym, side: s0, px: px0, onBack, onPlaced }: { sym: string; side: 'BUY' | 'SELL'; px?: number; onBack: () => void; onPlaced: () => void }) {
  const st = useStore(); const ltp = st.prices[sym].ltp
  const exit = useMemo(() => {
    const pos = st.positions[sym]
    if (pos?.qty && (pos.qty > 0) === (s0 === 'SELL')) return { qty: Math.abs(pos.qty), prod: (pos.product === 'CNC' ? 'CNC' : 'MIS') as 'MIS' | 'CNC' }
    const h = s0 === 'SELL' ? st.holdings.find((x) => x.sym === sym && x.qty > 0) : undefined
    return h ? { qty: h.qty, prod: 'CNC' as const } : null
  }, [sym, s0]) // eslint-disable-line react-hooks/exhaustive-deps
  const [side, setSide] = useState(s0); const [qty, setQty] = useState(exit?.qty ?? 1)
  const [prod, setProd] = useState<'MIS' | 'CNC'>(exit?.prod ?? 'MIS'); const [ot, setOt] = useState<'MARKET' | 'LIMIT'>(px0 != null ? 'LIMIT' : 'MARKET')
  const [px, setPx] = useState(String(px0 ?? +ltp.toFixed(1))); const [plan, setPlan] = useState(false)
  const [sl, setSl] = useState<number | null>(null); const [tg, setTg] = useState<number | null>(null); const [tag, setTag] = useState<string>()
  const gate = useEntryGate(); const held = gate && opensPosition(sym, side, qty, prod)
  const entry = ot === 'MARKET' ? ltp : +px || ltp
  const cost = useOrderCost(sym, side, qty, entry, prod)
  const [lo, hi] = priceBand(ltp); const outBand = ot === 'LIMIT' && (entry < lo || entry > hi)
  const buy = side === 'BUY'; const closing = !!exit && s0 === side
  const risk = sl != null ? Math.abs(entry - sl) * qty : 0
  const seg = (on: boolean, tone?: string) => cn('flex h-11 flex-1 flex-col items-center justify-center rounded-md text-[14px] font-medium', on ? tone ?? 'bg-surface text-fg shadow-sm' : 'text-fg-muted')
  const block = gate && held ? <p className="flex items-center justify-center gap-1.5 py-3 text-center text-[13px] text-fg-muted"><GateIcon g={gate} />{gate.short}. {gate.why}</p>
    : cost.short > 0 ? <p className="py-3 text-center text-[13px] text-down">Short by {inr(cost.short)}. Lower the quantity.</p>
    : outBand ? <p className="py-3 text-center text-[13px] text-down">Limit price is outside today's allowed range.</p> : null
  const place = () => {
    const msg = st.place(sym, side, qty, ot, ot === 'LIMIT' ? entry : 0, prod, { sl: sl ?? undefined, tgt: tg ?? undefined, tag: closing ? undefined : tag })
    st.setToast(msg); if (!msg.startsWith('Rejected')) onPlaced()
  }
  const chg = ((ltp - st.prices[sym].prev) / st.prices[sym].prev) * 100
  return (
    <Screen title={`${buy ? 'Buy' : 'Sell'} ${sym}`} sub={<span className="num">{fmt(ltp)} <span className={chg >= 0 ? 'text-up' : 'text-down'}>{chg >= 0 ? '+' : '−'}{Math.abs(chg).toFixed(2)}%</span></span>} onBack={onBack}
      footer={<>
        <CostLine cost={cost} className="mb-2.5" />
        {block ?? <SlideToConfirm key={side + qty} tone={buy ? 'buy' : 'sell'} label={`Slide to ${buy ? 'buy' : 'sell'} ${qty} ${sym}`} onConfirm={place} />}
      </>}>
      <div className="space-y-5 px-4 py-4">
        <div role="radiogroup" aria-label="Side" className="flex gap-1 rounded-lg bg-sunken p-1">
          {(['BUY', 'SELL'] as const).map((v) => <button key={v} type="button" role="radio" aria-checked={side === v} onClick={() => setSide(v)} className={seg(side === v, v === 'BUY' ? 'bg-success text-on-success' : 'bg-danger text-on-danger')}>{v === 'BUY' ? 'Buy' : 'Sell'}</button>)}
        </div>
        <div>
          <label htmlFor="op-qty" className="text-[12px] text-fg-subtle">Quantity{closing ? ' · prefilled with what you hold' : ''}</label>
          <div className="mt-1.5 flex items-center gap-2">
            <button type="button" aria-label="Less" onClick={() => setQty((n) => Math.max(1, n - 1))} className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line active:bg-hover"><Minus size={18} /></button>
            <input id="op-qty" inputMode="numeric" pattern="[0-9]*" value={qty} onChange={(e) => setQty(Math.max(1, Math.floor(+e.target.value.replace(/\D/g, '')) || 1))}
              className="num h-12 min-w-0 flex-1 rounded-lg border border-line bg-surface text-center text-[22px] font-semibold outline-none focus:border-fg-subtle" />
            <button type="button" aria-label="More" onClick={() => setQty((n) => n + 1)} className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-line active:bg-hover"><Plus size={18} /></button>
          </div>
          <div className="mt-2 flex gap-1.5">
            {[1, 5, 10, 25].map((n) => <button key={n} type="button" onClick={() => setQty(n)} className={cn('h-9 flex-1 rounded-lg border text-[13px]', qty === n ? 'border-fg text-fg' : 'border-line text-fg-muted')}>{n}</button>)}
            {exit && <button type="button" onClick={() => setQty(exit.qty)} className={cn('h-9 flex-1 rounded-lg border text-[13px]', qty === exit.qty ? 'border-fg text-fg' : 'border-line text-fg-muted')}>All {exit.qty}</button>}
          </div>
          <p className="num mt-2 text-[12px] text-fg-subtle">≈ {inr(qty * entry)}</p>
        </div>
        <div role="radiogroup" aria-label="Product" className="flex gap-1 rounded-lg bg-sunken p-1">
          {([['MIS', 'Intraday', 'Closes by 3:20 pm'], ['CNC', 'Delivery', 'Carries overnight']] as const).map(([v, l, d]) => <button key={v} type="button" role="radio" aria-checked={prod === v} onClick={() => setProd(v)} className={seg(prod === v)}><span>{l}</span><span className="text-[11px] font-normal text-fg-subtle">{d}</span></button>)}
        </div>
        <div>
          <div role="radiogroup" aria-label="Price" className="flex gap-1 rounded-lg bg-sunken p-1">
            {([['MARKET', 'Market'], ['LIMIT', 'Limit']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={ot === v} onClick={() => setOt(v)} className={seg(ot === v)}>{l}</button>)}
          </div>
          {ot === 'LIMIT' && <div className="mt-2">
            <input aria-label="Limit price" inputMode="decimal" value={px} onChange={(e) => setPx(e.target.value.replace(/[^\d.]/g, ''))}
              className={cn('num h-12 w-full rounded-lg border bg-surface px-3 text-right text-[18px] outline-none focus:border-fg-subtle', outBand ? 'border-danger' : 'border-line')} />
            <p className={cn('num mt-1 text-[12px]', outBand ? 'text-down' : 'text-fg-subtle')}>Allowed {fmt(lo)} – {fmt(hi)}</p>
          </div>}
        </div>
        {!closing && <div>
          {!plan ? <button type="button" onClick={() => setPlan(true)} className="flex h-11 w-full items-center justify-center rounded-lg border border-dashed border-line text-[14px] text-fg-muted">+ Add stop and target</button>
            : <div className="space-y-3 rounded-[10px] border border-line p-3">
              <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-down">Stop</span><LevelInput label="Stop" kind="sl" side={side} entry={entry} value={sl} onChange={setSl} /></div>
              <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-up">Target</span><LevelInput label="Target" kind="tgt" side={side} entry={entry} value={tg} onChange={setTg} /></div>
              {risk > 0 && <p className="text-[12px] text-fg-subtle">Risk if stopped <span className="num text-down">{inr(risk)}</span>{tg != null && sl != null && Math.abs(entry - sl) > 0 && <> · reward <span className="num">1 : {(Math.abs(tg - entry) / Math.abs(entry - sl)).toFixed(1)}</span></>}</p>}
            </div>}
        </div>}
        {!closing && <TagPicker value={tag} onChange={setTag} className="[&>button]:h-10 [&>button]:px-3 [&>button]:text-[13px]" />}
      </div>
    </Screen>
  )
}
