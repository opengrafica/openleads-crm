import { useCallback, useEffect, useState } from 'react'
import { listLeads, searchLeads as searchLeadsService } from '@/services/leadsService'
import type { Lead } from '@/types'
import { useAuth } from '@/hooks/useAuth'

export function useLeads() {
  const { user } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!user) {
      setLeads([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await listLeads(user.id)
      setLeads(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar leads')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const search = useCallback(
    async (query: string) => {
      if (!user) return []
      return searchLeadsService(user.id, query)
    },
    [user],
  )

  return { leads, loading, error, refresh, setLeads, search }
}
