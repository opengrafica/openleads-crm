import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  Search,
  Users,
  Shield,
  Moon,
  Sun,
  LogOut,
  Menu,
  X,
  Sparkles,
  MessageCircle,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { GlobalSearch } from '@/components/GlobalSearch'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import { PLAN_LABELS } from '@/types'

const nav = [
  { to: '/app', label: 'Início', icon: LayoutDashboard },
  { to: '/app/busca', label: 'Busca', icon: Search },
  { to: '/app/crm', label: 'Leads', icon: Users },
  { to: '/app/whatsapp', label: 'WhatsApp', icon: MessageCircle },
]

export function AppLayout() {
  const { user, subscription, signOut, isAdmin } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)

  const links = [
    ...nav,
    ...(isAdmin ? [{ to: '/app/admin', label: 'Super Admin', icon: Shield }] : []),
  ]

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col text-[var(--sidebar-text)] transition-transform lg:static lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--sidebar)' }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent)] text-[#06241c]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="font-display text-base font-bold leading-none">OpenLeads</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/55">CRM</p>
            </div>
          </div>
          <button type="button" className="lg:hidden" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 p-2.5">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                  isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <Icon className="h-4 w-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <p className="truncate text-sm font-semibold">{user?.full_name}</p>
          <p className="truncate text-xs text-white/60">{user?.email}</p>
          <p className="mt-1 text-xs text-white/50">
            {subscription ? PLAN_LABELS[subscription.plan] : '—'}
          </p>
        </div>
      </aside>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu"
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-3 py-2.5 backdrop-blur-md sm:px-4">
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] p-2 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <GlobalSearch className="hidden min-w-0 flex-1 sm:block" />
          <div className="ml-auto flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Alternar tema">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4 lg:p-6">
          <div className="mb-3 sm:hidden">
            <GlobalSearch />
          </div>
          <Outlet />
        </main>
      </div>

      {/* Navegação inferior — Android / mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--bg-elevated)] px-1 pb-[env(safe-area-inset-bottom)] pt-1 lg:hidden">
        <div className="grid grid-cols-4 gap-0.5">
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/app'}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-[10px] font-semibold',
                  isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]',
                )
              }
            >
              <Icon className="h-5 w-5" />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
