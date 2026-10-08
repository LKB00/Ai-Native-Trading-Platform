import { SQUARE_OFF, secOfDay, sessionDay, INSTS, bySym, history, chain, nextExpiries, STRATEGIES, SECTORS, levels, atr, rsiSeries, ema, payoff, isExpiryDay, labelOf, parseKey, depth, depthRead, type Leg, type TF } from './market'
import { useStore } from './store'
import { allMetrics, applyFilters, metricsFor, FIELDS, describeFilter } from './scan'
import { patterns } from './Chart'
import type { Action, Card, AIResult, Filter, OrderAction } from './actions'
import { entryGate, isEntry, type Gate } from './gate'
import { ruleText, SETUP_TAGS, tagLabel, isSetupTag, insights, type RuleId } from './rules'
import { styleOf } from './setup'

const ALIAS: Record<string, string> = {
  'bank nifty': 'BANKNIFTY', banknifty: 'BANKNIFTY', 'nifty bank': 'BANKNIFTY', nifty: 'NIFTY', 'nifty 50': 'NIFTY', finnifty: 'FINNIFTY', 'fin nifty': 'FINNIFTY', sensex: 'SENSEX',
  reliance: 'RELIANCE', ril: 'RELIANCE', 'hdfc bank': 'HDFCBANK', hdfc: 'HDFCBANK', infosys: 'INFY', icici: 'ICICIBANK', 'icici bank': 'ICICIBANK', sbi: 'SBIN',
  'tata motors': 'TATAMOTORS', 'l&t': 'LT', airtel: 'BHARTIARTL', 'bharti airtel': 'BHARTIARTL', hul: 'HINDUNILVR', kotak: 'KOTAKBANK', axis: 'AXISBANK', 'bajaj finance': 'BAJFINANCE',
  maruti: 'MARUTI', 'sun pharma': 'SUNPHARMA', 'dr reddy': 'DRREDDY', hcl: 'HCLTECH', 'tech mahindra': 'TECHM', 'asian paints': 'ASIANPAINT', titan: 'TITAN', ultratech: 'ULTRACEMCO',
  'tata steel': 'TATASTEEL', 'jsw steel': 'JSWSTEEL', hindalco: 'HINDALCO', adani: 'ADANIENT', 'adani ports': 'ADANIPORTS', zomato: 'ZOMATO', eternal: 'ZOMATO', dmart: 'DMART',
  'tata power': 'TATAPOWER', 'coal india': 'COALINDIA', 'power grid': 'POWERGRID', 'nifty bees': 'NIFTYBEES', 'gold bees': 'GOLDBEES', gold: 'GOLDBEES',
  ...Object.fromEntries(INSTS.map((i) => [i.sym.toLowerCase(), i.sym])),
}
const aliasKeys = Object.keys(ALIAS).sort((a, b) => b.length - a.length)
const esc = (k: string) => k.replace(/[&.*+?^${}()|[\]\\]/g, '\\$&')
function findSym(t: string): string | undefined {
  for (const k of aliasKeys) if (new RegExp(`(^|[^a-z])${esc(k)}($|[^a-z])`).test(t)) return ALIAS[k]
}
const SECTOR_ALIAS: Record<string, string> = { bank: 'Banks', banks: 'Banks', banking: 'Banks', it: 'IT', tech: 'IT', software: 'IT', pharma: 'Pharma', auto: 'Auto', metal: 'Metals', metals: 'Metals', fmcg: 'FMCG', power: 'Power', energy: 'Energy', oil: 'Energy', defence: 'Defence', defense: 'Defence', cement: 'Cement', telecom: 'Telecom', retail: 'Retail', finance: 'Financials', nbfc: 'Financials', financials: 'Financials', 'capital goods': 'Capital Goods', infra: 'Infra', consumer: 'Consumer', etf: 'ETF', etfs: 'ETF' }
const inr = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN')

/** Setup names the user might say: the standard ones plus any tag already on their trades. */
const knownTags = () => [...new Set([...SETUP_TAGS, ...useStore.getState().trades.map((x) => x.tag).filter(isSetupTag) as string[]])].sort((a, b) => b.length - a.length)
/** The setup named in a sentence ("as a breakout", "pullback trade", "bounces"), as its stored tag. */
function tagIn(t: string): string | undefined {
  for (const g of knownTags()) if (new RegExp(`\\b${esc(g)}(?:e?s)?\\b`).test(t)) return g
}
/** Results per setup over the last 30 days, best first. */
function bySetup() {
  const ts = useStore.getState().trades.filter((x) => x.close > Date.now() - 30 * 864e5)
  const g = new Map<string, { n: number; wins: number; net: number }>()
  for (const x of ts) { const k = isSetupTag(x.tag) ? x.tag! : ''; const r = g.get(k) ?? { n: 0, wins: 0, net: 0 }; r.n++; r.net += x.pnl - x.charges; if (x.pnl - x.charges > 0) r.wins++; g.set(k, r) }
  // Best first; untagged trades last, since they say nothing about a setup.
  return [...g.entries()].map(([tag, r]) => ({ tag, ...r })).sort((a, b) => (a.tag ? 0 : 1) - (b.tag ? 0 : 1) || b.net - a.net)
}
const sgn = (n: number, d = 2) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)}`
const NOT_ADVICE = '*Educational analysis on simulated data, not investment advice.*'

// ---------------------------------------------------------------- deterministic analyses

export function analyse(sym: string): string {
  const inst = bySym(sym)!; const s = useStore.getState(); const px = s.prices[sym]
  const d = history(inst, '1D', 220, px.ltp); const c = d.map((x) => x.close)
  const r = rsiSeries(c).at(-1)!, e20 = ema(c, 20).at(-1)!, e50 = ema(c, 50).at(-1)!, e200 = ema(c, 200).at(-1)!
  const chg = (px.ltp / px.prev - 1) * 100
  const trend = px.ltp > e20 && e20 > e50 ? 'uptrend: price above the rising 20 and 50 EMA' : px.ltp < e20 && e20 < e50 ? 'downtrend: price below the falling 20 and 50 EMA' : 'sideways: the averages are mixed'
  const lv = levels(d.slice(-120)); const sup = lv.filter((l) => l.kind === 'support').sort((a, b) => b.price - a.price)[0], res = lv.filter((l) => l.kind === 'resistance').sort((a, b) => a.price - b.price)[0]
  const pats = patterns(d)
  let out = `**${sym}** ₹${px.ltp.toFixed(2)} (${sgn(chg)}%) · daily chart\n- Trend: ${trend}; ${px.ltp > e200 ? 'above' : 'below'} the 200 EMA (${e200.toFixed(0)})\n- RSI(14): ${r.toFixed(0)}, ${r > 70 ? 'overbought' : r < 30 ? 'oversold' : r > 55 ? 'positive momentum' : r < 45 ? 'weak momentum' : 'neutral'}\n- Nearest support ${sup ? sup.price.toFixed(1) + ` (${sup.touches} touches)` : 'none nearby'} · resistance ${res ? res.price.toFixed(1) + ` (${res.touches} touches)` : 'none nearby'}\n- ATR(14): ${atr(d).at(-1)!.toFixed(1)} points, the typical daily move`
  if (pats.length) out += `\n- Recent pattern: ${pats.at(-1)!.name}`
  const m = metricsFor(sym)
  if (m) out += `\n- 52-week range ${m.lo52.toFixed(0)}–${m.hi52.toFixed(0)} (${sgn(m.fromHi52, 1)}% from the high) · 3-month relative strength vs Nifty ${sgn(m.rs, 1)}%\n- Fundamentals: P/E ${m.pe}, ROE ${m.roe}%, debt/equity ${m.de}, EPS growth ${m.epsG}%`
  if (inst.fno) {
    const ex = nextExpiries(sym)[0]; const rows = chain(sym, px.ltp, ex.T, 21)
    const coi = rows.reduce((a, x) => a + x.ce.oi, 0), poi = rows.reduce((a, x) => a + x.pe.oi, 0)
    const maxCe = rows.reduce((a, x) => (x.ce.oi > a.ce.oi ? x : a)), maxPe = rows.reduce((a, x) => (x.pe.oi > a.pe.oi ? x : a))
    out += `\n- Options (${ex.label}): PCR ${(poi / coi).toFixed(2)}, call wall ${maxCe.strike}, put wall ${maxPe.strike}`
  }
  const bias = (px.ltp > e20 ? 1 : -1) + (r > 55 ? 1 : r < 45 ? -1 : 0) + (px.ltp > e200 ? 1 : -1)
  out += `\n\n**Technical read: ${bias >= 2 ? 'bullish' : bias <= -2 ? 'bearish' : 'neutral'}.** ${bias >= 2 ? `Traders watching this often wait for a pullback toward ${(sup?.price ?? e20).toFixed(0)}.` : bias <= -2 ? `Bounces into ${(res?.price ?? e20).toFixed(0)} are where sellers have shown up.` : `Range between ${(sup?.price ?? px.low).toFixed(0)} and ${(res?.price ?? px.high).toFixed(0)}.`} I've marked the levels and patterns on the chart.\n\n${NOT_ADVICE}`
  return out
}

