// First-run teaching, in three parts that hand over to each other:
//   Welcome         the first screen: how the product works in one look, then the desk setup.
//   GettingStarted  a checklist above the composer that ticks itself as the user does each thing.
//   Tour            a spotlight walk through the Terminal the first time it opens.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Activity, ArrowRight, CandlestickChart, Check, ChevronDown, ChevronUp, Hand, MessageSquare, ShieldCheck, Wallet, X } from 'lucide-react'
import { useStore } from './store'
import { AIMark, Button, cn } from './ds'
import { BRAND } from './brand'
import { SetupCard, say } from './chat/cards'
import { skipSetup } from './setup'
import { STEPS, progress, useLearn, type StepId } from './learn'

/* ------------------------------------------------------------------ welcome */

/** The product in three pictures. Every column has the same parts: a label, a picture on a tinted panel, a caption. */
function Beat({ label, caption, last, children }: { label: string; caption: string; last?: boolean; children: ReactNode }) {
  return (
    <section className="relative min-w-0 cursor-default select-none">
      <h3 className="text-[13px] font-semibold text-fg">{label}</h3>
      <div aria-hidden className="mt-2 flex h-[124px] items-center @2xl:h-[152px] justify-center rounded-[14px] bg-sunken p-3.5">{children}</div>
      <p className="mt-2 text-[12px] leading-4 text-fg-muted">{caption}</p>
      {!last && <ArrowRight aria-hidden size={16} strokeWidth={1.75} className="absolute -right-[22px] top-[96px] hidden text-fg-subtle @2xl:block" />}
    </section>
  )
}
/** The picture inside a panel: one white card, the same size in every column. */
const Pic = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('flex h-full w-full flex-col justify-center rounded-[10px] bg-surface p-3 shadow-sm', className)}>{children}</div>

function Story() {
  return (
    <div className="grid gap-5 @2xl:grid-cols-3 @2xl:gap-11">
      <Beat label="Ask" caption="In plain words">
        <Pic className="gap-2.5">
          <div className="ml-auto w-fit max-w-full rounded-xl rounded-br-sm bg-sunken px-3 py-1.5 text-[12px] text-fg">buy 50 sbin, stop 850</div>
          <div className="flex items-center gap-1.5"><span className="flex size-6 items-center justify-center rounded-full bg-lime text-on-lime"><AIMark size={16} /></span><span className="flex gap-1 rounded-xl rounded-bl-sm bg-sunken px-3 py-2"><i className="size-1 rounded-full bg-fg-subtle" /><i className="size-1 rounded-full bg-fg-subtle opacity-60" /><i className="size-1 rounded-full bg-fg-subtle opacity-30" /></span></div>
        </Pic>
      </Beat>
      <Beat label="Review" caption="Nothing is sent until you approve">
        <Pic className="gap-2">
          <p className="text-[13px] font-semibold text-fg">Buy 50 SBIN</p>
          <p className="flex flex-wrap gap-1.5 text-[11px]"><span className="rounded bg-danger-soft px-1.5 py-0.5 font-medium text-danger-fg">Stop 850</span><span className="rounded bg-success-soft px-1.5 py-0.5 font-medium text-success-fg">Target 900</span></p>
          <span className="w-fit rounded-md bg-sunken px-3 py-1 text-[11px] font-medium text-fg">Approve</span>
        </Pic>
      </Beat>
      <Beat label="Done" caption="I watch it for you" last>
        <Pic className="items-center gap-1">
          <span className="flex size-7 items-center justify-center rounded-full bg-success text-white"><Check size={15} strokeWidth={3} /></span>
          <p className="mt-0.5 text-[12px] text-fg-muted">SBIN hit your target</p>
          <p className="num text-[20px] font-semibold text-up">+₹2,480</p>
        </Pic>
      </Beat>
    </div>
  )
}

