// The Assistant, docked in the cockpit. You say what you want; it answers with live cards (quotes, charts,
// chains, scans, positions) and drafts every trade as an editable ticket you approve in place. It also speaks
// first when something happens to your money. The chart, watchlist and positions stay in view around it.
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Bell, SquarePen, CircleAlert, CircleCheck, Mic, PanelRightClose, Square, Crosshair, ChevronDown, SquareSlash, CornerDownRight, Check } from 'lucide-react'
import { AIMark, Badge, IconButton, Markdown, TypingIndicator, KeyHint, cn } from '../ds'
import { useStore, type Msg } from '../store'
import { actionablePending, usePendingCount, useEntryGate, GateIcon } from '../gate'
import { INSTS, bySym, fmtIST, labelOf, parseKey } from '../market'
import { progress } from '../watch'
import { useShallow } from 'zustand/react/shallow'
import { ask } from '../ai'
import { Chg, Money, pct } from '../ui'
import { CardView, DraftCard, say } from './cards'
import { GettingStarted, Welcome } from '../welcome'
import { DeskBar } from '../agent/Desk'

/** Starting over drops drafts that are still waiting for approval, so say so first. */
function confirmClear() {
  const waiting = actionablePending(useStore.getState())
  return confirm(waiting ? `Start a new conversation? ${waiting} draft${waiting > 1 ? 's' : ''} waiting for approval will be discarded. Positions and orders are not affected.` : 'Start a new conversation? Positions and orders are not affected.')
}