function portfolio(): string {
  const s = useStore.getState(); const p = s.pnl(); const pos = Object.values(s.positions).filter((x) => x.qty)
  let o = `**Today**\n- Net P&L after charges: **${p.net >= 0 ? '+' : ''}${inr(p.net)}** (realised ${inr(p.realized)}, open ${inr(p.unreal)}, charges ${inr(p.charges)})\n- Funds available ${inr(p.avail)} · margin used ${inr(p.used)}`
  if (s.risk.killed) o += `\n- Trading is locked: ${s.risk.reason}`
  o += pos.length ? '\n\n**Open positions**\n' + pos.map((x) => { const b = s.brackets[x.key]; return `- ${x.qty > 0 ? 'Long' : 'Short'} ${Math.abs(x.qty)} ${labelOf(x.key)} at ${x.avg.toFixed(2)} → ${s.ltp(x.key).toFixed(2)} (${inr((s.ltp(x.key) - x.avg) * x.qty)})${b?.sl ? ` · stop ${b.sl.toFixed(2)}` : parseKey(x.key).strike ? '' : ' · **no stop**'}` }).join('\n') : '\n\nNo open positions.'
  const hv = s.holdings.reduce((a, h) => a + h.qty * s.prices[h.sym].ltp, 0), hi = s.holdings.reduce((a, h) => a + h.qty * h.avg, 0)
  o += `\n\n**Holdings** ${s.holdings.length} stocks and ETFs worth ${inr(hv)} (${sgn((hv / hi - 1) * 100, 1)}% overall)`
  return o
}

/** Explain today's P&L by position, splitting price move, time decay and charges. */
function explainPnl(): string {
  const s = useStore.getState(); const p = s.pnl(); const ps = Object.values(s.positions).filter((x) => x.qty || x.realized)
  if (!ps.length) return 'No trades today yet, so there is nothing to explain. Ask me to **review my trades** for your history.'
  const rows = ps.map((x) => {
    const k = parseKey(x.key); const open = x.qty ? (s.ltp(x.key) - x.avg) * x.qty : 0
    let theta = ''
    if (k.strike && x.qty) { const ex = nextExpiries(k.und).find((e) => e.label === k.exp) ?? nextExpiries(k.und)[0]; const dayDecay = payoff(k.und, s.prices[k.und].ltp, ex.T, [{ side: x.qty > 0 ? 'BUY' : 'SELL', type: k.type!, strike: k.strike, lots: Math.abs(x.qty) / bySym(k.und)!.lot }], s.prices[k.und].ltp, true) - payoff(k.und, s.prices[k.und].ltp, Math.max(ex.T - 1 / 365, 0.0005), [{ side: x.qty > 0 ? 'BUY' : 'SELL', type: k.type!, strike: k.strike, lots: Math.abs(x.qty) / bySym(k.und)!.lot }], s.prices[k.und].ltp, true); theta = ` · time decay about ${inr(-dayDecay)} per day` }
    return `- ${labelOf(x.key)}: realised ${inr(x.realized)}, open ${inr(open)}, charges ${inr(x.charges)}${theta}`
  })
  const gross = p.realized + p.unreal
  return `**Where today's ${inr(p.net)} came from**\n${rows.join('\n')}\n\nCharges took **${inr(p.charges)}**${gross > 0 ? `, ${(p.charges / gross * 100).toFixed(0)}% of gross profit` : ''}. STT on options is 0.15% of premium on the sell side, so frequent option trading adds up.`
}

/** Journal review: deterministic stats and behaviour flags. */
function reviewTrades(): string {
  const t = useStore.getState().trades.filter((x) => x.close > Date.now() - 30 * 864e5)
  if (!t.length) return 'No trades in the last 30 days.'
  const net = (x: (typeof t)[0]) => x.pnl - x.charges
  const wins = t.filter((x) => net(x) > 0), losses = t.filter((x) => net(x) <= 0)
  const tot = t.reduce((a, x) => a + net(x), 0), ch = t.reduce((a, x) => a + x.charges, 0), gross = t.reduce((a, x) => a + x.pnl, 0)
  const avgW = wins.reduce((a, x) => a + net(x), 0) / (wins.length || 1), avgL = losses.reduce((a, x) => a + net(x), 0) / (losses.length || 1)
  const byDay = (d: number) => t.filter((x) => new Date(x.open).getDay() === d)
  const tue = byDay(2); const tueWr = tue.filter((x) => net(x) > 0).length / (tue.length || 1), restWr = (wins.length - tue.filter((x) => net(x) > 0).length) / ((t.length - tue.length) || 1)
  const days = new Map<string, typeof t>(); t.forEach((x) => { const k = new Date(x.open).toDateString(); days.set(k, [...(days.get(k) ?? []), x]) })
  const busy = [...days.values()].filter((d) => d.length > 3); const busyNet = busy.flat().reduce((a, x) => a + net(x), 0)
  const worst = t.reduce((a, x) => (net(x) < net(a) ? x : a))
  const flags: string[] = []
  if (tue.length >= 4 && tueWr < restWr - 0.08) flags.push(`Expiry Tuesdays hurt: win rate ${(tueWr * 100).toFixed(0)}% vs ${(restWr * 100).toFixed(0)}% on other days`)
  if (busy.length) flags.push(`On ${busy.length} days you took more than 3 trades. Those days netted ${inr(busyNet)}`)
  if (Math.abs(net(worst)) > 2.5 * avgW) flags.push(`Your largest loss (${inr(net(worst))} on ${labelOf(worst.key)}) was ${(Math.abs(net(worst)) / avgW).toFixed(1)}× your average win. A hard stop would cap this`)
  if (gross > 0 && ch / gross > 0.25) flags.push(`Charges ate ${(ch / gross * 100).toFixed(0)}% of gross profit`)
  const noStop = t.filter((x) => x.exitReason === 'manual' && net(x) < avgL * 1.5).length
  if (noStop) flags.push(`${noStop} losing trade${noStop > 1 ? 's were' : ' was'} closed by hand after running past your usual loss. Exit plans would close them automatically`)
  return `**Last 30 days: ${t.length} trades, net ${inr(tot)}**\n- Win rate ${(wins.length / t.length * 100).toFixed(0)}% · average win ${inr(avgW)} · average loss ${inr(avgL)}\n- Expectancy ${inr(tot / t.length)} per trade · charges ${inr(ch)}\n\n**What stands out**\n${flags.map((f) => '- ' + f).join('\n') || '- Nothing unusual. Consistent sizing and exits.'}\n\nThe Journal has the calendar and breakdowns. *Includes sample history.*`
}

function briefing(): string {
  const s = useStore.getState(); const p = s.prices
  const idx = ['NIFTY', 'BANKNIFTY', 'SENSEX'].map((k) => `${k} ${p[k].ltp.toFixed(0)} (${sgn((p[k].ltp / p[k].prev - 1) * 100)}%)`).join(' · ')
  const ms = allMetrics(); const adv = ms.filter((m) => m.chg > 0).length
  const sec = SECTORS.filter((x) => x !== 'ETF').map((x) => { const r = ms.filter((m) => m.sector === x); return { x, c: r.reduce((a, m) => a + m.chg, 0) / r.length } }).sort((a, b) => b.c - a.c)
  const shock = ms.filter((m) => m.volx >= 2).sort((a, b) => b.volx - a.volx).slice(0, 3)
  const ex = nextExpiries('NIFTY')[0]
  const near = Object.values(s.positions).filter((x) => x.qty && s.brackets[x.key]?.sl && Math.abs(s.ltp(x.key) / s.brackets[x.key].sl! - 1) < 0.01)
  const unprotected = Object.values(s.positions).filter((x) => x.qty && !s.brackets[x.key]?.sl && !(parseKey(x.key).strike && x.tag && STRATEGIES[x.tag] && !/short (straddle|strangle)/.test(x.tag)))
  const book = `**Your book**\n- ${Object.values(s.positions).filter((x) => x.qty).length} open positions, ${s.triggers.filter((t) => !t.done).length} alerts working${near.length ? `\n- Near the stop: ${near.map((x) => labelOf(x.key)).join(', ')}` : ''}${unprotected.length ? `\n- Positions without a stop: ${unprotected.map((x) => labelOf(x.key)).join(', ')}` : ''}\n- Daily loss limit ${inr(s.risk.maxLoss)}, trades left today ${Math.max(0, s.risk.maxTrades - s.orders.filter((o) => o.status === 'COMPLETE' && o.via !== 'bracket').length)}`
  // In chat the market numbers are in the card under this text, so the words cover what the card can't.
  if (s.mode === 'chat') return `**${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}.** ${sec[0].x} leads and ${sec.at(-1)!.x} lags; ${adv > ms.length / 2 ? 'more stocks are rising than falling' : 'more stocks are falling than rising'}.${shock.length ? ` Unusual volume in ${shock.map((m) => m.sym).join(', ')}.` : ''}${isExpiryDay('NIFTY') ? ' **NIFTY expiry is today**: short options carry an extra 2% margin.' : ''}\n\n${book}\n\n*Prices are simulated. No news feed is connected.*`
  return `**Market brief** · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}\n- ${idx}\n- Breadth: ${adv} advancing, ${ms.length - adv} declining\n- Strongest sectors: ${sec.slice(0, 2).map((x) => `${x.x} ${sgn(x.c)}%`).join(', ')} · weakest: ${sec.slice(-2).map((x) => `${x.x} ${sgn(x.c)}%`).join(', ')}\n- Unusual volume: ${shock.map((m) => `${m.sym} ${m.volx.toFixed(1)}×`).join(', ') || 'none'}\n- NIFTY weekly expiry ${isExpiryDay('NIFTY') ? '**is today**. Short options carry an extra 2% margin' : `is on ${ex.label}`}\n\n**Your book**\n- ${Object.values(s.positions).filter((x) => x.qty).length} open positions, ${s.triggers.filter((t) => !t.done).length} alerts working${near.length ? `\n- Near the stop: ${near.map((x) => labelOf(x.key)).join(', ')}` : ''}${unprotected.length ? `\n- Positions without a stop: ${unprotected.map((x) => labelOf(x.key)).join(', ')}` : ''}\n- Daily loss limit ${inr(s.risk.maxLoss)}, trades left today ${Math.max(0, s.risk.maxTrades - s.orders.filter((o) => o.status === 'COMPLETE' && o.via !== 'bracket').length)}\n\n*Prices are simulated. No news feed is connected.*`
}

