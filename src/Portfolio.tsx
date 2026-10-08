import { Fragment, useMemo, useState } from 'react'
import { useStore, type Holding } from './store'
import { useEntryGate } from './gate'
import { INSTS, bySym } from './market'
import { inr, inrShort, pct, Chg, Money, Section, ViewHeader } from './ui'
import { Badge, Button, Callout, IconButton, StatTile, Switch, EmptyState, cn } from './ds'
import { XIcon } from './ds/lib/icons'

/* Sections: holdings, allocation, tax view, SIPs and trading positions all open by default (each is decision content);
   the StatTile row above them is never folded. */
const DAY = 86400000
const STCG = 0.2, LTCG = 0.125, LTCG_EXEMPT = 125000
const field = 'h-8 rounded-md border border-line bg-surface px-3 text-[12px] num outline-none focus:border-fg-subtle'
const sign = (n: number) => (n > 0 ? '+' : '') + inr(n)
const dir = (n: number) => (n > 0 ? 'up' : n < 0 ? 'down' : 'flat') as 'up' | 'down' | 'flat'

/** Months and days held; long-term once a full 12 months have passed. */
function held(since: string) {
  const s = new Date(since), now = new Date()
  let m = (now.getFullYear() - s.getFullYear()) * 12 + now.getMonth() - s.getMonth(); if (now.getDate() < s.getDate()) m--
  const lt = new Date(s); lt.setFullYear(s.getFullYear() + 1)
  const text = m >= 12 ? `${Math.floor(m / 12)}y ${m % 12}m` : m >= 1 ? `${m}m` : `${Math.max(0, Math.floor((now.getTime() - s.getTime()) / DAY))}d`
  return { text, long: now >= lt, lt }
}
const fmtDate = (d: Date) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

type Row = Holding & { name: string; sector: string; ltp: number; value: number; cost: number; pl: number; plPct: number; day: number; dayPct: number; text: string; long: boolean; lt: Date }

