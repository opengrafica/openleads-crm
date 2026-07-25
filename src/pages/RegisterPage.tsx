import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export function RegisterPage() {
  const { user, loading, signUp, signOut } = useAuth()
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)

  // Se já logado e não acabou de cadastrar, vai pro app
  if (!loading && user && !showSuccessPopup) return <Navigate to="/app" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await signUp(email, password, fullName, companyName)
      setShowSuccessPopup(true)
      // Evita entrar no app pendente; desloga e mostra o popup
      await signOut()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-svh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold">Cadastro de cliente</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Crie sua conta e comece a prospectar com o OpenLeads.
        </p>

        {!isSupabaseConfigured ? (
          <p className="mt-6 text-sm text-[var(--danger)]">Supabase não configurado.</p>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Opcional"
              />
            </div>
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Criando...' : 'Criar conta'}
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-[var(--text-muted)]">
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-[var(--accent)]">
            Entrar
          </Link>
        </p>
      </Card>

      {showSuccessPopup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-xl">
            <h2 className="font-display text-xl font-bold">Conta criada!</h2>
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-muted)]">
              Aguarde que em até 1 a 2 horas sua conta será ativada, com 3 dias grátis para testes.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Link to="/login">
                <Button
                  onClick={() => setShowSuccessPopup(false)}
                >
                  Entendi
                </Button>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
