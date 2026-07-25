import { Link } from 'react-router-dom'
import { ArrowRight, MapPinned, MessageCircle, ShieldCheck, Cloud } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function LandingPage() {
  return (
    <div className="min-h-svh overflow-x-hidden">
      <header className="relative isolate">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(52,211,173,0.28), transparent 55%), linear-gradient(165deg, #071410 0%, #0b1f1a 42%, #122820 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-0 -z-10 opacity-40"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%2334d3ad" fill-opacity="0.06"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />

        <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <div className="font-display text-xl font-bold tracking-tight text-[#e8f8f3]">
            OpenLeads <span className="text-[#34d3ad]">CRM</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="secondary" size="sm" className="border-white/20 bg-white/5 text-[#e8f8f3]">
                Entrar
              </Button>
            </Link>
            <Link to="/registro">
              <Button size="sm">Criar conta</Button>
            </Link>
          </div>
        </nav>

        <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:pb-28 lg:pt-16">
          <div>
            <p className="font-display text-5xl font-extrabold leading-[1.05] tracking-tight text-[#e8f8f3] sm:text-6xl lg:text-7xl">
              OpenLeads
            </p>
            <h1 className="mt-4 max-w-xl text-xl font-medium text-[#b8d9ce] sm:text-2xl">
              Prospecção no Maps, leads na nuvem e WhatsApp em um só lugar.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-[#8fb3a7] sm:text-base">
              Capture contatos reais, continue a busca mesmo saindo da página e dispare mensagens com
              controle total — feito para operação comercial no Brasil.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/registro">
                <Button size="lg" className="gap-2">
                  Começar agora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button
                  size="lg"
                  variant="secondary"
                  className="border-white/15 bg-transparent text-[#e8f8f3] hover:bg-white/10"
                >
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>

          <div className="relative min-h-[280px] overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(145deg,rgba(52,211,173,0.18),rgba(7,20,16,0.85))] p-6 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)] sm:min-h-[340px]">
            <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-[#34d3ad]/20 blur-3xl" />
            <div className="relative space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0b1412]/70 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-widest text-[#34d3ad]">Busca em nuvem</p>
                <p className="mt-1 font-display text-2xl font-semibold text-white">42 / 50 contatos</p>
                <p className="text-sm text-[#9bb0a8]">Continua rodando mesmo se você sair</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-white/10 bg-[#0b1412]/50 p-3">
                  <p className="text-xs text-[#9bb0a8]">WhatsApp</p>
                  <p className="font-semibold text-white">Disparo em massa</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-[#0b1412]/50 p-3">
                  <p className="text-xs text-[#9bb0a8]">Equipe</p>
                  <p className="font-semibold text-white">Aprovação admin</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-3xl font-bold tracking-tight">Feito para vender mais</h2>
        <p className="mt-2 max-w-2xl text-[var(--text-muted)]">
          Do Maps ao WhatsApp, com segurança de contas e histórico na nuvem.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: MapPinned,
              title: 'Maps real',
              text: 'Extrai nome, telefone e endereço direto da lista do Google Maps.',
            },
            {
              icon: Cloud,
              title: 'Busca na nuvem',
              text: 'Saiu da página? A captura segue e os resultados ficam salvos.',
            },
            {
              icon: MessageCircle,
              title: 'WhatsApp',
              text: 'Valida números, pausa, continua e cancela disparos com intervalo.',
            },
            {
              icon: ShieldCheck,
              title: 'Contas aprovadas',
              text: 'Novos clientes passam pela aprovação do Super Admin.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-[var(--border)] bg-[var(--bg-elevated)] p-5">
              <item.icon className="h-6 w-6 text-[var(--accent)]" />
              <h3 className="mt-3 font-display text-lg font-semibold">{item.title}</h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[var(--border)] bg-[var(--bg-muted)]/40 py-16">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-4 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="font-display text-3xl font-bold">Pronto para prospectar?</h2>
            <p className="mt-2 text-[var(--text-muted)]">Crie sua conta — a liberação é feita pelo admin.</p>
          </div>
          <Link to="/registro">
            <Button size="lg" className="gap-2">
              Criar conta <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between px-4 py-8 text-sm text-[var(--text-muted)] sm:px-6">
        <span className="font-display font-semibold text-[var(--text)]">OpenLeads CRM</span>
        <span>© {new Date().getFullYear()}</span>
      </footer>
    </div>
  )
}
