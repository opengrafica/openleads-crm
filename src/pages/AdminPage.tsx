import { useEffect, useState } from 'react'
import {
  adminUpdateSubscription,
  adminUpdateUserRole,
  getAdminData,
} from '@/services/dashboardService'
import type { AdminStats, Profile, Subscription, SubscriptionPlan, SubscriptionStatus } from '@/types'
import { PLAN_LABELS } from '@/types'
import { Card, StatCard, Badge } from '@/components/ui/Card'
import { Select } from '@/components/ui/Input'
import { Users, CreditCard, Target, Wallet } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export function AdminPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setLoading(true)
    try {
      const data = await getAdminData()
      setUsers(data.users)
      setSubscriptions(data.subscriptions)
      setStats(data.stats)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
  }, [])

  function subFor(userId: string) {
    return subscriptions.find((s) => s.user_id === userId)
  }

  if (loading || !stats) {
    return <p className="text-[var(--text-muted)]">Carregando painel admin...</p>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Painel Admin</h1>
        <p className="mt-1 text-[var(--text-muted)]">
          Usuários, assinaturas e estatísticas da plataforma.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuários" value={stats.totalUsers} icon={<Users className="h-5 w-5" />} />
        <StatCard
          label="Assinaturas ativas"
          value={stats.activeSubscriptions}
          icon={<CreditCard className="h-5 w-5" />}
        />
        <StatCard
          label="Leads na plataforma"
          value={stats.totalLeads}
          icon={<Target className="h-5 w-5" />}
        />
        <StatCard
          label="Receita estimada /mês"
          value={`R$ ${stats.revenueEstimate}`}
          icon={<Wallet className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="font-display text-lg font-semibold">Usuários por plano</h2>
          <ul className="mt-4 space-y-2">
            {stats.usersByPlan.map((item) => (
              <li
                key={item.plan}
                className="flex items-center justify-between rounded-xl bg-[var(--bg-muted)] px-3 py-2"
              >
                <Badge tone="accent">{PLAN_LABELS[item.plan]}</Badge>
                <span className="font-semibold">{item.count}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Usuários</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[var(--bg-muted)] text-xs uppercase tracking-wide text-[var(--text-muted)]">
                <tr>
                  <th className="px-4 py-3">Usuário</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3">Plano</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const sub = subFor(user.id)
                  return (
                    <tr key={user.id} className="border-t border-[var(--border)]">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{user.full_name}</p>
                        <p className="text-xs text-[var(--text-muted)]">{user.email}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                          desde {formatDate(user.created_at)}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={user.role}
                          onChange={(e) =>
                            void adminUpdateUserRole(
                              user.id,
                              e.target.value as Profile['role'],
                            ).then(() => refresh())
                          }
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={sub?.plan ?? 'free'}
                          onChange={(e) =>
                            void adminUpdateSubscription(user.id, {
                              plan: e.target.value as SubscriptionPlan,
                            }).then(() => refresh())
                          }
                        >
                          {Object.entries(PLAN_LABELS).map(([k, v]) => (
                            <option key={k} value={k}>
                              {v}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={sub?.status ?? 'trialing'}
                          onChange={(e) =>
                            void adminUpdateSubscription(user.id, {
                              status: e.target.value as SubscriptionStatus,
                            }).then(() => refresh())
                          }
                        >
                          <option value="trialing">trialing</option>
                          <option value="active">active</option>
                          <option value="past_due">past_due</option>
                          <option value="canceled">canceled</option>
                        </Select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  )
}
