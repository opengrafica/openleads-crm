import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

const fieldClass =
  'w-full rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)] placeholder:text-[var(--text-muted)]'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldClass, className)} {...props} />
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldClass, className)} {...props}>
      {children}
    </select>
  )
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldClass, 'min-h-24 resize-y', className)} {...props} />
}

export function Label({
  children,
  htmlFor,
  className,
}: {
  children: ReactNode
  htmlFor?: string
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]',
        className,
      )}
    >
      {children}
    </label>
  )
}
