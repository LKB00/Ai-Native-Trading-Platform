import { useMemo, useState } from 'react'
import { useStore, type Trade } from './store'
import { parseKey } from './market'
import { isSetupTag, tagLabel } from './rules'
import { ask } from './ai'
import { inr, inrShort, Money, Section, SortMark, ViewHeader, AgentNote } from './ui'
import { Badge, Button, EmptyState, LineChart, SegmentedControl, StatTile, cn } from './ds'
import { SparkleIcon, InfoIcon } from './ds/lib/icons'

/* Sections: insights, P&L calendar and equity curve open by default (primary review); breakdown tables and the full
   trade log start folded as deep detail. The StatTile row is never folded. */
type Period = '7d' | '30d' | 'all'
type T = Trade & { net: number; day: string }
const DAY = 86400000
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const dayKey = (ts: number) => { const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fmtDay = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' })
const fmtTime = new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const sign = (n: number) => (n > 0 ? '+' : '') + inr(n)
const pc = (n: number) => `${Math.round(n * 100)}%`
/** Sample option keys carry exp 'PAST'; show them as expired contracts. */
const label = (key: string) => { const k = parseKey(key); return k.strike ? `${k.und} ${k.strike} ${k.type}${k.exp === 'PAST' ? '' : ' ' + k.exp}` : k.und }
const kind = (t: Trade) => (parseKey(t.key).strike ? 'Options' : t.product === 'CNC' ? 'Stocks, delivery' : 'Stocks, intraday')

type Group = { k: string; n: number; wins: number; net: number }
function group(ts: T[], key: (t: T) => string, order?: string[]): Group[] {
  const m = new Map<string, Group>()
  for (const t of ts) { const k = key(t); const g = m.get(k) ?? { k, n: 0, wins: 0, net: 0 }; g.n++; g.net += t.net; if (t.net > 0) g.wins++; m.set(k, g) }
  const out = [...m.values()]
  return order ? out.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k)) : out.sort((a, b) => b.net - a.net)
}
const sum = (ts: T[], f: (t: T) => number) => ts.reduce((a, t) => a + f(t), 0)

function stats(ts: T[]) {
  const wins = ts.filter((t) => t.net > 0), losses = ts.filter((t) => t.net <= 0)
  const gross = sum(ts, (t) => t.pnl), charges = sum(ts, (t) => t.charges), net = gross - charges
  const winSum = sum(wins, (t) => t.net), lossSum = -sum(losses, (t) => t.net)
  const avgWin = wins.length ? winSum / wins.length : 0, avgLoss = losses.length ? lossSum / losses.length : 0
  return { n: ts.length, wins, losses, gross, charges, net, winRate: ts.length ? wins.length / ts.length : 0, pf: lossSum ? winSum / lossSum : Infinity, exp: ts.length ? net / ts.length : 0, avgWin, avgLoss, grossProfit: sum(ts.filter((t) => t.pnl > 0), (t) => t.pnl) }
}

