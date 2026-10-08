// How a new user learns the product. Three pieces share this state: the welcome (how it works, then the desk setup),
// the Getting started checklist that follows them above the composer, and the Terminal tour. Progress is read from
// what the user actually does (a question asked, a draft made, an order approved), never from a "mark as done" click.
import { create } from 'zustand'
import { useStore } from './store'

export type StepId = 'ask' | 'draft' | 'approve' | 'terminal' | 'alert'
export const STEPS: StepId[] = ['ask', 'draft', 'approve', 'terminal', 'alert']

type Learn = {
  /** Set when the welcome ends (set up or skipped): the checklist starts counting from here. */
  started: boolean
  /** Message id, orders and alerts at that moment, so only what happens afterwards counts. */
  base: { msg: number; orders: number; triggers: number }
  done: Partial<Record<StepId, boolean>>
  /** The checklist card above the composer: collapsed or open, or put away. */
  open: boolean; hidden: boolean
  /** The charts tour: waits for the first visit, runs, then stays off until asked for again. */
  tour: 'off' | 'pending' | 'running'
  start: () => void
  set: (p: Partial<Learn>) => void
}

const KEY = 'learn'
const load = (): Partial<Learn> | null => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } }
const save = (l: Learn) => { try { localStorage.setItem(KEY, JSON.stringify({ started: l.started, base: l.base, done: l.done, open: l.open, hidden: l.hidden, tour: l.tour === 'running' ? 'off' : l.tour })) } catch { /* private mode */ } }

// Someone who set up their desk before this existed has already learned their way around: no checklist, no tour.
const existing = (() => { try { return !!localStorage.getItem('profile') && localStorage.getItem('profile') !== 'null' } catch { return false } })()
const saved = load()

export const useLearn = create<Learn>((set) => ({
  started: saved?.started ?? false,
  base: saved?.base ?? { msg: 0, orders: 0, triggers: 0 },
  done: saved?.done ?? {},
  open: saved?.open ?? true,
  hidden: saved?.hidden ?? (!saved && existing),
  tour: saved?.tour ?? 'off',
  start: () => {
    const s = useStore.getState()
    set({ started: true, hidden: false, open: true, done: {}, tour: 'pending', base: { msg: Math.max(0, ...s.msgs.map((m) => m.id)), orders: s.orders.length, triggers: s.triggers.length } })
  },
  set: (p) => set(p),
}))
useLearn.subscribe(save)

/** Watch the store and tick steps off as the user does them. */
function track() {
  const l = useLearn.getState(); if (!l.started) return
  const s = useStore.getState(); const done = { ...l.done }; let changed = false
  const tick = (id: StepId, ok: boolean) => { if (ok && !done[id]) { done[id] = true; changed = true } }
  const fresh = s.msgs.filter((m) => m.id > l.base.msg)
  tick('ask', fresh.some((m) => m.role === 'user'))
  tick('draft', fresh.some((m) => m.pending?.length))
  tick('approve', fresh.some((m) => m.state === 'confirmed') || s.orders.length > l.base.orders)
  tick('terminal', !s.panels.chatFull)
  tick('alert', s.triggers.length > l.base.triggers)
  if (changed) useLearn.setState({ done })
}
useStore.subscribe(track)
useLearn.subscribe((l, p) => { if (l.started && !p.started) track() })

export const progress = (done: Learn['done']) => STEPS.filter((id) => done[id]).length
