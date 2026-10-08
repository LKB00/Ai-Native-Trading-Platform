import { create } from 'zustand'
import { INSTS, bySym, nextExpiries, optQuote, simNow, keyOf, parseKey, labelOf, history, charges, FREEZE, isExpiryDay, SQUARE_OFF, secOfDay, sessionDay, expiryDate, type Leg, type TF } from './market'
import { DEFAULT_RULES, hhmm, type Rules } from './rules'
import type { Profile } from './setup'
import type { Action, Card, Filter, OrderAction, ViewName } from './actions'

export type OType = 'MARKET' | 'LIMIT' | 'SL' | 'SL-M'
export type Via = 'manual' | 'ai' | 'chart' | 'gtt' | 'bracket' | 'risk' | 'sip'
export type Order = {
  id: number; time: string; ts: number; key: string; side: 'BUY' | 'SELL'; qty: number; otype: OType
  price: number; trigger?: number; product: string; status: 'OPEN' | 'TRIGGER_PENDING' | 'COMPLETE' | 'CANCELLED' | 'REJECTED'
  fill?: number; note?: string; tag?: string; via: Via; sl?: number; tgt?: number; trail?: number
  /** When it filled, for the order's timeline. */
  filledAt?: number
  /** Simulated exchange time of the order, for chart fill markers. */
  st?: number
}
export type Position = { key: string; qty: number; avg: number; realized: number; product: string; charges: number; openedAt: number; tag?: string }
/** Exit plan on an open position: stop, target (OCO) and optional trailing distance. */
export type Bracket = { sl?: number; tgt?: number; trail?: number; peak?: number }
export type Trigger = { id: number; sym: string; dir: 'above' | 'below'; price: number; then?: OrderAction; done?: boolean; created: number
  /** A paused watch keeps its settings but isn't checked until resumed. */
  paused?: boolean
  /** How it was asked, when it came from a percentage ("falls 2%"), so the rail can say it the same way. */
  note?: string }
export type Trade = { id: number; key: string; side: 'LONG' | 'SHORT'; qty: number; entry: number; exit: number; pnl: number; charges: number; open: number; close: number; product: string; tag?: string; via: Via; sample?: boolean; exitReason?: string }
export type Holding = { sym: string; qty: number; avg: number; since: string }
export type Sip = { id: number; sym: string; amount: number; day: number; active: boolean; runs: number }
export type Risk = { maxLoss: number; maxProfit: number; maxTrades: number; cooloffAfter: number; killed: boolean; reason?: string; cooloffUntil?: number }
export type Audit = { ts: number; source: 'ai' | 'user' | 'system'; text: string }
export type Msg = {
  /** Bookkeeping (an order moved, cancelled or filled): shown as a one-line note, not a full reply. */
  kind?: 'activity'
  id: number; role: 'user' | 'ai'; text: string; pending?: Action[]; state?: 'pending' | 'confirmed' | 'dismissed'; scan?: Filter[]
  /** Live cards shown under the reply. */
  cards?: Card[]
  /** Next prompts that make sense after this reply. */
  follow?: string[]
  /** The agent started this message itself: a fill, a stop, an alert, a risk limit. */
  event?: 'info' | 'good' | 'bad' | 'attention'
  /** Orders placed when this message's draft was approved, so its card can track them. */
  orderIds?: number[]
  ts?: number
  /** Loaded from a previous visit. Its orders and positions no longer exist, because paper trading resets on reload. */
  restored?: boolean
}
/** Chat is the AI-native home: the conversation is the terminal. Terminal is the classic multi-panel layout. */
/** One saved conversation. `renamed` stops the title following the first question. */
export type ChatMeta = { id: string; title: string; ts: number; updated: number; renamed?: boolean; msgs: Msg[] }
export type Mode = 'chat' | 'terminal'
/** What the chat's side canvas shows: one full tool, opened from a card. */
export type Canvas = { view: ViewName } | null
export type View = ViewName
export type ChartType = 'bars' | 'candles' | 'hollow' | 'heikin' | 'line' | 'area' | 'baseline'
/** One indicator on the chart (same shape as chart/indicators.ts IndInstance). */
export type IndInstance = { id: string; type: string; params: Record<string, number>; color?: string; visible: boolean }
export type ChartCfg = { type: ChartType; inds: IndInstance[]; pivots: boolean; scale: 'normal' | 'log' | 'percent'; autoScale: boolean; magnet: boolean; keepDrawing: boolean; lockAll: boolean; hideAll: boolean; watermark: boolean }
/** Layout panels: open state and sizes, persisted per browser. */
/** Layout panels: open state and sizes, persisted per browser. `chatFull`: the agent fills the screen. */
export type Panels = { watch: boolean; copilot: boolean; bottom: boolean; watchW: number; copilotW: number; bottomH: number; focus: boolean; chips: boolean; chatFull: boolean }
export type ChartLayout = '1' | '2v' | '2h' | '3' | '4'
/** One chart pane: an instrument key (stock, index or option contract) and its timeframe. */
export type Pane = { k: string; tf: TF }
/** A two-point drawing. Times are epoch seconds, so drawings survive timeframe changes. */
export type DrawKind = 'trend' | 'ray' | 'extended' | 'hray' | 'vline' | 'channel' | 'fib' | 'rect' | 'text' | 'long' | 'short' | 'measure'
/**
 * A drawing anchored in time and price, so it survives timeframe changes.
 * channel: p3 is the parallel line's price offset. long/short: p1 entry, p2 target, p3 stop, t2 right edge.
 */
export type Drawing = { id: string; kind: DrawKind; t1: number; p1: number; t2: number; p2: number; p3?: number; text?: string; color?: string; width?: 1 | 2 | 3; dash?: 0 | 1 | 2; locked?: boolean; extendLeft?: boolean; extendRight?: boolean }
export type Quote = { ltp: number; prev: number; open: number; high: number; low: number; vol: number; avgVol: number }

const START = 1_000_000
const now = () => new Date().toLocaleTimeString('en-IN', { hour12: false })
let oid = 1000, tid = 1, mid = 1, trid = 1, sid = 1
let warned = false
let misWarned = ''

type S = {
  prices: Record<string, Quote>
  watch: string[]; sym: string; view: View; expiryIdx: number
  legs: Leg[]; stratName: string
  orders: Order[]; positions: Record<string, Position>; brackets: Record<string, Bracket>; cash: number
  /** Session day on which intraday positions were auto squared off; no new intraday entries that day. */
  misClosed?: string
  triggers: Trigger[]; trades: Trade[]; holdings: Holding[]; sips: Sip[]; risk: Risk; rules: Rules; audit: Audit[]
  /** Who this desk is set up for (onboarding). Null until set up, or after Skip. */
  profile: Profile | null
  fnoAck: boolean; needAck: boolean; instant: boolean
  chart: ChartCfg; drawings: Record<string, number[]>; aiLevels: Record<string, boolean>
  scan: { filters: Filter[]; name: string; sort: string }
  palette: boolean
  /** The keyboard shortcuts sheet. */
  shortcuts: boolean
  panels: Panels; setPanels: (p: Partial<Panels>) => void; togglePanel: (k: 'watch' | 'copilot' | 'bottom' | 'focus' | 'chips') => void
  sections: Record<string, boolean>; toggleSection: (id: string, open?: boolean) => void
  charts: { layout: ChartLayout; panes: Pane[]; active: number }
  setLayout: (l: ChartLayout, panes?: Pane[]) => void; setPane: (i: number, p: Partial<Pane>) => void; setActivePane: (i: number) => void
  shapes: Record<string, Drawing[]>; history: Record<string, { undo: Drawing[][]; redo: Drawing[][] }>; snapshot: (k: string) => void; undo: (k: string) => void; redo: (k: string) => void
  addShape: (k: string, d: Omit<Drawing, 'id'>) => string; updateShape: (k: string, id: string, d: Partial<Drawing>) => void; removeShape: (k: string, id?: string) => void
  msgs: Msg[]; toast: string; apiKey: string; busy: boolean
  /** Every conversation, newest activity first. The open one is kept in step with `msgs`. */
  chats: ChatMeta[]; activeChat: string
  /** Start a fresh conversation. The current one stays in the history; an empty one is reused instead of piling up. */
  newChat: () => void
  openChat: (id: string) => void
  deleteChat: (id: string) => void
  renameChat: (id: string, title: string) => void
  mode: Mode; setMode: (m: Mode) => void; canvas: Canvas; setCanvas: (c: Canvas) => void
  /** The agent reports something that happened without being asked. Also shows a toast. */
  event: (text: string, tone?: Msg['event'], cards?: Card[], follow?: string[]) => void
  theme: 'light' | 'dark'; toggleTheme: () => void
  tick: () => void
  setSym: (s: string) => void; setView: (v: View) => void; setExpiry: (i: number) => void
  setLegs: (l: Leg[], name?: string) => void
  ltp: (key: string) => number
  place: (key: string, side: 'BUY' | 'SELL', qty: number, otype: OType, price: number, product: string, opts?: { trigger?: number; sl?: number; tgt?: number; trail?: number; tag?: string; via?: Via }) => string
  modify: (id: number, p: { price?: number; trigger?: number }) => void
  cancel: (id: number) => void
  /** Move an open equity position between Intraday (MIS) and Delivery (CNC). Returns what happened, for a toast. */
  convert: (key: string) => string
  squareoff: (key?: string, reason?: string) => number
  setBracket: (key: string, b: Partial<Bracket> | null) => void
  addMsg: (m: Omit<Msg, 'id'>) => number
  patchMsg: (id: number, p: Partial<Msg>) => void
  setToast: (t: string) => void
  setApiKey: (k: string) => void; setBusy: (b: boolean) => void
  watchOp: (op: 'add' | 'remove', sym: string) => void
  addTrigger: (t: Omit<Trigger, 'id' | 'created'>) => void
  removeTrigger: (id: number) => void
  pauseTrigger: (id: number, paused: boolean) => void
  setRisk: (r: Partial<Risk>) => void
  /** Turn rules on (values) or off (undefined). Persisted, and logged like risk settings. */
  setRules: (r: Partial<Rules>) => void
  /** Set or clear why an open position was taken; it carries to the journal when it closes. */
  tagPosition: (key: string, tag?: string) => void
  setProfile: (p: Profile | null) => void
  setWatch: (w: string[]) => void
  setChart: (c: Partial<ChartCfg>) => void
  toggleDrawing: (sym: string, price: number) => void
  setScan: (s: Partial<S['scan']>) => void
  log: (source: Audit['source'], text: string) => void
  pnl: () => { day: number; realized: number; unreal: number; used: number; avail: number; charges: number; net: number }
  run: (a: Action, via?: Via) => string
  resolveOrder: (a: OrderAction) => { key: string; qty: number }
  set: (p: Partial<S>) => void
}