function whyMove(sym: string): string {
  const m = metricsFor(sym); const s = useStore.getState(); const q = s.prices[sym]
  if (!m) { const c = (q.ltp / q.prev - 1) * 100; return `${sym} is ${sgn(c)}% today. Index moves come from its heavyweights; open the Markets view for sector breadth.` }
  const sec = allMetrics().filter((x) => x.sector === m.sector); const secChg = sec.reduce((a, x) => a + x.chg, 0) / sec.length
  const nifty = (s.prices.NIFTY.ltp / s.prices.NIFTY.prev - 1) * 100
  const reasons: string[] = []
  if (Math.abs(m.chg) > 2 * Math.abs(secChg) + 0.5) reasons.push(`it is outpacing its ${m.sector} sector (${sgn(secChg)}%), so the move is stock-specific`)
  else if (Math.abs(secChg) > 0.4 && Math.sign(secChg) === Math.sign(m.chg)) reasons.push(`the whole ${m.sector} sector is moving ${sgn(secChg)}%`)
  if (Math.sign(nifty) === Math.sign(m.chg) && Math.abs(nifty) > 0.3) reasons.push(`the broad market is ${sgn(nifty)}%`)
  if (m.volx > 1.8) reasons.push(`volume is ${m.volx.toFixed(1)}× normal, so participation is unusually heavy`)
  if (m.brk20 > 0) reasons.push('it broke above its 20-day high'); if (m.fromHi52 > -1) reasons.push('it is at a 52-week high')
  if (Math.abs(m.gap) > 0.8) reasons.push(`it gapped ${m.gap > 0 ? 'up' : 'down'} ${Math.abs(m.gap).toFixed(1)}% at the open`)
  return `**${sym} ${sgn(m.chg)}% today.** From price and volume data${reasons.length ? ', ' + reasons.join('; ') : ', the move looks stock-specific: the sector and market are flat and volume is normal'}.\n\n*No news or filings feed is connected, so this explains the move only from market data.*`
}

// ---------------------------------------------------------------- natural-language scan parsing

export function parseScan(t: string): Filter[] {
  const f: Filter[] = []; const n = (re: RegExp) => { const m = t.match(re); return m ? parseFloat(m[1]) : undefined }
  if (/52.?w(ee)?k? high|52 week high|new high/.test(t)) f.push({ field: 'fromHi52', op: '>=', value: /break|new|at /.test(t) ? -0.5 : -3 })
  if (/52.?w(ee)?k? low|52 week low/.test(t)) f.push({ field: 'fromLo52', op: '<=', value: 5 })
  const vx = n(/vol(?:ume)?[^0-9]{0,12}(\d+(?:\.\d+)?)\s*(?:x|times)/) ?? n(/(\d+(?:\.\d+)?)\s*(?:x|times)\s*(?:avg |average |normal )?vol/)
  if (vx) f.push({ field: 'volx', op: '>=', value: vx }); else if (/volume (shock|spike|surge)|high volume|unusual volume/.test(t)) f.push({ field: 'volx', op: '>=', value: 2 })
  for (const len of [20, 50, 200]) {
    if (new RegExp(`above (the )?${len}.?(ema|dma|day|sma|ma)`).test(t)) f.push({ field: `above${len}`, op: '>', value: 0 })
    if (new RegExp(`below (the )?${len}.?(ema|dma|day|sma|ma)`).test(t)) f.push({ field: `above${len}`, op: '<', value: 0 })
  }
  const rsiHi = n(/rsi\s*(?:over|above|>|greater than|more than)\s*(\d+)/), rsiLo = n(/rsi\s*(?:under|below|<|less than)\s*(\d+)/)
  if (rsiHi) f.push({ field: 'rsi', op: '>', value: rsiHi }); if (rsiLo) f.push({ field: 'rsi', op: '<', value: rsiLo })
  if (!rsiLo && /oversold/.test(t)) f.push({ field: 'rsi', op: '<', value: 35 }); if (!rsiHi && /overbought/.test(t)) f.push({ field: 'rsi', op: '>', value: 70 })
  if (/gap(ped)? ?up/.test(t)) f.push({ field: 'gap', op: '>=', value: 1 }); if (/gap(ped)? ?down/.test(t)) f.push({ field: 'gap', op: '<=', value: -1 })
  if (/breakout|breaking out|20.?day high/.test(t)) f.push({ field: 'brk20', op: '>', value: 0 })
  if (/nr7|squeeze|narrow range/.test(t)) f.push({ field: 'nr7', op: '=', value: 1 })
  if (/outperform|relative strength|stronger than (the )?(nifty|market)|leaders/.test(t)) f.push({ field: 'rs', op: '>', value: 0 })
  if (/top gainers|gainers|up today|rising/.test(t)) f.push({ field: 'chg', op: '>', value: 1 }); if (/top losers|losers|down today|falling/.test(t)) f.push({ field: 'chg', op: '<', value: -1 })
  const pe = n(/p\/?e\s*(?:under|below|<|less than)\s*(\d+)/); if (pe) f.push({ field: 'pe', op: '<', value: pe })
  const roe = n(/roe\s*(?:over|above|>|more than)\s*(\d+)/); if (roe) f.push({ field: 'roe', op: '>', value: roe }); else if (/high roe|quality/.test(t)) f.push({ field: 'roe', op: '>', value: 18 })
  if (/low debt|debt.?free|no debt/.test(t)) f.push({ field: 'de', op: '<', value: 0.5 })
  if (/dividend/.test(t)) f.push({ field: 'div', op: '>', value: 2 })
  if (/growth|growing|fast grow/.test(t)) f.push({ field: 'epsG', op: '>', value: 15 })
  if (/cheap|undervalued|value stocks?/.test(t) && !pe) f.push({ field: 'pe', op: '<', value: 20 })
  if (/large.?caps?/.test(t)) f.push({ field: 'mcap', op: '>', value: 200000 }); if (/mid.?caps?/.test(t)) f.push({ field: 'mcap', op: '<', value: 200000 })
  if (/f&o|fno|f ?and ?o/.test(t)) f.push({ field: 'fno', op: '=', value: 1 })
  const secs = [...new Set(Object.entries(SECTOR_ALIAS).filter(([k]) => new RegExp(`(^|[^a-z])${esc(k)}($|[^a-z])`).test(t)).map(([, v]) => v))]
  if (secs.length) f.push({ field: 'sector', op: 'in', value: secs })
  return f
}

// ---------------------------------------------------------------- local intent engine

/** After 3:20 pm (or once today's intraday window has closed) equity drafts default to delivery. */
const misClosedNow = () => secOfDay() >= SQUARE_OFF || useStore.getState().misClosed === sessionDay()
const analysisFollow = (sym: string) => [`buy ${sym.toLowerCase()}`, `alert me if ${sym.toLowerCase()} crosses ${Math.ceil(useStore.getState().prices[sym].high)}`, ...(bySym(sym)?.fno ? [`${sym.toLowerCase()} option chain`] : []), `why is ${sym.toLowerCase()} moving`]