/** Under the story, three short columns on the same grid, each built the same way: a heading and two one-line facts. */
type Fact = { Icon: typeof MessageSquare; title: string; detail: string }
function FactCol({ heading, facts }: { heading: string; facts: [Fact, Fact] }) {
  return (
    <div className="min-w-0">
      <h4 className="text-[11px] font-medium uppercase tracking-[0.04em] text-fg-subtle">{heading}</h4>
      <ul className="mt-2.5 space-y-2">{facts.map(({ Icon, title, detail }) => (
        <li key={title} className="flex h-5 items-center gap-2.5 whitespace-nowrap text-[13px]"><Icon size={16} strokeWidth={1.75} className="shrink-0 text-fg-muted" aria-hidden /><span className="min-w-0 truncate text-fg"><b className="font-semibold">{title}</b><span className="text-fg-muted"> · {detail}</span></span></li>))}
      </ul>
    </div>
  )
}
function Facts() {
  return (
    <div className="grid gap-5 border-t border-line pt-5 @2xl:grid-cols-3 @2xl:gap-11">
      <FactCol heading="Two ways to use it" facts={[{ Icon: MessageSquare, title: 'Chat', detail: 'just ask' }, { Icon: CandlestickChart, title: 'Charts', detail: 'see and click' }]} />
      <FactCol heading="You stay in control" facts={[{ Icon: ShieldCheck, title: 'Loss limit', detail: 'you set it' }, { Icon: Hand, title: 'Approvals', detail: 'every order' }]} />
      <FactCol heading="Nothing is real" facts={[{ Icon: Wallet, title: 'Play money', detail: '₹10,00,000' }, { Icon: Activity, title: 'Prices', detail: 'simulated' }]} />
    </div>
  )
}

export function Welcome() {
  const [step, setStep] = useState<0 | 1>(0); const start = useLearn((l) => l.start)
  const top = useRef<HTMLDivElement>(null); const first = useRef(true)
  // Moving between the two steps brings the new one to the top; the first draw keeps the thread's own position.
  useEffect(() => { if (first.current) { first.current = false; return } top.current?.scrollIntoView({ block: 'start' }) }, [step])
  const finish = () => start()
  return (
    <div ref={top} className="pt-4 @2xl:pt-[5vh]">
      <span className="inline-flex size-9 items-center justify-center rounded-full bg-lime text-on-lime"><AIMark size={22} /></span>
      <h1 className="mt-4 text-[22px] font-semibold leading-tight tracking-[-0.02em] @2xl:text-[34px]">Welcome to {BRAND}.</h1>
      <p className="mt-2 text-[14px] leading-5 text-fg-muted @2xl:text-[16px]">Practice trading with <b className="font-medium text-fg">₹10,00,000 of play money</b>. Just ask.</p>


      {step === 0 ? <div className="mt-8 space-y-6">
        <Story />
        <Facts />
        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-2 bg-gradient-to-t from-bg from-70% to-transparent px-1 pb-1 pt-5">
          <Button size="md" variant="primary" trailing={<ArrowRight size={14} strokeWidth={2} />} onClick={() => setStep(1)}>Set my limits</Button>
          <Button size="md" variant="ghost" onClick={() => { skipSetup(); finish() }}>Skip intro</Button>
          <span className="ml-auto text-[12px] text-fg-subtle">Step 1 of 2 · about a minute</span>
        </div>
      </div> : <div className="mt-8">
        <SetupCard first onFinish={finish} />
        <button type="button" onClick={() => setStep(0)} className="mt-3 text-[12px] text-fg-muted hover:text-fg hover:underline">Back to how it works</button>
      </div>}
    </div>
  )
}

/* ------------------------------------------------------------------ getting started */

