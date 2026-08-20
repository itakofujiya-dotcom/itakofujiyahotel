import { useCallback, useEffect, useState } from 'react'
import { fetchReservations } from './admin-reservations-api'
import type { ReservationListItem } from './types'

export function useAdminReservations() {
  const [reservations, setReservations] = useState<ReservationListItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadReservations = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setReservations(await fetchReservations())
    } catch {
      setError('予約情報の取得に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadReservations()
  }, [loadReservations])

  return { reservations, isLoading, error, loadReservations }
}
