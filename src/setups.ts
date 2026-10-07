// Today's setups: a short list of watchlist stocks whose chart is at a decision point, each with an exact entry, stop
// and target, so the next step is "set a GTT" rather than "go research". Three patterns, all from the same daily data
// the scanner uses. They describe price structure; they are not recommendations.
import { bySym, history, levels, atr } from './market'
import { metricsFor } from './scan'

export type Setup = {
  sym: string; kind: 'Breakout' | 'Pullback' | 'Bounce'
  /** Why it's on the list, in one line. */
  why: string
  entry: number; stop: number; target: number; dir: 'above' | 'below'
  /** Lower is closer to triggering; used to sort. */
  dist: number
}

const tick = (p: number) => +(Math.round(p / 0.05) * 0.05).toFixed(2)

export function setupsFor(watch: string[], ltpOf: (s: string) => number): Setup[] {
  const out: Setup[] = []
  for (const sym of watch) {
    const inst = bySym(sym); if (!inst || inst.seg !== 'EQ') continue
    const m = metricsFor(sym); if (!m) continue
    const ltp = ltpOf(sym); const d = history(inst, '1D', 160, ltp); const a = atr(d).at(-1)!
    const lv = levels(d, 6)
    const res = lv.filter((x) => x.kind === 'resistance').sort((x, y) => x.price - y.price)[0]
    const sup = lv.filter((x) => x.kind === 'support').sort((x, y) => y.price - x.price)[0]
    // Breakout: just under a resistance that has held at least twice, with volume showing up.
    if (res && (res.price - ltp) / ltp < 0.02 && m.volx >= 1.1) {
      const entry = tick(res.price * 1.002), stop = tick(Math.max(sup?.price ?? 0, entry - 1.5 * a)), target = tick(entry + 2 * (entry - stop))
      out.push({ sym, kind: 'Breakout', dir: 'above', entry, stop, target, dist: (entry - ltp) / ltp, why: `${((res.price - ltp) / ltp * 100).toFixed(1)}% under resistance at ${res.price.toFixed(0)} (held ${res.touches}×), volume ${m.volx.toFixed(1)}×` })
      continue
    }
    // Pullback: uptrend intact, price back near its 20-day average.
    if (m.above50 > 0 && m.above200 > 0 && m.above20 > -1 && m.above20 < 1.5) {
      const entry = tick(ltp), stop = tick(m.ema20 - a), target = tick(entry + 2 * (entry - stop))
      if (entry > stop) out.push({ sym, kind: 'Pullback', dir: 'above', entry, stop, target, dist: Math.abs(m.above20) / 100, why: `Uptrend, back at its 20-day average (${m.ema20.toFixed(0)}); RSI ${m.rsi.toFixed(0)}` })
      continue
    }
    // Bounce: oversold, but still above the 200-day average.
    if (m.rsi < 35 && m.above200 > 0) {
      const entry = tick(ltp * 1.005), stop = tick(Math.min(sup?.price ?? ltp - a, ltp - a)), target = tick(entry + 2 * (entry - stop))
      if (entry > stop) out.push({ sym, kind: 'Bounce', dir: 'above', entry, stop, target, dist: 0.005, why: `RSI ${m.rsi.toFixed(0)}, oversold while still above its 200-day average` })
    }
  }
  return out.sort((x, y) => x.dist - y.dist).slice(0, 3)
}
