import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-muted)]">
        Carregando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Outlet />
}

export function AdminRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center text-[var(--text-muted)]">
        Carregando...
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/" replace />
  return <Outlet />
}
