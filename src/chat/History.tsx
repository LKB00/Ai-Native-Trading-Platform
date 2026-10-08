// Conversation history, as in any AI app: start a new chat for another stock or topic, and come back to the old ones.
// A popover on a computer, a sheet on a phone. Search, rename and delete live here; the open chat is highlighted.
import { useEffect, useMemo, useRef, useState } from 'react'
import { History, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useStore, type ChatMeta } from '../store'
import { Button, IconButton, Popover, cn } from '../ds'
import { Sheet } from '../mobile'
import { resetScroll } from './scroll'

const DAY = 86_400_000
function group(updated: number, now: number): string {
  const sod = new Date(now).setHours(0, 0, 0, 0)
  if (updated >= sod) return 'Today'
  if (updated >= sod - DAY) return 'Yesterday'
  if (updated >= sod - 7 * DAY) return 'Previous 7 days'
  return 'Older'
}
const ORDER = ['Today', 'Yesterday', 'Previous 7 days', 'Older']
const when = (t: number) => { const d = new Date(t); return t >= new Date().setHours(0, 0, 0, 0) ? d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true }) : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) }

export function startNewChat() { resetScroll(); useStore.getState().newChat() }

function Row({ c, active, onOpen }: { c: ChatMeta; active: boolean; onOpen: () => void }) {
  const rename = useStore((s) => s.renameChat); const del = useStore((s) => s.deleteChat)
  const [mode, setMode] = useState<'view' | 'edit' | 'del'>('view'); const [t, setT] = useState(c.title); const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { if (mode === 'edit') { ref.current?.focus(); ref.current?.select() } }, [mode])
  const asked = c.msgs.filter((m) => m.role === 'user').length
  if (mode === 'edit') return (
    <form className="px-1.5 py-1" onSubmit={(e) => { e.preventDefault(); rename(c.id, t); setMode('view') }}>
      <input ref={ref} value={t} onChange={(e) => setT(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setMode('view') } }} onBlur={() => { rename(c.id, t); setMode('view') }}
        aria-label="Chat name" className="h-9 w-full rounded-md border border-line bg-surface px-2.5 text-[13px] text-fg outline-none focus:border-fg-subtle max-md:h-11" />
    </form>)
  if (mode === 'del') return (
    <div className="flex items-center gap-2 rounded-lg bg-danger-soft px-2.5 py-2 text-[12px] text-danger-fg">
      <span className="min-w-0 flex-1 truncate">Delete “{c.title}”?</span>
      <Button size="sm" variant="danger" onClick={() => del(c.id)}>Delete</Button>
      <Button size="sm" variant="ghost" onClick={() => setMode('view')}>Keep</Button>
    </div>)
  return (
    <div className={cn('group/row flex items-center gap-1 rounded-lg pr-1 hover:bg-hover', active && 'bg-sunken')}>
      <button type="button" onClick={onOpen} aria-current={active || undefined} className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left max-md:py-3">
        <span className={cn('block truncate text-[13px] text-fg', active && 'font-medium')}>{c.title}</span>
        <span className="block text-[11px] text-fg-subtle">{when(c.updated)}{asked ? ` · ${asked} question${asked > 1 ? 's' : ''}` : ''}</span>
      </button>
      <span className="flex shrink-0 gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100 max-md:opacity-100">
        <IconButton size="sm" label={`Rename ${c.title}`} onClick={() => { setT(c.title); setMode('edit') }}><Pencil size={13} strokeWidth={1.75} /></IconButton>
        <IconButton size="sm" label={`Delete ${c.title}`} onClick={() => setMode('del')}><Trash2 size={13} strokeWidth={1.75} /></IconButton>
      </span>
    </div>)
}

function Panel({ close }: { close: () => void }) {
  const chats = useStore((s) => s.chats); const activeChat = useStore((s) => s.activeChat); const open = useStore((s) => s.openChat)
  const hasThread = useStore((s) => s.msgs.some((m) => m.id > 0))
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const now = Date.now(); const t = q.trim().toLowerCase()
    const list = chats.filter((c) => c.msgs.length && (!t || c.title.toLowerCase().includes(t) || c.msgs.some((m) => m.role === 'user' && m.text.toLowerCase().includes(t))))
    return ORDER.map((g) => ({ g, items: list.filter((c) => group(c.updated, now) === g) })).filter((x) => x.items.length)
  }, [chats, q])
  return (
    <div className="flex max-h-[70vh] w-full flex-col md:w-[340px]">
      <div className="flex items-center gap-2 border-b border-line p-2.5">
        <label className="relative min-w-0 flex-1"><Search size={14} strokeWidth={1.75} aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chats" aria-label="Search chats" className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-[13px] text-fg outline-none focus:border-fg-subtle max-md:h-11" /></label>
        <Button size="sm" variant="secondary" leading={<Plus size={14} strokeWidth={2} />} disabled={!hasThread} onClick={() => { startNewChat(); close() }}>New chat</Button>
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {groups.length ? groups.map(({ g, items }) => <section key={g} className="mb-1.5">
          <h3 className="px-2.5 pb-1 pt-2 text-[11px] font-medium text-fg-subtle">{g}</h3>
          {items.map((c) => <Row key={c.id} c={c} active={c.id === activeChat} onOpen={() => { if (c.id !== activeChat) { resetScroll(); open(c.id) } close() }} />)}
        </section>) : <p className="px-3 py-8 text-center text-[13px] text-fg-subtle">{q ? `No chats match “${q}”.` : 'Your chats will appear here.'}</p>}
      </div>
    </div>
  )
}

function usePhone() {
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia('(max-width: 839px)').matches)
  useEffect(() => { const q = matchMedia('(max-width: 839px)'); const h = () => setM(q.matches); q.addEventListener('change', h); return () => q.removeEventListener('change', h) }, [])
  return m
}

/** The History button. Opens the list of conversations. */
export function ChatHistory({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const phone = usePhone(); const [sheet, setSheet] = useState(false)
  const icon = <History size={size === 'sm' ? 15 : 16} strokeWidth={1.5} />
  if (phone) return <>
    <IconButton size={size} label="Chat history" onClick={() => setSheet(true)}>{icon}</IconButton>
    <Sheet open={sheet} onClose={() => setSheet(false)} label="Chat history"><div className="px-1 pb-2"><p className="px-4 pb-2 text-[16px] font-semibold text-fg">Chat history</p><Panel close={() => setSheet(false)} /></div></Sheet>
  </>
  return (
    <Popover label="Chat history" align="end" trigger={({ toggle, triggerProps }) => <IconButton size={size} label="Chat history" onClick={toggle} {...triggerProps}>{icon}</IconButton>}>
      {({ close }) => <Panel close={close} />}
    </Popover>
  )
}
