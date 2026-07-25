import { Navigate, Outlet, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/Button'

export function ProtectedRoute() {
  const { user, loading, isApproved } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-muted)]">
        Carregando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (!isApproved) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 text-center">
          <h1 className="font-display text-2xl font-bold">Aguardando aprovação</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Sua conta <strong>{user.email}</strong> foi criada e está pendente. O Super Admin precisa
            aprovar antes do acesso.
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">
            Status: {user.account_status || 'pending'}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link to="/">
              <Button variant="secondary" size="sm">
                Início
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <Outlet />
}

export function AdminRoute() {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-muted)]">
        Carregando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/app" replace />
  return <Outlet />
}