/** Today's debrief: what happened, which rule stepped in, and one change for tomorrow. Used most when the day is locked. */
function debrief(): string {
  const s = useStore.getState(); const p = s.pnl(); const g = entryGate(s)
  const day = new Date().toDateString()
  const today = s.trades.filter((x) => !x.sample && new Date(x.close).toDateString() === day)
  const net = (x: (typeof today)[0]) => x.pnl - x.charges
  if (!today.length && !Object.values(s.positions).some((x) => x.qty || x.realized)) return 'No trades today, so there is nothing to review yet. Ask me to **review my trades** for your last 30 days.'
  const wins = today.filter((x) => net(x) > 0); const worst = [...today].sort((a, b) => net(a) - net(b))[0]
  const noStop = today.filter((x) => net(x) < 0 && !x.exitReason?.includes('stop'))
  let o = `**Today: ${p.net >= 0 ? '+' : '−'}${inr(Math.abs(p.net)).replace('−', '')} after ${inr(p.charges)} of charges.** ${today.length} closed trade${today.length === 1 ? '' : 's'}, ${wins.length} won.`
  if (worst && net(worst) < 0) o += `

- **Biggest loss:** ${labelOf(worst.key)}, ${inr(net(worst))}${p.net < 0 ? `, ${Math.round((net(worst) / p.net) * 100)}% of the day's loss` : ''}.${worst.exitReason ? ` Closed by ${worst.exitReason}.` : ''}`
  if (noStop.length) o += `
- **${noStop.length} losing trade${noStop.length === 1 ? ' was' : 's were'} closed without a stop doing it**, so the loss ran until you or a rule stepped in.`
  if (g) o += `
- **${g.kind === 'locked' ? 'Your limit did its job' : g.kind === 'cooloff' ? 'The break stepped in' : g.kind === 'rule' ? 'Your rule stepped in' : 'You used every trade for today'}:** ${g.why}`
  o += `

**For tomorrow:** ${noStop.length ? 'put a stop on every entry before you place it, so a rule exits a bad trade before the daily limit has to.' : worst && net(worst) < 0 && p.net < 0 && net(worst) / p.net > 0.6 ? `one trade made most of the loss. Consider a smaller size for ${labelOf(worst.key)}-type setups.` : 'keep the same limits; they held.'} Exits and stops still work today; new entries ${g?.kind === 'cooloff' ? 'come back when the pause ends' : g ? 'open again next session' : 'are open'}.`
  return o
}

/** With "every entry needs a stop" on, equity entries arrive with the default plan: stop 2× ATR away, target at 1 : 2. */
function withRuleStops(actions: Action[]): Action[] {
  const s = useStore.getState(); if (!s.rules.stopRequired) return actions
  return actions.map((a) => {
    if (a.t !== 'order' || a.strike || a.sl != null || !isEntry(a, s)) return a
    const ltp = s.prices[a.und].ltp; const ref = a.otype === 'LIMIT' && a.price ? a.price : ltp
    const d = atr(history(bySym(a.und)!, '15m', 60, ltp)).at(-1)! * 2; const long = a.side === 'BUY'
    return { ...a, sl: +(long ? ref - d : ref + d).toFixed(1), tgt: a.tgt ?? +(long ? ref + 2 * d : ref - 2 * d).toFixed(1) }
  })
}

/** What the agent says instead of drafting an entry it knows will be rejected. */
export function gatedReply(g: Gate): string {
  const back = g.kind === 'rule' ? 'New entries open again next session, or turn the rule off.' : g.kind === 'cooloff' && g.until ? `New entries come back at ${new Date(g.until).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}.` : 'New entries open again next session.'
  return `**I haven't drafted that: ${g.short.toLowerCase()}.** ${g.why} ${back}

Closing positions, stops and targets still work. Want a quick review of today instead?`
}

