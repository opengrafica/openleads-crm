import { useState, type FormEvent } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export function LoginPage() {
  const { user, loading, signIn, enterDemo } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signIn(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no login')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(13,159,126,0.18),transparent_40%),radial-gradient(circle_at_80%_0%,rgba(10,101,83,0.2),transparent_35%)]" />
      <div className="relative grid w-full max-w-5xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#06241c]">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">
                OpenLeads
              </h1>
              <p className="text-sm uppercase tracking-[0.22em] text-[var(--text-muted)]">CRM</p>
            </div>
          </div>
          <p className="max-w-md text-lg text-[var(--text-muted)]">
            Busca de contatos no Maps, gestão de leads e disparo no WhatsApp — no PC e no celular.
          </p>
        </div>

        <Card className="w-full">
          <h2 className="font-display text-2xl font-semibold">Entrar</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Acesse sua conta ou experimente o modo demo.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={!isSupabaseConfigured}
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!isSupabaseConfigured}
              />
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting || !isSupabaseConfigured}>
              {submitting ? 'Entrando...' : 'Entrar'}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <div className="h-px flex-1 bg-[var(--border)]" />
            ou
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <Button type="button" variant="secondary" onClick={() => enterDemo(false)}>
              Demo usuário
            </Button>
            <Button type="button" variant="secondary" onClick={() => enterDemo(true)}>
              Demo admin
            </Button>
          </div>

          <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
            Não tem conta?{' '}
            <Link to="/registro" className="font-semibold text-[var(--accent)]">
              Criar conta
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
