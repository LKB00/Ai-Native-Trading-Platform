// Insight → rule. The journal can say what is costing you money; this turns each finding into a standing rule you
// switch on with one tap, and the drafts, the gate and the agent then hold you to it. Rules are yours: every one can
// be turned off again from the rules card.
import type { Trade } from './store'

export type Rules = {
  /** Every entry carries a stop. Drafts arrive with one; Place stays off without one. */
  stopRequired?: boolean
  /** Most a single trade may risk (entry to stop), as a percentage of capital. */
  maxRiskPct?: number
  /** No new entries after this time of day, in seconds since IST midnight. */
  noEntryAfter?: number
}
export const DEFAULT_RULES: Rules = {}

export type RuleId = keyof Rules
export const hhmm = (sec: number) => { const h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60); return `${h > 12 ? h - 12 : h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h >= 12 ? 'pm' : 'am'}` }

/** A rule in plain words, for the rules card, chips and the agent. */
export function ruleText(id: RuleId, r: Rules): string {
  switch (id) {
    case 'stopRequired': return 'Every entry needs a stop'
    case 'maxRiskPct': return `Risk at most ${r.maxRiskPct}% of capital per trade`
    case 'noEntryAfter': return `No new entries after ${hhmm(r.noEntryAfter!)}`
  }
}

export type Insight = {
  id: RuleId
  /** The finding, one sentence without its full stop; shown in bold. */
  lead: string
  /** Supporting numbers, as full sentences. */
  detail: string
  /** The rule that answers it. */
  rule: Rules
}

const net = (t: Trade) => t.pnl - t.charges
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const inr = (n: number) => `₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
const istHour = (ms: number) => +new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', hourCycle: 'h23' }).format(new Date(ms))

/**
 * What your last 30 days of trades say, strongest first. Each finding needs enough trades behind it to be more than
 * noise, and is left out once its rule is already on.
 */
export function insights(trades: Trade[], rules: Rules, capital: number): Insight[] {
  const t = trades.filter((x) => x.close > Date.now() - 30 * 864e5)
  const losers = t.filter((x) => net(x) < 0); const out: (Insight & { weight: number })[] = []
  if (losers.length < 3) return []
  const avgLoss = -avg(losers.map(net))

  // Losses that no stop closed: the trader (or the day's limit) did, later.
  const byHand = losers.filter((x) => !/stop/.test(x.exitReason ?? '')); const byStop = losers.filter((x) => /stop/.test(x.exitReason ?? ''))
  if (!rules.stopRequired && byHand.length >= 2) {
    const h = -avg(byHand.map(net)), st = -avg(byStop.map(net))
    out.push({ id: 'stopRequired', weight: -byHand.reduce((a, x) => a + net(x), 0),
      lead: `${byHand.length} of ${losers.length} losing trades were closed by hand, not by a stop`,
      detail: byStop.length && h > st ? `They lost ${(h / st).toFixed(1)}× more on average than the ones a stop closed (${inr(h)} against ${inr(st)}).` : `They averaged ${inr(h)} each.`,
      rule: { stopRequired: true } })
  }

  // One outsized loss: sizing, not direction, is the problem.
  const worst = Math.min(...losers.map(net))
  if (!rules.maxRiskPct && -worst >= 3 * avgLoss && capital > 0) {
    const pct = Math.max(0.5, Math.min(2, Math.round((avgLoss * 1.5 / capital) * 100 * 2) / 2))
    out.push({ id: 'maxRiskPct', weight: -worst - avgLoss,
      lead: `Your largest loss (${inr(worst)}) was ${(-worst / avgLoss).toFixed(1)}× your average loss`,
      detail: `One trade like that undoes several good ones. Capping risk per trade at ${pct}% of capital (${inr(capital * pct / 100)}) sizes every position to the same worst case.`,
      rule: { maxRiskPct: pct } })
  }

  // A time of day that keeps losing.
  if (!rules.noEntryAfter) {
    for (const h of [14, 13]) {
      const late = t.filter((x) => istHour(x.open) >= h), early = t.filter((x) => istHour(x.open) < h)
      const ln = late.reduce((a, x) => a + net(x), 0), en = early.reduce((a, x) => a + net(x), 0)
      if (late.length >= 3 && ln < 0 && avg(late.map(net)) < avg(early.map(net)) - avgLoss * 0.25) {
        out.push({ id: 'noEntryAfter', weight: -ln,
          lead: `Trades you opened after ${hhmm(h * 3600)} lost ${inr(ln)} across ${late.length} trades`,
          detail: `Earlier ones ${en >= 0 ? `made ${inr(en)}` : `lost ${inr(en)}`}. Late entries have less time to work before the 3:20 pm square-off.`,
          rule: { noEntryAfter: h * 3600 } })
        break
      }
    }
  }
  return out.sort((a, b) => b.weight - a.weight)
}
