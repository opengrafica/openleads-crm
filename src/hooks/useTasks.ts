import { useCallback, useEffect, useState } from 'react'
import { listTasks } from '@/services/tasksService'
import type { Task } from '@/types'
import { useAuth } from '@/hooks/useAuth'

export function useTasks() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!user) {
      setTasks([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setTasks(await listTasks(user.id))
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { tasks, loading, refresh, setTasks }
}
