// The agent watching your open positions. Between fills, stops and targets the book is silent; this speaks up at
// the moments a trader would want a nudge: price closing in on the stop, closing in on the target, or sliding
// with no stop at all. Each nudge fires once, and re-arms only after price moves well away again.
import { useStore } from './store'
import { labelOf, parseKey } from './market'

/** How close counts as "close": the share of the entry-to-level distance still left. */
const NEAR_STOP = 0.3, NEAR_TARGET = 0.25, REARM = 0.6
/** Sliding without a stop: an adverse move from entry, in percent. */
const NAKED_MOVE = 1

const fired = new Set<string>()
const inr = (n: number) => `${n < 0 ? '−' : '+'}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
const px = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

/** Where a position sits: share of the way from entry to stop (0 = at entry, 1 = at stop), and to target. */
export function progress(avg: number, ltp: number, long: boolean, sl?: number, tgt?: number) {
  const d = long ? ltp - avg : avg - ltp
  return {
    toStop: sl != null && Math.abs(avg - sl) > 0 ? Math.max(0, -d) / Math.abs(avg - sl) : undefined,
    toTarget: tgt != null && Math.abs(tgt - avg) > 0 ? Math.max(0, d) / Math.abs(tgt - avg) : undefined,
  }
}

function check() {
  const s = useStore.getState()
  const open = Object.values(s.positions).filter((p) => p.qty)
  const live = new Set(open.map((p) => p.key))
  for (const k of fired) if (!live.has(k.split('|')[0])) fired.delete(k) // closed positions start fresh next time
  for (const p of open) {
    const ltp = s.ltp(p.key); const long = p.qty > 0; const br = s.brackets[p.key]; const und = parseKey(p.key).und.toLowerCase()
    const pl = (ltp - p.avg) * p.qty; const label = labelOf(p.key)
    const { toStop, toTarget } = progress(p.avg, ltp, long, br?.sl, br?.tgt)
    const once = (id: string, near: boolean, far: boolean, say: () => void) => {
      const key = `${p.key}|${id}`
      if (near && !fired.has(key)) { fired.add(key); say() } else if (far) fired.delete(key)
    }
    if (toStop != null) once('stop', toStop >= 1 - NEAR_STOP, toStop < 1 - REARM, () => {
      const gap = Math.abs(ltp - br!.sl!) / ltp * 100
      s.event(`**${label} is ${gap.toFixed(1)}% from your stop** at ${px(br!.sl!)}, now ${px(ltp)} (${inr(pl)} open). If it hits, the stop closes it. Hold, or exit now?`, 'attention', [{ k: 'position', key: p.key }], [`square off ${und}`, `manage ${und}`])
    })
    if (toTarget != null) once('target', toTarget >= 1 - NEAR_TARGET, toTarget < 1 - REARM, () => {
      const trail = +(Math.abs(br!.tgt! - p.avg) * 0.5).toFixed(1)
      s.event(`**${label} is close to your target** at ${px(br!.tgt!)}, now ${px(ltp)} (${inr(pl)} open). Trailing the stop would lock in some of this if it turns.`, 'good', [{ k: 'position', key: p.key }], [`trail my ${und} stop by ${trail}`, `move ${und} stop to ${p.avg.toFixed(1)}`])
    })
    if (br?.sl == null && !parseKey(p.key).strike) {
      const against = (long ? p.avg - ltp : ltp - p.avg) / p.avg * 100
      once('naked', against >= NAKED_MOVE, against < NAKED_MOVE / 3, () => {
        s.event(`**${label} is ${against.toFixed(1)}% against you with no stop** (${inr(pl)} open). Nothing limits the loss from here.`, 'attention', [{ k: 'position', key: p.key }], [`protect my ${und}`, `square off ${und}`])
      })
    }
  }
}

// Prices tick every second; checking every two is plenty and keeps this off the render path.
let last = 0
useStore.subscribe((st, prev) => {
  if (st.prices === prev.prices) return
  const now = Date.now(); if (now - last < 2000) return
  last = now; check()
})