const WELCOME: Msg = { id: 0, role: 'ai', text: "I'm your trading assistant. Ask in plain English. I draft orders, scans and plans, and nothing executes until you approve it.\n\nTry:\n- **brief me** for the morning summary\n- **buy 50 sbi with sl 850 target 900**\n- **stocks above 200 ema with rsi over 60 in banks**\n- **iron condor on nifty 2 lots**\n- **draw levels on reliance**\n- **review my trades**" }

// ---- Paper book: orders, positions, exit plans, alerts, trades, holdings, SIPs, cash and prices, kept in this
// browser so a reload continues the same trading day instead of starting over.
const BOOK_KEY = 'book'
const BOOK_FIELDS = ['orders', 'positions', 'brackets', 'triggers', 'trades', 'holdings', 'sips', 'cash', 'prices', 'misClosed'] as const
type SavedBook = { v: 1; day: string; counters: { oid: number; tid: number; trid: number; sid: number } } & Partial<Pick<S, (typeof BOOK_FIELDS)[number]>>
function loadBook(): Partial<S> {
  try {
    const raw = localStorage.getItem(BOOK_KEY); if (!raw) return {}
    const b = JSON.parse(raw) as SavedBook; if (b.v !== 1) return {}
    oid = Math.max(oid, b.counters.oid); tid = Math.max(tid, b.counters.tid); trid = Math.max(trid, b.counters.trid); sid = Math.max(sid, b.counters.sid)
    const out: Partial<S> = {}
    for (const k of BOOK_FIELDS) if (b[k] != null) (out as Record<string, unknown>)[k] = b[k]
    // Prices carry on within the same trading day. On a new day the book is settled overnight and prices start
    // fresh, so yesterday's last price doesn't pose as today's.
    if (b.day !== sessionDay()) { Object.assign(out, rollover(b)); delete out.prices; out.misClosed = undefined }
    else if (out.prices && INSTS.some((i) => !out.prices![i.sym])) delete out.prices // instrument list changed since
    return out
  } catch { return {} }
}
/** Shown once the store exists: what overnight settlement did to the book. */
let bookNotice: string | undefined

/**
 * Overnight settlement, the way an Indian broker does it, using the last prices of the saved day:
 * intraday (MIS) positions close at 3:20 pm, delivery (CNC) buys move into holdings, options past expiry
 * settle at intrinsic value, unfilled day orders expire, and the daily risk lock lifts.
 */
function rollover(b: SavedBook): Partial<S> {
  const px = (sym: string) => b.prices?.[sym]?.ltp ?? bySym(sym)?.base ?? 0
  const at320 = Date.parse(`${b.day}T09:50:00Z`) // 15:20 IST
  let cash = b.cash ?? START; const trades = [...(b.trades ?? [])]; const holdings = [...(b.holdings ?? [])]
  const positions: Record<string, Position> = {}; const notes: string[] = []
  const close = (p: Position, price: number, reason: string) => {
    const kind = kindOf(p.key, p.product); const q = Math.abs(p.qty); const long = p.qty > 0
    const exitCh = charges(kind, long ? 'SELL' : 'BUY', price * q).total, entryCh = charges(kind, long ? 'BUY' : 'SELL', p.avg * q).total
    const pnl = (price - p.avg) * p.qty
    cash += (long ? price : -price) * q - exitCh
    trades.unshift({ id: trid++, key: p.key, side: long ? 'LONG' : 'SHORT', qty: q, entry: p.avg, exit: price, pnl, charges: exitCh + entryCh, open: p.openedAt, close: at320, product: p.product, via: 'risk', tag: p.tag, exitReason: reason })
    notes.push(`- ${labelOf(p.key)}: ${reason} at ${price.toFixed(2)}, ${pnl - exitCh - entryCh < 0 ? '−' : '+'}₹${Math.abs(Math.round(pnl - exitCh - entryCh)).toLocaleString('en-IN')} after charges`)
  }
  for (const p of Object.values(b.positions ?? {})) {
    if (!p.qty) continue
    const k = parseKey(p.key)
    if (k.strike) {
      const exp = expiryDate(k.exp, b.day)
      if (exp && exp <= b.day) { const spot = px(k.und); close(p, Math.max(k.type === 'CE' ? spot - k.strike : k.strike - spot, 0), 'expiry settlement'); continue }
      positions[p.key] = { ...p, realized: 0, charges: 0 }
    } else if (p.product === 'MIS') close(p, px(k.und), 'auto square-off 3:20 pm')
    else if (p.product === 'CNC' && p.qty > 0) {
      const h = holdings.find((x) => x.sym === p.key)
      if (h) { h.avg = (h.avg * h.qty + p.avg * p.qty) / (h.qty + p.qty); h.qty += p.qty } else holdings.push({ sym: p.key, qty: p.qty, avg: p.avg, since: b.day })
      notes.push(`- ${p.key}: ${p.qty} shares moved to holdings`)
    } else close(p, px(k.und), 'auto square-off 3:20 pm')
  }
  const brackets = Object.fromEntries(Object.entries(b.brackets ?? {}).filter(([k]) => positions[k]))
  let expired = 0
  const orders = (b.orders ?? []).map((o) => (o.status === 'OPEN' || o.status === 'TRIGGER_PENDING' ? (expired++, { ...o, status: 'CANCELLED' as const, note: 'Day order expired at the close' }) : o))
  if (expired) notes.push(`- ${expired} unfilled day order${expired > 1 ? 's' : ''} expired at the close`)
  const carried = Object.keys(positions).length; if (carried) notes.push(`- ${carried} F&O position${carried > 1 ? 's' : ''} carried forward`)
  const risk = { ...loadJSON('risk', DEFAULT_RISK), killed: false, reason: undefined, cooloffUntil: undefined }; saveJSON('risk', risk)
  if (notes.length) bookNotice = `**New session.** Since you were last here on ${new Date(b.day).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}, your book was settled the way a broker would:\n${notes.join('\n')}\n\nToday's P&L and risk limits start fresh.`
  return { cash, trades, holdings, positions, brackets, orders, risk }
}

let bookTimer: ReturnType<typeof setTimeout> | undefined
function bookSnapshot(): SavedBook {
  const s = useStore.getState()
  return { v: 1, day: sessionDay(), counters: { oid, tid, trid, sid }, ...Object.fromEntries(BOOK_FIELDS.map((k) => [k, s[k]])) }
}
let skipSave = false
/** Throttled, not debounced: prices change every second, so a debounce would never fire. */
function saveBook() {
  if (bookTimer || skipSave) return
  bookTimer = setTimeout(() => { bookTimer = undefined; if (skipSave) return; try { localStorage.setItem(BOOK_KEY, JSON.stringify(bookSnapshot())) } catch { /* storage unavailable */ } }, 2000)
}