export function localAI(input: string): AIResult {
  const s = useStore.getState(); const t = input.toLowerCase().replace(/[₹,]/g, '').replace(/\brs\.?\s*(?=\d)/g, '').replace(/\s+/g, ' ').trim()
  const named = findSym(t); const sym = named ?? s.sym
  const expiryIdx = /next (week|expiry)|2nd|second/.test(t) ? 1 : /month(ly)?/.test(t) && sym === 'NIFTY' ? nextExpiries('NIFTY').findIndex((e) => !e.weekly) : 0

  if (/^(help|\?|what can you do)/.test(t)) return { reply: "Here's what I can do:\n- **Trade**: \"buy 50 sbi with sl 850 target 900\", \"sell 2 lots nifty atm ce\", \"bull call spread on nifty\"\n- **Protect**: \"add stop 1400 to reliance\", \"trail my tcs stop by 20\", \"close all positions\"\n- **Scan**: \"stocks near 52 week high with volume 2x in IT\"\n- **Analyse**: \"analyse hdfc bank\", \"draw levels on reliance\", \"why is bel up\"\n- **Review**: \"brief me\", \"explain my pnl\", \"review my trades\"\n- **Risk**: \"set max loss 5000\", \"stop trading for today\"\n- **Rules**: \"always use a stop\", \"no trades after 2 pm\", \"risk 1% per trade\", \"my rules\"\n- **Invest**: \"sip 5000 in niftybees\", \"show my holdings\"", actions: [] }

  // Advice guard: reframe stock-tip requests as education.
  if (/should i (buy|sell)|best stock|multibagger|tips?\b|which stock (to|will)|recommend|guaranteed|sure.?shot/.test(t))
    return { reply: `I can't tell you what to buy or sell. Personal recommendations need a SEBI-registered adviser. I can show you the data so you decide yourself.${named ? '\n\n' + analyse(sym) : '\n\nTry **analyse tcs**, or a scan like **quality stocks with low debt**.'}`, actions: named ? [{ t: 'chart', sym, levels: true }] : [] }

  if (/kill ?switch|stop (all )?trading|lock (my )?trading|panic/.test(t)) return { reply: 'This closes every open position at market, cancels working orders and blocks new entries for the rest of today.', actions: [{ t: 'risk', kill: true }], cards: [{ k: 'positions' }] }
  const ml = t.match(/max(?:imum)? (?:daily )?loss (?:to |of |at )?(\d+)/), mp = t.match(/max(?:imum)? (?:daily )?profit (?:to |of |at )?(\d+)/), mt = t.match(/max(?:imum)? (\d+) trades|max(?:imum)? trades (?:to |of )?(\d+)/)
  if ((ml || mp || mt) && !/bullish|bearish|range|sideways|volatile|big move/.test(t)) return { reply: `Updating your daily limits${ml ? `: positions close automatically if today's loss reaches ${inr(+ml[1])}` : ''}${mp ? `${ml ? ',' : ':'} profits lock in at ${inr(+mp[1])}` : ''}${mt ? `, maximum ${mt[1] ?? mt[2]} trades a day` : ''}.`, actions: [{ t: 'risk', maxLoss: ml ? +ml[1] : undefined, maxProfit: mp ? +mp[1] : undefined, maxTrades: mt ? +(mt[1] ?? mt[2]) : undefined }], cards: [{ k: 'risk' }] }

  if (/square ?off|exit all|close (all|everything|my positions?)|flatten/.test(t) || (named && /^(close|exit) (my )?[a-z&.]+( position)?$/.test(t))) {
    const keys = Object.values(s.positions).filter((p) => p.qty && (!named || parseKey(p.key).und === named))
    return { reply: keys.length ? `This closes ${keys.length} position${keys.length > 1 ? 's' : ''} at market and cancels their working orders.` : 'You have no open positions.', actions: keys.length ? [{ t: 'squareoff', key: named && keys.length === 1 ? keys[0].key : undefined }] : [], cards: keys.length ? [{ k: 'positions' }] : undefined }
  }
  if (/brief|morning|what.?s happening|market (today|summary|overview)|how.?s the market/.test(t)) return { reply: briefing(), actions: [{ t: 'nav', view: 'markets' }], cards: [{ k: 'brief' }], follow: ["today's setups", 'show my positions', 'stocks with volume 2x today', 'nifty option chain'] }
  if (/explain (my )?(p&?n?l|profit|loss)|why (am i|did i) (lose|losing|make|down|up)|where did .* (money|profit|loss)/.test(t)) return { reply: explainPnl(), actions: [], cards: [{ k: 'positions' }], follow: ['review my trades', 'tighten my stops'] }
  if (/(how|which|what).{0,24}(setups?|tags?).{0,24}(doing|performing|working|best|worst|making|losing)|(setups?|tags?) (performance|results|stats|breakdown)|by (setup|tag)|my setups? (results|stats)/.test(t)) {
    const rows = bySetup(); const tagged = rows.filter((r) => r.tag)
    if (!tagged.length) return { reply: 'None of your recent trades carry a setup tag yet. Tag entries as you place them (the Setup field on the ticket, or say "buy tcs as a breakout") and I can show which setups make money.', actions: [], follow: ['review my trades'] }
    const line = (r: (typeof rows)[number]) => `- **${r.tag ? tagLabel(r.tag) : 'Untagged'}**: ${r.n} trade${r.n > 1 ? 's' : ''}, ${r.wins} ${r.wins === 1 ? 'win' : 'wins'}, ${inr(r.net)} after charges`
    const st = useStore.getState(); const tip = insights(st.trades, st.rules, st.cash).find((i) => i.id === 'pausedSetups')
    return { reply: `**Your setups, last 30 days.**\n\n${rows.map(line).join('\n')}${tip ? `\n\n${tip.lead}. ${tip.detail}` : ''}`, actions: [], cards: tip ? [{ k: 'rules' }] : undefined, follow: tip ? ['my rules', 'review my trades'] : ['review my trades'] }
  }
  if (/\bsetups?\b(?! (my )?desk)|trade ideas|ideas for today|what (should i|to) watch|morning plan|pre.?market/.test(t)) return { reply: s.mode === 'chat' ? '' : 'Setups from your watchlist.', actions: [], cards: [{ k: 'setups' }], follow: ['brief me', 'show my positions'] }
  if (/set ?up (my )?desk|onboard|change my (trading )?(style|setup)|start over setup/.test(t)) return { reply: 'Four quick questions, and I will set your limits, rules and watchlist to match. Nothing changes until you confirm.', actions: [], cards: [{ k: 'setup' }] }
  // Standing rules: show them, or set one in plain words.
  if (/\b(my|show|list|trading) rules?\b|what are my rules/.test(t)) return { reply: 'Your standing rules. I apply them to every draft and order; switch any of them off here.', actions: [], cards: [{ k: 'rules' }], follow: ['review my trades'] }
  {
    const on = (id: RuleId, a: Extract<Action, { t: 'rules' }>) => ({ reply: `**Rule on: ${ruleText(id, { ...s.rules, ...a })}.** I'll hold every new entry to it. You can switch it off any time in your rules.`, actions: [a], cards: [{ k: 'rules' }] as Card[] })
    if (/always (use|put|add|set) a stop|every (trade|entry|order) (needs|gets|must have) a stop|stop on every (trade|entry)|no (trade|entry) without a stop/.test(t)) return on('stopRequired', { t: 'rules', stopRequired: true })
    const late = t.match(/no (?:new )?(?:trades|entries|trading|buying)(?: after| past) (\d{1,2})(?::(\d{2}))? ?(am|pm)?/)
    if (late) { let h = +late[1]; if (late[3] === 'pm' && h < 12) h += 12; else if (!late[3] && h < 8) h += 12; return on('noEntryAfter', { t: 'rules', noEntryAfter: h * 3600 + (+(late[2] ?? 0)) * 60 }) }
    const named = tagIn(t); const paused = s.rules.pausedSetups ?? []
    if (named && /\b(resume|unpause|allow|re-?enable|turn on|start (taking|trading))\b/.test(t)) {
      const rest = paused.filter((x) => x !== named)
      return { reply: paused.includes(named) ? `**${tagLabel(named)} trades are back on.** New entries tagged ${named} go through as usual.` : `${tagLabel(named)} trades weren't paused.`, actions: paused.includes(named) ? [rest.length ? { t: 'rules', pausedSetups: rest } : { t: 'rules', off: 'pausedSetups' }] : [], cards: [{ k: 'rules' }] }
    }
    if (named && /\b(pause|stop (taking|trading|doing)|no more|don'?t (let me )?take|avoid|block)\b/.test(t)) return on('pausedSetups', { t: 'rules', pausedSetups: [...new Set([...paused, named])] })
    const rp = t.match(/risk (?:at most |max(?:imum)? |only )?(\d+(?:\.\d+)?) ?% (?:of (?:my )?capital )?(?:per|a|each) trade/)
    if (rp) return on('maxRiskPct', { t: 'rules', maxRiskPct: +rp[1] })
  }
  if (/\b(market )?depth\b|order ?book|bid.?(and|&|\/)?.?ask|bids? and offers?|buyers (vs|or|and) sellers/.test(t)) {
    if (bySym(sym)!.seg !== 'EQ') return { reply: `${sym} is an index, so it has no order book of its own. It trades through futures and options; ask for the ${sym.toLowerCase()} option chain instead.`, actions: [], follow: [`${sym.toLowerCase()} option chain`] }
    const q = s.prices[sym]; const d = depth(sym, q.ltp, q.prev, q.avgVol)
    return { reply: `**${sym} order book.** ${depthRead(d, q.ltp)}`, actions: [], cards: [{ k: 'depth', sym }], follow: [`analyse ${sym.toLowerCase()}`, `${sym.toLowerCase()} chart`] }
  }
  if (/review (my )?(today|day)|debrief|what went wrong today|today'?s review/.test(t)) return { reply: debrief(), actions: [], follow: ['show my positions', 'review my trades', 'my rules'] }
  if (/review (my )?trades|journal|how am i doing|my (trading )?mistakes|win rate/.test(t)) return { reply: reviewTrades(), actions: [{ t: 'nav', view: 'journal' }], cards: [{ k: 'journal' }], follow: ['my rules', 'set max loss 5000'] }
  if (/p&?l|pnl|positions?|margin|funds|balance|holdings?|portfolio/.test(t) && !/\b(buy|sell|add|stop|sl)\b/.test(t)) return { reply: s.mode === 'chat' ? '' : portfolio(), actions: /holding|portfolio/.test(t) ? [{ t: 'nav', view: 'portfolio' }] : [], cards: /holding|portfolio/.test(t) ? [{ k: 'funds' }] : /margin|funds|balance/.test(t) ? [{ k: 'funds' }] : [{ k: 'positions' }], follow: ['explain my pnl', 'close all positions'] }
  if (named && /why .*(up|down|moving|rally|fall|fell|jump|crash)|what.?s (up|happening) with/.test(t)) return { reply: whyMove(sym), actions: [{ t: 'chart', sym }], cards: [{ k: 'chart', sym, tf: '5m' }], follow: [`analyse ${sym.toLowerCase()}`, `buy ${sym.toLowerCase()}`, `alert me if ${sym.toLowerCase()} crosses ${Math.ceil(s.prices[sym].high)}`] }

  // Position sizing.
  const sz = t.match(/how many (?:shares|qty|quantity).*?risk (\d+).*?(?:stop|sl)(?: loss)? (?:at |of )?(\d+(?:\.\d+)?)/)
  if (sz) { const px = s.prices[sym].ltp; const per = Math.abs(px - +sz[2]); const q = Math.floor(+sz[1] / per); return { reply: `Risking ${inr(+sz[1])} with a stop at ${sz[2]} (${per.toFixed(2)} below ${px.toFixed(2)}): **${q} shares** of ${sym}, about ${inr(q * px)} of capital.\n\nThe chart ticket sizes this automatically. Press B on the chart.`, actions: [] } }

  // Exit plan on an existing position.
  const posKey = Object.values(s.positions).find((p) => p.qty && parseKey(p.key).und === sym)?.key
  const slM = t.match(/\b(?:sl|stop(?: ?loss)?)\s*(?:at|of|to)?\s*(\d+(?:\.\d+)?)/), tgM = t.match(/\b(?:target|tgt|tp)\s*(?:at|of|to)?\s*(\d+(?:\.\d+)?)/), trM = t.match(/trail(?:ing)?\b[^\d]*?(\d+(?:\.\d+)?)/)
  if (posKey && !/\b(buy|sell|short|long)\b/.test(t) && (slM || tgM || trM)) return { reply: `Stop and target for your ${labelOf(posKey)} position: ${[slM && `stop ${slM[1]}`, tgM && `target ${tgM[1]}`, trM && `trailing ${trM[1]} points`].filter(Boolean).join(', ')}. Whichever is hit first closes it.`, actions: [{ t: 'bracket', key: posKey, sl: slM ? +slM[1] : undefined, tgt: tgM ? +tgM[1] : undefined, trail: trM ? +trM[1] : undefined }], cards: [{ k: 'position', key: posKey }] }

  // Protect or manage a position without numbers: show it with its exit-plan controls.
  if (posKey && !/\b(buy|sell|short|long)\b/.test(t) && /\b(stop|sl|protect|exit plan|trail|target|manage)\b/.test(t)) return { reply: `Here's your ${labelOf(posKey)} position. **Add stop and target** suggests levels from recent volatility; change them before you save.`, actions: [], cards: [{ k: 'position', key: posKey }] }
  if (/tighten (my )?stops|protect (my )?positions/.test(t)) return { reply: 'Your open positions and their exit plans. Positions marked **No stop** have nothing protecting them.', actions: [], cards: [{ k: 'positions' }] }

  // Levels / chart explanation.
  if (/levels?|support|resistance|explain (the |this )?chart|draw|patterns?/.test(t) && !/\b(buy|sell)\b/.test(t)) return { reply: analyse(sym), actions: [{ t: 'chart', sym, levels: true }], cards: [{ k: 'chart', sym, tf: '1D', levels: true }], follow: analysisFollow(sym) }
  if (/analy[sz]e|outlook|view on|technical|trend|rsi of|how (is|does) .* look/.test(t)) return { reply: analyse(sym), actions: [{ t: 'chart', sym, levels: true }], cards: [{ k: 'chart', sym, tf: '1D', levels: true }], follow: analysisFollow(sym) }

  // Strategy from a market view.
  const view = /mildly bullish|moderately bullish|bullish|bearish|range.?bound|sideways|big move|volatile/.exec(t)?.[0]
  if (view && !/\b(buy|sell)\b/.test(t) && !Object.keys(STRATEGIES).some((k) => t.includes(k))) {
    const idx = bySym(sym)?.seg === 'IDX' ? sym : 'NIFTY'; const inst = bySym(idx)!; const spot = s.prices[idx].ltp; const atm = Math.round(spot / inst.step) * inst.step
    const maxLoss = +(t.match(/max(?:imum)? loss (?:of )?(\d+)/)?.[1] ?? 0)
    const picks = /bear/.test(view) ? ['bear put spread', 'bear call spread'] : /range|sideways/.test(view) ? ['iron condor', 'iron butterfly'] : /big move|volatile/.test(view) ? ['long strangle', 'long straddle'] : ['bull call spread', 'bull put spread']
    const ex = nextExpiries(idx)[expiryIdx] ?? nextExpiries(idx)[0]
    const rows = picks.map((name) => {
      const one = STRATEGIES[name].build(atm, inst.step, 1)
      const grid = Array.from({ length: 41 }, (_, i) => spot * (0.9 + i * 0.005)); const vals = grid.map((x) => payoff(idx, spot, ex.T, one, x))
      const loss = Math.min(...vals), prof = Math.max(...vals); const lots = maxLoss && loss < 0 ? Math.max(1, Math.floor(maxLoss / -loss)) : 1
      return { name, lots, loss: loss * lots, prof: prof * lots, legs: STRATEGIES[name].build(atm, inst.step, lots) }
    })
    if (s.mode === 'chat') return { reply: `For a **${view}** view on ${idx} (${ex.label} expiry), these two structures match${maxLoss ? `, sized to a maximum loss of ${inr(maxLoss)} where one lot allows it` : ''}. Draft one to see its legs, margin and payoff before anything is placed. ${NOT_ADVICE}`, actions: [], cards: [{ k: 'ideas', und: idx, expiryIdx, view, maxLoss: maxLoss || undefined, picks }] }
    s.setSym(idx); s.setLegs(rows[0].legs, rows[0].name); s.setExpiry(expiryIdx); s.setView('strategy')
    return { reply: `For a **${view}** view on ${idx} (${ex.label} expiry), two structures that match:\n${rows.map((r) => `- **${r.name}**, ${r.lots} lot${r.lots > 1 ? 's' : ''}: max loss ${inr(r.loss)}, max profit ${inr(r.prof)}. ${STRATEGIES[r.name].desc}`).join('\n')}\n\nI loaded the first into the Strategy builder so you can see the payoff and adjust it. ${NOT_ADVICE}`, actions: [] }
  }

  // Named strategies.
  const stratName = Object.keys(STRATEGIES).find((k) => t.includes(k)) ?? (t.includes('straddle') ? (/sell|short/.test(t) ? 'short straddle' : 'long straddle') : t.includes('strangle') ? (/buy|long/.test(t) ? 'long strangle' : 'short strangle') : t.includes('condor') ? 'iron condor' : t.includes('butterfly') ? 'iron butterfly' : undefined)
  if (stratName && !/\d{4,6}\s*(ce|pe)/.test(t)) {
    const idx = bySym(sym)?.fno ? sym : 'NIFTY'; const lots = parseInt(t.match(/(\d+)\s*lots?/)?.[1] ?? '1')
    const inst = bySym(idx)!; const atm = Math.round(s.prices[idx].ltp / inst.step) * inst.step
    const legs = STRATEGIES[stratName].build(atm, inst.step, lots); const ex = nextExpiries(idx)[expiryIdx] ?? nextExpiries(idx)[0]
    return { reply: `Here is ${/^[aeiou]/.test(stratName) ? 'an' : 'a'} **${stratName}** on ${idx} (${ex.label}, ${lots} lot${lots > 1 ? 's' : ''}): ${STRATEGIES[stratName].desc}. Change the lots below if you need to. Approving places all legs, hedges first.`, actions: [{ t: 'legs', und: idx, legs, expiryIdx, name: stratName }] }
  }

  // Alerts.
  const trig = t.match(/(falls?|drops?|dips?|goes? (?:down )?(?:to|below)|below|under|rises?|gains?|jumps?|goes? (?:up )?(?:to|above)|above|over|crosses|reaches|hits|touch(?:es)?)\s*(?:to|at|by)?\s*(\d+(?:\.\d+)?)\s*(%|percent)?/)
  const trigDir = trig ? (/fall|drop|dip|below|under|down/.test(trig[1]) ? 'below' : /rise|gain|jump|above|over|up/.test(trig[1]) ? 'above' : +trig[2] >= s.prices[sym].ltp ? 'above' : 'below') as 'above' | 'below' : undefined
  // "falls 2%" means 2% from the previous close: turn it into the price the watch checks, and keep the words for the rail.
  const trigPct = trig?.[3] ? +trig[2] : undefined
  const trigPrice = trig ? (trigPct != null ? +(Math.round(s.prices[sym].prev * (1 + (trigDir === 'below' ? -trigPct : trigPct) / 100) / 0.05) * 0.05).toFixed(2) : +trig[2]) : 0
  // Short form for the rail ("falls 2%"); replies add "from yesterday's close".
  const trigNote = trigPct != null ? `${trigDir === 'below' ? 'falls' : 'rises'} ${trigPct}%` : undefined
  if (/alert|notify|remind|ping|tell me/.test(t) && trig && trigDir) return { reply: `I'll alert you when ${sym} ${trigNote ? `${trigNote} from yesterday's close (₹${trigPrice.toLocaleString('en-IN')})` : `goes ${trigDir} ${trigPrice}`}. It also shows as a line on the chart.`, actions: [{ t: 'trigger', sym, dir: trigDir, price: trigPrice, note: trigNote }], cards: [{ k: 'alerts' }] }

  // SIP.
  const sip = t.match(/sip (?:of )?(\d+)/) ?? t.match(/(\d+) (?:a|per|every) month/)
  if (sip && named) return { reply: `Start a monthly SIP of ${inr(+sip[1])} into ${sym}? It buys at market on the 5th of each month (simulated).`, actions: [{ t: 'sip', sym, amount: +sip[1], day: 5 }] }

  // Orders.
  const sd = t.match(/\b(buy|long|sell|short)\b/)
  if (sd) {
    const side: 'BUY' | 'SELL' = /buy|long/.test(sd[1]) ? 'BUY' : 'SELL'
    let rest = t
    const cond = trig && /\b(if|when|whenever|once|after)\b/.test(t) ? trig : null
    if (cond) rest = rest.replace(/\b(if|when|whenever|once|after)\b.*$/, '')
    for (const m of [slM, tgM, trM]) if (m) rest = rest.replace(m[0], ' ')
    const strikeM = rest.match(/\b(\d{3,6})\s*(ce|pe|call|put)\b/)
    rest = rest.replace(/\b(\d{3,6})\s*(ce|pe|call|put)\b/, ' ')
    const lotM = rest.match(/(\d+)\s*lots?/)
    const priceM = rest.match(/(?:at|@|limit|for)\s*(\d+(?:\.\d+)?)(?!\s*lots?)/)
    const isMkt = /market|\bcmp\b|\bnow\b|\bmkt\b/.test(rest)
    if (priceM) rest = rest.replace(priceM[0], ' ')
    const rsM = rest.match(/(?:worth|for) (\d+)/)
    const qM = rest.match(/(\d+)/)
    const inst = bySym(sym)!
    if (inst.seg === 'IDX' && !strikeM) return { reply: `${sym} is an index, so you trade it through options. Tap a ${side === 'BUY' ? 'call to go long or a put to go short' : 'price to write that option'} in the chain below, or say "${side.toLowerCase()} 1 lot ${sym.toLowerCase()} ${Math.round(s.prices[sym].ltp / inst.step) * inst.step} ce".`, actions: [], cards: [{ k: 'chain', und: sym, expiryIdx }] }
    let qty = qM ? parseInt(qM[1]) : 1
    if (!strikeM && lotM) qty = parseInt(lotM[1]) * inst.lot
    if (!strikeM && rsM) qty = Math.max(1, Math.floor(+rsM[1] / s.prices[sym].ltp))
    if (strikeM && lotM) qty = parseInt(lotM[1])
    const limit = !isMkt && priceM ? +priceM[1] : undefined
    const a: OrderAction = { t: 'order', und: sym, side, qty, otype: limit ? 'LIMIT' : 'MARKET', price: limit, product: strikeM ? 'NRML' : /deliver|cnc|hold|invest|swing/.test(t) || misClosedNow() || (['swing', 'investing'].includes(styleOf(s.profile) ?? '') && !/intraday|mis\b/.test(t)) ? 'CNC' : 'MIS', sl: slM ? +slM[1] : undefined, tgt: tgM ? +tgM[1] : undefined, trail: trM ? +trM[1] : undefined, ...(strikeM ? { strike: +strikeM[1], ot: /ce|call/.test(strikeM[2]) ? 'CE' as const : 'PE' as const, expiryIdx } : {}), tag: tagIn(t) }
    if (a.strike && (a.strike % inst.step)) return { reply: `${a.strike} isn't a valid ${sym} strike. Strikes are in steps of ${inst.step}.`, actions: [] }
    const ref = limit ?? s.prices[sym].ltp
    if (!strikeM && a.sl && (side === 'BUY' ? a.sl >= ref : a.sl <= ref)) return { reply: `A stop at ${a.sl} is on the wrong side of the ${ref.toFixed(2)} entry for a ${side.toLowerCase()}. Check the price.`, actions: [] }
    const what = strikeM ? `${qty} lot${qty > 1 ? 's' : ''} (${qty * inst.lot} qty) ${sym} ${strikeM[1]} ${a.ot}` : `${qty} ${sym}`
    const plan = a.sl || a.tgt ? ` with ${[a.sl && `stop ${a.sl}`, a.tgt && `target ${a.tgt}`, a.trail && `trailing ${a.trail}`].filter(Boolean).join(', ')}` : ''
    const risk = !strikeM && a.sl ? ` Risk if stopped: ${inr(Math.abs(ref - a.sl) * qty)}${a.tgt ? `, reward ${inr(Math.abs(a.tgt - ref) * qty)} (1 : ${(Math.abs(a.tgt - ref) / Math.abs(ref - a.sl)).toFixed(1)})` : ''}.` : !strikeM ? ' No stop set. Add "sl 850" to attach one.' : ''
    if (cond && trigDir) return { reply: `Price trigger: when ${sym} ${trigNote ? `${trigNote} from yesterday's close (₹${trigPrice.toLocaleString('en-IN')})` : `goes ${trigDir} ${trigPrice}`}, I'll ${side.toLowerCase()} ${what}${plan} automatically, within your limits and rules.`, actions: [{ t: 'trigger', sym, dir: trigDir, price: trigPrice, then: a, note: trigNote }] }
    // In chat the draft card shows every number, so the reply only says what to do with it instead of repeating it.
    if (s.mode === 'chat') return { reply: a.sl || strikeM ? 'Here it is. Check it over, then place it.' : 'Here it is, without a stop for now. Add one before you place it.', actions: [a] }
    return { reply: `${side === 'BUY' ? 'Buy' : 'Sell'} ${what} ${limit ? `at limit ${limit}` : 'at market'}${plan} · ${a.product === 'MIS' ? 'intraday' : a.product === 'CNC' ? 'delivery' : 'F&O'}.${risk}`, actions: [a] }
  }

  // Scans.
  const filters = parseScan(t)
  if (filters.length && (/stock|scan|screen|find|show|list|which|shares|compan/.test(t) || !named)) {
    const rows = applyFilters(allMetrics(), filters).sort((a, b) => b.chg - a.chg)
    return { reply: rows.length ? `Found **${rows.length}**, sorted by today's change. Tap a row to analyse it, or Buy to draft an order.` : 'Nothing matches right now. Try loosening a condition.', actions: [{ t: 'scan', filters, name: input.slice(0, 60) }], cards: [{ k: 'scan', filters, name: input.slice(0, 60) }], follow: rows.length ? [`analyse ${rows[0].sym.toLowerCase()}`, `why is ${rows[0].sym.toLowerCase()} moving`] : undefined }
  }

  // Navigation.
  if (/scanner|screener/.test(t)) return { reply: 'Opening Find stocks.', actions: [{ t: 'nav', view: 'scanner' }] }
  if (/heat ?map|sectors?|market view|markets/.test(t)) return { reply: 'Opening Markets.', actions: [{ t: 'nav', view: 'markets' }] }
  if (/chain|\boi\b|open interest/.test(t)) { const u = bySym(sym)?.fno ? sym : 'NIFTY'; return { reply: `${u} options, ${nextExpiries(u)[expiryIdx]?.label ?? nextExpiries(u)[0].label} expiry. Tap a price to draft an order.`, actions: [{ t: 'nav', view: 'chain', sym: u, expiryIdx }], cards: [{ k: 'chain', und: u, expiryIdx }], follow: [`iron condor on ${u.toLowerCase()}`, `bull call spread on ${u.toLowerCase()}`] } }
  if (/strateg|payoff|builder|greeks/.test(t)) return { reply: 'Opening the Strategy builder.', actions: [{ t: 'nav', view: 'strategy' }] }
  const tf = t.match(/\b(1m|5m|15m|1h|1d|1w|daily|weekly|hourly)\b/)?.[1]
  if (/chart|show|open|go to|price|how is|ltp|quote/.test(t) || named) { const tfv = tf ? (({ daily: '1D', weekly: '1W', hourly: '1h', '1d': '1D', '1w': '1W' } as Record<string, TF>)[tf] ?? tf as TF) : undefined
    return { reply: s.mode === 'chat' ? '' : named ? `${sym} ₹${s.prices[sym].ltp.toFixed(2)}.` : 'Opening the chart.', actions: [{ t: 'chart', sym, tf: tfv }], cards: [{ k: 'quote', sym }, ...(/chart/.test(t) || tfv ? [{ k: 'chart' as const, sym, tf: tfv ?? '5m' as TF }] : [])], follow: [`analyse ${sym.toLowerCase()}`, ...(bySym(sym)!.fno ? [`${sym.toLowerCase()} option chain`] : []), `why is ${sym.toLowerCase()} moving`] } }
  return { reply: "I didn't catch that. Try \"brief me\", \"buy 50 sbi with sl 850\", \"stocks above 200 ema in pharma\" or \"help\".", actions: [] }
}

// ---------------------------------------------------------------- Claude (optional) — same action schema, numbers from tools

export async function llmAI(input: string, apiKey: string): Promise<AIResult> {
  const s = useStore.getState()
  const named = findSym(input.toLowerCase())
  const ctx = {
    now: new Date().toISOString(), currentSymbol: s.sym, view: s.view,
    quotes: Object.fromEntries([...new Set([...s.watch, ...(named ? [named] : [])])].map((w) => [w, +s.prices[w].ltp.toFixed(2)])),
    lots: Object.fromEntries(INSTS.filter((i) => i.fno).map((i) => [i.sym, i.lot])), strikeStep: Object.fromEntries(INSTS.filter((i) => i.fno).map((i) => [i.sym, i.step])),
    expiries: Object.fromEntries(['NIFTY', 'BANKNIFTY', 'SENSEX'].map((u) => [u, nextExpiries(u).map((e, i) => `${i}:${e.label}`)])),
    strategies: Object.keys(STRATEGIES), scanFields: Object.fromEntries(Object.entries(FIELDS).map(([k, v]) => [k, v.label + (v.unit ? ` (${v.unit})` : '')])), sectors: SECTORS,
    account: portfolio(), risk: s.risk, rules: s.rules,
    analysis: named ? analyse(named) : undefined,
  }
  const system = `You are the copilot inside an Indian (NSE/BSE) paper-trading terminal with simulated prices. Reply with JSON ONLY: {"reply": string (concise markdown), "actions": Action[]}.
Action types (all trades are shown to the user for approval before running, so draft them):
{"t":"order","und":SYM,"strike"?:n,"ot"?:"CE"|"PE","side":"BUY"|"SELL","qty":n (LOTS for options, SHARES for equity),"otype":"MARKET"|"LIMIT"|"SL-M","price"?:n,"trigger"?:n,"product":"MIS"|"CNC"|"NRML","expiryIdx"?:n,"sl"?:n,"tgt"?:n,"trail"?:n,"tag"?:"breakout"|"pullback"|... (lowercase setup, only when the user names one)}
{"t":"legs","und":SYM,"legs":[{"side","type":"CE"|"PE","strike":n,"lots":n}],"expiryIdx":n,"name":string}
{"t":"bracket","key":positionKey,"sl"?:n,"tgt"?:n,"trail"?:n} {"t":"squareoff","key"?:string} {"t":"risk","maxLoss"?:n,"maxProfit"?:n,"maxTrades"?:n,"kill"?:true}
{"t":"rules","stopRequired"?:true,"maxRiskPct"?:n,"noEntryAfter"?:secondsSinceISTMidnight,"pausedSetups"?:[lowercase tags, the full list],"off"?:"stopRequired"|"maxRiskPct"|"noEntryAfter"|"pausedSetups"} (standing trading rules the user asks for)
{"t":"trigger","sym":SYM,"dir":"above"|"below","price":n,"then"?:<order>} {"t":"scan","filters":[{"field":scanField,"op":">"|"<"|">="|"<="|"="|"in","value":n|string|string[]}],"name":string}
{"t":"chart","sym"?:SYM,"tf"?:"1m"|"5m"|"15m"|"1h"|"1D"|"1W","indicators"?:string[],"levels"?:true} {"t":"nav","view":"chart"|"chain"|"strategy"|"scanner"|"markets"|"portfolio"|"journal"} {"t":"watch","op","sym"} {"t":"sip","sym","amount","day"}
Rules: Never invent numbers — use only values in context (quotes, analysis, account); for screens output a scan action and let the engine compute results. Strikes must be multiples of strikeStep. Never give personalised buy/sell recommendations or price targets (SEBI: needs RIA/RA registration) — offer analysis and education instead and say so briefly. Mention risk plainly for F&O selling. Context: ${JSON.stringify(ctx)}`
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
    body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1500, system, messages: [{ role: 'user', content: input }] }),
  })
  if (!r.ok) throw new Error(`API ${r.status}`)
  const txt: string = (await r.json()).content?.[0]?.text ?? ''
  const j = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1))
  return { reply: String(j.reply ?? ''), actions: Array.isArray(j.actions) ? j.actions : [] }
}

