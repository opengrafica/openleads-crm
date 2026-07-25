import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Target, Users, Percent, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { useLeads } from '@/hooks/useLeads'
import { computeDashboardStats } from '@/services/dashboardService'
import { StatCard, Card, Badge } from '@/components/ui/Card'
import { STATUS_LABELS } from '@/types'

export function DashboardPage() {
  const { leads, loading } = useLeads()
  const stats = useMemo(() => computeDashboardStats(leads), [leads])

  if (loading) {
    return <p className="text-[var(--text-muted)]">Carregando dashboard...</p>
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Início</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Resumo dos seus leads e conversão.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total de leads"
          value={stats.totalLeads}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="Clientes fechados"
          value={stats.closedClients}
          icon={<Trophy className="h-5 w-5" />}
        />
        <StatCard
          label="Taxa de conversão"
          value={`${stats.conversionRate}%`}
          icon={<Percent className="h-5 w-5" />}
        />
        <StatCard
          label="Cidades ativas"
          value={stats.leadsByCity.length}
          icon={<Target className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Leads por cidade</h2>
          <div className="mt-4 h-64">
            {stats.leadsByCity.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.leadsByCity.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="city" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fill: 'var(--text-muted)', fontSize: 12 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sem dados ainda.</p>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="font-display text-lg font-semibold">Distribuição por status</h2>
          <ul className="mt-4 space-y-3">
            {stats.leadsByStatus.length ? (
              stats.leadsByStatus.map((item) => (
                <li
                  key={item.status}
                  className="flex items-center justify-between rounded-xl bg-[var(--bg-muted)] px-3 py-2.5"
                >
                  <Badge tone="accent">{STATUS_LABELS[item.status]}</Badge>
                  <span className="font-semibold">{item.count}</span>
                </li>
              ))
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Sem dados ainda.</p>
            )}
          </ul>
        </Card>
      </div>
    </div>
  )
}
