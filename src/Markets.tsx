import { useMemo } from 'react'
import { useStore } from './store'
import { INSTS, SECTORS, bySym, nextExpiries, isExpiryDay } from './market'
import { allMetrics, type Metrics } from './scan'
import { ask } from './ai'
import { Chg, Dir, Section, ViewHeader, inrShort, pct, AgentNote } from './ui'
import { AIBadge, Badge, Button, MeterBar, cn } from './ds'
import { SparkleIcon } from './ds/lib/icons'

/* Sections: breadth, sectors, movers and today's expiries open by default (primary briefing); sector strength, flows/VIX and
   the events calendar start folded as secondary detail. Index strip and the At-a-glance takeaway are always visible. */
const IDX = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX']
/** ETFs are not a sector; keep them out of breadth and sector maths. */
const SECT = SECTORS.filter((s) => s !== 'ETF')
const card = 'rounded-[10px] border border-line bg-surface p-4'
const label = 'text-[11px] font-medium text-fg-subtle'

function rng(seed: number) { return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 } }
const dayKey = (d = new Date()) => d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
const fmtDay = (d: Date) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
const daysTo = (d: Date) => Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 864e5)
const sgn = (v: number, d = 2) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(d)}%`
const heat = (c: number) => `color-mix(in oklab, var(${c >= 0 ? '--success-soft' : '--danger-soft'}) ${25 + Math.min(Math.abs(c) / 1.5, 1) * 75}%, var(--surface))`

/** Simulated flows, events and calendar: deterministic for the date so the briefing is stable all day. */
function simulatedDay() {
  const r = rng(dayKey())
  const fii = Math.round((r() - 0.55) * 7000), dii = Math.round((r() - 0.3) * 6000)
  const pool = INSTS.filter((i) => i.seg === 'EQ' && i.sector !== 'ETF')
  const kinds = ['Quarterly results', 'Quarterly results', 'Quarterly results', 'Board meeting', 'Dividend ex-date', 'Analyst meet']
  const used = new Set<string>(); const events: { sym: string; name: string; kind: string; date: Date }[] = []
  const d = new Date()
  while (events.length < 5) {
    const i = pool[Math.floor(r() * pool.length)]; if (used.has(i.sym)) continue; used.add(i.sym)
    const dt = new Date(d); dt.setDate(d.getDate() + 1 + Math.floor(r() * 10))
    while (dt.getDay() === 0 || dt.getDay() === 6) dt.setDate(dt.getDate() + 1)
    events.push({ sym: i.sym, name: i.name, kind: kinds[Math.floor(r() * kinds.length)], date: dt })
  }
  return { fii, dii, events: events.sort((a, b) => a.date.getTime() - b.date.getTime()) }
}

export default function Markets() {
  const { prices, setSym, setView, setScan, busy } = useStore()
  const bucket = Math.floor(Date.now() / 3000)
  // Scanner metrics are the costly part: refresh every 3 s, not every tick.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => allMetrics().filter((m) => m.sector !== 'ETF'), [bucket])
  const sim = useMemo(simulatedDay, [])
  const open = (s: string) => { setSym(s); setView('chart') }
  const toSector = (s: string) => { setScan({ filters: [{ field: 'sector', op: 'in', value: [s] }], name: `${s} stocks`, sort: 'chg' }); setView('scanner') }

  const a = useMemo(() => {
    const adv = rows.filter((r) => r.chg > 0).length, dec = rows.filter((r) => r.chg < 0).length
    const above200 = rows.filter((r) => r.above200 > 0).length
    const sectors = SECT.map((s) => { const rs = rows.filter((r) => r.sector === s); const avg = (k: keyof Metrics) => rs.reduce((x, r) => x + (r[k] as number), 0) / Math.max(rs.length, 1); return { s, n: rs.length, chg: avg('chg'), rs: avg('rs') } }).filter((x) => x.n)
    const by = (k: keyof Metrics, dir = -1) => [...rows].sort((x, y) => dir * ((x[k] as number) - (y[k] as number))).slice(0, 5)
    return { adv, dec, above200, sectors, rsRank: [...sectors].sort((x, y) => y.rs - x.rs), gainers: by('chg'), losers: by('chg', 1), shockers: by('volx') }
  }, [rows])

  const n = prices.NIFTY; const nRange = (n.high - n.low) / n.prev * 100
  const vix = 12 + Math.min(nRange / 1.2, 1) * 4
  const lead = a.rsRank[0], lag = a.rsRank[a.rsRank.length - 1]
  const top = a.sectors.length ? a.sectors.reduce((x, y) => (y.chg > x.chg ? y : x)) : undefined
  const flow = (v: number) => `${v >= 0 ? '+' : '−'}${inrShort(Math.abs(v) * 1e7)}`
  const maxRs = Math.max(...a.rsRank.map((x) => Math.abs(x.rs)), 1)
  const expiries = [
    { und: 'NIFTY', e: nextExpiries('NIFTY')[0] }, { und: 'SENSEX', e: nextExpiries('SENSEX')[0] }, { und: 'BANKNIFTY', e: nextExpiries('BANKNIFTY')[0] },
  ]
  const soon = [...expiries].sort((x, y) => x.e.date.getTime() - y.e.date.getTime())[0]
  const soonDays = daysTo(soon.e.date)

  return (
    <div className="@container">
      <ViewHeader title="Markets" sub={`Morning briefing · ${fmtDay(new Date())} · simulated data`}>
        <AIBadge />
        <Button size="sm" disabled={busy} onClick={() => ask('brief me')} leading={<SparkleIcon width={14} height={14} />}>AI briefing</Button>
      </ViewHeader>
      <div className="space-y-4 p-4">
        {/* Index strip */}
        <div className="grid grid-cols-2 gap-3 @4xl:grid-cols-4">
          {IDX.map((s) => { const q = prices[s]; const span = q.high - q.low || 1; const at = Math.min(Math.max((q.ltp - q.low) / span, 0), 1); return (
            <button key={s} onClick={() => open(s)} className={cn(card, 'text-left transition-colors hover:border-line-strong hover:bg-hover')} title={`${bySym(s)!.name}: open chart`}>
              <div className="flex items-baseline justify-between gap-2"><span className="font-bold">{s}</span><Chg v={pct(q.ltp, q.prev)} className="text-[12px]" /></div>
              <div className="num mt-1 text-[18px] font-semibold leading-7">{q.ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="mt-2" aria-label={`Day range ${q.low.toFixed(0)} to ${q.high.toFixed(0)}`}>
                <div className="relative h-1.5 rounded-full bg-sunken"><span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fg" style={{ left: `${at * 100}%` }} /></div>
                <div className="num mt-1 flex justify-between text-[11px] text-fg-subtle"><span>L {q.low.toFixed(0)}</span><span>H {q.high.toFixed(0)}</span></div>
              </div>
            </button>) })}
        </div>

        <AgentNote label="At a glance">
          {a.adv >= a.dec ? 'Buyers lead' : 'Sellers lead'}: {a.adv} stocks up, {a.dec} down. {lead && lag && <>{lead.s} is the strongest sector over 3 months, {lag.s} the weakest. </>}
          {a.above200} of {rows.length} stocks trade above their 200-day EMA.
        </AgentNote>

        <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            {/* Breadth */}
            <Section id="markets.breadth" title="How many stocks are up" summary={`${a.adv} up · ${a.dec} down`}>
              <div className="flex h-7 overflow-hidden rounded-md text-[12px]" role="img" aria-label={`${a.adv} advancing, ${a.dec} declining`}>
                <div className="flex items-center bg-success-soft px-3 text-success-fg" style={{ width: `${(a.adv / Math.max(a.adv + a.dec, 1)) * 100}%` }}><span className="num whitespace-nowrap"><Dir up /> {a.adv}</span></div>
                <div className="flex flex-1 items-center justify-end bg-danger-soft px-3 text-danger-fg"><span className="num whitespace-nowrap"><Dir up={false} /> {a.dec}</span></div>
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-fg-subtle"><span>Advancing</span><span>Declining</span></div>
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-[12px]"><span className="text-fg-muted">Above 200-day average</span><span className="num">{Math.round(a.above200 / Math.max(rows.length, 1) * 100)}%</span></div>
                <MeterBar label="Stocks above 200-day EMA" value={a.above200} max={Math.max(rows.length, 1)} valueText={`${a.above200} of ${rows.length} stocks`} />
              </div>
            </Section>

            {/* Sector heatmap */}
            <Section id="markets.sectors" title="Sectors today" sub="Tap a sector to scan it" summary={top ? `Leader: ${top.s} ${sgn(top.chg, 1)}` : undefined}>
              <div className="grid grid-cols-2 gap-2 @md:grid-cols-3 @2xl:grid-cols-4">
                {a.sectors.map((x) => (
                  <button key={x.s} onClick={() => toSector(x.s)} className="rounded-lg border border-line p-3 text-left transition-shadow hover:shadow-md" style={{ background: heat(x.chg) }}>
                    <div className="truncate text-[13px] font-bold">{x.s}</div>
                    <div className="mt-1 flex items-baseline justify-between gap-1"><Chg v={x.chg} className="text-[12px]" /><span className="text-[11px] text-fg-subtle">{x.n}</span></div>
                  </button>))}
              </div>
            </Section>

            {/* Sector relative strength */}
            <Section id="markets.strength" title="Sector strength vs Nifty, 3 months" sub="Average 3-month return minus Nifty’s. Leaders on top." defaultOpen={false}
              summary={lead && lag ? `Strongest ${lead.s} ${sgn(lead.rs, 1)} · weakest ${lag.s} ${sgn(lag.rs, 1)}` : undefined}>
              <ul className="space-y-1.5">
                {a.rsRank.map((x) => (
                  <li key={x.s}>
                    <button onClick={() => toSector(x.s)} className="grid w-full grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_4.5rem] items-center gap-2 rounded-lg px-1 py-0.5 text-left text-[12px] hover:bg-hover">
                      <span className="truncate">{x.s}</span>
                      <span className="relative h-2.5" aria-hidden>
                        <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                        <span className={cn('absolute inset-y-0 rounded-md', x.rs >= 0 ? 'left-1/2 bg-success-soft' : 'right-1/2 bg-danger-soft')} style={{ width: `${Math.abs(x.rs) / maxRs * 50}%` }} />
                      </span>
                      <Chg v={x.rs} digits={1} className="text-right text-[11px]" />
                    </button>
                  </li>))}
              </ul>
            </Section>

            {/* Movers */}
            <div className="grid gap-4 @2xl:grid-cols-3">
              <Movers id="markets.gainers" title="Top gainers" rows={a.gainers} open={open} />
              <Movers id="markets.losers" title="Top losers" rows={a.losers} open={open} />
              <Movers id="markets.volume" title="Unusual volume" rows={a.shockers} open={open} vol />
            </div>
          </div>

          {/* Today */}
          <aside className="min-w-0 space-y-4" aria-label="Today">
            <Section id="markets.today" title="Today" summary={`${soon.und} expiry ${isExpiryDay(soon.und) ? 'today' : `in ${soonDays} day${soonDays === 1 ? '' : 's'}`}`}>
              <p className={label}>Next expiries</p>
              <ul className="mt-1 divide-y divide-line">
                {expiries.map(({ und, e }) => { const d = daysTo(e.date); return (
                  <li key={und} className="flex items-center justify-between gap-2 py-2">
                    <span><span className="font-bold">{und}</span> <span className="text-[11px] text-fg-subtle">{e.weekly ? 'weekly' : 'monthly'}</span></span>
                    <span className="flex items-center gap-2 text-[12px]">
                      <span className="num">{fmtDay(e.date)}</span>
                      {isExpiryDay(und) ? <Badge tone="info">Expiry today</Badge> : <span className="text-fg-subtle">in {d} day{d === 1 ? '' : 's'}</span>}
                    </span>
                  </li>) })}
              </ul>
            </Section>

            <Section id="markets.flows" title="Flows and volatility" defaultOpen={false} actions={<Badge>Simulated</Badge>}
              summary={`FII ${flow(sim.fii)} · DII ${flow(sim.dii)} · VIX ${vix.toFixed(2)}`}>
              <p className={label}>Cash flows, yesterday</p>
              <dl className="mt-1 space-y-1 text-[12px]">
                {[['FII / FPI', sim.fii], ['DII', sim.dii]].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between"><dt className="text-fg-muted">{k}</dt><dd><span className={cn('num', (v as number) >= 0 ? 'text-up' : 'text-down')}><Dir up={(v as number) >= 0} /> {(v as number) >= 0 ? 'Bought ' : 'Sold '}{inrShort(Math.abs(v as number) * 1e7)}</span></dd></div>))}
              </dl>

              <p className={cn(label, 'mt-3')}>India VIX</p>
              <div className="mt-1 flex items-baseline justify-between text-[12px]">
                <span className="num text-[18px]">{vix.toFixed(2)}</span>
                <span className="text-fg-muted">{vix < 13 ? 'Calm, cheap options' : vix < 15 ? 'Normal' : 'Elevated, wider swings'}</span>
              </div>
            </Section>

            <Section id="markets.events" title="Next 10 days" defaultOpen={false} actions={<Badge>Simulated</Badge>}
              summary={sim.events[0] ? `${sim.events.length} events · next ${sim.events[0].sym} ${fmtDay(sim.events[0].date)}` : 'No events'}>
              <ul className="divide-y divide-line">
                {sim.events.map((e) => (
                  <li key={e.sym}>
                    <button onClick={() => open(e.sym)} className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-hover">
                      <span className="min-w-0"><span className="font-bold">{e.sym}</span><span className="block truncate text-[11px] text-fg-subtle">{e.kind}</span></span>
                      <span className="num shrink-0 text-[12px] text-fg-muted">{fmtDay(e.date)}</span>
                    </button>
                  </li>))}
              </ul>
            </Section>

            <p className="text-[11px] text-fg-subtle">All prices, flows and events here are simulated for practice trading. The AI briefing is generated and can be wrong; check before acting.</p>
          </aside>
        </div>
      </div>
    </div>
  )
}

function Movers({ id, title, rows, open, vol }: { id: string; title: string; rows: Metrics[]; open: (s: string) => void; vol?: boolean }) {
  const t = rows[0]
  return (
    <Section id={id} title={title} summary={t ? (vol ? `${t.sym} ${t.volx.toFixed(1)}× vol` : `${t.sym} ${sgn(t.chg)}`) : undefined}>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.sym}>
            <button onClick={() => open(r.sym)} className="flex w-full items-center justify-between gap-2 py-2 text-left hover:bg-hover">
              <span className="min-w-0"><span className="font-bold">{r.sym}</span><span className="num block text-[11px] text-fg-subtle">{r.ltp.toFixed(2)}</span></span>
              <span className="shrink-0 text-right">
                {vol ? <><span className="num block text-[12px]">{r.volx.toFixed(1)}× vol</span><Chg v={r.chg} className="text-[11px]" /></> : <Chg v={r.chg} className="text-[12px]" />}
              </span>
            </button>
          </li>))}
      </ul>
    </Section>
  )
}