/** Actions that change money or exposure. These always wait for the person to approve. */
export const isTrade = (a: Action) => a.t === 'order' || a.t === 'legs' || a.t === 'squareoff' || a.t === 'sip' || (a.t === 'trigger' && !!a.then) || (a.t === 'risk' && !!a.kill)

/** Validate model output against the instrument master before anything reaches the person. */
function validate(a: Action): string | null {
  if ('und' in a && !bySym(a.und)) return `Unknown symbol ${a.und}`
  if ((a.t === 'order' || a.t === 'legs') && 'und' in a) {
    const inst = bySym(a.und)!; const strikes = a.t === 'order' ? (a.strike ? [a.strike] : []) : a.legs.map((l) => l.strike)
    if (strikes.some((k) => k % inst.step)) return `Invalid strike for ${a.und}`
    if (a.t === 'order' && a.qty <= 0) return 'Quantity must be positive'
  }
  if (a.t === 'scan') a.filters = a.filters.filter((f) => FIELDS[f.field])
  return null
}

export async function ask(input: string) {
  const s = useStore.getState()
  s.addMsg({ role: 'user', text: input }); s.log('user', `Asked: ${input}`)
  let res: AIResult
  if (s.apiKey) {
    s.setBusy(true)
    try { res = await llmAI(input, s.apiKey) } catch (e) { res = localAI(input); res.reply = `*Claude unavailable (${(e as Error).message}); used the built-in engine.*\n\n` + res.reply } finally { s.setBusy(false) }
  } else res = localAI(input)
  const problems = res.actions.map(validate).filter(Boolean)
  const actions = res.actions.filter((a) => !validate(a))
  const legsAct = actions.find((a) => a.t === 'legs') as Extract<Action, { t: 'legs' }> | undefined
  const chat = s.mode === 'chat'
  if (legsAct && !(entryGate(s))) { s.setSym(legsAct.und); s.setLegs(legsAct.legs, legsAct.name); s.setExpiry(legsAct.expiryIdx); if (!chat) s.setView('strategy') }
  const instant = actions.filter((a) => !isTrade(a)); let trades = actions.filter(isTrade)
  // Locked mode: entries that the store would reject are not drafted at all; exits still go through.
  const gate = entryGate(s); const blocked = gate ? trades.filter((a) => isEntry(a, s)) : []
  if (gate && blocked.length) { trades = trades.filter((a) => !blocked.includes(a)); res = { ...res, reply: trades.length ? `${res.reply}\n\n${gatedReply(gate)}` : gatedReply(gate), cards: trades.length ? res.cards : [{ k: 'risk' }], follow: ['review today', 'show my positions'] } }
  trades = withRuleStops(trades)
  // In chat the reply's cards are the view, so actions that would switch screens only apply their side effects.
  const switches = (a: Action) => a.t === 'nav' || a.t === 'scan' || a.t === 'chart'
  instant.forEach((a) => {
    if (chat && switches(a)) {
      if (a.t === 'chart') { if (a.sym) s.setSym(a.sym); if (a.levels && a.sym) s.set({ aiLevels: { ...s.aiLevels, [a.sym]: true } }) }
      if (a.t === 'scan') s.setScan({ filters: a.filters, name: a.name ?? 'Custom scan' })
      if (a.t === 'nav' && a.sym && bySym(a.sym)) s.setSym(a.sym)
      return
    }
    const m = s.run(a); if (m && a.t !== 'nav') s.setToast(m)
  })
  // Anything named in the request becomes the conversation's focus, so "buy 10 of it" works next.
  const named = findSym(input.toLowerCase()); if (chat && named) s.setSym(named)
  const scan = actions.find((a) => a.t === 'scan') as Extract<Action, { t: 'scan' }> | undefined
  const text = res.reply + (problems.length ? `\n\n*Skipped ${problems.length} action(s): ${problems.join('; ')}.*` : '')
  s.addMsg({ role: 'ai', text, pending: trades.length ? trades : undefined, state: trades.length ? 'pending' : undefined, scan: chat ? undefined : scan?.filters, cards: res.cards, follow: res.follow })
  s.log('ai', `Replied${actions.length ? ` with ${actions.map((a) => a.t).join(', ')}` : ''}`)
}