// ---- Chat history: every conversation is kept in this browser, like any AI app, so you can start a new one for another
// stock or topic and come back to the old ones. `msgs` is always the open conversation; `chats` holds them all.
const CHAT_KEY = 'chat'        // the old single thread, read once to migrate
const CHATS_KEY = 'chats'
const CHAT_MAX = 200           // messages kept per conversation
const CHATS_MAX = 60           // conversations kept
/**
 * Saved messages come back marked `restored`. Orders are saved too (see loadBook), so order trackers keep
 * working; if the book was cleared, the card says the order is gone. Approval drafts are kept: placing one
 * re-runs every pre-trade check at current prices.
 */
const tidy = (raw: unknown): Msg[] => (Array.isArray(raw) ? (raw as Msg[]) : []).filter((m) => m && m.id > 0 && (m.role === 'user' || m.role === 'ai')).slice(-CHAT_MAX)
const newId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)
const titleOf = (msgs: Msg[]) => {
  const q = msgs.find((m) => m.role === 'user')?.text.replace(/\s+/g, ' ').trim()
  if (!q) return 'New chat'
  const t = q.length > 46 ? q.slice(0, 44).trimEnd() + '…' : q
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const blank = (): ChatMeta => ({ id: newId(), title: 'New chat', ts: Date.now(), updated: Date.now(), msgs: [] })
function loadChats(): { chats: ChatMeta[]; active: string } {
  let chats: ChatMeta[] = []; let active = ''
  try {
    const raw = localStorage.getItem(CHATS_KEY)
    if (raw) {
      const j = JSON.parse(raw) as { active?: string; chats?: ChatMeta[] }
      chats = (j.chats ?? []).filter((c) => c && c.id).map((c) => ({ ...c, msgs: tidy(c.msgs).map((m) => ({ ...m, restored: true })) }))
      active = j.active ?? ''
    } else {
      // Before conversations existed there was one thread; it becomes the first entry.
      const old = tidy(JSON.parse(localStorage.getItem(CHAT_KEY) || '[]')).map((m) => ({ ...m, restored: true }))
      if (old.length) chats = [{ id: newId(), title: titleOf(old), ts: old[0].ts ?? Date.now(), updated: old[old.length - 1].ts ?? Date.now(), msgs: old }]
    }
  } catch { /* unreadable: start clean */ }
  for (const c of chats) for (const m of c.msgs) mid = Math.max(mid, m.id)
  if (!chats.some((c) => c.id === active)) { const f = blank(); chats = [f, ...chats]; active = f.id }
  return { chats, active }
}
let saveTimer: ReturnType<typeof setTimeout> | undefined
const persistable = (chats: ChatMeta[], active: string) => ({ active, chats: chats.filter((c) => c.id === active || c.msgs.length).slice(0, CHATS_MAX).map((c) => ({ ...c, msgs: c.msgs.filter((m) => m.id > 0).slice(-CHAT_MAX).map(({ restored: _r, ...m }) => m) })) })
function saveChats(chats: ChatMeta[], active: string) {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(CHATS_KEY, JSON.stringify(persistable(chats, active))) } catch { /* storage full or unavailable: history just won't persist */ }
  }, 400)
}
/** Keep the open conversation's entry in step with the live thread. */
function syncActive(msgs: Msg[], chats: ChatMeta[], active: string): ChatMeta[] {
  const real = msgs.filter((m) => m.id > 0); const i = chats.findIndex((c) => c.id === active); if (i < 0) return chats
  const cur = chats[i]
  const next: ChatMeta = { ...cur, msgs: real, title: cur.renamed ? cur.title : titleOf(real), updated: real.length ? (real[real.length - 1].ts ?? Date.now()) : cur.updated }
  const rest = chats.filter((_, k) => k !== i)
  return [next, ...rest].sort((a, b) => (b.id === active ? 1 : 0) - (a.id === active ? 1 : 0) || b.updated - a.updated).sort((a, b) => b.updated - a.updated)
}

const INITIAL_CHATS = loadChats()
const loadKey = () => { try { return localStorage.getItem('anthropic_key') || '' } catch { return '' } }
const loadJSON = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) as T : d } catch { return d } }
const saveJSON = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage unavailable */ } }

function initPrices(): Record<string, Quote> {
  return Object.fromEntries(INSTS.map((i) => {
    const d = history(i, '1D', 260)
    const r = Math.max(-0.012, Math.min(0.012, i.base / d[d.length - 2].close - 1)); const prev = i.base / (1 + r), avgVol = d.slice(-21, -1).reduce((a, c) => a + c.volume, 0) / 20
    const open = prev * (1 + r * 0.4)
    return [i.sym, { ltp: i.base, prev, open, high: Math.max(open, i.base), low: Math.min(open, i.base), vol: Math.round(d[d.length - 1].volume * 0.55), avgVol }]
  }))
}

const kindOf = (key: string, product: string) => (parseKey(key).strike ? 'OPTION' : product === 'CNC' ? 'DELIVERY' : 'INTRADAY') as 'OPTION' | 'DELIVERY' | 'INTRADAY'

/** Sample history so the journal and calendar are meaningful on first run. Flagged `sample`. */
function sampleTrades(): Trade[] {
  let seed = 42; const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const syms = ['RELIANCE', 'SBIN', 'TCS', 'INFY', 'HDFCBANK', 'TATAMOTORS', 'ICICIBANK', 'NIFTY', 'NIFTY', 'BANKNIFTY']
  const out: Trade[] = []; const d = new Date(); d.setHours(10, 0, 0, 0)
  for (let day = 1, n = 0; day <= 45 && n < 60; day++) {
    const dt = new Date(d); dt.setDate(d.getDate() - day); if (dt.getDay() === 0 || dt.getDay() === 6) continue
    const count = Math.floor(r() * 3) + (r() < 0.2 ? 3 : 0)
    for (let k = 0; k < count; k++, n++) {
      const sym = syms[Math.floor(r() * syms.length)]; const inst = bySym(sym)!; const opt = inst.seg === 'IDX'
      const entry = opt ? 80 + r() * 160 : inst.base * (0.95 + r() * 0.1)
      const win = r() < (dt.getDay() === 2 ? 0.38 : 0.55) // weaker on expiry Tuesdays: gives the journal something to find
      const move = (win ? 1 : -1) * entry * (opt ? 0.08 + r() * 0.3 : 0.004 + r() * 0.018)
      const long = r() < 0.65; const qty = opt ? inst.lot * (1 + Math.floor(r() * 2)) : Math.round((60000 + r() * 90000) / entry)
      const exit = entry + (long ? move : -move)
      const ch = charges(opt ? 'OPTION' : 'INTRADAY', 'BUY', entry * qty).total + charges(opt ? 'OPTION' : 'INTRADAY', 'SELL', exit * qty).total
      const open = dt.getTime() + k * 3.6e6 + r() * 1.8e6
      const strike = opt ? Math.round(inst.base / inst.step) * inst.step + (r() < 0.5 ? 0 : inst.step) : 0
      out.push({ id: trid++, key: opt ? keyOf(sym, strike, r() < 0.5 ? 'CE' : 'PE', 'PAST') : sym, side: long ? 'LONG' : 'SHORT', qty, entry, exit, pnl: (exit - entry) * qty * (long ? 1 : -1), charges: ch, open, close: open + (10 + r() * 200) * 60000, product: opt ? 'NRML' : 'MIS', via: r() < 0.3 ? 'ai' : 'manual', tag: opt ? (r() < 0.5 ? 'expiry scalp' : 'breakout') : r() < 0.5 ? 'breakout' : 'pullback', sample: true, exitReason: win ? 'target' : r() < 0.6 ? 'stop' : 'manual' })
    }
  }
  return out.sort((a, b) => b.close - a.close)
}

const DEFAULT_CHART: ChartCfg = {
  type: 'candles', pivots: false, scale: 'normal', autoScale: true, magnet: true, keepDrawing: false, lockAll: false, hideAll: false, watermark: true,
  inds: [{ id: 'vwap', type: 'vwap', params: {}, visible: true }, { id: 'ema20', type: 'ema', params: { length: 20 }, visible: true }, { id: 'vol', type: 'volume', params: { length: 20 }, visible: true }],
}
/** Turn an indicator name from the copilot ("EMA 50", "RSI", "Bollinger") into an instance. */
function indFromName(n: string): IndInstance | null {
  const t = n.toLowerCase(); const num = +(t.match(/\d+/)?.[0] ?? 0); const id = Math.random().toString(36).slice(2, 9)
  const map: [RegExp, string, Record<string, number>][] = [[/^ema/, 'ema', { length: num || 20 }], [/^sma|moving average/, 'sma', { length: num || 20 }], [/vwap/, 'vwap', {}], [/super/, 'supertrend', { atrLength: 10, factor: 3 }], [/boll|^bb/, 'bb', { length: 20, mult: 2 }], [/rsi/, 'rsi', { length: num || 14 }], [/macd/, 'macd', { fast: 12, slow: 26, signal: 9 }], [/vol/, 'volume', { length: 20 }], [/stoch/, 'stoch', { k: 14, d: 3, smooth: 3 }], [/atr/, 'atr', { length: 14 }], [/adx/, 'adx', { length: 14 }]]
  const m = map.find(([re]) => re.test(t)); return m ? { id, type: m[1], params: m[2], visible: true } : null
}
const DEFAULT_PANELS: Panels = { watch: true, copilot: true, bottom: true, watchW: 264, copilotW: 420, bottomH: 220, focus: false, chips: true, chatFull: false }
const DEFAULT_RISK: Risk = { maxLoss: 15000, maxProfit: 40000, maxTrades: 20, cooloffAfter: 3, killed: false }