/** Deterministic behaviour flags, in plain language. */
function insights(ts: T[], s: ReturnType<typeof stats>): string[] {
  const out: string[] = []
  if (ts.length < 5) return out
  const tue = ts.filter((t) => new Date(t.close).getDay() === 2), rest = ts.filter((t) => new Date(t.close).getDay() !== 2)
  if (tue.length >= 3 && rest.length >= 3) {
    const a = stats(tue), b = stats(rest)
    if (b.winRate - a.winRate >= 0.08) out.push(`You lose more on Tuesdays (weekly expiry): win rate ${pc(a.winRate)} vs ${pc(b.winRate)} on other days. Tuesdays netted ${sign(a.net)} over ${a.n} trades.`)
    else if (a.winRate - b.winRate >= 0.08) out.push(`Expiry Tuesdays are your stronger day: win rate ${pc(a.winRate)} vs ${pc(b.winRate)} on other days.`)
  }
  const worst = Math.min(...ts.map((t) => t.net))
  if (s.avgWin > 0 && -worst >= 2 * s.avgWin) out.push(`Your largest loss (${inr(worst)}) was ${(-worst / s.avgWin).toFixed(1)}× your average win. One trade like that wipes out several good ones; a fixed stop per trade caps it.`)
  if (s.avgLoss > 0 && s.avgWin > 0 && s.avgLoss > s.avgWin * 1.15) out.push(`Average loss (${inr(s.avgLoss)}) is bigger than average win (${inr(s.avgWin)}). At this ratio you need a win rate above ${pc(s.avgLoss / (s.avgLoss + s.avgWin))} just to break even.`)
  const days = group(ts, (t) => t.day); const busy = days.filter((d) => d.n >= 4), calm = days.filter((d) => d.n < 4)
  if (busy.length) {
    const tot = (g: Group[], f: (x: Group) => number) => g.reduce((a, x) => a + f(x), 0)
    const bn = tot(busy, (d) => d.net), bt = tot(busy, (d) => d.n), cnet = tot(calm, (d) => d.net), ct = tot(calm, (d) => d.n)
    if (ct && bn / bt < cnet / ct) out.push(`Overtrading: ${busy.length} day${busy.length > 1 ? 's' : ''} with 4 or more trades netted ${sign(bn)} (${sign(bn / bt)} a trade) vs ${sign(cnet / ct)} a trade on quieter days.`)
  }
  const base = s.gross > 0 ? s.gross : s.grossProfit
  if (base > 0 && s.charges / base >= 0.1) out.push(`Charges ate ${pc(s.charges / base)} of your ${s.gross > 0 ? 'gross P&L' : 'gross profit'}: ${inr(s.charges)} in brokerage, STT, exchange fees, GST and stamp duty. Fewer, larger-edge trades keep more of it.`)
  const lost = ts.filter((t) => t.net < 0), manual = lost.filter((t) => t.exitReason === 'manual'), stop = lost.filter((t) => t.exitReason === 'stop')
  if (manual.length >= 3 && stop.length >= 3) {
    const m = -sum(manual, (t) => t.net) / manual.length, st = -sum(stop, (t) => t.net) / stop.length
    if (m > st * 1.2) out.push(`Losers you closed by hand cost ${inr(m)} on average vs ${inr(st)} when a stop closed them. Pre-set stops are working better than discretion.`)
  }
  const hold = (x: T[]) => x.length ? sum(x, (t) => t.close - t.open) / x.length : 0
  const hw = hold(s.wins), hl = hold(s.losses)
  if (hw > 0 && hl > hw * 1.3) out.push(`You hold losing trades ${(hl / hw).toFixed(1)}× longer than winners (${Math.round(hl / 60000)} vs ${Math.round(hw / 60000)} min). Cutting losers sooner is the usual fix.`)
  const tags = group(ts.filter((t) => isSetupTag(t.tag)), (t) => tagLabel(t.tag!)).filter((g) => g.n >= 3)
  if (tags.length >= 2 && tags[tags.length - 1].net < 0) {
    const best = tags[0], worst = tags[tags.length - 1]
    out.push(best.net > 0
      ? `Best setup: ${best.k} (${sign(best.net)} over ${best.n} trades). Weakest: ${worst.k} (${sign(worst.net)} over ${worst.n}).`
      : `No setup made money in this period. ${best.k} lost least (${sign(best.net)} over ${best.n} trades), ${worst.k} most (${sign(worst.net)} over ${worst.n}).`)
  }
  return out
}

