import { useMemo, useState } from 'react'
import { useStore } from './store'
import { SECTORS } from './market'
import { allMetrics, applyFilters, describeFilter, FIELDS, PRESETS, type Metrics } from './scan'
import type { Filter } from './actions'
import { Chg, Section, SortMark, ViewHeader, inrShort } from './ui'
import { Button, EmptyState, IconButton, Popover, SegmentedControl, cn } from './ds'
import { ArrowRightIcon, BookmarkIcon, CheckIcon, PlusIcon, XIcon } from './ds/lib/icons'
import { BellIcon } from './chart/icons'

/* Sections: presets (scanner.presets) and results (scanner.results) both open by default; active conditions stay always visible.
   Folding presets lets the results table take the full width. */
type Group = 'Intraday' | 'Swing' | 'Investing'
type Op = Filter['op']
/** Presets whose best results are the lowest values: they sort ascending. */
const ASC = new Set(['gapdn', 'oversold', 'lo52'])
/** Always-on columns after Symbol / LTP / Change. */
const FIXED = ['rsi', 'volx', 'rs', 'pe']
const field = 'h-8 rounded-md border border-line bg-surface px-3 text-[12px] text-fg outline-none focus:border-fg-subtle'

/** Format a metric value with its unit, sign shown for percent fields. */
function fmt(f: string, v: number | string | boolean) {
  const m = FIELDS[f]
  if (typeof v === 'boolean' || m?.kind === 'bool') return Number(v) ? 'Yes' : 'No'
  if (typeof v === 'string') return v
  if (f === 'rsi' || f === 'pe' || f === 'pb' || f === 'de') return v ? v.toFixed(1) : '—'
  switch (m?.unit) {
    case '%': return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}%`
    case 'x': return `${v.toFixed(1)}×`
    case 'cr': return inrShort(v * 1e7)
    case '₹': return v.toFixed(2)
    default: return v.toFixed(2)
  }
}
const shortLabel: Record<string, string> = { volx: 'Vol×', rs: '3m RS', pe: 'P/E', rsi: 'RSI', fromHi52: 'From 52w H', fromLo52: 'From 52w L', brk20: '20d breakout', above20: 'vs 20 EMA', above50: 'vs 50 EMA', above200: 'vs 200 EMA', gap: 'Gap', atrp: 'ATR %', mcap: 'Mcap', epsG: 'EPS gr.', salesG: 'Sales gr.', div: 'Div yld', roe: 'ROE', de: 'D/E', pb: 'P/B', r1w: '1w', r1m: '1m', r3m: '3m', r1y: '1y', nr7: 'NR7', fno: 'F&O', ltp: 'LTP', chg: 'Change' }

export default function Scanner() {
  const { scan, setScan, watch, watchOp, setSym, setView, addTrigger, setToast } = useStore()
  // Metrics are heavy-ish (EMA/RSI over a year per stock): recompute at most every 3 s.
  const bucket = Math.floor(Date.now() / 3000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rows = useMemo(() => allMetrics(), [bucket])
  const counts = useMemo(() => Object.fromEntries(PRESETS.map((p) => [p.id, applyFilters(rows, p.filters).length])), [rows])
  const active = PRESETS.find((p) => p.name === scan.name)
  const [group, setGroup] = useState<Group>(active?.group ?? 'Swing')
  const [alertFor, setAlertFor] = useState<string | null>(null)
  const presetsOpen = useStore((s) => s.sections['scanner.presets'] ?? true)

  const desc = !scan.sort.startsWith('-')
  const sortKey = scan.sort.replace(/^-/, '') || 'chg'
  const results = useMemo(() => {
    const out = applyFilters(rows, scan.filters)
    const get = (r: Metrics) => (r as unknown as Record<string, number | string>)[sortKey]
    return out.sort((a, b) => { const x = get(a), y = get(b); const c = typeof x === 'string' ? String(x).localeCompare(String(y)) : Number(x) - Number(y); return desc ? -c : c })
  }, [rows, scan.filters, sortKey, desc])

  const cols = useMemo(() => {
    const extra = [...scan.filters.map((f) => f.field), sortKey].filter((f) => FIELDS[f] && !['sector', 'ltp', 'chg', 'sym', 'name'].includes(f) && !FIXED.includes(f))
    return [...new Set(extra), ...FIXED]
  }, [scan.filters, sortKey])

  const setFilters = (filters: Filter[]) => setScan({ filters, name: filters.length ? 'Custom scan' : '' })
  const runPreset = (p: (typeof PRESETS)[number]) => setScan({ filters: p.filters, name: p.name, sort: (ASC.has(p.id) ? '-' : '') + p.sort })
  const sortBy = (k: string) => setScan({ sort: k === sortKey ? (desc ? '-' : '') + k : k })
  const sectorFilter = scan.filters.find((f) => f.field === 'sector' && f.op === 'in')
  const sectors = sectorFilter ? (Array.isArray(sectorFilter.value) ? sectorFilter.value : [String(sectorFilter.value)]) : []
  const setSectors = (s: string[]) => {
    const rest = scan.filters.filter((f) => !(f.field === 'sector' && f.op === 'in'))
    setScan({ filters: s.length ? [...rest, { field: 'sector', op: 'in', value: s }] : rest, name: active ? 'Custom scan' : scan.name || 'Custom scan' })
  }
  const openChart = (s: string) => { setSym(s); setView('chart') }

  const th = (k: string, label: string, left = false) => (
    <th key={k} aria-sort={sortKey === k ? (desc ? 'descending' : 'ascending') : 'none'} className={left ? '!text-left' : undefined}>
      <button onClick={() => sortBy(k)} className={cn('inline-flex items-center gap-1 rounded-md hover:text-fg', sortKey === k && 'text-fg')} title={FIELDS[k]?.label}>
        {label}{sortKey === k && <SortMark desc={desc} />}
      </button>
    </th>
  )

  return (
    <div className="@container">
      <ViewHeader title="Find stocks" sub={`${scan.name || 'All stocks'} · simulated data`}>
        {scan.filters.length > 0 && <Button size="sm" variant="ghost" onClick={() => setScan({ filters: [], name: '', sort: 'chg' })}>Clear scan</Button>}
      </ViewHeader>
      <div className={cn('grid gap-4 p-4', presetsOpen && '@4xl:grid-cols-[260px_minmax(0,1fr)]')}>
        {/* Presets */}
        <Section id="scanner.presets" title="Preset scans" summary={active?.name ?? `${PRESETS.length} ready-made scans`} className="self-start" bodyClassName="space-y-3">
          <SegmentedControl size="sm" label="Scan group" value={group} onChange={setGroup} options={(['Intraday', 'Swing', 'Investing'] as const).map((g) => ({ value: g, label: g }))} />
          <ul className="grid gap-2 @md:grid-cols-2 @4xl:grid-cols-1">
            {PRESETS.filter((p) => p.group === group).map((p) => { const on = active?.id === p.id; return (
              <li key={p.id}>
                <button onClick={() => runPreset(p)} aria-pressed={on} className={cn('w-full rounded-[10px] border p-3 text-left transition-colors', on ? 'border-fg bg-sunken' : 'border-line bg-surface hover:bg-hover')}>
                  <div className="flex items-baseline justify-between gap-2"><span className="font-bold">{p.name}</span><span className="num text-[11px] text-fg-subtle">{counts[p.id]} stocks</span></div>
                  <p className="mt-0.5 text-[12px] text-fg-muted">{p.desc}</p>
                </button>
              </li>) })}
          </ul>
          <p className="text-[12px] text-fg-subtle">Tip: ask the assistant <i>“stocks near 52-week high with volume 2x in IT”</i> and the scan appears here.</p>
        </Section>

        <div className="min-w-0 space-y-3">
          {/* Active conditions */}
          <div className="flex flex-wrap items-center gap-2" aria-label="Active conditions">
            {scan.filters.map((f, i) => (
              <span key={i} className="inline-flex h-8 items-center gap-1 rounded-md border border-line bg-sunken pl-3 pr-1 text-[12px]">
                {describeFilter(f)}
                <button aria-label={`Remove condition: ${describeFilter(f)}`} onClick={() => setFilters(scan.filters.filter((_, j) => j !== i))} className="inline-flex size-6 items-center justify-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg"><XIcon width={12} height={12} /></button>
              </span>))}
            {!scan.filters.length && <span className="text-[12px] text-fg-subtle">No conditions. Showing every stock.</span>}
            <AddCondition onAdd={(f) => setFilters([...scan.filters, f])} />
            <Popover label="Sectors" trigger={({ toggle, triggerProps }) => (
              <Button size="sm" variant="secondary" onClick={toggle} {...triggerProps}>Sectors{sectors.length ? ` · ${sectors.length}` : ''}</Button>)}>
              <div className="w-64 p-2">
                <div className="scroll-thin max-h-72 overflow-auto">
                  {SECTORS.map((s) => (
                    <label key={s} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] hover:bg-hover">
                      <input type="checkbox" checked={sectors.includes(s)} onChange={(e) => setSectors(e.target.checked ? [...sectors, s] : sectors.filter((x) => x !== s))} />{s}
                    </label>))}
                </div>
                {sectors.length > 0 && <Button size="sm" variant="ghost" className="mt-1 w-full" onClick={() => setSectors([])}>Any sector</Button>}
              </div>
            </Popover>
          </div>

          <p className="text-[12px] text-fg-subtle" aria-live="polite"><span className="num text-fg">{results.length}</span> of <span className="num">{rows.length}</span> stocks · prices are simulated</p>

          <Section id="scanner.results" title="Results" summary={`${results.length} of ${rows.length} stocks`} bodyClassName={results.length ? '!px-0 !pb-0' : undefined}>
          {results.length === 0
            ? <EmptyState variant="no-results" compact layout="start" title="No stocks match every condition"
                action={scan.filters.length > 1 ? <Button size="sm" variant="secondary" onClick={() => setFilters(scan.filters.slice(0, -1))}>Remove the last condition</Button> : undefined}>
                Loosen one condition, for example widen a percentage or drop the sector filter.
              </EmptyState>
            : <div className="scroll-thin overflow-x-auto rounded-b-[10px]">
                <table className="tbl">
                  <thead><tr>
                    {th('sym', 'Symbol', true)}{th('ltp', 'Price')}{th('chg', 'Change')}
                    {cols.map((c) => th(c, shortLabel[c] ?? FIELDS[c].label))}
                    <th><span className="sr-only">Actions</span></th>
                  </tr></thead>
                  <tbody>
                    {results.map((r) => { const inWatch = watch.includes(r.sym); const rec = r as unknown as Record<string, number | string | boolean>; return [
                      <tr key={r.sym}>
                        <td className="!font-sans">
                          <button onClick={() => openChart(r.sym)} className="text-left hover:underline"><span className="font-bold">{r.sym}</span></button>
                          <div className="max-w-[18ch] truncate text-[11px] text-fg-subtle">{r.name} · {r.sector}</div>
                        </td>
                        <td>{r.ltp.toFixed(2)}</td>
                        <td><Chg v={r.chg} /></td>
                        {cols.map((c) => <td key={c}>{c === 'rs' ? <Chg v={r.rs} digits={1} /> : fmt(c, rec[c])}</td>)}
                        <td>
                          <div className="flex justify-end gap-0.5">
                            <IconButton size="sm" label={`Open ${r.sym} chart`} onClick={() => openChart(r.sym)}><ArrowRightIcon width={14} height={14} /></IconButton>
                            <IconButton size="sm" label={inWatch ? `Remove ${r.sym} from watchlist` : `Add ${r.sym} to watchlist`} active={inWatch}
                              onClick={() => { watchOp(inWatch ? 'remove' : 'add', r.sym); setToast(`${inWatch ? 'Removed' : 'Added'} ${r.sym} ${inWatch ? 'from' : 'to'} watchlist`) }}>
                              {inWatch ? <CheckIcon width={14} height={14} /> : <BookmarkIcon width={14} height={14} />}
                            </IconButton>
                            <IconButton size="sm" label={`Set price alert on ${r.sym}`} active={alertFor === r.sym} aria-expanded={alertFor === r.sym} onClick={() => setAlertFor(alertFor === r.sym ? null : r.sym)}><BellIcon width={14} height={14} /></IconButton>
                          </div>
                        </td>
                      </tr>,
                      alertFor === r.sym && <tr key={r.sym + '-alert'}><td colSpan={cols.length + 4} className="!bg-sunken !font-sans">
                        <AlertForm m={r} onCancel={() => setAlertFor(null)} onSet={(dir, price) => { addTrigger({ sym: r.sym, dir, price }); setToast(`Alert set: ${r.sym} ${dir} ₹${price}`); setAlertFor(null) }} />
                      </td></tr>,
                    ] })}
                  </tbody>
                </table>
              </div>}
          </Section>
        </div>
      </div>
    </div>
  )
}

function AddCondition({ onAdd }: { onAdd: (f: Filter) => void }) {
  const keys = Object.keys(FIELDS).filter((k) => FIELDS[k].kind !== 'text')
  const [f, setF] = useState('rsi'); const [op, setOp] = useState<Op>('>'); const [v, setV] = useState('60')
  const bool = FIELDS[f].kind === 'bool'
  return (
    <Popover label="Add condition" trigger={({ toggle, triggerProps }) => (
      <Button size="sm" variant="secondary" onClick={toggle} {...triggerProps} leading={<PlusIcon width={14} height={14} />}>Add condition</Button>)}>
      {({ close }) => (
        <form className="w-72 space-y-2 p-3" onSubmit={(e) => { e.preventDefault(); if (!bool && v.trim() === '') return; onAdd(bool ? { field: f, op: '=', value: Number(v) ? 1 : 0 } : { field: f, op, value: Number(v) }); close() }}>
          <p className="text-[13px] font-semibold text-fg">Add condition</p>
          <label className="block text-[12px] text-fg-subtle">Field
            <select value={f} onChange={(e) => { setF(e.target.value); if (FIELDS[e.target.value].kind === 'bool') setV('1') }} className={cn(field, 'mt-1 w-full')}>
              {keys.map((k) => <option key={k} value={k}>{FIELDS[k].label}{FIELDS[k].unit && FIELDS[k].unit !== '₹' ? ` (${FIELDS[k].unit})` : ''}</option>)}
            </select>
          </label>
          {bool
            ? <SegmentedControl size="sm" label="Value" value={Number(v) ? '1' : '0'} onChange={setV} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
            : <div className="flex gap-2">
                <select aria-label="Operator" value={op} onChange={(e) => setOp(e.target.value as Op)} className={cn(field, 'w-28')}>
                  <option value=">">above</option><option value=">=">at least</option><option value="<">below</option><option value="<=">at most</option>
                </select>
                <input aria-label="Value" type="number" step="any" value={v} onChange={(e) => setV(e.target.value)} className={cn(field, 'num min-w-0 flex-1')} />
              </div>}
          <div className="flex gap-2 pt-1"><Button size="sm" type="submit">Add</Button><Button size="sm" variant="ghost" onClick={close}>Cancel</Button></div>
        </form>)}
    </Popover>
  )
}

function AlertForm({ m, onSet, onCancel }: { m: Metrics; onSet: (dir: 'above' | 'below', price: number) => void; onCancel: () => void }) {
  const [px, setPx] = useState(+(m.ltp * 1.02).toFixed(1))
  const dir = px >= m.ltp ? 'above' : 'below'
  const picks = [{ label: '+2%', v: m.ltp * 1.02 }, { label: '−2%', v: m.ltp * 0.98 }, { label: '52-week high', v: m.hi52 }]
  return (
    <form className="flex flex-wrap items-center gap-2 py-1" onSubmit={(e) => { e.preventDefault(); if (px > 0) onSet(dir, +px.toFixed(2)) }}>
      <span className="text-[12px] text-fg-muted">Alert when <b className="text-fg">{m.sym}</b> goes <b className="text-fg">{dir}</b></span>
      <input aria-label={`Alert price for ${m.sym}`} type="number" step={0.05} value={px} onChange={(e) => setPx(+e.target.value)} className={cn(field, 'num w-28')} />
      {picks.map((p) => <button key={p.label} type="button" onClick={() => setPx(+p.v.toFixed(1))} className="h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] text-fg-muted hover:bg-hover hover:text-fg">{p.label}</button>)}
      <Button size="sm" type="submit">Set alert</Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </form>
  )
}