export const useStore = create<S>((set, get) => ({
  prices: initPrices(),
  watch: loadJSON('watch', ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'TCS', 'INFY', 'SBIN', 'BEL', 'TATAMOTORS']),
  sym: 'NIFTY', view: 'chart', expiryIdx: 0,
  legs: [], stratName: '',
  orders: [], positions: {}, brackets: {}, cash: START, triggers: [],
  trades: sampleTrades(),
  holdings: [
    { sym: 'RELIANCE', qty: 40, avg: 1310, since: '2024-03-12' }, { sym: 'HDFCBANK', qty: 60, avg: 1610, since: '2023-11-02' },
    { sym: 'TCS', qty: 15, avg: 3480, since: '2024-07-19' }, { sym: 'ITC', qty: 300, avg: 405, since: '2024-01-08' },
    { sym: 'BEL', qty: 200, avg: 252, since: '2024-05-27' }, { sym: 'TITAN', qty: 20, avg: 3150, since: '2025-02-14' },
    { sym: 'NIFTYBEES', qty: 500, avg: 236, since: '2023-06-05' }, { sym: 'GOLDBEES', qty: 800, avg: 63, since: '2024-02-05' },
  ],
  sips: [{ id: sid++, sym: 'NIFTYBEES', amount: 10000, day: 5, active: true, runs: 28 }, { id: sid++, sym: 'GOLDBEES', amount: 3000, day: 10, active: true, runs: 19 }],
  risk: loadJSON('risk', DEFAULT_RISK),
  rules: loadJSON('rules', DEFAULT_RULES),
  profile: loadJSON<Profile | null>('profile', null),
  audit: [],
  fnoAck: loadJSON('fnoAck', false), needAck: false, instant: false,
  chart: { ...DEFAULT_CHART, ...loadJSON('chart2', {}) },
  drawings: loadJSON('drawings', {}), aiLevels: {},
  scan: { filters: [], name: '', sort: 'chg' },
  palette: false, shortcuts: false,
  // 'cockpit-panels': a new key, so the cockpit opens with every panel showing instead of the old Terminal's folds.
  // A first visit (no desk set up, no saved layout) opens in Chat with the empty positions panel folded, so setup has
  // room; the Terminal is one tap away.
  panels: { ...DEFAULT_PANELS, ...(!loadJSON('cockpit-panels', null) && !loadJSON('profile', null) ? { chatFull: true, bottom: false } : {}), ...loadJSON('cockpit-panels', {}), focus: false },
  setPanels: (p) => { const panels = { ...get().panels, ...p }; saveJSON('cockpit-panels', panels); set({ panels }) },
  togglePanel: (k) => {
    const pn = get().panels
    // Focus mode hides every side panel; leaving it restores what was open before.
    if (k === 'focus') { if (pn.focus) get().setPanels({ ...(loadJSON('panelsBeforeFocus', {}) as Partial<Panels>), focus: false }); else { saveJSON('panelsBeforeFocus', { watch: pn.watch, copilot: pn.copilot, bottom: pn.bottom }); get().setPanels({ watch: false, copilot: false, bottom: false, focus: true }) } return }
    get().setPanels({ [k]: !pn[k], focus: false })
  },
  sections: loadJSON('sections', {}),
  toggleSection: (id, open) => { const cur = get().sections[id] ?? true; const sections = { ...get().sections, [id]: open ?? !cur }; saveJSON('sections', sections); set({ sections }) },
  charts: loadJSON('charts', { layout: '1', panes: [{ k: 'NIFTY', tf: '5m' }, { k: 'BANKNIFTY', tf: '5m' }, { k: 'RELIANCE', tf: '15m' }, { k: 'HDFCBANK', tf: '1D' }], active: 0 }),
  setLayout: (layout, panes) => { const charts = { ...get().charts, layout, panes: panes ? [...panes, ...get().charts.panes.slice(panes.length)].slice(0, 4) : get().charts.panes, active: 0 }; saveJSON('charts', charts); set({ charts, sym: parseKey(charts.panes[0].k).und }) },
  setPane: (i, p) => { const panes = get().charts.panes.map((x, j) => (j === i ? { ...x, ...p } : x)); const charts = { ...get().charts, panes }; saveJSON('charts', charts); set({ charts }) },
  setActivePane: (i) => { const charts = { ...get().charts, active: i }; saveJSON('charts', charts); set({ charts, sym: parseKey(charts.panes[i].k).und }) },
  shapes: loadJSON('shapes', {}),
  history: {},
  snapshot: (k) => { const h = get().history[k] ?? { undo: [], redo: [] }; set({ history: { ...get().history, [k]: { undo: [...h.undo, get().shapes[k] ?? []].slice(-50), redo: [] } } }) },
  undo: (k) => { const h = get().history[k]; if (!h?.undo.length) return; const prev = h.undo[h.undo.length - 1]; const shapes = { ...get().shapes, [k]: prev }; saveJSON('shapes', shapes); set({ shapes, history: { ...get().history, [k]: { undo: h.undo.slice(0, -1), redo: [...h.redo, get().shapes[k] ?? []] } } }) },
  redo: (k) => { const h = get().history[k]; if (!h?.redo.length) return; const next = h.redo[h.redo.length - 1]; const shapes = { ...get().shapes, [k]: next }; saveJSON('shapes', shapes); set({ shapes, history: { ...get().history, [k]: { undo: [...h.undo, get().shapes[k] ?? []], redo: h.redo.slice(0, -1) } } }) },
  addShape: (k, d) => { get().snapshot(k); const id = Math.random().toString(36).slice(2, 9); const shapes = { ...get().shapes, [k]: [...(get().shapes[k] ?? []), { ...d, id }] }; saveJSON('shapes', shapes); set({ shapes }); return id },
  updateShape: (k, id, d) => { const shapes = { ...get().shapes, [k]: (get().shapes[k] ?? []).map((x) => (x.id === id ? { ...x, ...d } : x)) }; saveJSON('shapes', shapes); set({ shapes }) },
  removeShape: (k, id) => { get().snapshot(k); const shapes = { ...get().shapes, [k]: id ? (get().shapes[k] ?? []).filter((x) => x.id !== id) : [] }; saveJSON('shapes', shapes); set({ shapes }) },
  // One cockpit now: the agent always answers with cards. Kept as a field so replies can still branch on it.
  mode: 'chat', setMode: (mode) => set({ mode }),
  canvas: null, setCanvas: (canvas) => { if (canvas) set({ view: canvas.view }); set({ canvas }) },
  event: (text, tone = 'info', cards, follow) => { get().addMsg({ role: 'ai', text, event: tone, cards, follow }); get().setToast(text.replace(/\*\*/g, '')) },
  // Saved paper trading state overrides the fresh defaults above.
  ...loadBook(),
  msgs: [WELCOME, ...INITIAL_CHATS.chats.find((c) => c.id === INITIAL_CHATS.active)!.msgs],
  chats: INITIAL_CHATS.chats, activeChat: INITIAL_CHATS.active,
  newChat: () => {
    const s = get(); if (!s.msgs.some((m) => m.id > 0)) return   // already on an empty one
    const f = blank(); set({ chats: [f, ...s.chats], activeChat: f.id, msgs: [WELCOME] })
  },
  openChat: (id) => {
    const s = get(); const c = s.chats.find((x) => x.id === id); if (!c || id === s.activeChat) return
    // Leaving an empty conversation drops it, so "New chat" never leaves blanks behind.
    const chats = s.msgs.some((m) => m.id > 0) ? s.chats : s.chats.filter((x) => x.id !== s.activeChat)
    set({ chats, activeChat: id, msgs: [WELCOME, ...c.msgs], busy: false })
  },
  deleteChat: (id) => {
    const s = get(); const rest = s.chats.filter((c) => c.id !== id)
    if (id !== s.activeChat) { set({ chats: rest }); return }
    const next = rest.find((c) => c.msgs.length)
    if (next) set({ chats: rest, activeChat: next.id, msgs: [WELCOME, ...next.msgs], busy: false })
    else { const f = blank(); set({ chats: [f, ...rest], activeChat: f.id, msgs: [WELCOME], busy: false }) }
  },
  renameChat: (id, title) => { const t = title.trim(); if (!t) return; set({ chats: get().chats.map((c) => (c.id === id ? { ...c, title: t.slice(0, 80), renamed: true } : c)) }) },
  toast: '', apiKey: loadKey(), busy: false,
  theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
  toggleTheme: () => {
    const theme = get().theme === 'dark' ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem('theme', theme) } catch { /* storage unavailable */ }
    set({ theme })
  },
  set: (p) => set(p),

  tick: () => {
    const p = { ...get().prices }
    for (const i of INSTS) {
      const q = p[i.sym]; const dt = 1 / (252 * 6.25 * 3600) * 12
      const ltp = q.ltp * Math.exp((Math.random() - 0.5) * 2 * i.vol * Math.sqrt(dt) * 1.7)
      p[i.sym] = { ...q, ltp, high: Math.max(q.high, ltp), low: Math.min(q.low, ltp), vol: q.vol + Math.round(q.avgVol / 22500 * (0.5 + Math.random())) }
    }
    set({ prices: p })
    const s = get()
    // Working orders: limits fill when price crosses; SL / SL-M trigger then fill at market.
    for (const o of s.orders.filter((o) => o.status === 'OPEN' || o.status === 'TRIGGER_PENDING')) {
      const l = s.ltp(o.key)
      const hit = o.status === 'TRIGGER_PENDING' ? (o.side === 'BUY' && l >= o.trigger!) || (o.side === 'SELL' && l <= o.trigger!) : (o.side === 'BUY' && l <= o.price) || (o.side === 'SELL' && l >= o.price)
      if (hit) {
        fill(o.id, l)
        if (o.via !== 'bracket' && o.via !== 'risk') get().event(`Your ${o.status === 'TRIGGER_PENDING' ? 'stop' : 'limit'} ${o.side.toLowerCase()} order filled: **${o.qty} ${labelOf(o.key)} at ₹${l.toFixed(2)}**.`, 'good', get().positions[o.key]?.qty ? [{ k: 'position', key: o.key }] : undefined, get().brackets[o.key] ? undefined : [`add stop to ${parseKey(o.key).und.toLowerCase()}`])
      }
    }
    // Exit plans (OCO): whichever of stop or target is hit first closes the position; trailing stop follows the best price.
    for (const [key, b] of Object.entries(get().brackets)) {
      const pos = get().positions[key]; if (!pos?.qty) continue
      const l = get().ltp(key); const long = pos.qty > 0
      if (b.trail) {
        const peak = long ? Math.max(b.peak ?? l, l) : Math.min(b.peak ?? l, l)
        const sl = +(long ? Math.max(b.sl ?? -Infinity, peak - b.trail) : Math.min(b.sl ?? Infinity, peak + b.trail)).toFixed(2)
        if (peak !== b.peak || sl !== b.sl) set({ brackets: { ...get().brackets, [key]: { ...b, peak, sl } } })
      }
      const cur = get().brackets[key]
      const hitSl = cur.sl != null && (long ? l <= cur.sl : l >= cur.sl), hitTg = cur.tgt != null && (long ? l >= cur.tgt : l <= cur.tgt)
      if (hitSl || hitTg) {
        const msg = get().place(key, long ? 'SELL' : 'BUY', Math.abs(pos.qty), 'MARKET', 0, pos.product, { via: 'bracket', tag: hitSl ? (cur.trail ? 'trailing stop' : 'stop') : 'target' })
        const tr = get().trades[0]; const net = tr && tr.key === key ? tr.pnl - tr.charges : undefined
        get().event(`**${hitSl ? (cur.trail ? 'Trailing stop' : 'Stop') : 'Target'} hit on ${labelOf(key)}.** ${msg}.${net != null ? ` Net on this trade after charges: ${net < 0 ? '−' : '+'}₹${Math.abs(Math.round(net)).toLocaleString('en-IN')}.` : ''}`, hitSl && (net ?? 0) < 0 ? 'bad' : 'good', undefined, ['review my trades', 'show my positions'])
      }
    }
    // Intraday window: warn ten minutes ahead, then close every MIS position at 3:20 pm, as brokers do.
    { const t = simNow(); const sod = secOfDay(t); const day = sessionDay(t)
      const mis = Object.values(get().positions).filter((x) => x.qty && x.product === 'MIS')
      if (mis.length && sod >= SQUARE_OFF - 600 && sod < SQUARE_OFF && misWarned !== day) {
        misWarned = day
        get().event(`**Intraday positions close automatically at 3:20 pm**, in ${Math.ceil((SQUARE_OFF - sod) / 60)} minutes: ${mis.map((x) => labelOf(x.key)).join(', ')}. Exit before then if you'd rather choose the price.`, 'attention', [{ k: 'positions' }])
      }
      if (sod >= SQUARE_OFF && get().misClosed !== day) autoSquareOff(day) }
    // Daily risk limits: auto square-off and lock.
    const r = get().risk; const pl = get().pnl()
    if (!r.killed && Object.values(get().positions).some((x) => x.qty)) {
      if (pl.net <= -r.maxLoss) { get().squareoff(undefined, 'max loss'); get().setRisk({ killed: true, reason: `Daily loss limit of ₹${r.maxLoss.toLocaleString('en-IN')} reached` }); get().event('**Daily loss limit reached.** I closed all positions and locked new trades for today. Exits still work.', 'bad', [{ k: 'risk' }], ['review my trades']) }
      else if (pl.net >= r.maxProfit) { get().squareoff(undefined, 'max profit'); get().setRisk({ killed: true, reason: `Daily profit target of ₹${r.maxProfit.toLocaleString('en-IN')} locked in` }); get().event('**Profit target reached.** I closed positions and locked the profit for today.', 'good', [{ k: 'risk' }]) }
      else if (pl.net <= -r.maxLoss * 0.8 && !warned) { warned = true; get().event(`**You're at ${Math.round(-pl.net / r.maxLoss * 100)}% of today's loss limit.** At ₹${r.maxLoss.toLocaleString('en-IN')} I close everything automatically.`, 'attention', [{ k: 'positions' }], ['close all positions', 'tighten my stops']) }
    }
    // Alerts and GTTs.
    for (const t of get().triggers.filter((t) => !t.done && !t.paused)) {
      const l = p[t.sym].ltp
      if ((t.dir === 'above' && l >= t.price) || (t.dir === 'below' && l <= t.price)) {
        set({ triggers: get().triggers.map((x) => (x.id === t.id ? { ...x, done: true } : x)) })
        if (t.then) { const ro = get().resolveOrder(t.then); const msg = get().place(ro.key, t.then.side, ro.qty, t.then.otype, t.then.price ?? 0, t.then.product, { via: 'gtt', sl: t.then.sl, tgt: t.then.tgt, trail: t.then.trail, trigger: t.then.trigger, tag: t.then.tag }); get().event(`**Price trigger hit:** ${t.sym} went ${t.dir} ${t.price}. ${msg}`, msg.startsWith('Rejected') ? 'bad' : 'good', get().positions[ro.key]?.qty ? [{ k: 'position', key: ro.key }] : undefined) }
        else get().event(`**Alert: ${t.sym} is ${t.dir} ${t.price}** (now ${l.toFixed(2)}).`, 'attention', [{ k: 'quote', sym: t.sym }], [`buy ${t.sym.toLowerCase()}`, `analyse ${t.sym.toLowerCase()}`, `why is ${t.sym.toLowerCase()} moving`])
      }
    }
  },
  setSym: (sym) => { const c = get().charts; const panes = c.panes.map((x, j) => (j === c.active ? { ...x, k: sym } : x)); saveJSON('charts', { ...c, panes }); set({ sym, charts: { ...c, panes } }) },
  setView: (view) => set({ view }), setExpiry: (expiryIdx) => set({ expiryIdx }),
  setLegs: (legs, stratName = '') => set({ legs, stratName }),
  ltp: (key) => {
    const k = parseKey(key); const spot = get().prices[k.und]?.ltp ?? 0
    if (!k.strike) return spot
    const exps = nextExpiries(k.und); const ex = exps.find((e) => e.label === k.exp) ?? exps[0]
    return +optQuote(k.und, spot, ex.T, k.strike, k.type!).price.toFixed(2)
  },
  resolveOrder: (a) => {
    const inst = bySym(a.und)!
    if (a.strike && a.ot) { const ex = nextExpiries(a.und)[a.expiryIdx ?? 0] ?? nextExpiries(a.und)[0]; return { key: keyOf(a.und, a.strike, a.ot, ex.label), qty: a.qty * inst.lot } }
    return { key: a.und, qty: a.qty }
  },
  place: (key, side, qty, otype, price, product, opts = {}) => {
    const s = get(); const l = s.ltp(key); const k = parseKey(key); const inst = bySym(k.und)!
    const via = opts.via ?? 'manual'
    const reject = (note: string) => { const id = ++oid; set({ orders: [{ id, time: now(), ts: Date.now(), key, side, qty, otype, price: price || l, product, status: 'REJECTED', note, via, tag: opts.tag }, ...get().orders] }); get().log('system', `Rejected ${side} ${qty} ${labelOf(key)}: ${note}`); return `Rejected: ${note}` }
    const pos = s.positions[key]
    const holding = !k.strike && product === 'CNC' && side === 'SELL' ? s.holdings.find((h) => h.sym === key && h.qty >= qty) : undefined
    const reducing = (!!pos && ((pos.qty > 0 && side === 'SELL') || (pos.qty < 0 && side === 'BUY')) && qty <= Math.abs(pos.qty)) || !!holding
    if (!reducing) {
      // Pre-trade checks, cheapest first. Exits are never blocked.
      if (s.risk.killed) return reject(`Trading locked: ${s.risk.reason ?? 'emergency stop on'}`)
      if (product === 'MIS' && !k.strike && (secOfDay() >= SQUARE_OFF || s.misClosed === sessionDay())) return reject('Intraday entries stop at 3:20 pm. Choose Delivery, or trade in the next session')
      if (s.risk.cooloffUntil && Date.now() < s.risk.cooloffUntil) return reject(`Taking a break after ${s.risk.cooloffAfter} losses in a row, ${Math.ceil((s.risk.cooloffUntil - Date.now()) / 60000)} min left`)
      if (s.rules.noEntryAfter && secOfDay() >= s.rules.noEntryAfter) return reject(`Your rule: no new entries after ${hhmm(s.rules.noEntryAfter)}`)
      if (s.rules.stopRequired && !k.strike && opts.sl == null && via !== 'sip') return reject('Your rule: every entry needs a stop')
      if (opts.tag && s.rules.pausedSetups?.includes(opts.tag)) return reject(`Your rule: ${opts.tag} trades are paused`)
      const today = s.orders.filter((o) => o.status === 'COMPLETE' && new Date(o.ts).toDateString() === new Date().toDateString() && o.via !== 'bracket' && o.via !== 'risk').length
      if (today >= s.risk.maxTrades) return reject(`Daily trade limit of ${s.risk.maxTrades} reached`)
      if (k.strike && !s.fnoAck) { set({ needAck: true }); return reject('Read and accept the F&O risk disclosure first') }
      if (k.strike && qty % inst.lot) return reject(`Quantity must be a multiple of the lot size ${inst.lot}`)
      if (otype === 'LIMIT' && !k.strike && Math.abs(price / l - 1) > 0.2) return reject('Limit price is outside the 20% price band')
      const signed = side === 'BUY' ? qty : -qty
      const next = { ...s.positions, [key]: { key, qty: (pos?.qty ?? 0) + signed, avg: l, realized: 0, product, charges: 0, openedAt: 0 } }
      const ref = otype === 'MARKET' ? l : price || l
      const cashAfter = s.cash - signed * ref
      const req = marginReq(next, s)
      if (cashAfter < req) return reject(`Insufficient funds, short by ₹${Math.round(req - cashAfter).toLocaleString('en-IN')}`)
    }
    // Auto-slice above the exchange freeze quantity.
    const freeze = k.strike ? FREEZE[k.und] : 0
    if (freeze && qty > freeze) {
      const n = Math.ceil(qty / freeze); const out: string[] = []
      for (let i = 0; i < n; i++) out.push(get().place(key, side, Math.min(freeze, qty - i * freeze), otype, price, product, { ...opts, tag: `${opts.tag ? opts.tag + ' · ' : ''}slice ${i + 1}/${n}` }))
      return `Sliced into ${n} orders (freeze qty ${freeze}). ` + out[out.length - 1]
    }
    const id = ++oid
    const pending = otype === 'SL' || otype === 'SL-M'
    const o: Order = { id, time: now(), ts: Date.now(), st: simNow(), key, side, qty, otype, price: otype === 'MARKET' ? l : price || l, trigger: opts.trigger, product, status: pending ? 'TRIGGER_PENDING' : 'OPEN', via, tag: opts.tag, sl: opts.sl, tgt: opts.tgt, trail: opts.trail }
    set({ orders: [o, ...get().orders] })
    get().log(via === 'ai' ? 'ai' : via === 'manual' || via === 'chart' ? 'user' : 'system', `${side} ${qty} ${labelOf(key)} ${otype}${otype === 'LIMIT' ? ' @ ' + price : ''}${pending ? ' trigger ' + opts.trigger : ''} (${via})`)
    if (pending) return `${side} ${qty} ${labelOf(key)} stop order placed, triggers at ₹${opts.trigger}`
    if (otype === 'MARKET' || (side === 'BUY' && l <= price) || (side === 'SELL' && l >= price)) { fill(id, l); return `${side} ${qty} ${labelOf(key)} filled at ₹${l.toFixed(2)}${opts.sl || opts.tgt ? ` · exit plan set${opts.sl ? ' SL ' + opts.sl : ''}${opts.tgt ? ' target ' + opts.tgt : ''}${opts.trail ? ' trailing ' + opts.trail : ''}` : ''}` }
    return `${side} ${qty} ${labelOf(key)} limit order at ₹${price} is working (now ${l.toFixed(2)})`
  },
  modify: (id, p) => set({ orders: get().orders.map((o) => (o.id === id && (o.status === 'OPEN' || o.status === 'TRIGGER_PENDING') ? { ...o, ...(p.price != null ? { price: +p.price.toFixed(2) } : {}), ...(p.trigger != null ? { trigger: +p.trigger.toFixed(2) } : {}) } : o)) }),
  convert: (key) => {
    const s = get(); const p = s.positions[key]
    if (!p?.qty || parseKey(key).strike) return 'Only open stock positions can be converted'
    const to = p.product === 'CNC' ? 'MIS' : 'CNC'
    if (to === 'MIS' && (secOfDay() >= SQUARE_OFF || s.misClosed === sessionDay())) return 'Intraday closes at 3:20 pm, so this stays Delivery'
    set({ positions: { ...s.positions, [key]: { ...p, product: to } } })
    get().log('user', `Converted ${labelOf(key)} to ${to === 'CNC' ? 'Delivery' : 'Intraday'}`)
    return `${labelOf(key)} is now ${to === 'CNC' ? 'Delivery: it carries overnight' : 'Intraday: it squares off at 3:20 pm'}`
  },
  cancel: (id) => set({ orders: get().orders.map((o) => (o.id === id && (o.status === 'OPEN' || o.status === 'TRIGGER_PENDING') ? { ...o, status: 'CANCELLED' } : o)) }),
  squareoff: (key, reason) => {
    let n = 0
    // Shorts first, so a hedged book never ends up naked mid-exit.
    const ps = Object.values(get().positions).filter((p) => p.qty && (!key || p.key === key)).sort((a, b) => a.qty - b.qty)
    for (const p of ps) { get().place(p.key, p.qty > 0 ? 'SELL' : 'BUY', Math.abs(p.qty), 'MARKET', 0, p.product, { via: reason ? 'risk' : 'manual', tag: reason }); n++ }
    for (const o of get().orders) if ((o.status === 'OPEN' || o.status === 'TRIGGER_PENDING') && (!key || o.key === key)) get().cancel(o.id)
    return n
  },
  setBracket: (key, b) => { const br = { ...get().brackets }; if (b === null) delete br[key]; else br[key] = { ...br[key], ...b }; set({ brackets: br }) },
  addMsg: (m) => { const id = ++mid; set({ msgs: [...get().msgs, { ts: Date.now(), ...m, id }] }); return id },
  patchMsg: (id, p) => set({ msgs: get().msgs.map((m) => (m.id === id ? { ...m, ...p } : m)) }),
  setToast: (toast) => { set({ toast }); setTimeout(() => get().toast === toast && set({ toast: '' }), 5000) },
  setApiKey: (k) => { try { localStorage.setItem('anthropic_key', k) } catch { /* storage unavailable */ } set({ apiKey: k }) },
  setBusy: (busy) => set({ busy }),
  watchOp: (op, sym) => { const w = op === 'add' ? (get().watch.includes(sym) ? get().watch : [...get().watch, sym]) : get().watch.filter((x) => x !== sym); saveJSON('watch', w); set({ watch: w }) },
  addTrigger: (t) => set({ triggers: [{ ...t, id: ++tid, created: Date.now() }, ...get().triggers] }),
  removeTrigger: (id) => set({ triggers: get().triggers.filter((t) => t.id !== id) }),
  pauseTrigger: (id, paused) => { set({ triggers: get().triggers.map((t) => (t.id === id ? { ...t, paused } : t)) }); get().log('user', `${paused ? 'Paused' : 'Resumed'} watch #${id}`) },
  setProfile: (profile) => { saveJSON('profile', profile); set({ profile }) },
  setWatch: (w) => { saveJSON('watch', w); set({ watch: w }) },
  tagPosition: (key, tag) => { const p = get().positions[key]; if (!p?.qty) return; set({ positions: { ...get().positions, [key]: { ...p, tag } } }) },
  setRules: (r) => { const rules = Object.fromEntries(Object.entries({ ...get().rules, ...r }).filter(([, v]) => v != null && v !== false && !(Array.isArray(v) && !v.length))) as Rules; saveJSON('rules', rules); set({ rules }); get().log('user', `Rules: ${JSON.stringify(r)}`) },
  setRisk: (r) => { const risk = { ...get().risk, ...r }; saveJSON('risk', { ...risk, cooloffUntil: undefined }); set({ risk }); get().log('user', `Risk settings: ${JSON.stringify(r)}`) },
  setChart: (c) => { const chart = { ...get().chart, ...c }; saveJSON('chart2', chart); set({ chart }) },
  toggleDrawing: (sym, price) => {
    const cur = get().drawings[sym] ?? []; const hit = cur.find((p) => Math.abs(p - price) / price < 0.0008)
    const d = { ...get().drawings, [sym]: hit != null ? cur.filter((p) => p !== hit) : [...cur, +price.toFixed(2)] }; saveJSON('drawings', d); set({ drawings: d })
  },
  setScan: (sc) => set({ scan: { ...get().scan, ...sc } }),
  log: (source, text) => set({ audit: [{ ts: Date.now(), source, text }, ...get().audit].slice(0, 300) }),
  pnl: () => {
    const s = get(); let unreal = 0, realized = 0, ch = 0
    for (const p of Object.values(s.positions)) { realized += p.realized; ch += p.charges; if (p.qty) unreal += (s.ltp(p.key) - p.avg) * p.qty }
    const used = marginReq(s.positions, s)
    return { day: realized + unreal, realized, unreal, used, avail: Math.max(s.cash - used, 0), charges: ch, net: realized + unreal - ch }
  },
  run: (a, via = 'ai') => {
    const s = get()
    switch (a.t) {
      case 'order': { const r = s.resolveOrder(a); return s.place(r.key, a.side, r.qty, a.otype, a.price ?? 0, a.product, { trigger: a.trigger, sl: a.sl, tgt: a.tgt, trail: a.trail, tag: a.tag, via }) }
      case 'legs': {
        const out: string[] = []; const inst = bySym(a.und)!; const ex = nextExpiries(a.und)[a.expiryIdx] ?? nextExpiries(a.und)[0]
        // Buy legs first so the hedge's margin benefit applies to the shorts.
        for (const l of [...a.legs].sort((x, y) => (x.side === 'BUY' ? -1 : 1) - (y.side === 'BUY' ? -1 : 1)))
          out.push(s.place(keyOf(a.und, l.strike, l.type, ex.label), l.side, l.lots * inst.lot, 'MARKET', 0, 'NRML', { via, tag: a.name }))
        return out.join('\n')
      }
      case 'squareoff': { const n = s.squareoff(a.key); return n ? `Closed ${n} position${n > 1 ? 's' : ''} at market` : 'No open positions' }
      case 'nav': { if (a.sym && bySym(a.sym)) set({ sym: a.sym.toUpperCase() }); if (a.view) set({ view: a.view }); if (a.expiryIdx != null) set({ expiryIdx: a.expiryIdx }); return '' }
      case 'watch': s.watchOp(a.op, a.sym.toUpperCase()); return `${a.op === 'add' ? 'Added' : 'Removed'} ${a.sym}`
      case 'trigger': s.addTrigger({ sym: a.sym, dir: a.dir, price: a.price, then: a.then, note: a.note }); return a.then ? `Trigger set: when ${a.sym} goes ${a.dir} ${a.price}, ${a.then.side.toLowerCase()} ${a.then.qty}` : `Alert set: ${a.sym} ${a.dir} ${a.price}`
      case 'bracket': { if (!s.positions[a.key]?.qty) return 'No open position to protect'; s.setBracket(a.key, { sl: a.sl, tgt: a.tgt, trail: a.trail, peak: undefined }); return `Exit plan on ${labelOf(a.key)}:${a.sl ? ' stop ' + a.sl : ''}${a.tgt ? ' target ' + a.tgt : ''}${a.trail ? ' trailing ' + a.trail : ''}` }
      case 'risk': {
        if (a.kill) { const n = s.squareoff(undefined, 'kill switch'); s.setRisk({ killed: true, reason: 'You stopped trading for today' }); return `Emergency stop on. Closed ${n} position(s); new trades are blocked for today.` }
        const { t: _t, kill: _k, ...rest } = a; s.setRisk(Object.fromEntries(Object.entries(rest).filter(([, v]) => v != null))); return 'Risk limits updated'
      }
      case 'rules': { const { t: _t, off, ...on } = a; s.setRules(off ? { [off]: undefined } : on); return off ? 'Rule turned off' : 'Rule on' }
      case 'scan': set({ scan: { filters: a.filters, name: a.name ?? 'Custom scan', sort: a.sort ?? get().scan.sort }, view: 'scanner' }); return ''
      case 'chart': { if (a.sym) get().setSym(a.sym); if (a.tf) get().setPane(get().charts.active, { tf: a.tf }); if (a.indicators) { const cur = get().chart.inds; const add = a.indicators.map(indFromName).filter((x): x is IndInstance => !!x && !cur.some((y) => y.type === x.type && JSON.stringify(y.params) === JSON.stringify(x.params))); s.setChart({ inds: [...cur, ...add] }) } if (a.levels && a.sym) set({ aiLevels: { ...get().aiLevels, [a.sym]: true } }); set({ view: 'chart' }); return '' }
      case 'sip': { set({ sips: [...get().sips, { id: sid++, sym: a.sym, amount: a.amount, day: a.day ?? 5, active: true, runs: 0 }] }); return `SIP started: ₹${a.amount.toLocaleString('en-IN')} into ${a.sym} on day ${a.day ?? 5} of each month` }
    }
  },
}))

