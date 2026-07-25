import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5 shadow-[var(--shadow)]',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: ReactNode
}) {
  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-[var(--accent-soft)]" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            {label}
          </p>
          <p className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-sm text-[var(--text-muted)]">{hint}</p> : null}
        </div>
        {icon ? (
          <div className="rounded-xl bg-[var(--accent-soft)] p-2.5 text-[var(--accent)]">
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'
}) {
  const tones = {
    neutral: 'bg-[var(--bg-muted)] text-[var(--text-muted)]',
    success: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    warning: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    danger: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
    accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold',
        tones[tone],
      )}
    >
      {children}
    </span>
  )
}