export default function Journal() {
  const all = useStore((s) => s.trades)
  const [sample, setSample] = useState<'incl' | 'excl'>('incl')
  const [period, setPeriod] = useState<Period>('30d')
  const [sort, setSort] = useState<{ by: 'date' | 'pnl'; desc: boolean }>({ by: 'date', desc: true })
  const [limit, setLimit] = useState(100)
  const hasSample = all.some((t) => t.sample)

  const ts: T[] = useMemo(() => {
    const from = period === 'all' ? 0 : Date.now() - (period === '7d' ? 7 : 30) * DAY
    return all.filter((t) => (sample === 'incl' || !t.sample) && t.close >= from).map((t) => ({ ...t, net: t.pnl - t.charges, day: dayKey(t.close) }))
  }, [all, sample, period])
  const s = useMemo(() => stats(ts), [ts])
  const flags = useMemo(() => insights(ts, s), [ts, s])
  const br = useMemo(() => ({
    weekday: group(ts, (t) => WD[new Date(t.close).getDay()], WD.slice(1).concat('Sun')),
    tag: group(ts, (t) => (isSetupTag(t.tag) ? tagLabel(t.tag!) : 'Untagged')),
    via: group(ts, (t) => t.via),
    exit: group(ts, (t) => t.exitReason ?? 'unknown'),
    kind: group(ts, kind),
  }), [ts])
  const curve = useMemo(() => {
    const days = group(ts, (t) => t.day).sort((a, b) => a.k.localeCompare(b.k)); let c = 0
    return { x: days.map((d) => fmtShort.format(new Date(d.k + 'T12:00'))), y: days.map((d) => (c += d.net)) }
  }, [ts])
  const log = useMemo(() => [...ts].sort((a, b) => (sort.desc ? -1 : 1) * (sort.by === 'date' ? a.close - b.close : a.net - b.net)), [ts, sort])
  const chPct = s.gross > 0 ? s.charges / s.gross : s.grossProfit > 0 ? s.charges / s.grossProfit : 0
  const sortBtn = (by: 'date' | 'pnl', text: string) => (
    <button onClick={() => setSort({ by, desc: sort.by === by ? !sort.desc : true })} className="inline-flex items-center gap-1 hover:text-fg"
      aria-label={`Sort by ${text}${sort.by === by ? (sort.desc ? ', currently descending' : ', currently ascending') : ''}`}>
      {text}<SortMark desc={sort.desc} active={sort.by === by} /></button>)

  return (
    <div>
      <ViewHeader title="Journal" sub="Every closed trade, logged automatically. Numbers are after charges unless marked gross.">
        {sample === 'incl' && hasSample && <Badge tone="neutral">Includes sample history</Badge>}
        <SegmentedControl size="sm" label="Sample history" value={sample} onChange={(v) => { setSample(v); setLimit(100) }} options={[{ value: 'incl', label: 'With sample' }, { value: 'excl', label: 'My trades only' }]} />
        <SegmentedControl size="sm" label="Period" value={period} onChange={(v) => { setPeriod(v); setLimit(100) }} options={[{ value: '7d', label: '7 days' }, { value: '30d', label: '30 days' }, { value: 'all', label: 'All' }]} />
      </ViewHeader>
      <div className="@container space-y-4 p-4">
        {ts.length === 0 ? (
          <EmptyState variant="no-results" title="No closed trades in this view" headingLevel={3}
            action={sample === 'excl' && hasSample ? <Button size="sm" variant="secondary" onClick={() => setSample('incl')}>Include sample history</Button> : undefined}>
            Trades appear here as soon as a position is closed. Try a longer period{sample === 'excl' ? ' or include the sample history' : ''}.
          </EmptyState>
        ) : (<>
          <div className="dense-stats grid grid-cols-2 gap-3 @2xl:grid-cols-3 @6xl:grid-cols-6">
            <StatTile label="Net P&L" serif value={sign(s.net)} detail={`Gross ${sign(s.gross)}`} />
            <StatTile label="Win rate" serif value={pc(s.winRate)} detail={`${s.wins.length} won · ${s.losses.length} lost · ${new Set(ts.map((t) => t.day)).size} days`} />
            <StatTile label="Profit ratio" serif value={Number.isFinite(s.pf) ? s.pf.toFixed(2) : 'No losses'} detail="Won ÷ lost, above 1 is profitable" />
            <StatTile label="Average per trade" serif value={sign(s.exp)} detail="What a typical trade earns after charges" />
            <StatTile label="Avg win / avg loss" serif value={`${inrShort(s.avgWin)} / ${inrShort(s.avgLoss)}`} detail={s.avgLoss ? `Reward to risk ${(s.avgWin / s.avgLoss).toFixed(2)}` : undefined} />
            <StatTile label="Charges paid" serif value={inr(s.charges)} needsAction={chPct >= 0.25} actionText="Look at this"
              detail={chPct ? `${pc(chPct)} of gross ${s.gross > 0 ? 'P&L' : 'profit'}` : undefined} />
          </div>

          <Section id="journal.insights" title="What your trades say" bodyClassName="space-y-3"
            summary={flags[0] ?? 'No strong patterns yet'}
            actions={<Button size="sm" variant="primary" leading={<SparkleIcon width={14} height={14} />} onClick={() => ask('review my trades')}>Ask AI to review my trades</Button>}>
            {flags.length === 0 ? <p className="text-[13px] text-fg-muted">No strong patterns yet. Flags appear once there are enough trades to compare.</p> : (<>
              <AgentNote label="Biggest pattern">{flags[0]}</AgentNote>
              {flags.length > 1 && <ul className="space-y-2">{flags.slice(1).map((f) => <li key={f} className="flex gap-2 text-[13px] leading-6"><InfoIcon width={14} height={14} className="mt-1 shrink-0 text-fg-subtle" aria-hidden />{f}</li>)}</ul>}
            </>)}
            <p className="text-[11px] text-fg-subtle">Computed from your journal with fixed rules. Patterns in small samples can be chance.</p>
          </Section>

          <div className="grid items-start gap-4 xl:grid-cols-2">
            <Calendar ts={ts} period={period} />
            <Section id="journal.equity" title="Account growth" summary={<>Net <Money v={s.net} /> over {curve.x.length} trading day{curve.x.length === 1 ? '' : 's'}</>}>
              <LineChart series={[{ id: 'eq', label: 'Cumulative net P&L', data: curve.y }]} x={curve.x} formatValue={inrShort} height={200} zeroBaseline ariaLabel="Cumulative net P&L by day" />
            </Section>
          </div>

          <Section id="journal.breakdowns" title="Breakdowns" defaultOpen={false} summary="By weekday, setup, source, exit and instrument" bodyClassName="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            <Weekdays rows={br.weekday} />
            <Breakdown title="By strategy" head="Strategy" rows={br.tag} />
            <Breakdown title="By how it was placed" head="Placed by" rows={br.via} />
            <Breakdown title="By exit" head="Exit reason" rows={br.exit} />
            <Breakdown title="By type of trade" head="Type" rows={br.kind} />
          </Section>

          <Section id="journal.log" title="Trade log" sub={`${log.length} trades`} defaultOpen={false} summary={`${log.length} trade${log.length === 1 ? '' : 's'}`} bodyClassName="!px-0 !pb-0">
            <div className="scroll-thin overflow-x-auto">
              <table className="tbl">
                <thead><tr>
                  <th aria-sort={sort.by === 'date' ? (sort.desc ? 'descending' : 'ascending') : undefined}>{sortBtn('date', 'Closed')}</th>
                  <th className="!text-left">Instrument</th><th>Side</th><th>Qty</th><th>Entry</th><th>Exit</th><th>Gross</th><th>Charges</th>
                  <th aria-sort={sort.by === 'pnl' ? (sort.desc ? 'descending' : 'ascending') : undefined}>{sortBtn('pnl', 'Net')}</th>
                  <th className="!text-left">Tag</th><th className="!text-left">Via</th><th className="!text-left">Exit</th>
                </tr></thead>
                <tbody>{log.slice(0, limit).map((t) => (
                  <tr key={t.id}>
                    <td>{fmtTime.format(t.close)}</td>
                    <td className="!text-left !font-sans">{label(t.key)}{parseKey(t.key).exp === 'PAST' && <span className="ml-1 text-[11px] text-fg-subtle">expired</span>}{t.sample && <span className="ml-1 text-[11px] text-fg-subtle">· sample</span>}</td>
                    <td className="!font-sans">{t.side === 'LONG' ? 'Long' : 'Short'}</td><td>{t.qty}</td><td>{t.entry.toFixed(2)}</td><td>{t.exit.toFixed(2)}</td>
                    <td><Money v={t.pnl} /></td><td className="text-fg-muted">{inr(t.charges)}</td><td><Money v={t.net} className="font-bold" /></td>
                    <td className="!text-left !font-sans">{t.tag ?? '—'}</td><td className="!text-left !font-sans">{t.via}</td><td className="!text-left !font-sans">{t.exitReason ?? '—'}</td>
                  </tr>))}</tbody>
              </table>
            </div>
            {log.length > limit && <div className="border-t border-line p-3 text-center"><Button size="sm" variant="secondary" onClick={() => setLimit(limit + 100)}>Show {Math.min(100, log.length - limit)} more</Button></div>}
          </Section>
        </>)}
      </div>
    </div>
  )
}