/** 3:20 pm: close intraday positions at market and cancel intraday orders still working. Runs once per session. */
function autoSquareOff(day: string) {
  const st = useStore.getState(); useStore.setState({ misClosed: day })
  for (const o of st.orders) if ((o.status === 'OPEN' || o.status === 'TRIGGER_PENDING') && o.product === 'MIS') st.cancel(o.id)
  const mis = Object.values(st.positions).filter((x) => x.qty && x.product === 'MIS'); if (!mis.length) return
  const lines = mis.map((p) => {
    const msg = useStore.getState().place(p.key, p.qty > 0 ? 'SELL' : 'BUY', Math.abs(p.qty), 'MARKET', 0, 'MIS', { via: 'risk', tag: 'auto square-off 3:20 pm' })
    const tr = useStore.getState().trades[0]; const net = tr?.key === p.key ? tr.pnl - tr.charges : undefined
    return `- ${labelOf(p.key)}: ${net != null ? `closed at ${tr.exit.toFixed(2)}, ${net < 0 ? '−' : '+'}₹${Math.abs(Math.round(net)).toLocaleString('en-IN')} after charges` : msg}`
  })
  useStore.getState().event(`**3:20 pm: intraday positions squared off** at market, as a broker would.\n${lines.join('\n')}\n\nNew intraday entries are closed for this session. Delivery and F&O still work.`, 'info', [{ k: 'positions' }], ['review my trades', 'explain my pnl'])
}
if (bookNotice) { const n = bookNotice; setTimeout(() => useStore.getState().event(n, 'info', [{ k: 'positions' }], ['brief me', 'show my holdings']), 0) }

