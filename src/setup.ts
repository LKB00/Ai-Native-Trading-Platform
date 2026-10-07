// Onboarding: four questions that set up the desk. The answers become real settings (daily limits, standing rules,
// default product, a starter watchlist) instead of a profile nobody reads, and the summary shows exactly what each
// answer changed before anything is applied. Everything stays editable afterwards.
import { useStore } from './store'
import { INSTS, SECTORS } from './market'
import type { Rules } from './rules'

export type Style = 'intraday' | 'swing' | 'options' | 'investing'
export type Experience = 'new' | 'some' | 'pro'
export type Profile = { style: Style; experience: Experience; themes: string[]; at: number } | { skipped: true; at: number }

export const STYLES: { v: Style; l: string; d: string }[] = [
  { v: 'intraday', l: 'Intraday', d: 'In and out the same day' },
  { v: 'swing', l: 'Swing', d: 'Hold for days or weeks' },
  { v: 'options', l: 'Options', d: 'Index and stock F&O' },
  { v: 'investing', l: 'Investing', d: 'Build positions, SIPs' },
]
export const EXPERIENCE: { v: Experience; l: string }[] = [
  { v: 'new', l: 'New to trading' }, { v: 'some', l: 'A year or two' }, { v: 'pro', l: 'Experienced' },
]
/** Themes for the starter watchlist: the sectors in the instrument list, biggest first. */
export const THEMES = SECTORS.filter((x) => x !== 'ETF').slice(0, 10)

export const LIMITS = [2000, 5000, 10000, 20000]

/** What the answers turn into. Shown in the card's summary, then applied as is. */
export function planFor(style: Style, exp: Experience, themes: string[], maxLoss: number) {
  const rules: Rules = exp === 'pro' ? {} : { stopRequired: true, maxRiskPct: exp === 'new' ? 0.5 : 1 }
  const maxTrades = style === 'intraday' ? (exp === 'new' ? 5 : 10) : style === 'options' ? 6 : 4
  // Two indices for context, then the three largest names in each chosen theme.
  const idx = style === 'options' ? ['NIFTY', 'BANKNIFTY', 'FINNIFTY'] : ['NIFTY', 'BANKNIFTY']
  const picks = themes.flatMap((t) => INSTS.filter((i) => i.seg === 'EQ' && i.sector === t).sort((a, b) => (b.fund?.mcap ?? 0) - (a.fund?.mcap ?? 0)).slice(0, 3).map((i) => i.sym))
  const extra = style === 'investing' ? ['NIFTYBEES', 'GOLDBEES'].filter((s) => INSTS.some((i) => i.sym === s)) : []
  const watch = [...new Set([...idx, ...picks, ...extra])]
  const follow = style === 'options' ? ['nifty option chain', 'mildly bullish on nifty, max loss 5000', 'brief me']
    : style === 'intraday' ? ['brief me', 'stocks with volume 2x today', 'stocks near 52 week high with volume 2x']
    : style === 'swing' ? ['brief me', `${themes[0]?.toLowerCase() ?? 'banks'} stocks above 200 ema with rsi over 60`, 'stocks near 52 week high']
    : ['show my holdings', 'sip 5000 in niftybees', 'stocks with pe under 20 and roe over 15']
  return { rules, maxLoss, maxTrades, watch, follow }
}

export function applySetup(style: Style, exp: Experience, themes: string[], maxLoss: number) {
  const s = useStore.getState(); const p = planFor(style, exp, themes, maxLoss)
  s.setRisk({ maxLoss: p.maxLoss, maxTrades: p.maxTrades })
  s.setRules({ stopRequired: p.rules.stopRequired, maxRiskPct: p.rules.maxRiskPct })
  if (p.watch.length > 2) s.setWatch(p.watch)
  s.setProfile({ style, experience: exp, themes, at: Date.now() })
  s.log('user', `Desk set up: ${style}, ${exp}, ${themes.join('/')}, max loss ${maxLoss}`)
  const lines = [
    `- **Daily loss limit ₹${p.maxLoss.toLocaleString('en-IN')}** and **${p.maxTrades} trades a day**. At the limit I close everything and pause new entries until the next session.`,
    p.rules.stopRequired ? `- **Every entry gets a stop**, and no trade risks more than **${p.rules.maxRiskPct}% of capital**. Drafts arrive sized and protected; you can switch either rule off in "my rules".` : '- **No standing rules yet.** Your journal will suggest some once it sees how you trade.',
    p.watch.length > 2 ? `- **Watchlist:** ${p.watch.join(', ')}.` : '',
    `- ${style === 'swing' || style === 'investing' ? 'Orders default to **Delivery**' : style === 'options' ? 'Options carry overnight as **NRML**' : 'Orders default to **Intraday**, squared off at 3:20 pm'}.`,
  ].filter(Boolean)
  s.addMsg({ role: 'ai', text: `**Your desk is ready.**\n\n${lines.join('\n')}\n\nYou trade ₹10,00,000 of paper money on simulated NSE prices. When the market is closed I replay the last session, so you can practise any time. Where would you like to start?`, follow: p.follow })
}

export function skipSetup() {
  const s = useStore.getState(); s.setProfile({ skipped: true, at: Date.now() }); s.log('user', 'Skipped desk setup')
}

/** The style the desk was set up for, if any: drafts use it to pick Delivery or Intraday. */
export const styleOf = (p: Profile | null) => (p && 'style' in p ? p.style : undefined)