export default function Portfolio() {
  const gate = useEntryGate()
  const prices = useStore((s) => s.prices), holdings = useStore((s) => s.holdings), sips = useStore((s) => s.sips), positions = useStore((s) => s.positions)
  const { place, setToast, setSym, setView, pnl, cash } = useStore.getState()
  const p = pnl()
  const [ticket, setTicket] = useState<{ sym: string; side: 'BUY' | 'SELL'; qty: number } | null>(null)

  const rows: Row[] = useMemo(() => holdings.map((h) => {
    const q = prices[h.sym]; const inst = bySym(h.sym)!; const value = q.ltp * h.qty, cost = h.avg * h.qty
    return { ...h, name: inst.name, sector: inst.sector, ltp: q.ltp, value, cost, pl: value - cost, plPct: pct(q.ltp, h.avg), day: (q.ltp - q.prev) * h.qty, dayPct: pct(q.ltp, q.prev), ...held(h.since) }
  }).sort((a, b) => b.value - a.value), [holdings, prices])

  const t = useMemo(() => {
    const value = rows.reduce((a, r) => a + r.value, 0), cost = rows.reduce((a, r) => a + r.cost, 0), day = rows.reduce((a, r) => a + r.day, 0)
    const stcg = rows.filter((r) => !r.long).reduce((a, r) => a + r.pl, 0), ltcg = rows.filter((r) => r.long).reduce((a, r) => a + r.pl, 0)
    const bySector: Record<string, number> = {}; for (const r of rows) bySector[r.sector] = (bySector[r.sector] ?? 0) + r.value
    const sectors = Object.entries(bySector).sort((a, b) => b[1] - a[1])
    const top = sectors.slice(0, 5).map(([k, v], i) => ({ k, v, color: `var(--chart-${i + 1})` }))
    const rest = sectors.slice(5).reduce((a, [, v]) => a + v, 0)
    const alloc = rest ? [...top, { k: 'Other', v: rest, color: 'var(--chart-neutral)' }] : top
    const heavy = rows.filter((r) => value && r.value / value > 0.25)
    return { value, cost, day, prevValue: value - day, stcg, ltcg, alloc, heavy, losers: rows.filter((r) => r.pl < 0).sort((a, b) => a.pl - b.pl) }
  }, [rows])

  const open = Object.values(positions).filter((x) => x.qty)
  const go = (sym: string) => { setSym(sym); setView('chart') }
  const [openRow, setOpenRow] = useState<string | null>(null)
  const submit = () => {
    if (!ticket) return
    const msg = place(ticket.sym, ticket.side, ticket.qty, 'MARKET', 0, 'CNC', { via: 'manual' })
    setToast(msg); setTicket(null)
  }
  const taxStcg = Math.max(0, t.stcg) * STCG, taxLtcg = Math.max(0, t.ltcg - LTCG_EXEMPT) * LTCG

  /** Buy more or sell from a holding, inline under its row: the table on wide screens, the list on phones. */
  const inlineTicket = (r: (typeof rows)[number], t: NonNullable<typeof ticket>) => (
    <div role="group" aria-label={`${t.side === 'BUY' ? 'Buy' : 'Sell'} ${r.sym}`} className="flex flex-wrap items-center gap-2 text-left">
                        <span className="text-[12px]">{t.side === 'BUY' ? 'Buy more' : 'Sell'} <b>{r.sym}</b> at market, delivery</span>
                        <label className="text-[12px] text-fg-subtle">Qty <input type="number" min={1} max={t.side === 'SELL' ? r.qty : undefined} value={t.qty} autoFocus
                          onChange={(e) => setTicket({ ...t, qty: Math.max(1, Math.min(t.side === 'SELL' ? r.qty : 1e6, Math.floor(+e.target.value) || 1)) })} className={cn(field, 'ml-1 w-24')} /></label>
                        <span className="text-[12px] text-fg-subtle">≈ <span className="num text-fg">{inr(t.qty * r.ltp)}</span>
                          {t.side === 'SELL' && <> · P&amp;L <Money v={(r.ltp - r.avg) * t.qty} /> · {r.long ? 'long-term' : 'short-term'}</>}</span>
                        <div className="ml-auto flex gap-2">
                          <Button size="sm" variant={t.side === 'SELL' ? 'danger' : 'primary'} onClick={submit}>{t.side === 'SELL' ? 'Sell' : 'Buy'} {t.qty}</Button>
                          <Button size="sm" variant="ghost" onClick={() => setTicket(null)}>Cancel</Button>
                        </div>
                      </div>
  )
  return (
    <div>
      <ViewHeader title="Portfolio" sub="Long-term holdings, SIPs and your trading account. Practice money, simulated prices.">
        <Badge tone="neutral">{rows.length} holdings</Badge>
      </ViewHeader>
      <div className="@container space-y-4 p-4">
        {/* Six tiles in even rows (2, 3 or 6 across), never five and an orphan. */}
        <div className="dense-stats grid grid-cols-2 gap-3 @2xl:grid-cols-3 @6xl:grid-cols-6">
          <StatTile label="Current value" serif value={inrShort(t.value)} detail={`${rows.length} holdings`} />
          <StatTile label="Invested" serif value={inrShort(t.cost)} />
          <StatTile label="Total P&L" serif value={sign(t.value - t.cost)} goodDirection="up"
            delta={{ text: `${Math.abs(t.cost ? pct(t.value, t.cost) : 0).toFixed(2)}%`, direction: dir(t.value - t.cost), versus: 'on invested' }} />
          <StatTile label="Today on holdings" serif value={sign(t.day)} goodDirection="up"
            delta={{ text: `${Math.abs(t.prevValue ? (t.day / t.prevValue) * 100 : 0).toFixed(2)}%`, direction: dir(t.day), versus: 'since previous close' }} />
          <StatTile label="Available funds" serif value={inrShort(p.avail)} detail="For new trades" />
          <StatTile label="Money in use" serif value={inrShort(p.used)} detail={`of ${inrShort(cash)} cash`} />
        </div>

        <Section id="portfolio.holdings" title="Holdings" sub="Stocks you hold for the long run. Held over 12 months counts as long-term." bodyClassName={rows.length ? '!px-0 !pb-0' : undefined}
          summary={`${rows.length} holding${rows.length === 1 ? '' : 's'} · ${inrShort(t.value)}`}>
          {rows.length === 0 ? <EmptyState compact variant="cleared" title="No holdings" headingLevel={4}>Buy with the Delivery product to build long-term holdings.</EmptyState> : (
            <>
            {/* Phones: one line per holding, value and P&L on the right; tap for Chart, Add and Sell. */}
            <ul className="divide-y divide-[var(--border)] md:hidden">{rows.map((r) => <li key={r.sym}>
              <button type="button" onClick={() => setOpenRow(openRow === r.sym ? null : r.sym)} aria-expanded={openRow === r.sym} className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-hover">
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-fg">{r.sym}</span><span className="num block text-[12px] text-fg-subtle">{r.qty} × {r.avg.toFixed(2)} · {r.text} {r.long ? 'LTCG' : 'STCG'}</span></span>
                <span className="shrink-0 text-right"><span className="num block text-[14px] text-fg">{inr(r.value)}</span><span className="block text-[12px]"><Money v={r.pl} /> <Chg v={r.plPct} /></span></span>
              </button>
              {openRow === r.sym && <div className="flex gap-2 px-4 pb-3">
                <Button size="sm" variant="ghost" onClick={() => go(r.sym)}>Chart</Button>
                <Button size="sm" variant="secondary" className="flex-1" disabled={!!gate} onClick={() => setTicket({ sym: r.sym, side: 'BUY', qty: 1 })}>Add</Button>
                <Button size="sm" variant="secondary" className="flex-1" onClick={() => setTicket({ sym: r.sym, side: 'SELL', qty: r.qty })}>Sell</Button>
              </div>}
              {ticket?.sym === r.sym && <div className="bg-sunken px-4 py-3">{inlineTicket(r, ticket)}</div>}
            </li>)}</ul>
            <div className="scroll-thin overflow-x-auto rounded-b-[10px] max-md:hidden">
              <table className="tbl">
                <thead><tr><th>Name</th><th>Qty</th><th>Avg price</th><th>Price</th><th>Value</th><th>Profit / loss</th><th>Today</th><th>Held</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{rows.map((r) => (<Fragment key={r.sym}>
                  <tr>
                    <td className="!font-sans"><button onClick={() => go(r.sym)} className="text-left hover:underline"><b>{r.sym}</b><div className="max-w-44 truncate text-[11px] text-fg-subtle">{r.name}</div></button></td>
                    <td>{r.qty}</td><td>{r.avg.toFixed(2)}</td><td>{r.ltp.toFixed(2)}</td><td>{inr(r.value)}</td>
                    <td className="whitespace-nowrap"><Money v={r.pl} /> <span className="text-[11px]"><Chg v={r.plPct} /></span></td><td><Chg v={r.dayPct} /></td>
                    <td className="whitespace-nowrap" title={`Since ${fmtDate(new Date(r.since))}`}>{r.text} <span className="ml-1 font-sans">{r.long ? <Badge tone="info">LTCG</Badge> : <Badge tone="neutral" title={`Long-term from ${fmtDate(r.lt)}`}>STCG</Badge>}</span></td>
                    <td className="!font-sans"><div className="flex justify-end gap-1">
                      <Button size="sm" variant="secondary" aria-label={`Add more ${r.sym}`} disabled={!!gate} title={gate ? `${gate.short}. ${gate.why}` : undefined} onClick={() => setTicket({ sym: r.sym, side: 'BUY', qty: 1 })}>Add</Button>
                      <Button size="sm" variant="secondary" aria-label={`Sell ${r.sym}`} onClick={() => setTicket({ sym: r.sym, side: 'SELL', qty: r.qty })}>Sell</Button>
                    </div></td>
                  </tr>
                  {ticket?.sym === r.sym && (
                    <tr><td colSpan={9} className="!bg-sunken !font-sans">{inlineTicket(r, ticket)}</td></tr>)}
                </Fragment>))}</tbody>
              </table>
            </div></>)}
        </Section>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
          <Section id="portfolio.allocation" title="Allocation by sector" bodyClassName="space-y-3"
            summary={t.alloc[0] ? `Top: ${t.alloc[0].k} ${((t.alloc[0].v / (t.value || 1)) * 100).toFixed(0)}%` : undefined}>
            <div role="img" aria-label={`Sector allocation: ${t.alloc.map((a) => `${a.k} ${((a.v / (t.value || 1)) * 100).toFixed(0)}%`).join(', ')}`} className="flex h-4 overflow-hidden rounded-md bg-sunken">
              {t.alloc.map((a) => <div key={a.k} className="h-full border-r-2 border-surface last:border-r-0" style={{ width: `${(a.v / (t.value || 1)) * 100}%`, background: a.color }} />)}
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px]">
              {t.alloc.map((a) => <li key={a.k} className="flex items-center gap-2"><i aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
                <span className="truncate">{a.k}</span><span className="num ml-auto text-fg-muted">{((a.v / (t.value || 1)) * 100).toFixed(1)}%</span></li>)}
            </ul>
            {t.heavy.length > 0 && <Callout tone="info" title="Concentration">
              {t.heavy.map((r) => `${r.sym} is ${((r.value / t.value) * 100).toFixed(0)}%`).join(', ')} of your holdings. A single stock above 25% means one result or one bad quarter moves your whole portfolio.
            </Callout>}
          </Section>

          <Section id="portfolio.tax" title="Tax view" bodyClassName="space-y-3" actions={<Badge tone="neutral">Indicative</Badge>}
            summary={<>Unrealised LTCG <Money v={t.ltcg} /> · STCG <Money v={t.stcg} /></>}>
            <div className="scroll-thin overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Not sold yet</th><th>Gain / loss</th><th>Rate</th><th>Tax if sold today</th></tr></thead>
                <tbody>
                  <tr><td className="!font-sans">Short-term (STCG)</td><td><Money v={t.stcg} /></td><td>20%</td><td>{inr(taxStcg)}</td></tr>
                  <tr><td className="!font-sans">Long-term (LTCG)</td><td><Money v={t.ltcg} /></td><td>12.5%</td><td>{inr(taxLtcg)}</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-fg-subtle">Listed equity rates. LTCG first uses the ₹1.25 L yearly exemption, which realised gains this year also use up. Ignores loss set-off, grandfathering and surcharge. Not tax advice.</p>
            <div>
              <p className="mb-1.5 text-[12px] font-bold">Holdings at a loss</p>
              {t.losers.length === 0 ? <p className="text-[12px] text-fg-muted">None right now.</p> : (
                <ul className="divide-y divide-line text-[12px]">
                  {t.losers.map((r) => <li key={r.sym} className="flex items-center gap-2 py-1.5"><b>{r.sym}</b><Badge tone="neutral">{r.long ? 'Long-term' : 'Short-term'}</Badge><Money v={r.pl} className="ml-auto" /></li>)}
                </ul>)}
              <p className="mt-2 text-[11px] text-fg-subtle">How tax-loss harvesting works: a booked loss can offset gains in the same year. Short-term losses offset both short and long-term gains; long-term losses offset only long-term gains. Selling only for tax has costs and changes your plan, so treat this as information, not a recommendation.</p>
            </div>
          </Section>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Sips sips={sips} />
          <Section id="portfolio.positions" title="Trading positions" bodyClassName="space-y-3"
            summary={<>{open.length} open · net <Money v={p.net} /></>}>
            <div className="flex gap-6">
              <div><p className="text-[11px] text-fg-subtle">Open</p><p className="num text-[18px] font-semibold">{open.length}</p></div>
              <div><p className="text-[11px] text-fg-subtle">Net P&amp;L today</p><Money v={p.net} className="text-[18px] font-semibold" /></div>
            </div>
            <p className="text-[12px] text-fg-muted">Intraday and F&amp;O positions, after charges of {inr(p.charges)}.</p>
            <Button size="sm" variant="secondary" onClick={() => setView('chart')}>View positions</Button>
          </Section>
        </div>
      </div>
    </div>
  )
}