// Save the conversation whenever it changes.
useStore.subscribe((s, prev) => {
  if (s.msgs !== prev.msgs && s.activeChat === prev.activeChat) { const chats = syncActive(s.msgs, s.chats, s.activeChat); useStore.setState({ chats }) }
  if (s.chats !== prev.chats || s.activeChat !== prev.activeChat) saveChats(s.chats, s.activeChat)
  if (BOOK_FIELDS.some((k) => s[k] !== prev[k])) saveBook()
})
// Flush a pending save when the tab closes.
addEventListener('pagehide', () => {
  clearTimeout(saveTimer); clearTimeout(bookTimer); if (skipSave) return
  try { { const st = useStore.getState(); localStorage.setItem(CHATS_KEY, JSON.stringify(persistable(syncActive(st.msgs, st.chats, st.activeChat), st.activeChat))) }; localStorage.setItem(BOOK_KEY, JSON.stringify(bookSnapshot())) } catch { /* storage unavailable */ }
})
/** Start the paper account over: fresh cash, no positions or orders. Settings, chat and drawings stay. */
export function resetBook() {
  skipSave = true; clearTimeout(bookTimer)
  try { localStorage.removeItem(BOOK_KEY) } catch { /* storage unavailable */ }
  location.reload()
}

// Start on the symbol of the active chart pane.
{ const c = useStore.getState().charts; useStore.setState({ sym: parseKey(c.panes[c.active]?.k ?? 'NIFTY').und }) }

