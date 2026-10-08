// The phone app's own screens. A phone isn't a small terminal: people open it to check how they're doing, react
// to something, or find a tool, so the structure follows the mobile brokers (Home, Watchlist, Positions, Tools,
// Profile) with the agent one tap away on every tab rather than a tab of its own.
import { useMemo, useState, type ReactNode } from 'react'
import { Bell, BookOpen, ChevronRight, Layers, Lock, ScanSearch, Search, Shield, Sparkles, Target, TrendingUp, Workflow, Zap, Moon, Sun, KeyRound, RotateCcw, Wallet, Briefcase, Settings2 } from 'lucide-react'
import { useStore, resetBook, type View } from './store'
import { INSTS, bySym } from './market'
import { cn } from './ds'
import { Money, inr, inrShort } from './ui'
import { ruleText, type RuleId } from './rules'
import { setupsFor } from './setups'
import { usePendingCount } from './gate'
import { Screen, Sheet } from './mobile'

const fmt = (n: number, d = 2) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })
const INDEX = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'SENSEX']

/** The phone's top bar: where you are on the left, search and notifications on the right. */
export function PhoneTop({ title, onSearch, onBell, unread }: { title: ReactNode; onSearch: () => void; onBell: () => void; unread: number }) {
  return (
    <header className="flex h-14 min-w-0 shrink-0 items-center gap-1 border-b border-line bg-surface pl-4 pr-1.5 pt-[env(safe-area-inset-top)] box-content">
      <h1 className="min-w-0 flex-1 truncate text-[20px] font-semibold tracking-[-0.01em] text-fg">{title}</h1>
      <button type="button" aria-label="Search stocks" onClick={onSearch} className="flex size-11 items-center justify-center rounded-full text-fg active:bg-hover"><Search size={21} strokeWidth={1.75} /></button>
      <button type="button" aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'} onClick={onBell} className="relative flex size-11 items-center justify-center rounded-full text-fg active:bg-hover">
        <Bell size={21} strokeWidth={1.75} />{unread > 0 && <span className="num absolute right-1.5 top-1.5 min-w-4 rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-4 text-white">{unread}</span>}
      </button>
    </header>
  )
}

/** The agent, one tap away on every tab, in the thumb's reach. Shows how many drafts wait for your approval. */
export function AskButton({ onClick }: { onClick: () => void }) {
  const pending = usePendingCount()
  return (
    <button type="button" onClick={onClick} aria-label={pending ? `Ask the assistant, ${pending} waiting for you` : 'Ask the assistant'}
      className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-2 rounded-full bg-fg pl-4 pr-5 text-[15px] font-semibold text-[var(--bg)] shadow-lg active:scale-95">
      <Sparkles size={20} strokeWidth={1.75} />Ask
      {pending > 0 && <span className="num absolute -right-1 -top-1 min-w-5 rounded-full bg-attention px-1.5 text-center text-[11px] font-bold leading-5 text-[var(--ref-charcoal)]">{pending}</span>}
    </button>
  )
}