/** Chat-layout actions for the top bar: drafts waiting on you, and a new conversation. */
export function ChatTopActions() {
  const pending = usePendingCount(); const hasChat = useStore((s) => s.msgs.length > 1)
  return <>
    {pending > 0 && <button type="button" onClick={() => document.querySelector('[data-pending]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Badge tone="warning">{pending} waiting for you</Badge></button>}
    <IconButton label="New conversation" disabled={!hasChat} onClick={() => { if (confirmClear()) useStore.getState().clearChat() }}><SquarePen size={16} strokeWidth={1.5} /></IconButton>
  </>
}

/** The agent panel on the right of the cockpit. `resize` is the drag handle the layout passes in. */
export function ChatPanel({ overlay, resize, full = false }: { overlay: boolean; resize?: ReactNode; full?: boolean }) {
  const pending = usePendingCount()
  const hasChat = useStore((s) => s.msgs.length > 1)
  useEffect(() => { if (overlay) document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus({ preventScroll: true }) }, [overlay])
  return (
    // Docked it's a grid column (relative, for its resize handle); as a drawer it's fixed over the page. Never both:
    // with both classes 'relative' wins, and the drawer would take a grid slot and push the folded rail onto a new row.
    <aside id="copilot" aria-label="Assistant" className={cn('flex min-h-0 min-w-0 flex-col bg-bg', !full && 'border-l border-line', overlay ? 'fixed bottom-0 right-0 top-[86px] z-40 w-[min(440px,100vw)] shadow-lg animate-sheet' : 'relative max-md:border-l-0')}>
      {resize}
      {/* In the Chat layout the top bar already says where you are, so the panel drops its header; New chat and the
          drafts badge move up there (ChatTopActions). The docked panel keeps it, to name the column. */}
      {!full && <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface pl-4 pr-2 max-md:hidden">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-lime text-on-lime"><AIMark size={16} /></span>
        <h2 className="font-sans text-[13px] font-semibold text-fg">Assistant</h2>
        {pending > 0 && <button type="button" onClick={() => document.querySelector('[data-pending]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Badge tone="warning">{pending} waiting for you</Badge></button>}
        <span className="ml-auto flex items-center gap-0.5">
          <KeyHint className="mr-1 max-lg:hidden">/</KeyHint>
          <IconButton size="sm" label="New conversation" disabled={!hasChat} onClick={() => { if (confirmClear()) useStore.getState().clearChat() }}><SquarePen size={15} strokeWidth={1.5} /></IconButton>
          <IconButton size="sm" className="max-md:hidden" label="Hide the assistant ( ] )" onClick={() => useStore.getState().togglePanel('copilot')}><PanelRightClose size={15} strokeWidth={1.5} /></IconButton>
        </span>
      </header>}
      {full && <div className="min-[960px]:hidden"><DeskBar /></div>}
      <Thread full={full} />
    </aside>
  )
}

/** Where the thread was scrolled, kept across remounts (switching Agent/Terminal views). */
const saved: { pinned: boolean; top: number | null } = { pinned: true, top: null }

function Thread({ full = false }: { full?: boolean }) {
  const msgs = useStore((s) => s.msgs); const busy = useStore((s) => s.busy)
  const real = msgs.filter((m) => m.id !== 0)
  const scroller = useRef<HTMLDivElement>(null); const pinned = useRef(saved.pinned)
  // Switching views remounts the thread. Put it back where you left it before the first paint, with no animation:
  // at the bottom if you were following along, otherwise at the exact spot you were reading.
  const mounted = useRef(false)
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return
    // An empty thread is the welcome: it reads from the top, not from the bottom.
    if (real.length === 0) { el.scrollTop = 0; return }
    el.scrollTop = saved.pinned || saved.top == null ? el.scrollHeight : saved.top
    // Cards with charts grow after the first frame; keep the bottom in view while they settle.
    if (saved.pinned) { const t = setTimeout(() => { el.scrollTop = el.scrollHeight }, 120); return () => clearTimeout(t) }
  }, [])
  // Follow the conversation when you just asked something, or when you were already at the bottom.
  // An event while you're reading further up doesn't yank the page; the toast and positions panel tell you instead.
  useEffect(() => {
    const el = scroller.current; const last = real[real.length - 1]; if (!el || !last) return
    if (!mounted.current) { mounted.current = true; return }
    const userTurn = last.role === 'user' || real[real.length - 2]?.role === 'user'
    if (!userTurn && !pinned.current) return
    const go = () => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    // Again once cards have laid out their charts, which grow the thread after the first frame.
    requestAnimationFrame(go); const t = setTimeout(go, 120), t2 = setTimeout(go, 600); return () => { clearTimeout(t); clearTimeout(t2) }
  }, [real.length, busy]) // eslint-disable-line react-hooks/exhaustive-deps
  const lastAi = [...real].reverse().find((m) => m.role === 'ai')
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Conversation">
      <div ref={scroller} onScroll={(e) => { const el = e.currentTarget; pinned.current = saved.pinned = el.scrollHeight - el.scrollTop - el.clientHeight < 120; saved.top = el.scrollTop }} className="scroll-thin min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className={cn('@container mx-auto w-full max-w-[800px] px-4 pb-8', full ? 'pt-8' : 'pt-5')}>
          {real.length === 0 ? <Hero /> : <div>{real.map((m, i) => <Fragment key={m.id}>
              <div className={i === 0 ? undefined : gap(real[i - 1], m)}><MsgView m={m} /></div>
              {/* Marks where this session starts, so only when something new follows the restored history. */}
              {m.restored && real[i + 1] && !real[i + 1].restored && <SessionDivider ts={m.ts} />}
            </Fragment>)}
            {busy && <div className="mt-4 flex h-6 items-center gap-2 text-fg-subtle"><AIMark size={16} className="animate-pulse text-fg" /><TypingIndicator /></div>}</div>}
        </div>
      </div>
      <ChatComposer full={full} chips={lastAi?.follow && lastAi.follow.length > 0 && !busy
        ? <div className="mb-2 flex flex-wrap gap-1.5 max-md:-mx-3 max-md:flex-nowrap max-md:overflow-x-auto max-md:px-3 max-md:[scrollbar-width:none]" aria-label="Suggested next">{lastAi.follow.map((f) => <button key={f} type="button" onClick={() => say(f)} className="group inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-line bg-surface max-md:h-10 max-md:px-3.5 max-md:text-[14px] pl-2 pr-2.5 text-[12px] text-fg-muted transition-colors hover:border-line-strong hover:bg-hover hover:text-fg active:translate-y-px"><CornerDownRight size={12} strokeWidth={1.75} className="text-fg-subtle group-hover:text-fg-muted" />{f}</button>)}</div>
        : null} />
    </div>
  )
}

/** Marks where the saved conversation ends and this visit begins. */
function SessionDivider({ ts }: { ts?: number }) {
  return (
    <div role="separator" className="my-8 flex items-center gap-3 text-[11px] text-fg-subtle">
      <span className="h-px flex-1 bg-line" />
      <span>Earlier{ts ? ` · ${new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

/** Bookkeeping lines, including ones saved before they were marked. */
const isActivity = (m: Msg) => m.kind === 'activity' || (m.role === 'ai' && !m.cards?.length && !m.pending && !m.event && !m.follow?.length && /^(✓|⚠️|Moved your|Cancelled your|Closed your)/.test(m.text))

/**
 * Space between messages says how they relate: a reply sits close under its question, a new question opens a new
 * exchange, and runs of bookkeeping lines stack tightly.
 */
function gap(prev: Msg, m: Msg) {
  if (isActivity(m)) return isActivity(prev) ? 'mt-1.5' : 'mt-4'
  if (m.role === 'user') return 'mt-7'
  return prev.role === 'user' ? 'mt-3' : 'mt-4'
}

const clock = (ts?: number) => fmtIST((ts ?? Date.now()) / 1000, { hour: '2-digit', minute: '2-digit', hour12: false })
const TONE: Record<NonNullable<Msg['event']>, { label: string; icon: typeof Bell; cls: string }> = {
  info: { label: 'Update', icon: Bell, cls: 'text-fg-muted' },
  good: { label: 'Done', icon: CircleCheck, cls: 'text-up' },
  bad: { label: 'Loss taken', icon: CircleAlert, cls: 'text-down' },
  attention: { label: 'Needs your attention', icon: CircleAlert, cls: 'text-[var(--attention-fg)]' },
}

function MsgView({ m }: { m: Msg }) {
  // Your words: a bubble on the right. Its time shows on hover, on the side away from the text.
  if (m.role === 'user') return (
    <div className="group flex items-end justify-end gap-2 animate-rise">
      <span className="mb-1.5 text-[11px] tabular-nums text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100">{clock(m.ts)}</span>
      <div className="max-w-[75%] whitespace-pre-wrap rounded-lg bg-sunken px-3 py-1.5 text-[13px] leading-6 text-fg">{m.text}</div>
    </div>
  )
  // Bookkeeping: one quiet line with its time, so it reads as a log entry, not a reply.
  if (isActivity(m)) {
    const bad = m.text.startsWith('⚠️') || /^Rejected/.test(m.text)
    return (
      <div className="flex items-start gap-2 text-[12px] leading-5 text-fg-muted">
        <span className={cn('mt-[7px] size-1.5 shrink-0 rounded-full', bad ? 'bg-danger' : 'bg-[var(--border-strong)]')} aria-hidden />
        <span className="min-w-0 flex-1 [&_p]:my-0 [&_strong]:font-medium [&_strong]:text-fg"><Markdown>{m.text.replace(/^(✓|⚠️)\s*/gm, '')}</Markdown></span>
        <span className="shrink-0 tabular-nums text-fg-subtle">{clock(m.ts)}</span>
      </div>
    )
  }
  // The agent: full width, no avatar. Something it noticed on its own carries a tone, a label and the time.
  const t = m.event ? TONE[m.event] : undefined
  return (
    <div id={`msg-${m.id}`} data-pending={m.state === 'pending' || undefined} className="min-w-0 space-y-3 animate-rise">
      {t && <p className={cn('flex items-center gap-1.5 text-[12px] font-medium', t.cls)}><t.icon size={14} strokeWidth={2} aria-hidden />{t.label}<span className="font-normal text-fg-subtle">· {clock(m.ts)}</span></p>}
      {/* Prose rhythm: 8px between paragraphs and lists, tighter between list items, bold in medium weight. */}
      {m.text && <div className="text-[13px] leading-[22px] text-fg [&>*]:my-0 [&>*+*]:mt-2 [&_li+li]:mt-1 [&_li]:my-0 [&_strong]:font-semibold [&_ul]:pl-5"><Markdown>{m.text}</Markdown></div>}
      {m.cards?.map((c, i) => <CardView key={i} c={c} />)}
      {m.pending && <DraftCard msgId={m.id} />}
    </div>
  )
}

/* ------------------------------------------------------------------ first screen */

const STARTERS: { group: string; items: string[] }[] = [
  { group: 'Start the day', items: ['brief me', 'show my positions'] },
  { group: 'Find trades', items: ['stocks near 52 week high with volume 2x', 'banks above 200 ema with rsi over 60'] },
  { group: 'Trade', items: ['buy 50 sbi with sl 850 target 900', 'buy 1 lot nifty atm ce'] },
  { group: 'Options', items: ['mildly bullish on nifty, max loss 5000', 'nifty option chain'] },
]

function Hero() {
  const h = +fmtIST(Date.now() / 1000, { hour: 'numeric', hour12: false })
  const fresh = useStore((s) => !s.profile)
  if (fresh) return <Welcome />
  return (
    <div className="pt-4 @2xl:pt-[6vh]">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-lime text-on-lime"><AIMark size={22} /></span>
      <h1 className="mt-3 text-[22px] font-semibold leading-tight tracking-[-0.02em] @2xl:mt-5 @2xl:text-[34px]">{h < 12 ? 'Good morning.' : h < 17 ? 'Good afternoon.' : 'Good evening.'} What are we trading?</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-5 text-fg-muted @2xl:text-[15px] @2xl:leading-6">Say it in plain words. I pull up the data, draft the order with a stop, and nothing reaches the market until you approve it. I'll also tell you when a stop, target or alert is hit.</p>
      <>
      <div className="mt-5 grid gap-4 @2xl:mt-7 @2xl:grid-cols-2 @2xl:gap-3">
        {STARTERS.map((g) => <div key={g.group} className="@2xl:rounded-[10px] @2xl:border @2xl:border-line @2xl:bg-surface @2xl:p-3">
          <p className="px-1 text-[11px] font-medium text-fg-subtle">{g.group}</p>
          <ul className="mt-1">{g.items.map((it) => <li key={it}><button type="button" onClick={() => say(it)} className="w-full rounded-lg px-2 py-1.5 text-left text-[13px] text-fg hover:bg-hover">{it}</button></li>)}</ul>
        </div>)}
      </div>
      <p className="mt-5 text-[12px] text-fg-subtle">Type <KeyHint>@</KeyHint> for a symbol, <KeyHint>/</KeyHint> for commands. Practice trading with simulated prices. Not investment advice.</p></>
    </div>
  )
}

/* ------------------------------------------------------------------ live position strip */

/**
 * Open positions, pinned where you type: total open P&L, then one chip per position with where price sits between
 * its stop and target. Tap a chip for its exit controls. It is the at-a-glance half of the agent's watch; the other
 * half is the check-in message when price nears a level (see watch.ts).
 */
function PositionStrip() {
  const open = useStore(useShallow((s) => Object.values(s.positions).filter((p) => p.qty)))
  const brackets = useStore((s) => s.brackets); const ltp = useStore((s) => s.ltp); useStore((s) => s.prices)
  if (!open.length) return null
  const total = open.reduce((a, p) => a + (ltp(p.key) - p.avg) * p.qty, 0)
  return (
    <div role="region" aria-label="Open positions" className="mb-2 flex items-center gap-2 overflow-hidden rounded-[10px] border border-line bg-surface py-1.5 pl-3 pr-1.5">
      <div className="shrink-0 pr-1">
        <p className="flex items-center gap-1.5 text-[11px] text-fg-subtle"><span className="size-1.5 animate-pulse rounded-full bg-success" aria-hidden />{open.length} open</p>
        <Money v={total} className="text-[13px] font-semibold" />
      </div>
      <div className="scroll-thin flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
        {open.map((p) => {
          const l = ltp(p.key); const long = p.qty > 0; const br = brackets[p.key]; const pl = (l - p.avg) * p.qty
          const { toStop, toTarget } = progress(p.avg, l, long, br?.sl, br?.tgt)
          const nearTgt = toTarget != null && toTarget >= 0.75
          const near = toStop != null && toStop >= 0.7
          const hedged = !!parseKey(p.key).strike && !!p.tag
          // Marker between stop (0) and target (1); works for shorts too because the signs cancel.
          const at = br?.sl != null && br?.tgt != null ? Math.min(1, Math.max(0, (l - br.sl) / (br.tgt - br.sl))) : undefined
          return (
            <button key={p.key} type="button" onClick={() => say(`manage ${parseKey(p.key).und.toLowerCase()}`)} title={`${labelOf(p.key)}: ${long ? 'long' : 'short'} ${Math.abs(p.qty)} at ₹${p.avg.toFixed(2)}, now ₹${l.toFixed(2)}${br?.sl != null ? `, stop ₹${br.sl}` : ''}${br?.tgt != null ? `, target ₹${br.tgt}` : ''}`}
              className={cn('flex h-10 shrink-0 items-center gap-2.5 rounded-lg border px-2.5 text-left transition-colors hover:bg-hover', near ? 'border-[var(--attention)] bg-attention-soft' : 'border-line')}>
              <span className="min-w-0">
                <span className="block max-w-[140px] truncate text-[12px] font-medium leading-4 text-fg">{labelOf(p.key)}</span>
                <span className={cn('block text-[11px] leading-4', near ? 'text-[var(--attention-fg)]' : 'text-fg-subtle')}>
                  {nearTgt ? <span className="text-up">{(Math.abs(br!.tgt! - l) / l * 100).toFixed(1)}% to target</span> : br?.sl != null ? `${(Math.abs(l - br.sl) / l * 100).toFixed(1)}% to stop` : hedged ? 'hedged' : <span className="text-[var(--attention-fg)]">No stop</span>}</span>
              </span>
              {at != null && <span className="relative h-1 w-10 rounded-full" aria-hidden style={{ background: 'linear-gradient(to right, var(--danger), var(--border) 50%, var(--success))' }}>
                <span className="absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--surface)] bg-fg" style={{ left: `${at * 100}%` }} /></span>}
              <Money v={pl} className="text-[12px] font-semibold" />
            </button>)
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ composer with @symbol and /command */

const COMMANDS: { cmd: string; text: string; desc: string }[] = [
  { cmd: 'buy', text: 'buy ', desc: 'Draft a buy: “buy 50 sbi with sl 850 target 900”' },
  { cmd: 'sell', text: 'sell ', desc: 'Draft a sell or short' },
  { cmd: 'options', text: 'nifty option chain', desc: 'Option chain; tap a price to trade' },
  { cmd: 'strategy', text: 'mildly bullish on nifty, max loss 5000', desc: 'Strategies that fit a view and a max loss' },
  { cmd: 'scan', text: 'stocks ', desc: 'Screen in words: “above 200 ema with rsi over 60 in pharma”' },
  { cmd: 'alert', text: 'alert me if ', desc: 'Price alert, or an order that fires at a price: “buy 10 tcs if it crosses 4200”' },
  { cmd: 'positions', text: 'show my positions', desc: 'Live positions with exit controls' },
  { cmd: 'brief', text: 'brief me', desc: 'Market and your book in one look' },
  { cmd: 'review', text: 'review my trades', desc: 'What your last 30 days say' },
  { cmd: 'limits', text: 'set max loss 5000', desc: 'Daily loss limit, trades per day' },
  { cmd: 'exit', text: 'close all positions', desc: 'Close everything (asks first)' },
]

/** focus: the @ list opened from the Focus chip, where picking switches the focus symbol instead of typing it. */
type Menu = { kind: '@' | '/'; q: string; start: number; sel: number; focus?: boolean } | null

function ChatComposer({ chips, full = false }: { chips?: ReactNode; full?: boolean }) {
  const tool = 'inline-flex size-7 max-md:size-10 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-hover hover:text-fg active:translate-y-px'
  const [text, setText] = useState(''); const [menu, setMenu] = useState<Menu>(null); const [listening, setListening] = useState(false)
  const ta = useRef<HTMLTextAreaElement>(null)
  const busy = useStore((s) => s.busy); const sym = useStore((s) => s.sym); const prices = useStore((s) => s.prices)
  const gate = useEntryGate()
  useEffect(() => { const el = ta.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 180) + 'px' } }, [text])
  const items = useMemo(() => {
    if (!menu) return []
    const q = menu.q.toLowerCase()
    if (menu.kind === '/') return COMMANDS.filter((c) => c.cmd.startsWith(q)).map((c) => ({ id: c.cmd, label: `/${c.cmd}`, hint: c.desc, apply: c.text, sym: '' }))
    return INSTS.filter((i) => !q || i.sym.toLowerCase().startsWith(q) || i.name.toLowerCase().includes(q)).slice(0, menu.focus ? 12 : 7).map((i) => ({ id: i.sym, label: i.sym, hint: i.name, apply: i.sym + ' ', sym: i.sym }))
  }, [menu])
  const detect = (v: string, caret: number) => {
    const before = v.slice(0, caret)
    const at = /(^|\s)@(\w*)$/.exec(before); if (at) return setMenu({ kind: '@', q: at[2], start: caret - at[2].length - 1, sel: 0 })
    const sl = /^\/(\w*)$/.exec(before); if (sl) return setMenu({ kind: '/', q: sl[1], start: 0, sel: 0 })
    setMenu(null)
  }
  const pick = (i: number) => {
    const it = items[i]; if (!it || !menu) return
    if (menu.focus) { useStore.getState().setSym(it.sym); setMenu(null); ta.current?.focus(); return }
    const caret = ta.current?.selectionStart ?? text.length
    const next = menu.kind === '/' ? it.apply : text.slice(0, menu.start) + it.apply + text.slice(caret)
    setText(next); setMenu(null)
    requestAnimationFrame(() => { const el = ta.current; if (el) { el.focus(); const p = menu.kind === '/' ? next.length : menu.start + it.apply.length; el.setSelectionRange(p, p) } })
  }
  const send = (raw = text) => {
    let t = raw.trim(); if (!t || busy) return
    // Resolve "ATM" to a concrete strike before parsing.
    t = t.replace(/\batm\b/i, () => { const s = /bank/i.test(t) ? 'BANKNIFTY' : /sensex/i.test(t) ? 'SENSEX' : /nifty/i.test(t) ? 'NIFTY' : sym; const i = bySym(s); return i && i.fno ? String(Math.round(prices[s].ltp / i.step) * i.step) : 'atm' })
    setText(''); setMenu(null); void ask(t)
  }
  const voice = () => {
    type SR = { lang: string; start: () => void; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void }
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR }
    const C = W.SpeechRecognition ?? W.webkitSpeechRecognition
    if (!C) return useStore.getState().setToast('Voice input is not supported in this browser')
    const r = new C(); r.lang = 'en-IN'; r.onresult = (e) => send(e.results[0][0].transcript); r.onend = () => setListening(false); setListening(true); r.start()
  }
  const q = prices[sym]
  return (
    <>
      <div className="@container relative mx-auto w-full max-w-[800px] px-4 pb-3">
        {/* Cards scroll away under a short fade instead of being cut off at a hard edge. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-full h-6 bg-gradient-to-t from-bg to-transparent" />
        {/* The agent view's desk rail already shows positions and the lock, so these strips are for the docked panel only. */}
        <GettingStarted compact={!full} />
        {!full && <PositionStrip />}
        {/* Locked mode: the state of the day sits where you're about to type, with the way forward next to it. */}
        {gate && !full && <div role="status" className="mb-2 flex min-h-10 items-center gap-2.5 rounded-[10px] border border-line bg-sunken py-[5px] pl-3 pr-1.5 text-[12px] leading-5 text-fg-muted">
          <span className="shrink-0 text-fg"><GateIcon g={gate} size={14} /></span>
          <p className="min-w-0 flex-1"><b className="font-medium text-fg">{gate.kind === 'locked' ? 'Locked for today.' : gate.kind === 'cooloff' ? `Paused for ${gate.short.split('· ')[1]}.` : gate.kind === 'rule' ? `${gate.short}.` : 'Trade limit reached.'}</b> <span className="@max-md:hidden">{gate.why} </span>Exits and stops still work.</p>
          <button type="button" onClick={() => say('review today')} className="inline-flex h-7 shrink-0 items-center rounded-md border border-line-strong bg-surface px-3 text-[12px] font-medium text-fg shadow-xs transition-colors hover:bg-hover">Review today</button>
        </div>}
        {chips}
        <div className="relative">
          {menu && items.length > 0 && <ul role="listbox" aria-label={menu.focus ? 'Change focus' : menu.kind === '@' ? 'Symbols' : 'Commands'} className="absolute bottom-full left-0 z-30 mb-2 max-h-80 w-full max-w-md overflow-auto rounded-lg border border-line bg-raised p-1 shadow-lg animate-rise">
            {menu.focus && <li role="presentation" className="px-3 pb-1 pt-1.5 text-[11px] text-fg-subtle">Switch focus. “it” and “buy 10” will mean this symbol</li>}
            {items.map((it, i) => { const p = it.sym ? prices[it.sym] : undefined; return (
              <li key={it.id} role="option" aria-selected={i === menu.sel}>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); pick(i) }} onMouseEnter={() => setMenu({ ...menu, sel: i })} className={cn('flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13px]', i === menu.sel && 'bg-sunken')}>
                  <span className="num w-24 shrink-0 font-medium text-fg">{it.label}</span><span className="min-w-0 flex-1 truncate text-fg-muted">{it.hint}</span>
                  {p && <><span className="num text-fg">{p.ltp.toFixed(2)}</span><Chg v={pct(p.ltp, p.prev)} className="w-16 text-right text-[11px]" /></>}
                  {menu.focus && <Check size={14} strokeWidth={2} aria-label={it.sym === sym ? 'Current focus' : undefined} className={cn('shrink-0 text-fg', it.sym !== sym && 'invisible')} />}
                </button></li>) })}
          </ul>}
          {/* One unit, the way AI composers work: what you type on top, and everything that acts on it in the box's
              own bottom row. Context on the left (the focus symbol, commands), input and send on the right. */}
          <div className="rounded-lg border border-line bg-surface p-1.5 transition-colors focus-within:border-line-strong">
            <textarea id="chat-input" ref={ta} rows={1} value={text} aria-label="Message the assistant" placeholder={gate ? (matchMedia('(max-width: 640px)').matches ? 'Ask, review or exit' : 'Ask, review the day, or close a position') : matchMedia('(max-width: 640px)').matches ? 'Trade, scan or ask' : 'Trade, scan or ask. @ for a symbol, / for commands'}
                onChange={(e) => { setText(e.target.value); if (!menu?.focus) detect(e.target.value, e.target.selectionStart) }}
                onKeyDown={(e) => {
                  if (menu && items.length) {
                    if (e.key === 'ArrowDown') { e.preventDefault(); return setMenu({ ...menu, sel: (menu.sel + 1) % items.length }) }
                    if (e.key === 'ArrowUp') { e.preventDefault(); return setMenu({ ...menu, sel: (menu.sel - 1 + items.length) % items.length }) }
                    if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); return pick(menu.sel) }
                    if (e.key === 'Escape') { e.preventDefault(); return setMenu(null) }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
                }}
                onBlur={() => { if (menu?.focus) setMenu(null) }}
                className="block max-h-[180px] min-h-8 w-full resize-none bg-transparent px-2 py-1 text-[14px] leading-6 outline-none placeholder:text-fg-subtle" />
            <div className="mt-1 flex items-center gap-1">
              <button type="button" aria-label={`Focus: ${sym}. Change`} aria-haspopup="listbox" aria-expanded={!!menu?.focus} onMouseDown={(e) => e.preventDefault()} title="The symbol “it” refers to. Click to switch"
                onClick={() => { setMenu(menu?.focus ? null : { kind: '@', q: '', start: 0, sel: Math.max(0, INSTS.slice(0, 12).findIndex((i) => i.sym === sym)), focus: true }); ta.current?.focus() }}
                className={cn('inline-flex h-7 min-w-0 items-center gap-1.5 rounded-md bg-sunken pl-2 pr-1.5 text-[12px] transition-colors hover:bg-hover active:translate-y-px', menu?.focus && 'bg-hover')}>
                <Crosshair size={13} strokeWidth={1.75} className="shrink-0 text-fg-muted" />
                <span className="truncate font-medium text-fg">{sym}</span><span className="num text-fg-muted max-[420px]:hidden">{q.ltp.toFixed(2)}</span>
                <ChevronDown size={13} strokeWidth={1.75} className={cn('shrink-0 text-fg-muted transition-transform', menu?.focus && 'rotate-180')} /></button>
              <button type="button" aria-label="Commands" title="Commands ( / )" onClick={() => { setText('/'); setMenu({ kind: '/', q: '', start: 0, sel: 0 }); ta.current?.focus() }} className={tool}>
                <SquareSlash size={16} strokeWidth={1.5} /></button>
              <span className="flex-1" />
              <button type="button" aria-label={listening ? 'Listening' : 'Speak'} aria-pressed={listening} title={listening ? 'Listening…' : 'Speak'} onClick={voice}
                className={cn(tool, listening && 'bg-accent text-on-accent hover:bg-accent hover:text-on-accent animate-pulse')}><Mic size={16} strokeWidth={1.5} /></button>
              <button type="button" aria-label={busy ? 'Working' : 'Send'} disabled={!text.trim() && !busy} onClick={() => send()} className="inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-fg max-md:size-10 max-md:rounded-full text-bg transition-opacity disabled:opacity-30">
                {busy ? <Square size={12} fill="currentColor" strokeWidth={0} /> : <ArrowUp size={16} strokeWidth={2} />}</button>
            </div>
          </div>
        </div>
        {full && <p className="mt-2 text-center text-[11px] text-fg-subtle">Practice trading with simulated prices · not investment advice</p>}
      </div>
      {/* In Terminal the panel ends in a 49px bar with its top rule, level with the folded positions bar beside it. */}
      {!full && <div className="flex h-[49px] shrink-0 items-center justify-center border-t border-line bg-surface px-4 text-[11px] text-fg-subtle">Practice trading with simulated prices · not investment advice</div>}
    </>
  )
}