export function confirm(msgId: number) {
  const s = useStore.getState(); const m = s.msgs.find((x) => x.id === msgId); if (!m?.pending) return
  const before = new Set(s.orders.map((o) => o.id))
  const out = m.pending.map((a) => s.run(a, 'ai')).filter(Boolean)
  const orderIds = useStore.getState().orders.filter((o) => !before.has(o.id)).map((o) => o.id)
  const first = m.pending[0]; const und = 'und' in first ? first.und.toLowerCase() : undefined
  s.patchMsg(msgId, { state: 'confirmed', orderIds, follow: s.mode === 'chat' && und ? (first.t === 'order' && !first.sl ? [`add stop to ${und}`, 'show my positions'] : first.t === 'legs' ? ['show my positions', 'explain my pnl'] : [`trail my ${und} stop`, 'show my positions']) : m.follow })
  // In chat the approved card turns into a live order tracker, so a separate receipt message is only needed in the terminal.
  if (s.mode !== 'chat' || !orderIds.length) s.addMsg({ role: 'ai', kind: 'activity', text: out.map((x) => (x.startsWith('Rejected') ? '⚠️ ' : '✓ ') + x).join('\n\n') })
  s.log('user', `Approved: ${out.join(' | ')}`)
}
/**
 * A card asked for something (Buy on a quote, a price in the chain, an idea to draft). It goes into the
 * conversation as if typed, and the answer is a draft to approve, so the thread stays the record of every trade.
 */
