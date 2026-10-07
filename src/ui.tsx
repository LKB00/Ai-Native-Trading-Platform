import type { ReactNode } from 'react'
import { Switch, cn } from './ds'
import { ChevronIcon } from './ds/lib/icons'
import { ArrowDown, ArrowUp, ArrowUpDown, Triangle } from 'lucide-react'
import { useStore } from './store'

export const inr = (n: number) => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN')
/** ₹ in lakh / crore for large values: 1.2 L, 3.4 Cr. */
export const inrShort = (n: number) => { const a = Math.abs(n); const s = n < 0 ? '−' : ''; return a >= 1e7 ? `${s}₹${(a / 1e7).toFixed(2)} Cr` : a >= 1e5 ? `${s}₹${(a / 1e5).toFixed(2)} L` : inr(n) }
export const pct = (a: number, b: number) => ((a - b) / b) * 100

/** Up or down marker (a filled Lucide triangle), so direction never depends on color alone. */
export const Dir = ({ up }: { up: boolean }) =>
  <Triangle aria-hidden className={cn('inline size-[0.6em] -translate-y-px fill-current align-baseline', !up && 'rotate-180')} strokeWidth={0} />
/** Sort direction marker for table headers. */
export const SortMark = ({ desc, active = true }: { desc: boolean; active?: boolean }) => {
  const I = !active ? ArrowUpDown : desc ? ArrowDown : ArrowUp
  return <I aria-hidden className="size-3" strokeWidth={1.5} />
}

/** Signed change with an arrow, so direction never depends on color alone. */
export function Chg({ v, suffix = '%', className, digits = 2 }: { v: number; suffix?: string; className?: string; digits?: number }) {
  return <span className={cn('num whitespace-nowrap', v >= 0 ? 'text-up' : 'text-down', className)}><Dir up={v >= 0} /> {v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(digits)}{suffix}</span>
}
/** Signed rupee amount, colored and prefixed with + or −. */
export function Money({ v, className }: { v: number; className?: string }) {
  return <span className={cn('num', v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-fg', className)}>{v > 0 ? '+' : ''}{inr(v)}</span>
}
/**
 * Page header for full-width views: one 48px line, the same height as the instrument header, so switching between
 * the chart and a page doesn't make the layout jump. Title, a quiet subtitle, actions on the right.
 */
export function ViewHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2">
      <h2 className="text-[16px] font-semibold tracking-tight text-fg">{title}</h2>{sub && <p className="truncate text-[12px] text-fg-subtle">{sub}</p>}
      <div className="ml-auto flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

/**
 * A card section people can fold away. Open state is remembered per section id.
 * When folded, `summary` stays visible on the header line so the key number is never lost.
 */
export function Section({ id, title, sub, summary, actions, children, defaultOpen = true, className, bodyClassName }: {
  id: string; title: ReactNode; sub?: ReactNode; summary?: ReactNode; actions?: ReactNode; children: ReactNode
  defaultOpen?: boolean; className?: string; bodyClassName?: string
}) {
  const open = useStore((s) => s.sections[id] ?? defaultOpen); const toggle = useStore((s) => s.toggleSection)
  const bodyId = `sec-${id}`
  return (
    <section className={cn('rounded-[10px] border border-line bg-surface', className)} aria-labelledby={`${bodyId}-h`}>
      <div className="flex min-h-10 items-center gap-2 px-3.5 py-1.5">
        <button type="button" aria-expanded={open} aria-controls={bodyId} onClick={() => toggle(id, !open)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <ChevronIcon width={14} height={14} className={cn('shrink-0 text-fg-subtle transition-transform duration-[var(--dur-fast)]', open && 'rotate-90')} />
          <span className="flex min-w-0 items-baseline gap-2"><span id={`${bodyId}-h`} className="text-[13px] font-semibold leading-5 text-fg">{title}</span>{sub && open && <span className="truncate text-[12px] text-fg-subtle">{sub}</span>}</span>
          {!open && summary && <span className="ml-auto truncate pl-3 text-[12px] text-fg-muted">{summary}</span>}
        </button>
        {open && actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div id={bodyId} hidden={!open} className={cn('px-3.5 pb-3.5', bodyClassName)}>{children}</div>
    </section>
  )
}

/** Sandstone's Switch names itself for screen readers only; this shows the same text beside it. Clicking the text toggles too. */
export function LabeledSwitch({ label, checked, onChange, className }: { label: string; checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <span className="cursor-pointer select-none text-[12px] text-fg" onClick={() => onChange(!checked)}>{label}</span>
      <Switch label={label} checked={checked} onChange={onChange} className="shrink-0" />
    </div>
  )
}

/**
 * The agent's note on a page: a label and one or two lines behind a thin indigo rule, the same treatment as the agent's
 * read on cards, so commentary looks the same everywhere and never outshouts the numbers.
 */
export function AgentNote({ label, children, className }: { label?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('border-l-2 border-[var(--lime)] py-0.5 pl-3 text-[13px] leading-5 text-fg-muted', className)}>
      {label && <p className="mb-0.5 text-[11px] font-medium text-fg-subtle">{label}</p>}<div className="[&_b]:font-medium [&_b]:text-fg">{children}</div>
    </div>
  )
}