function Calendar({ ts, period }: { ts: T[]; period: Period }) {
  const { weeks, max, best, worst, inRange } = useMemo(() => {
    const byDay = new Map<string, { net: number; n: number }>()
    for (const t of ts) { const d = byDay.get(t.day) ?? { net: 0, n: 0 }; d.net += t.net; d.n++; byDay.set(t.day, d) }
    const end = new Date(); end.setHours(12, 0, 0, 0)
    const first = period === 'all' ? Math.min(...ts.map((t) => t.close)) : Date.now() - (period === '7d' ? 7 : 30) * DAY
    const from = dayKey(first)
    // At least six weeks so short periods still read as a calendar; days outside the period are faded.
    const start = new Date(Math.min(first, end.getTime() - 41 * DAY)); start.setHours(12, 0, 0, 0); start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
    const weeks: { key: string; date: Date; v?: { net: number; n: number } }[][] = []
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      if ((d.getDay() + 6) % 7 === 0) weeks.push([])
      const key = dayKey(d.getTime()); weeks[weeks.length - 1].push({ key, date: new Date(d), v: byDay.get(key) })
    }
    const nets = [...byDay.values()].map((v) => v.net)
    return { weeks, max: Math.max(1, ...nets.map(Math.abs)), best: nets.length ? Math.max(...nets) : 0, worst: nets.length ? Math.min(...nets) : 0, inRange: (k: string) => k >= from }
  }, [ts, period])
  const bg = (net: number) => {
    const t = Math.min(1, Math.abs(net) / max), c = net >= 0 ? 'success' : 'danger'
    return t < 0.5 ? `color-mix(in oklab, var(--${c}-soft) ${Math.round(40 + t * 120)}%, var(--surface))` : `color-mix(in oklab, var(--${c}) ${Math.round((t - 0.5) * 110)}%, var(--${c}-soft))`
  }
  return (
    <Section id="journal.calendar" title="P&L calendar" summary={<>Best day <Money v={best} /> · worst <Money v={worst} /></>}>
      <div className="scroll-thin overflow-x-auto pb-1">
        <div className="inline-flex gap-1" role="group" aria-label="Net P&L by day">
          <div className="grid grid-rows-7 gap-1 pr-1 text-[10px] leading-[14px] text-fg-subtle" aria-hidden>{['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].map((d, i) => <span key={i} className="h-3.5">{d}</span>)}</div>
          {weeks.map((w, i) => (
            <div key={i} className="grid grid-rows-7 gap-1">
              {w.map((c) => {
                const net = c.v?.net ?? 0
                const text = `${fmtDay.format(c.date)}: ${c.v ? `${sign(net)} net, ${c.v.n} trade${c.v.n > 1 ? 's' : ''}` : 'no trades'}`
                return <div key={c.key} role="img" aria-label={text} title={text}
                  className={cn('flex size-3.5 items-center justify-center rounded-[3px] text-[9px] font-bold leading-none', !c.v && 'border border-line', !inRange(c.key) && 'opacity-35', c.v && (net >= 0 ? 'text-success-fg' : 'text-danger-fg'))}
                  style={c.v ? { background: bg(net) } : undefined}>{c.v ? (net >= 0 ? '+' : '−') : ''}</div>
              })}
            </div>))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle" aria-hidden>
        <span>Loss</span>{[-1, -0.6, -0.2].map((v) => <i key={v} className="size-3 rounded-[3px]" style={{ background: bg(v * max) }} />)}
        <i className="size-3 rounded-[3px] border border-line" />{[0.2, 0.6, 1].map((v) => <i key={v} className="size-3 rounded-[3px]" style={{ background: bg(v * max) }} />)}<span>Profit</span>
        <span className="ml-auto">Darker means larger. Biggest day {inr(max)}.</span>
      </div>
    </Section>
  )
}

function Weekdays({ rows }: { rows: Group[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.net)))
  return (
    <section className="rounded-[10px] border border-line bg-surface p-4">
      <h3 className="mb-2 text-[13px] font-semibold text-fg">By weekday</h3>
      <ul className="space-y-2">{rows.map((r) => (
        <li key={r.k} className={cn('grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 rounded-lg px-1.5 py-1 text-[12px]', r.k === 'Tue' && 'bg-sunken')}>
          <span className="flex items-center gap-1">{r.k}{r.k === 'Tue' && <span className="sr-only"> (expiry day)</span>}</span>
          <div className="relative h-2.5 rounded-full bg-sunken" aria-hidden>
            <div className="absolute top-0 h-full rounded-md" style={{ left: r.net >= 0 ? '50%' : `${50 - (Math.abs(r.net) / max) * 50}%`, width: `${(Math.abs(r.net) / max) * 50}%`, background: r.net >= 0 ? 'var(--success)' : 'var(--danger)' }} />
            <div className="absolute left-1/2 top-[-2px] h-[14px] w-px bg-line-strong" />
          </div>
          <span className="flex items-center gap-2 whitespace-nowrap"><Money v={r.net} /><span className="num w-24 text-right text-fg-subtle">{pc(r.wins / r.n)} · {r.n}</span></span>
          {r.k === 'Tue' && <span className="col-span-3 -mt-1 pl-[60px]"><Badge tone="neutral">Weekly expiry</Badge></span>}
        </li>))}
      </ul>
      <p className="mt-2 text-[11px] text-fg-subtle">Net P&amp;L, then win rate · trades.</p>
    </section>
  )
}

function Breakdown({ title, head, rows }: { title: string; head: string; rows: Group[] }) {
  return (
    <section className="rounded-[10px] border border-line bg-surface">
      <h3 className="px-4 pt-3 text-[13px] font-semibold text-fg">{title}</h3>
      <div className="scroll-thin mt-1 overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>{head}</th><th>Trades</th><th>Win rate</th><th>Net P&amp;L</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.k}><td className="!font-sans">{r.k}</td><td>{r.n}</td><td>{pc(r.wins / r.n)}</td><td><Money v={r.net} /></td></tr>)}</tbody>
        </table>
      </div>
    </section>
  )
}
