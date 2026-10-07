import { useStore } from './store'
import { chain, nextExpiries, bySym, type Leg } from './market'
import { SegmentedControl } from './ds'

export default function Chain() {
  const { sym, expiryIdx, setExpiry, prices, legs, setLegs, setView, setToast } = useStore()
  const inst = bySym(sym)!; const spot = prices[sym].ltp; const ex = nextExpiries(sym)
  const ei = Math.min(expiryIdx, ex.length - 1); const rows = chain(sym, spot, ex[ei].T, 21)
  const maxOi = Math.max(...rows.flatMap((r) => [r.ce.oi, r.pe.oi]))
  const coi = rows.reduce((a, r) => a + r.ce.oi, 0), poi = rows.reduce((a, r) => a + r.pe.oi, 0)
  const atmRow = rows.find((r) => r.atm)!
  // Max pain: the expiry price at which option writers pay out the least.
  const maxPain = rows.reduce((best, x) => { const pain = rows.reduce((t, y) => t + Math.max(x.strike - y.strike, 0) * y.ce.oi + Math.max(y.strike - x.strike, 0) * y.pe.oi, 0); return pain < best.p ? { p: pain, k: x.strike } : best }, { p: Infinity, k: 0 }).k
  const add = (strike: number, type: 'CE' | 'PE', side: 'BUY' | 'SELL') => {
    const l: Leg = { side, type, strike, lots: 1 }; setLegs([...legs, l], 'custom'); setView('strategy')
    setToast(`Added ${side === 'BUY' ? 'buy' : 'sell'} ${strike} ${type} to the strategy`)
  }
  const L = (n: number) => (n / 1e5).toFixed(1) + 'L'
  const Bar = ({ v, tone }: { v: number; tone: 'up' | 'down' }) => <span aria-hidden className="mx-1.5 inline-block h-1.5 rounded-full align-middle" style={{ width: (v / maxOi) * 44, background: `var(--${tone === 'up' ? 'success' : 'danger'})` }} />
  const Trade = ({ v, strike, type }: { v: number; strike: number; type: 'CE' | 'PE' }) => (
    <span className="inline-flex items-center gap-1.5">
      <button aria-label={`Buy ${strike} ${type}`} onClick={() => add(strike, type, 'BUY')} className="h-5 rounded-full bg-success-soft px-1.5 font-sans text-[10px] font-bold text-success-fg opacity-0 group-hover:opacity-100 focus:opacity-100">B</button>
      <button aria-label={`Sell ${strike} ${type}`} onClick={() => add(strike, type, 'SELL')} className="h-5 rounded-full bg-danger-soft px-1.5 font-sans text-[10px] font-bold text-danger-fg opacity-0 group-hover:opacity-100 focus:opacity-100">S</button>
      <b className="inline-block min-w-14">{v.toFixed(2)}</b>
    </span>)
  const chg = (n: number) => <span className={n >= 0 ? 'text-up' : 'text-down'}>{n >= 0 ? '+' : '−'}{L(Math.abs(n))}</span>
  return (
    <div>
      <div className="sticky left-0 flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <SegmentedControl size="sm" label="Expiry" value={String(ei)} onChange={(v) => setExpiry(+v)} options={ex.map((e, i) => ({ value: String(i), label: e.label }))} />
        <span className="ml-auto text-[12px] text-fg-subtle">Max pain <b className="num text-fg">{maxPain}</b> · ATM straddle <b className="num text-fg">{(atmRow.ce.ltp + atmRow.pe.ltp).toFixed(1)}</b> (±{((atmRow.ce.ltp + atmRow.pe.ltp) / spot * 100).toFixed(1)}%) · ATM IV <b className="num text-fg">{((atmRow.ce.iv + atmRow.pe.iv) / 2).toFixed(1)}</b> · PCR <b className="num text-fg">{(poi / coi).toFixed(2)}</b> · Lot <b className="num text-fg">{inst.lot}</b> · Spot <b className="num text-fg">{spot.toFixed(2)}</b></span>
      </div>
      <table className="tbl chain min-w-[860px]">
        <thead>
          <tr><th colSpan={5} className="!text-center">Calls</th><th /><th colSpan={5} className="!text-center">Puts</th></tr>
          <tr><th>OI change</th><th>OI</th><th>IV</th><th>Delta</th><th>LTP</th><th className="!text-center">Strike</th><th>LTP</th><th>Delta</th><th>IV</th><th>OI</th><th>OI change</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => { const ci = r.strike < spot ? ' itm' : '', pi = r.strike > spot ? ' itm' : ''; return (
            <tr key={r.strike} className={'group' + (r.atm ? ' atm' : '')}>
              <td className={'ce' + ci}>{chg(r.ce.chgOi)}</td>
              <td className={'ce' + ci}>{L(r.ce.oi)}<Bar v={r.ce.oi} tone="down" /></td>
              <td className={'ce' + ci}>{r.ce.iv.toFixed(1)}</td>
              <td className={'ce' + ci}>{r.ce.delta.toFixed(2)}</td>
              <td className={'ce' + ci}><Trade v={r.ce.ltp} strike={r.strike} type="CE" /></td>
              <td className="k">{r.strike}{r.atm && <span className="ml-1 font-sans text-[10px] font-normal text-fg-subtle">ATM</span>}</td>
              <td className={'pe' + pi}><Trade v={r.pe.ltp} strike={r.strike} type="PE" /></td>
              <td className={'pe' + pi}>{r.pe.delta.toFixed(2)}</td>
              <td className={'pe' + pi}>{r.pe.iv.toFixed(1)}</td>
              <td className={'pe' + pi}><Bar v={r.pe.oi} tone="up" />{L(r.pe.oi)}</td>
              <td className={'pe' + pi}>{chg(r.pe.chgOi)}</td>
            </tr>) })}
        </tbody>
      </table>
      <p className="px-4 py-3 text-[11px] text-fg-subtle">Shaded cells are in the money. Bars show open interest: tall call OI marks resistance, tall put OI marks support.</p>
    </div>
  )
}
