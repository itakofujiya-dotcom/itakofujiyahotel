import { useCallback, useEffect, useState } from 'react'
import {
  fetchInventoryForMonth,
  fetchInventoryInitialData,
  resetInventoryForDates,
  saveInventoryForDates,
} from './admin-inventory-api'
import { getInventoryMonthRange } from './inventory-helpers'
import type {
  InventoryQuantity,
  RoomTypeCapacity,
  RoomTypeInventory,
} from './types'

type Feedback = { type: 'success' | 'error'; message: string } | null

export function useAdminInventory(month: Date) {
  const [capacities, setCapacities] = useState<RoomTypeCapacity[]>([])
  const [inventory, setInventory] = useState<RoomTypeInventory[]>([])
  const [maxBookingDays, setMaxBookingDays] = useState(40)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)
  const monthKey = `${month.getFullYear()}-${month.getMonth()}`

  const loadInventory = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const range = getInventoryMonthRange(month)
      const [initialData, monthInventory] = await Promise.all([
        fetchInventoryInitialData(),
        fetchInventoryForMonth(range.startDate, range.endDate),
      ])
      setCapacities(initialData.capacities)
      setMaxBookingDays(initialData.maxBookingDays)
      setInventory(monthInventory)
    } catch {
      setError('在庫情報の取得に失敗しました。')
    } finally {
      setIsLoading(false)
    }
    // monthKey represents the displayed calendar month.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey])

  useEffect(() => {
    void loadInventory()
  }, [loadInventory])

  const reloadMonth = useCallback(async () => {
    const range = getInventoryMonthRange(month)
    setInventory(await fetchInventoryForMonth(range.startDate, range.endDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey])

  const saveDates = useCallback(
    async (
      dates: string[],
      quantities: InventoryQuantity[],
    ): Promise<boolean> => {
      setIsMutating(true)
      setFeedback(null)
      try {
        await saveInventoryForDates({ dates, quantities })
        await reloadMonth()
        setFeedback({ type: 'success', message: '販売可能数を更新しました。' })
        return true
      } catch {
        setFeedback({
          type: 'error',
          message: '販売可能数を更新できませんでした。',
        })
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [reloadMonth],
  )

  const resetDates = useCallback(
    async (
      dates: string[],
      roomTypeIds: string[],
      expectedKeys: string[],
    ): Promise<boolean> => {
      setIsMutating(true)
      setFeedback(null)
      try {
        await resetInventoryForDates({ dates, roomTypeIds, expectedKeys })
        await reloadMonth()
        setFeedback({
          type: 'success',
          message: '販売設定をデフォルトに戻しました。',
        })
        return true
      } catch {
        setFeedback({
          type: 'error',
          message: '販売設定をデフォルトに戻せませんでした。',
        })
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [reloadMonth],
  )

  return {
    capacities,
    inventory,
    maxBookingDays,
    isLoading,
    isMutating,
    error,
    feedback,
    loadInventory,
    saveDates,
    resetDates,
  }
}