const prices = () => useStore.getState().prices
function sample() {
  const p = prices(); const sbin = p.SBIN?.ltp ?? 800; const nifty = p.NIFTY?.ltp ?? 24000
  return { stop: Math.floor(sbin * 0.98), level: Math.ceil((nifty + 100) / 50) * 50 }
}
const STEP_INFO: Record<StepId, { title: string; hint: string; go: string; run: () => void }> = {
  ask: { title: 'Ask the assistant something', hint: 'Start with a morning brief of your account and the market.', go: 'Brief me', run: () => say('brief me') },
  draft: { title: 'Have it draft a trade', hint: 'It sizes the order and adds a stop. Nothing is sent yet.', go: 'Draft one', run: () => say(`buy 10 sbin with sl ${sample().stop}`) },
  approve: { title: 'Approve a draft', hint: 'Practice money, so it is safe. Orders still go through your limits.', go: 'Find my draft', run: () => {
    const el = document.querySelector('[data-pending]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); else say(`buy 10 sbin with sl ${sample().stop}`) } },
  terminal: { title: 'Open the charts', hint: 'Chart, watchlist and order ticket, with the assistant beside them.', go: 'Open it', run: () => useStore.getState().setPanels({ chatFull: false, copilot: true }) },
  alert: { title: 'Set a price alert', hint: 'I will message you the moment it crosses, even while you are elsewhere.', go: 'Set one', run: () => say(`alert me if nifty crosses ${sample().level}`) },
}

export function GettingStarted({ compact = false }: { compact?: boolean }) {
  const { started, hidden, open: saved, done } = useLearn(); const set = useLearn((l) => l.set)
  // Beside the chart there is little room: it starts folded to one line, and opening it there is not remembered.
  const [local, setLocal] = useState(false); const open = compact ? local : saved; const toggle = () => (compact ? setLocal(!local) : set({ open: !open }))
  const n = progress(done); const all = n === STEPS.length; const next = STEPS.find((id) => !done[id])
  if (!started || hidden) return null
  return (
    <section aria-label="Getting started" className="mb-2 overflow-hidden rounded-[10px] border border-line bg-surface">
      <div className="flex items-center gap-1 pr-1">
        <button type="button" aria-expanded={open} onClick={toggle} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left">
          <span className="whitespace-nowrap text-[13px] font-semibold text-fg">{all ? 'You are all set' : 'Getting started'}</span>
          <span className="num whitespace-nowrap text-[11px] text-fg-subtle">{n} of {STEPS.length}</span>
          <span aria-hidden className="h-1 w-16 overflow-hidden rounded-full bg-sunken"><span className="block h-full rounded-full bg-success transition-[width] duration-300" style={{ width: `${n / STEPS.length * 100}%` }} /></span>
          {!open && next && <span className="min-w-0 flex-1 truncate text-[12px] text-fg-muted max-sm:hidden">Next: {STEP_INFO[next].title}</span>}
          <span className="ml-auto text-fg-subtle">{open ? <ChevronDown size={15} strokeWidth={1.75} /> : <ChevronUp size={15} strokeWidth={1.75} />}</span>
        </button>
        <button type="button" aria-label="Hide getting started" title="Hide. Bring it back from the command palette (⌘K)." onClick={() => set({ hidden: true })} className="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-hover hover:text-fg max-md:size-10"><X size={14} strokeWidth={1.75} /></button>
      </div>
      {open && <ul className="border-t border-line">
        {STEPS.map((id, i) => { const s = STEP_INFO[id]; const ok = !!done[id]; const cur = id === next
          return <li key={id} className={cn('flex items-center gap-3 px-3 py-2', cur && 'bg-sunken')}>
            <span aria-hidden className={cn('flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', ok ? 'bg-success text-white' : 'border border-[var(--border-strong)] text-fg-subtle')}>{ok ? <Check size={12} strokeWidth={3} /> : i + 1}</span>
            <div className="min-w-0 flex-1"><p className={cn('text-[13px]', ok ? 'text-fg-subtle line-through decoration-[var(--border-strong)]' : 'font-medium text-fg')}>{s.title}<span className="sr-only">{ok ? ', done' : ''}</span></p>
              {!ok && <p className="text-[12px] leading-4 text-fg-muted">{s.hint}</p>}</div>
            {!ok && <Button size="sm" variant={cur ? 'primary' : 'secondary'} className="shrink-0" onClick={s.run}>{s.go}</Button>}
          </li> })}
        {all && <li className="flex items-center gap-3 border-t border-line px-3 py-2 text-[12px] text-fg-muted"><span className="flex-1">That is the whole loop. Ask for anything, and press <kbd className="rounded border border-line px-1">?</kbd> to see every shortcut.</span><Button size="sm" variant="secondary" onClick={() => set({ hidden: true })}>Done</Button></li>}
      </ul>}
    </section>
  )
}

/* ------------------------------------------------------------------ terminal tour */

type TourStep = { find: string; title: string; text: string; pad?: number }
const TOUR: TourStep[] = [
  { find: 'aside[aria-label="Watchlist"]', title: 'Your watchlist', text: 'Click a stock to put it on the chart. Hover a row for Buy, Sell and depth, drag to reorder, and use the arrow keys with B or S to trade from the keyboard.' },
  { find: '[data-tour="chart"]', title: 'The chart', text: 'Draw with the tools on the left, change the interval from the top, and press B or S to open an order ticket right on the chart.' },
  { find: '[data-tour="trade"]', title: 'Sell and Buy at the live price', text: 'These open the ticket with a stop and a target already drawn on the chart. Drag the lines to adjust, then confirm. If a limit pauses new entries, they stay here, greyed, with the reason.', pad: 4 },
  { find: 'section[aria-label="Positions and orders"]', title: 'Positions, orders and alerts', text: 'Everything you hold or have waiting. Hover a row to add, set a stop or target, convert, or exit. Click it for the full timeline.' },
  { find: '#copilot', title: 'The assistant is still here', text: 'Same assistant as in Chat. Press / to type to it, or ask in plain words: “reliance chart”, “buy 1 lot nifty atm ce”, “how did I do this week”.' },
  { find: 'header', title: 'Everything else', text: 'Options, Find stocks, Markets, Portfolio and Journal are up here. Press ⌘K to search or run anything, and ? to see every shortcut.', pad: 0 },
]

export function Tour() {
  const tour = useLearn((l) => l.tour); const set = useLearn((l) => l.set); const chatFull = useStore((s) => s.panels.chatFull)
  const [i, setI] = useState(0); const [rect, setRect] = useState<DOMRect | null>(null); const phone = typeof matchMedia !== 'undefined' && matchMedia('(max-width: 839px)').matches
  const steps = useMemo(() => TOUR, [])
  // The first visit starts it once the Terminal has drawn; leaving for the Agent view pauses it for next time.
  useEffect(() => { if (tour === 'pending' && !chatFull && !phone) { const t = setTimeout(() => { setI(0); set({ tour: 'running' }) }, 700); return () => clearTimeout(t) } }, [tour, chatFull, set])
  const cur = steps[i]
  const measure = () => { const el = cur && document.querySelector(cur.find); const r = el?.getBoundingClientRect(); setRect(r && r.width > 0 && r.height > 0 ? r : null) }
  useLayoutEffect(() => { if (tour !== 'running') return; measure(); addEventListener('resize', measure); return () => removeEventListener('resize', measure) }, [tour, i]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tour === 'running' && cur && !rect) { // a panel is folded away: skip what can't be shown
    const t = setTimeout(() => { if (!document.querySelector(cur.find)) (i < steps.length - 1 ? setI(i + 1) : set({ tour: 'off' })) }, 50); return () => clearTimeout(t) } }, [tour, i, rect]) // eslint-disable-line react-hooks/exhaustive-deps
  const end = () => set({ tour: 'off' })
  const last = i === steps.length - 1
  useEffect(() => {
    if (tour !== 'running') return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); end() }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); last ? end() : setI(i + 1) }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); setI(i - 1) }
    }
    addEventListener('keydown', h, true); return () => removeEventListener('keydown', h, true)
  }, [tour, i, last]) // eslint-disable-line react-hooks/exhaustive-deps
  if (tour !== 'running' || !rect || phone) return null
  const pad = cur.pad ?? 6; const W = 340; const vw = innerWidth, vh = innerHeight
  const hole = { left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
  // Beside the spotlight when there is room, else below or above it; always kept on screen.
  let left: number, top: number
  if (hole.left + hole.width + W + 16 < vw) { left = hole.left + hole.width + 12; top = hole.top }
  else if (hole.left - W - 16 > 0) { left = hole.left - W - 12; top = hole.top }
  else { left = hole.left; top = hole.top + hole.height + 12 }
  if (top + 190 > vh) top = Math.max(12, hole.top + hole.height - 190 > 12 && hole.height > 190 ? hole.top : vh - 202)
  left = Math.min(Math.max(12, left), vw - W - 12); top = Math.min(Math.max(12, top), vh - 202)
  return createPortal(
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label={`Tour, step ${i + 1} of ${steps.length}: ${cur.title}`}>
      <div className="absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute rounded-[10px] ring-2 ring-white/80 transition-all duration-200" style={{ ...hole, boxShadow: '0 0 0 9999px rgba(8,8,12,.55)' }} />
      <div className="absolute rounded-[12px] border border-line bg-raised p-4 shadow-lg animate-rise" style={{ left, top, width: W }}>
        <p className="text-[11px] font-medium text-fg-subtle">Tour · {i + 1} of {steps.length}</p>
        <h2 className="mt-1 text-[15px] font-semibold text-fg">{cur.title}</h2>
        <p className="mt-1.5 text-[13px] leading-5 text-fg-muted">{cur.text}</p>
        <div className="mt-4 flex items-center gap-2">
          <span aria-hidden className="flex gap-1">{steps.map((_, k) => <span key={k} className={cn('size-1.5 rounded-full', k === i ? 'bg-fg' : 'bg-[var(--border-strong)]')} />)}</span>
          <span className="ml-auto flex items-center gap-1.5">
            <Button size="sm" variant="ghost" onClick={end}>{last ? 'Close' : 'Skip tour'}</Button>
            {i > 0 && <Button size="sm" variant="secondary" onClick={() => setI(i - 1)}>Back</Button>}
            <Button size="sm" variant="primary" autoFocus onClick={() => (last ? end() : setI(i + 1))}>{last ? 'Done' : 'Next'}</Button>
          </span>
        </div>
      </div>
    </div>, document.body)
}