const Section = ({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) => (
  <section className="mt-6">
    <div className="mb-2.5 flex items-baseline justify-between px-4"><h2 className="text-[16px] font-semibold text-fg">{title}</h2>{action}</div>
    {children}
  </section>
)

export type Tool = { id: string; label: string; sub: string; icon: ReactNode; run: 'page' | 'ask' | 'tab'; view?: View; q?: string; tab?: 'positions' | 'profile' }
export const TOOLS: Tool[] = [
  { id: 'chain', label: 'Option chain', sub: 'Strikes, OI and Greeks', icon: <Layers size={20} strokeWidth={1.75} />, run: 'page', view: 'chain' },
  { id: 'strategy', label: 'Strategy builder', sub: 'Multi-leg payoffs', icon: <Workflow size={20} strokeWidth={1.75} />, run: 'page', view: 'strategy' },
  { id: 'scanner', label: 'Find stocks', sub: 'Filter by price, trend and volume', icon: <ScanSearch size={20} strokeWidth={1.75} />, run: 'page', view: 'scanner' },
  { id: 'markets', label: 'Markets', sub: 'Breadth, sectors, events', icon: <TrendingUp size={20} strokeWidth={1.75} />, run: 'page', view: 'markets' },
  { id: 'setups', label: "Today's setups", sub: 'Entries with stop and target', icon: <Zap size={20} strokeWidth={1.75} />, run: 'ask', q: "today's setups" },
  { id: 'journal', label: 'Journal', sub: 'What your trades say', icon: <BookOpen size={20} strokeWidth={1.75} />, run: 'page', view: 'journal' },
  { id: 'alerts', label: 'Alerts and triggers', sub: 'Price alerts and triggers', icon: <Bell size={20} strokeWidth={1.75} />, run: 'ask', q: 'show my alerts' },
  { id: 'rules', label: 'Rules and limits', sub: 'Daily loss, trades, standing rules', icon: <Shield size={20} strokeWidth={1.75} />, run: 'tab', tab: 'profile' },
]

/** Live movers across the market, from the simulated prices. */
function useMovers() {
  const prices = useStore((s) => s.prices)
  return useMemo(() => {
    const rows = INSTS.filter((i) => i.seg === 'EQ' && prices[i.sym]).map((i) => { const q = prices[i.sym]; return { sym: i.sym, name: i.name, ltp: q.ltp, chg: (q.ltp / q.prev - 1) * 100, volx: q.vol / Math.max(1, q.avgVol) } })
    return { gainers: [...rows].sort((a, b) => b.chg - a.chg).slice(0, 5), losers: [...rows].sort((a, b) => a.chg - b.chg).slice(0, 5), active: [...rows].sort((a, b) => b.volx - a.volx).slice(0, 5) }
  }, [prices])
}

/**
 * Home: how you're doing today, the agent, the indices, your tools, and what's moving. Essentials first; everything
 * here is one tap from a full screen.
 */
export function PhoneHome({ onStock, onTool, onAsk, onTab }: { onStock: (sym: string) => void; onTool: (t: Tool) => void; onAsk: (q?: string) => void; onTab: (t: 'positions' | 'profile') => void }) {
  const s = useStore(); const p = s.pnl(); const pending = usePendingCount()
  const holdValue = s.holdings.reduce((a, h) => a + h.qty * (s.prices[h.sym]?.ltp ?? h.avg), 0)
  const open = Object.values(s.positions).filter((x) => x.qty).length
  const movers = useMovers(); const [mv, setMv] = useState<'gainers' | 'losers' | 'active'>('gainers')
  const setups = useMemo(() => setupsFor(s.watch, (x) => s.prices[x]?.ltp ?? 0).slice(0, 2), [s.watch]) // eslint-disable-line react-hooks/exhaustive-deps
  const row = (r: { sym: string; name: string; ltp: number; chg: number; volx?: number }, note?: string) => (
    <button key={r.sym} type="button" onClick={() => onStock(r.sym)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-hover">
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-fg">{r.sym}</span><span className="block truncate text-[12px] text-fg-subtle">{note ?? r.name}</span></span>
      <span className="shrink-0 text-right"><span className="num block text-[15px] text-fg">{fmt(r.ltp)}</span><span className={cn('num block text-[12px]', r.chg >= 0 ? 'text-up' : 'text-down')}>{r.chg >= 0 ? '+' : '−'}{Math.abs(r.chg).toFixed(2)}%</span></span>
    </button>
  )
  return (
    <div className="pb-28">
      {/* 1 · How am I doing: the question every session starts with. */}
      <button type="button" onClick={() => onTab('positions')} className="mx-4 mt-4 block w-[calc(100%-32px)] rounded-[14px] border border-line bg-surface p-4 text-left active:bg-hover">
        <p className="text-[13px] text-fg-subtle">Today, after charges</p>
        <Money v={p.net} className="mt-1 block text-[30px] font-semibold leading-tight" />
        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <div><p className="text-fg-subtle">Available</p><p className="num mt-0.5 text-[14px] text-fg">{inrShort(p.avail)}</p></div>
          <div><p className="text-fg-subtle">Holdings</p><p className="num mt-0.5 text-[14px] text-fg">{inrShort(holdValue)}</p></div>
          <div><p className="text-fg-subtle">Open</p><p className="num mt-0.5 text-[14px] text-fg">{open} position{open === 1 ? '' : 's'}</p></div>
        </div>
        {s.risk.killed && <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-sunken px-3 py-2 text-[12px] text-fg-muted"><Lock size={13} strokeWidth={2} />Locked for today: {s.risk.reason?.toLowerCase() ?? 'emergency stop'}. Exits still work.</p>}
      </button>

      {/* 2 · The agent: the fastest way to do anything here. */}
      <div className="mx-4 mt-3">
        <button type="button" onClick={() => onAsk()} className="flex h-12 w-full items-center gap-2.5 rounded-full border border-line bg-sunken px-4 text-left text-[15px] text-fg-subtle active:bg-hover">
          <Sparkles size={18} strokeWidth={1.75} className="text-fg-muted" /><span className="truncate">Ask the assistant anything</span>
        </button>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {(s.risk.killed ? ['Review today', 'My rules', 'Review my trades'] : ['Brief me', "Today's setups", 'Show my positions']).map((q) =>
            <button key={q} type="button" onClick={() => onAsk(q.toLowerCase())} className="h-10 shrink-0 rounded-full border border-line px-4 text-[14px] text-fg active:bg-hover">{q}</button>)}
        </div>
        {pending > 0 && <button type="button" onClick={() => onAsk()} className="mt-3 flex w-full items-center gap-3 rounded-[12px] bg-attention-soft px-4 py-3 text-left text-[14px] text-attention-fg">
          <span className="flex-1"><b>{pending} draft{pending > 1 ? 's' : ''} waiting for you.</b> Review and approve in the assistant.</span><ChevronRight size={18} /></button>}
      </div>

      {/* 3 · The market, at a glance. */}
      <Section title="Indices">
        <div className="flex gap-2.5 overflow-x-auto px-4 [scrollbar-width:none]">
          {INDEX.map((x) => { const q = s.prices[x]; if (!q) return null; const c = (q.ltp / q.prev - 1) * 100
            return <button key={x} type="button" onClick={() => onStock(x)} className="w-[150px] shrink-0 rounded-[12px] border border-line p-3 text-left active:bg-hover">
              <p className="text-[12px] font-medium text-fg-muted">{x}</p><p className="num mt-1 text-[16px] font-semibold text-fg">{fmt(q.ltp)}</p>
              <p className={cn('num text-[12px]', c >= 0 ? 'text-up' : 'text-down')}>{c >= 0 ? '+' : '−'}{Math.abs(c).toFixed(2)}%</p></button> })}
        </div>
      </Section>

      {/* 4 · Tools: everything else the product does, one tap each. */}
      <Section title="Tools">
        <div className="grid grid-cols-4 gap-y-3 px-2">
          {TOOLS.map((t) => <button key={t.id} type="button" onClick={() => onTool(t)} className="flex flex-col items-center gap-1.5 rounded-lg px-1 py-2 active:bg-hover">
            <span className="flex size-12 items-center justify-center rounded-[14px] bg-sunken text-fg">{t.icon}</span>
            <span className="text-center text-[12px] leading-tight text-fg">{t.label}</span></button>)}
        </div>
      </Section>

      {/* 5 · Setups from your own watchlist, when there are any. */}
      {setups.length > 0 && <Section title="Trade ideas on your watchlist" action={<button type="button" onClick={() => onAsk("trade ideas for today")} className="text-[13px] font-medium text-fg-muted">See all</button>}>
        <div className="divide-y divide-[var(--border)] border-y border-line">{setups.map((x) => { const q = s.prices[x.sym]
          return row({ sym: x.sym, name: bySym(x.sym)?.name ?? '', ltp: q.ltp, chg: (q.ltp / q.prev - 1) * 100 }, `${x.kind}: entry ${fmt(x.entry)}, stop ${fmt(x.stop)}`) })}</div>
      </Section>}

      {/* 6 · What's moving. */}
      <Section title="Market movers">
        <div role="tablist" aria-label="Movers" className="mx-4 mb-1 flex rounded-lg bg-sunken p-1">
          {([['gainers', 'Gainers'], ['losers', 'Losers'], ['active', 'Most active']] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={mv === v} onClick={() => setMv(v)}
            className={cn('h-9 flex-1 rounded-md text-[13px] font-medium', mv === v ? 'bg-surface text-fg shadow-sm' : 'text-fg-muted')}>{l}</button>)}
        </div>
        <div className="divide-y divide-[var(--border)]">{movers[mv].map((r) => row(r, mv === 'active' ? `Volume ${r.volx.toFixed(1)}× usual` : undefined))}</div>
      </Section>
      <p className="px-4 pt-6 text-center text-[11px] text-fg-subtle">Practice trading with simulated prices. Not investment advice.</p>
    </div>
  )
}

/** Tools: everything that isn't a daily screen, grouped by what you're doing. */
export function PhoneTools({ onTool }: { onTool: (t: Tool) => void }) {
  const groups: [string, string[]][] = [['Trade', ['chain', 'strategy', 'setups']], ['Discover', ['scanner', 'markets']], ['Review and control', ['journal', 'alerts', 'rules']]]
  return (
    <div className="pb-28">
      {groups.map(([g, ids]) => <section key={g} className="mt-5">
        <h2 className="px-4 pb-1.5 text-[13px] font-medium text-fg-subtle">{g}</h2>
        <div className="divide-y divide-[var(--border)] border-y border-line">{ids.map((id) => { const t = TOOLS.find((x) => x.id === id)!
          return <button key={id} type="button" onClick={() => onTool(t)} className="flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left active:bg-hover">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[12px] bg-sunken text-fg">{t.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-[15px] font-medium text-fg">{t.label}</span><span className="block text-[13px] text-fg-subtle">{t.sub}</span></span>
            <ChevronRight size={18} strokeWidth={1.75} className="text-fg-subtle" /></button> })}</div>
      </section>)}
    </div>
  )
}

/** Profile: the account, funds, limits and rules, and settings. */
export function PhoneProfile({ onHoldings, onAsk }: { onHoldings: () => void; onAsk: (q: string) => void }) {
  const s = useStore(); const p = s.pnl(); const [edit, setEdit] = useState(false); const [key, setKey] = useState(false)
  const rules = Object.keys(s.rules) as RuleId[]
  const row = (icon: ReactNode, label: string, value: ReactNode, onClick?: () => void) => (
    <button type="button" disabled={!onClick} onClick={onClick} className="flex min-h-14 w-full items-center gap-3.5 px-4 py-3 text-left active:bg-hover disabled:active:bg-transparent">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-sunken text-fg-muted">{icon}</span>
      <span className="min-w-0 flex-1 text-[15px] text-fg">{label}</span><span className={cn('shrink-0 text-[14px] text-fg-muted', typeof value === 'string' && /\d/.test(value) && 'num')}>{value}</span>
      {onClick && <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-fg-subtle" />}
    </button>
  )
  const group = (title: string, children: ReactNode) => <section className="mt-5"><h2 className="px-4 pb-1.5 text-[13px] font-medium text-fg-subtle">{title}</h2><div className="divide-y divide-[var(--border)] border-y border-line">{children}</div></section>
  return (
    <div className="pb-28">
      <div className="flex items-center gap-3.5 px-4 pt-5">
        <span className="flex size-14 items-center justify-center rounded-full bg-lime text-[20px] font-semibold text-on-lime">P</span>
        <div><p className="text-[18px] font-semibold text-fg">Practice account</p><p className="text-[13px] text-fg-subtle">₹10,00,000 to practise with · simulated NSE</p></div>
      </div>
      {group('Funds', <>
        {row(<Wallet size={18} />, 'Available to trade', inr(p.avail))}
        {row(<Shield size={18} />, 'Margin in use', inr(p.used))}
        {row(<Briefcase size={18} />, 'Holdings', 'View', onHoldings)}
      </>)}
      {group('Risk limits', <>
        {row(<Target size={18} />, 'Daily loss limit', inr(s.risk.maxLoss), () => setEdit(true))}
        {row(<Settings2 size={18} />, 'Trades a day', String(s.risk.maxTrades), () => setEdit(true))}
        {s.risk.killed && <div className="flex min-h-14 items-center gap-3.5 px-4 py-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-danger-soft text-danger-fg"><Lock size={18} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[15px] text-fg">Locked for today</span><span className="block text-[13px] text-fg-subtle">{s.risk.reason}. Exits still work; entries reopen next session.</span></span>
        </div>}
      </>)}
      {group('Your rules', rules.length ? rules.map((id) => <div key={id} className="flex min-h-12 items-center gap-3 px-4 py-2.5 text-[14px] text-fg"><Shield size={16} className="shrink-0 text-up" />{ruleText(id, s.rules)}</div>)
        : <button type="button" onClick={() => onAsk('my rules')} className="flex min-h-12 w-full items-center px-4 text-left text-[14px] text-fg-muted">No rules yet. Ask the assistant to suggest some from your trades.</button>)}
      {group('Settings', <>
        {row(s.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />, 'Appearance', s.theme === 'dark' ? 'Dark' : 'Light', () => s.toggleTheme())}
        {row(<KeyRound size={18} />, 'AI engine', s.apiKey ? 'Claude' : 'Built-in', () => setKey(true))}
        {row(<RotateCcw size={18} />, 'Reset practice account', '', () => { if (window.confirm('Reset the practice account? Positions, orders, alerts and trade history go back to the starting state.')) resetBook() })}
      </>)}
      <p className="px-4 pt-6 text-center text-[11px] text-fg-subtle">Practice trading with simulated prices. Not investment advice.</p>

      <Sheet open={edit} onClose={() => setEdit(false)} label="Risk limits">
        <form className="space-y-4 px-4" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); s.setRisk({ maxLoss: Math.max(500, +(f.get('loss') ?? 0)), maxTrades: Math.max(1, +(f.get('trades') ?? 0)) }); s.setToast('Limits saved'); setEdit(false) }}>
          <p className="text-[16px] font-semibold text-fg">Risk limits for today</p>
          <label className="block text-[13px] text-fg-subtle">Daily loss limit (₹)<input name="loss" inputMode="numeric" defaultValue={s.risk.maxLoss} className="num mt-1 h-12 w-full rounded-lg border border-line bg-surface px-3 text-[16px] text-fg outline-none focus:border-fg-subtle" /></label>
          <label className="block text-[13px] text-fg-subtle">Trades a day<input name="trades" inputMode="numeric" defaultValue={s.risk.maxTrades} className="num mt-1 h-12 w-full rounded-lg border border-line bg-surface px-3 text-[16px] text-fg outline-none focus:border-fg-subtle" /></label>
          <p className="text-[12px] text-fg-subtle">When a limit is hit, positions close and new entries pause until the next session. Exits always work.</p>
          <button type="submit" className="h-12 w-full rounded-lg bg-fg text-[15px] font-semibold text-[var(--bg)]">Save</button>
        </form>
      </Sheet>
      <Sheet open={key} onClose={() => setKey(false)} label="AI engine">
        <div className="space-y-3 px-4">
          <p className="text-[16px] font-semibold text-fg">AI engine</p>
          <p className="text-[13px] text-fg-muted">The built-in engine understands trading commands offline. Add an Anthropic API key and Claude reads free-form requests. The key stays in this browser.</p>
          <input type="password" aria-label="Anthropic API key" placeholder="sk-ant-…" defaultValue={s.apiKey} onBlur={(e) => s.setApiKey(e.target.value.trim())} className="h-12 w-full rounded-lg border border-line bg-surface px-3 text-[16px] outline-none focus:border-fg-subtle" />
          <button type="button" onClick={() => setKey(false)} className="h-12 w-full rounded-lg bg-fg text-[15px] font-semibold text-[var(--bg)]">Done</button>
        </div>
      </Sheet>
    </div>
  )
}

/** Search: find any instrument, or hand the words to the agent. */
export function SearchScreen({ onBack, onStock, onAsk }: { onBack: () => void; onStock: (sym: string) => void; onAsk: (q: string) => void }) {
  const [q, setQ] = useState(''); const prices = useStore((s) => s.prices); const watch = useStore((s) => s.watch)
  const t = q.trim().toLowerCase()
  const rows = (t ? INSTS.filter((i) => i.sym.toLowerCase().includes(t) || i.name.toLowerCase().includes(t)) : INSTS.filter((i) => watch.includes(i.sym))).slice(0, 30)
  return (
    <Screen title={<input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stocks and indices" aria-label="Search"
      className="h-10 w-full rounded-full bg-sunken px-4 text-[16px] font-normal text-fg outline-none placeholder:text-fg-subtle" />} onBack={onBack}>
      {t && <button type="button" onClick={() => onAsk(q)} className="flex min-h-14 w-full items-center gap-3 border-b border-line px-4 text-left active:bg-hover">
        <Sparkles size={18} className="text-fg-muted" /><span className="text-[15px] text-fg">Ask the agent: “{q}”</span></button>}
      {!t && <p className="px-4 pb-1 pt-4 text-[13px] text-fg-subtle">Your watchlist</p>}
      <div className="divide-y divide-[var(--border)]">{rows.map((i) => { const p = prices[i.sym]; const c = p ? (p.ltp / p.prev - 1) * 100 : 0
        return <button key={i.sym} type="button" onClick={() => onStock(i.sym)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left active:bg-hover">
          <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-fg">{i.sym}</span><span className="block truncate text-[12px] text-fg-subtle">{i.name}{i.seg === 'IDX' ? ' · Index' : ` · ${i.sector}`}</span></span>
          {p && <span className="shrink-0 text-right"><span className="num block text-[14px] text-fg">{fmt(p.ltp)}</span><span className={cn('num block text-[12px]', c >= 0 ? 'text-up' : 'text-down')}>{c >= 0 ? '+' : '−'}{Math.abs(c).toFixed(2)}%</span></span>}
        </button> })}</div>
    </Screen>
  )
}

/** Notifications: what the agent and your alerts told you, newest first. */
export function NotificationsSheet({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: () => void }) {
  const msgs = useStore((s) => s.msgs)
  const items = msgs.filter((m) => m.event).slice(-20).reverse()
  return (
    <Sheet open={open} onClose={onClose} label="Notifications">
      <p className="px-4 pb-2 text-[16px] font-semibold text-fg">Notifications</p>
      {items.length ? <div className="divide-y divide-[var(--border)]">{items.map((m) => (
        <button key={m.id} type="button" onClick={onOpen} className="flex w-full gap-3 px-4 py-3 text-left active:bg-hover">
          <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', m.event === 'bad' ? 'bg-danger' : m.event === 'good' ? 'bg-success' : m.event === 'attention' ? 'bg-attention' : 'bg-[var(--border-strong)]')} />
          <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-[14px] text-fg">{m.text.replace(/\*\*/g, '')}</span>
            {m.ts && <span className="block text-[12px] text-fg-subtle">{new Date(m.ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}</span>}</span>
        </button>))}</div>
        : <p className="px-4 py-8 text-center text-[14px] text-fg-subtle">Fills, stops, targets and alerts show up here.</p>}
    </Sheet>
  )
}
