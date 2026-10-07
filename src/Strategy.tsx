import { useState } from 'react'
import { useStore, legsMargin } from './store'
import { Button, IconButton, SegmentedControl, StatTile, EmptyState } from './ds'
import { PlusIcon, XIcon } from './ds/lib/icons'
import { bySym, nextExpiries, payoff, optQuote, STRATEGIES, INSTS, type Leg } from './market'
import { Section } from './ui'

/* Sections: legs table, stats and payoff (what-if + chart) all open by default since each drives the trade decision;
   the toolbar and the place-orders button stay always visible. */

const inr = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN')

export default function Strategy() {
  const { sym: s0, legs, setLegs, stratName, expiryIdx, setExpiry, prices, run, setToast, setSym } = useStore()
  const sym = bySym(s0)?.fno ? s0 : 'NIFTY'
  const inst = bySym(sym)!; const spot = prices[sym].ltp; const ex = nextExpiries(sym); const ei = Math.min(expiryIdx, ex.length - 1); const T = ex[ei].T
  const atm = Math.round(spot / inst.step) * inst.step
  const q = (l: Leg) => optQuote(sym, spot, T, l.strike, l.type)
  const span = Math.min(Math.max(0.04, 3.5 * (inst.vol + 0.01) * Math.sqrt(T)), 0.12)
  const lo = spot * (1 - span), hi = spot * (1 + span), N = 120
  const xs = Array.from({ length: N + 1 }, (_, i) => lo + ((hi - lo) * i) / N)
  const exp = xs.map((x) => payoff(sym, spot, T, legs, x))
  const [days, setDays] = useState(0); const [ivShift, setIvShift] = useState(0)
  const daysLeft = Math.max(0, Math.floor(T * 365))
  const t0 = xs.map((x) => payoff(sym, spot, T, legs, x, true, { days: Math.min(days, daysLeft), ivShift }))
  const far = [payoff(sym, spot, T, legs, spot * 0.5), payoff(sym, spot, T, legs, spot * 1.5)]
  const maxP = Math.max(...exp, ...far), maxL = Math.min(...exp, ...far)
  const unbounded = (v: number, i: number) => Math.abs(far[i] - v) > Math.abs(v) * 0.2 + 1000
  const be: number[] = []; for (let i = 1; i < xs.length; i++) if (Math.sign(exp[i]) !== Math.sign(exp[i - 1])) be.push(xs[i])
  const prem = legs.reduce((a, l) => a + (l.side === 'SELL' ? 1 : -1) * q(l).price * l.lots * inst.lot, 0)
  const g = legs.reduce((a, l) => { const k = q(l); const m = (l.side === 'BUY' ? 1 : -1) * l.lots * inst.lot; return { d: a.d + k.delta * m, t: a.t + k.theta * m, v: a.v + k.vega * m, g: a.g + k.gamma * m } }, { d: 0, t: 0, v: 0, g: 0 })
  const margin = legsMargin(sym, legs, ei) + Math.max(-prem, 0)
  // POP from lognormal at expiry
  const sd = (inst.vol + 0.01) * Math.sqrt(T)
  const pop = legs.length ? xs.reduce((a, x, i) => { const z = Math.log(x / spot) / sd; const d = Math.exp(-z * z / 2) / (x * sd * Math.sqrt(2 * Math.PI)); return a + (exp[i] > 0 ? d * ((hi - lo) / N) : 0) }, 0) : 0

  const W = 720, H = 240, yMax = Math.max(Math.abs(Math.max(...exp, ...t0)), Math.abs(Math.min(...exp, ...t0)), 1)
  const X = (x: number) => ((x - lo) / (hi - lo)) * W, Y = (y: number) => H / 2 - (y / yMax) * (H / 2 - 12)
  const path = (ys: number[]) => ys.map((y, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(y).toFixed(1)}`).join('')
  const upd = (i: number, p: Partial<Leg>) => setLegs(legs.map((l, j) => (i === j ? { ...l, ...p } : l)), stratName)
  const maxProfitUnl = (unbounded(exp[N], 1) && far[1] > exp[N]) || (unbounded(exp[0], 0) && far[0] > exp[0])
  const maxLossUnl = (unbounded(exp[N], 1) && far[1] < exp[N]) || (unbounded(exp[0], 0) && far[0] < exp[0])
  const sel = 'h-8 rounded-full border border-line bg-surface px-3 text-[12px] outline-none focus:border-fg-subtle'
  const pill = (on: boolean, tone: 'up' | 'down' | 'neutral') => `h-7 min-w-12 rounded-full px-2.5 text-[11px] font-bold ${tone === 'up' ? 'bg-success-soft text-success-fg' : tone === 'down' ? 'bg-danger-soft text-danger-fg' : 'border border-line bg-surface'} ${on ? '' : ''}`

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Underlying" className={sel} value={sym} onChange={(e) => { setSym(e.target.value); setLegs([]) }}>{INSTS.filter((i) => i.fno).map((i) => <option key={i.sym}>{i.sym}</option>)}</select>
        <SegmentedControl size="sm" label="Expiry" value={String(ei)} onChange={(v) => setExpiry(+v)} options={ex.map((e, i) => ({ value: String(i), label: e.label }))} />
        <select aria-label="Start from a template" className={sel} value="" onChange={(e) => e.target.value && setLegs(STRATEGIES[e.target.value].build(atm, inst.step, 1), e.target.value)}>
          <option value="">Start from a template…</option>{Object.keys(STRATEGIES).map((k) => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}</select>
        <Button size="sm" variant="secondary" leading={<PlusIcon width={14} height={14} />} onClick={() => setLegs([...legs, { side: 'BUY', type: 'CE', strike: atm, lots: 1 }], stratName || 'custom')}>Add leg</Button>
        {legs.length > 0 && <Button size="sm" variant="ghost" onClick={() => setLegs([])}>Clear all legs</Button>}
        {stratName && legs.length > 0 && <h2 className="ml-auto text-lg capitalize">{stratName}</h2>}
      </div>
      {!legs.length ? <EmptyState compact title="No legs yet" action={<Button size="sm" onClick={() => setLegs(STRATEGIES['iron condor'].build(atm, inst.step, 1), 'iron condor')}>Try an iron condor</Button>}>
          Pick a template, hover a price in the option chain, or ask the copilot: “bull call spread on nifty 2 lots”.</EmptyState> : <>
        <Section id="strategy.legs" title="Legs" bodyClassName="!px-0 !pb-0"
          summary={`${legs.length} leg${legs.length === 1 ? '' : 's'} · net ${prem >= 0 ? 'credit' : 'debit'} ${inr(Math.abs(prem))}`}>
        <div className="overflow-x-auto rounded-b-2xl">
          <table className="tbl"><thead><tr><th>Side</th><th>Type</th><th>Strike</th><th>Lots</th><th>LTP</th><th>IV</th><th>Delta</th><th><span className="sr-only">Remove</span></th></tr></thead>
            <tbody>{legs.map((l, i) => { const k = q(l); return (
              <tr key={i}>
                <td><button className={pill(true, l.side === 'BUY' ? 'up' : 'down')} aria-label={`Leg ${i + 1} side ${l.side}, switch`} onClick={() => upd(i, { side: l.side === 'BUY' ? 'SELL' : 'BUY' })}>{l.side === 'BUY' ? 'Buy' : 'Sell'}</button></td>
                <td><button className={pill(true, 'neutral')} aria-label={`Leg ${i + 1} type ${l.type}, switch`} onClick={() => upd(i, { type: l.type === 'CE' ? 'PE' : 'CE' })}>{l.type}</button></td>
                <td><span className="inline-flex items-center gap-1">
                  <IconButton size="sm" variant="secondary" label={`Lower leg ${i + 1} strike`} onClick={() => upd(i, { strike: l.strike - inst.step })}>−</IconButton>
                  <span className="w-14 text-center">{l.strike}</span>
                  <IconButton size="sm" variant="secondary" label={`Raise leg ${i + 1} strike`} onClick={() => upd(i, { strike: l.strike + inst.step })}>+</IconButton></span></td>
                <td><input type="number" min={1} aria-label={`Leg ${i + 1} lots`} value={l.lots} onChange={(e) => upd(i, { lots: Math.max(1, +e.target.value) })} className="num h-7 w-16 rounded-full border border-line bg-surface px-3 text-right" /></td>
                <td>{k.price.toFixed(2)}</td><td>{k.iv.toFixed(1)}</td><td>{k.delta.toFixed(2)}</td>
                <td><IconButton size="sm" label={`Remove leg ${i + 1}`} onClick={() => setLegs(legs.filter((_, j) => j !== i), stratName)}><XIcon width={12} height={12} /></IconButton></td>
              </tr>) })}</tbody>
          </table>
        </div>
        </Section>
        <Section id="strategy.stats" title="Risk and reward"
          summary={`Max profit ${maxProfitUnl ? 'unlimited' : inr(maxP)} · max loss ${maxLossUnl ? 'unlimited' : inr(maxL)}`}>
        <div className="dense-stats grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
          <StatTile label="Max profit" serif value={maxProfitUnl ? 'Unlimited' : inr(maxP)} />
          <StatTile label="Max loss" serif value={maxLossUnl ? 'Unlimited' : inr(maxL)} needsAction={maxLossUnl} actionText="Undefined risk" />
          <StatTile label="Breakeven" serif value={be.map((b) => b.toFixed(0)).join(' / ') || '—'} />
          <StatTile label="Chance of profit" serif value={`${(pop * 100).toFixed(0)}%`} detail="Approximate, at expiry" />
          <StatTile label={prem >= 0 ? 'Net credit' : 'Net debit'} serif value={inr(Math.abs(prem))} />
          <StatTile label="Margin needed" serif value={inr(margin)} />
          <StatTile label="Delta / Gamma" serif value={`${g.d.toFixed(1)} / ${g.g.toFixed(3)}`} />
          <StatTile label="Theta a day / Vega" serif value={`${inr(g.t)} / ${inr(g.v)}`} />
        </div>
        </Section>
        <Section id="strategy.payoff" title="Payoff" bodyClassName="space-y-3"
          summary={be.length ? `Breakeven ${be.map((b) => b.toFixed(0)).join(' / ')}` : 'No breakeven in range'}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl bg-sunken px-4 py-3 text-[12px]">
          <span className="font-bold">What if</span>
          <label className="flex items-center gap-2">Days passed <input type="range" min={0} max={daysLeft} value={Math.min(days, daysLeft)} onChange={(e) => setDays(+e.target.value)} className="w-32 accent-[var(--fg)]" /><span className="num w-16">{Math.min(days, daysLeft)} of {daysLeft}</span></label>
          <label className="flex items-center gap-2">IV change <input type="range" min={-10} max={10} value={ivShift} onChange={(e) => setIvShift(+e.target.value)} className="w-32 accent-[var(--fg)]" /><span className="num w-14">{ivShift >= 0 ? '+' : '−'}{Math.abs(ivShift)} pts</span></label>
          <span className="text-fg-subtle">P&amp;L at today's spot: <b className={'num ' + (t0[N / 2] >= 0 ? 'text-up' : 'text-down')}>{inr(t0[N / 2])}</b></span>
          {(days > 0 || ivShift !== 0) && <button className="underline text-fg-muted" onClick={() => { setDays(0); setIvShift(0) }}>Reset</button>}
        </div>
        <figure>
          <figcaption className="mb-2 flex flex-wrap gap-4 text-[11px] text-fg-subtle">
            <span><i aria-hidden className="mr-1 inline-block h-0.5 w-4 align-middle bg-fg" />At expiry</span>
            <span><i aria-hidden className="mr-1 inline-block w-4 border-t-2 border-dashed align-middle" style={{ borderColor: 'var(--chart-1)' }} />{days > 0 || ivShift ? `After ${days} days, IV ${ivShift >= 0 ? '+' : '−'}${Math.abs(ivShift)}` : 'Today'}</span>
            <span><i aria-hidden className="mr-1 inline-block h-3 w-0 border-l border-dashed align-middle border-fg-subtle" />Spot {spot.toFixed(0)}</span>
          </figcaption>
          <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`Payoff chart. Max profit ${maxProfitUnl ? 'unlimited' : inr(maxP)}, max loss ${maxLossUnl ? 'unlimited' : inr(maxL)}`}>
            <defs><clipPath id="pos"><rect x="0" y="0" width={W} height={H / 2} /></clipPath><clipPath id="neg"><rect x="0" y={H / 2} width={W} height={H / 2} /></clipPath></defs>
            <path d={path(exp) + `L${W},${H / 2}L0,${H / 2}Z`} fill="var(--success-soft)" clipPath="url(#pos)" />
            <path d={path(exp) + `L${W},${H / 2}L0,${H / 2}Z`} fill="var(--danger-soft)" clipPath="url(#neg)" />
            <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--border-strong)" />
            <line x1={X(spot)} x2={X(spot)} y1="0" y2={H} stroke="var(--fg-subtle)" strokeDasharray="3 3" />
            <path d={path(t0)} fill="none" stroke="var(--chart-1)" strokeWidth="1.5" strokeDasharray="5 4" />
            <path d={path(exp)} fill="none" stroke="var(--fg)" strokeWidth="2" />
            {[0, 0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={f * W} y={H + 14} fill="var(--fg-subtle)" fontSize="10" textAnchor={f === 0 ? 'start' : f === 1 ? 'end' : 'middle'}>{(lo + (hi - lo) * f).toFixed(0)}</text>)}
          </svg>
        </figure>
        </Section>
        <div className="flex items-center gap-3">
          <Button variant="lime" onClick={() => setToast(run({ t: 'legs', und: sym, legs, expiryIdx: ei, name: stratName }, 'manual'))}>Place {legs.length} orders</Button>
          <span className="text-[12px] text-fg-subtle">Paper trade at market. Buy legs go first, so hedges cut the margin.</span>
        </div>
      </>}
    </div>
  )
}
