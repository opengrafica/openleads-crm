import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'

export function RegisterPage() {
  const { user, loading, signUp, enterDemo } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    setMessage(null)
    try {
      await signUp(email, password, fullName)
      setMessage('Conta criada! Verifique seu e-mail se a confirmação estiver ativa.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no cadastro')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md">
        <h1 className="font-display text-3xl font-bold">Criar conta</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">OpenLeads CRM</p>

        {!isSupabaseConfigured ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Configure o Supabase no <code>.env</code> para registrar usuários reais, ou use o modo
              demo.
            </p>
            <Button className="w-full" onClick={() => enterDemo(false)}>
              Entrar no demo
            </Button>
          </div>
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
            {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
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
    </div>
  )
}