/** Margin for a set of legs, the way the order would see it. */
export function legsMargin(und: string, legs: Leg[], expiryIdx: number) {
  const s = useStore.getState(); const inst = bySym(und)!; const ex = nextExpiries(und)[expiryIdx] ?? nextExpiries(und)[0]; const pos: Record<string, Position> = {}
  for (const l of legs) { const key = keyOf(und, l.strike, l.type, ex.label); const q = (pos[key]?.qty ?? 0) + (l.side === 'BUY' ? 1 : -1) * l.lots * inst.lot; pos[key] = { key, qty: q, avg: 0, realized: 0, product: 'NRML', charges: 0, openedAt: 0 } }
  return marginReq(pos, s)
}

// SPAN-like portfolio margin: worst loss across ±8% underlying scenarios per underlying (hedges reduce it),
// plus exposure margin, an extra 2% ELM on short options on expiry day, and 20% of notional for short equity.
function marginReq(positions: Record<string, Position>, s: S) {
  const groups: Record<string, Position[]> = {}; let req = 0
  for (const p of Object.values(positions)) {
    if (!p.qty) continue
    const k = parseKey(p.key)
    if (!k.strike) { if (p.qty < 0) req += s.prices[k.und].ltp * -p.qty * 0.2; continue }
    ;(groups[k.und] ??= []).push(p)
  }
  for (const [und, ps] of Object.entries(groups)) {
    if (!ps.some((p) => p.qty < 0)) continue
    const spot = s.prices[und].ltp; const exps = nextExpiries(und)
    const val = (p: Position, S0: number) => { const k = parseKey(p.key); const ex = exps.find((e) => e.label === k.exp) ?? exps[0]; return optQuote(und, S0, ex.T, k.strike, k.type!).price }
    let worst = 0
    for (let m = -0.08; m <= 0.0801; m += 0.02) worst = Math.min(worst, ps.reduce((a, p) => a + p.qty * (val(p, spot * (1 + m)) - val(p, spot)), 0))
    const shortQty = ps.filter((p) => p.qty < 0).reduce((a, p) => a - p.qty, 0), longQty = ps.filter((p) => p.qty > 0).reduce((a, p) => a + p.qty, 0)
    const hedged = Math.min(shortQty, longQty)
    req += -worst + (shortQty - hedged) * spot * 0.02 + hedged * spot * 0.005 + (isExpiryDay(und) ? shortQty * spot * 0.02 : 0)
  }
  return req
}