const SIP_SYMS = INSTS.filter((i) => i.seg === 'EQ')
const nextRun = (day: number) => { const n = new Date(); const d = new Date(n.getFullYear(), n.getMonth(), day); if (d <= n) d.setMonth(d.getMonth() + 1); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }

function Sips({ sips }: { sips: ReturnType<typeof useStore.getState>['sips'] }) {
  const [sym, setSym] = useState('NIFTYBEES'), [amount, setAmount] = useState(5000), [day, setDay] = useState(5)
  const { set, setToast } = useStore.getState()
  const update = (next: typeof sips) => set({ sips: next })
  const add = () => {
    if (amount < 100) { setToast('SIP amount must be at least ₹100'); return }
    update([...sips, { id: Math.max(0, ...sips.map((s) => s.id)) + 1, sym, amount, day, active: true, runs: 0 }])
    setToast(`SIP started: ${inr(amount)} into ${sym} on day ${day} of each month`)
  }
  const monthly = sips.filter((s) => s.active).reduce((a, s) => a + s.amount, 0)
  const active = sips.filter((s) => s.active).length
  return (
    <Section id="portfolio.sips" title="SIPs" sub={`${inr(monthly)} a month active`} bodyClassName="!px-0 !pb-0"
      summary={`${active} active · ${inr(monthly)}/month`}>
      {sips.length === 0 ? <p className="px-4 pb-3 text-[12px] text-fg-muted">No SIPs yet. Start one below.</p> : (
        <div className="scroll-thin overflow-x-auto">
          <table className="tbl">
            <thead><tr><th>Fund / stock</th><th>Amount</th><th>Day</th><th>Next</th><th>Runs</th><th>Invested</th><th>Active</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>{sips.map((s) => (
              <tr key={s.id}>
                <td className="!font-sans"><b>{s.sym}</b><div className="max-w-40 truncate text-[11px] text-fg-subtle">{bySym(s.sym)?.name}</div></td>
                <td>{inr(s.amount)}</td><td>{s.day}</td><td>{s.active ? nextRun(s.day) : 'Paused'}</td><td>{s.runs}</td><td>{inr(s.amount * s.runs)}</td>
                <td><div className="flex justify-end"><Switch label={`${s.active ? 'Pause' : 'Resume'} SIP in ${s.sym}`} checked={s.active} onChange={(v) => update(sips.map((x) => (x.id === s.id ? { ...x, active: v } : x)))} /></div></td>
                <td><IconButton size="sm" label={`Remove SIP in ${s.sym}`} onClick={() => update(sips.filter((x) => x.id !== s.id))}><XIcon width={12} height={12} /></IconButton></td>
              </tr>))}</tbody>
          </table>
        </div>)}
      <form className="flex flex-wrap items-end gap-2 border-t border-line p-4" onSubmit={(e) => { e.preventDefault(); add() }}>
        <label className="text-[12px] text-fg-subtle">Fund / stock<br />
          <select value={sym} onChange={(e) => setSym(e.target.value)} className={cn(field, 'mt-1 font-sans')}>
            <optgroup label="ETFs">{SIP_SYMS.filter((i) => i.sector === 'ETF').map((i) => <option key={i.sym} value={i.sym}>{i.sym}</option>)}</optgroup>
            <optgroup label="Stocks">{SIP_SYMS.filter((i) => i.sector !== 'ETF').map((i) => <option key={i.sym} value={i.sym}>{i.sym}</option>)}</optgroup>
          </select></label>
        <label className="text-[12px] text-fg-subtle">Amount ₹<br /><input type="number" min={100} step={100} value={amount} onChange={(e) => setAmount(Math.max(0, Math.floor(+e.target.value)))} className={cn(field, 'mt-1 w-28')} /></label>
        <label className="text-[12px] text-fg-subtle">Day of month<br /><input type="number" min={1} max={28} value={day} onChange={(e) => setDay(Math.max(1, Math.min(28, Math.floor(+e.target.value) || 1)))} className={cn(field, 'mt-1 w-20')} /></label>
        <Button type="submit" size="sm" variant="lime">Add SIP</Button>
      </form>
    </Section>
  )
}