export { misClosedNow }
export function propose(userText: string, reply: string, actions: Action[], cards?: Card[], follow?: string[]) {
  const s = useStore.getState()
  s.addMsg({ role: 'user', text: userText }); s.log('user', `Asked: ${userText}`)
  const ok = actions.filter((a) => !validate(a)); let trades = ok.filter(isTrade)
  ok.filter((a) => !isTrade(a)).forEach((a) => s.run(a))
  const gate = entryGate(s)
  if (gate && trades.some((a) => isEntry(a, s))) { trades = trades.filter((a) => !isEntry(a, s)); reply = gatedReply(gate); cards = [{ k: 'risk' }]; follow = ['review today', 'show my positions'] }
  trades = withRuleStops(trades)
  s.addMsg({ role: 'ai', text: reply, pending: trades.length ? trades : undefined, state: trades.length ? 'pending' : undefined, cards, follow })
}
/** Replace a pending draft after the person edits it in its card. */
export function editDraft(msgId: number, i: number, a: Action) {
  const s = useStore.getState(); const m = s.msgs.find((x) => x.id === msgId); if (!m?.pending || m.state !== 'pending') return
  s.patchMsg(msgId, { pending: m.pending.map((x, j) => (j === i ? a : x)) })
}
export function dismiss(msgId: number) { useStore.getState().patchMsg(msgId, { state: 'dismissed' }); useStore.getState().log('user', 'Denied an AI action') }
export { describeFilter }
export type { Leg }