function fill(id: number, price: number) {
  const s = useStore.getState(); const o = s.orders.find((x) => x.id === id); if (!o) return
  const k = parseKey(o.key)
  const ch = charges(kindOf(o.key, o.product), o.side, price * o.qty).total
  // Selling from long-term holdings (CNC, no intraday position).
  const holdingIdx = s.holdings.findIndex((h) => h.sym === o.key)
  if (!k.strike && o.product === 'CNC' && o.side === 'SELL' && !(s.positions[o.key]?.qty > 0) && holdingIdx >= 0) {
    const h = s.holdings[holdingIdx]; const holdings = [...s.holdings]
    holdings[holdingIdx] = { ...h, qty: h.qty - o.qty }
    const trade: Trade = { id: trid++, key: o.key, side: 'LONG', qty: o.qty, entry: h.avg, exit: price, pnl: (price - h.avg) * o.qty, charges: ch, open: new Date(h.since).getTime(), close: Date.now(), product: 'CNC', via: o.via, tag: o.tag ?? 'investment', exitReason: 'manual' }
    useStore.setState({ holdings: holdings.filter((x) => x.qty > 0), cash: s.cash + price * o.qty - ch, trades: [trade, ...s.trades], orders: s.orders.map((x) => (x.id === id ? { ...x, status: 'COMPLETE', fill: price, filledAt: Date.now() } : x)) })
    return
  }
  const pos = s.positions[o.key] ?? { key: o.key, qty: 0, avg: 0, realized: 0, product: o.product, charges: 0, openedAt: Date.now() }
  // The tag says why a position was opened, so it comes from the entry order only: never from an exit (whose tag is
  // its reason, like "stop"), and never left over from an earlier position in the same name.
  const entryTag = o.via === 'bracket' || o.via === 'risk' ? undefined : o.tag
  let tag = pos.qty ? pos.tag : entryTag
  const signed = o.side === 'BUY' ? o.qty : -o.qty
  let { qty, avg, realized, openedAt } = pos; let cash = s.cash - ch
  cash += o.side === 'BUY' ? -price * o.qty : price * o.qty
  const trades = [...s.trades]; let risk = s.risk
  if (qty === 0 || Math.sign(qty) === Math.sign(signed)) { if (qty === 0) openedAt = Date.now(); avg = (avg * Math.abs(qty) + price * o.qty) / (Math.abs(qty) + o.qty); qty += signed }
  else {
    const closeQty = Math.min(Math.abs(qty), o.qty)
    const pnl = (price - avg) * closeQty * Math.sign(qty)
    realized += pnl
    const entryCh = charges(kindOf(o.key, o.product), qty > 0 ? 'BUY' : 'SELL', avg * closeQty).total
    trades.unshift({ id: trid++, key: o.key, side: qty > 0 ? 'LONG' : 'SHORT', qty: closeQty, entry: avg, exit: price, pnl, charges: ch + entryCh, open: openedAt, close: Date.now(), product: o.product, via: o.via, tag: pos.tag, exitReason: o.via === 'bracket' ? o.tag : o.via === 'risk' ? (o.tag ?? 'risk limit') : 'manual' })
    // Behaviour guardrail: N losing trades in a row today starts a 15-minute cool-off.
    const todays = trades.filter((t) => !t.sample && new Date(t.close).toDateString() === new Date().toDateString())
    let streak = 0; for (const t of todays) { if (t.pnl - t.charges < 0) streak++; else break }
    if (streak >= risk.cooloffAfter && !risk.cooloffUntil) { risk = { ...risk, cooloffUntil: Date.now() + 15 * 60000 }; setTimeout(() => useStore.getState().setToast(`${streak} losses in a row. New entries pause for 15 minutes. Exits still work.`), 0) }
    qty += signed
    if (qty !== 0 && Math.sign(qty) === Math.sign(signed)) { avg = price; openedAt = Date.now(); tag = entryTag }
    if (qty === 0) { avg = 0; tag = undefined }
  }
  const brackets = { ...s.brackets }
  if (qty === 0) delete brackets[o.key]
  else if (o.sl || o.tgt || o.trail) brackets[o.key] = { sl: o.sl, tgt: o.tgt, trail: o.trail }
  useStore.setState({
    cash, risk, trades, brackets,
    positions: { ...s.positions, [o.key]: { ...pos, qty, avg, realized, openedAt, charges: pos.charges + ch, tag: tag ?? (qty ? entryTag : undefined) } },
    orders: s.orders.map((x) => (x.id === id ? { ...x, status: 'COMPLETE', fill: price, filledAt: Date.now() } : x)),
  })
}

export { START }

/**
 * What an order would cost before you place it, using the same margin maths as the pre-trade check in `place`:
 * the funds it takes (negative when it frees them), the funds free right now, and round-trip charges at this price.
 */
export function orderCost(key: string, side: 'BUY' | 'SELL', qty: number, ref: number, product: string) {
  const s = useStore.getState(); const k = parseKey(key); const pos = s.positions[key]
  const signed = side === 'BUY' ? qty : -qty
  const now = marginReq(s.positions, s)
  // Selling delivery shares you hold is a sale, not a short: it frees the full value and needs no margin.
  const fromHoldings = !k.strike && product === 'CNC' && side === 'SELL' && !pos?.qty && s.holdings.some((h) => h.sym === key && h.qty >= qty)
  const next = { ...s.positions, [key]: { key, qty: (pos?.qty ?? 0) + signed, avg: ref, realized: 0, product, charges: 0, openedAt: 0 } }
  const needs = fromHoldings ? -qty * ref : signed * ref + marginReq(next, s) - now
  const kind = k.strike ? 'OPTION' : product === 'CNC' ? 'DELIVERY' : 'INTRADAY'
  const turnover = ref * qty
  const a = charges(kind, side, turnover), b = charges(kind, side === 'BUY' ? 'SELL' : 'BUY', turnover)
  const parts = (['brokerage', 'stt', 'exch', 'gst', 'stamp', 'sebi'] as const).map((p) => [p, a[p] + b[p]] as const)
  return { needs, free: Math.max(s.cash - now, 0), charges: a.total + b.total, parts }
}
