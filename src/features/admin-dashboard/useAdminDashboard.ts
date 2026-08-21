import { useCallback, useEffect, useState } from 'react'
import { fetchDashboardMetrics } from './admin-dashboard-api'
import { getJapanToday } from './dashboard-helpers'
import type { DashboardMetrics } from './types'

export function useAdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadDashboard = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setMetrics(await fetchDashboardMetrics(getJapanToday()))
    } catch {
      setMetrics(null)
      setError('データの取得に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  return { metrics, isLoading, error, loadDashboard }
}
