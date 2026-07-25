import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}

const variants = {
  primary:
    'bg-[var(--accent)] text-white dark:text-[#06241c] hover:opacity-90 shadow-[var(--shadow)]',
  secondary:
    'bg-[var(--bg-elevated)] text-[var(--text)] border border-[var(--border)] hover:bg-[var(--bg-muted)]',
  ghost: 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]',
  danger: 'bg-[var(--danger)] text-white hover:opacity-90',
}

const sizes = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
