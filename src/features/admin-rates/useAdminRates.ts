import { useCallback, useEffect, useState } from 'react'
import {
  createRateOverride,
  deleteRateOverride,
  DuplicateRateOverrideError,
  fetchAdminRates,
  updateBaseRoomRates,
  updateRateOverride,
} from './admin-rates-api'
import type {
  AdminRatesData,
  BaseRateChange,
  RateOverrideCreateInput,
  RateOverrideUpdateInput,
} from './types'

type Feedback = { type: 'success' | 'error'; message: string } | null
const emptyData: AdminRatesData = {
  roomTypes: [],
  baseRates: [],
  overrides: [],
}

export function useAdminRates() {
  const [data, setData] = useState<AdminRatesData>(emptyData)
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const loadRates = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setLoadError(null)
    try {
      setData(await fetchAdminRates())
    } catch {
      setLoadError(
        '料金情報の取得に失敗しました。時間をおいて再度お試しください。',
      )
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRates()
  }, [loadRates])

  const saveBaseRates = useCallback(
    async (changes: BaseRateChange[]): Promise<boolean> => {
      setIsMutating(true)
      setFeedback(null)
      try {
        await updateBaseRoomRates(changes)
        await loadRates(false)
        setFeedback({ type: 'success', message: '基本料金を更新しました。' })
        return true
      } catch {
        await loadRates(false)
        setFeedback({
          type: 'error',
          message: '料金の更新に失敗しました。時間をおいて再度お試しください。',
        })
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [loadRates],
  )

  const addOverride = useCallback(
    async (input: RateOverrideCreateInput): Promise<boolean> => {
      setIsMutating(true)
      setFeedback(null)
      try {
        await createRateOverride(input)
        await loadRates(false)
        setFeedback({ type: 'success', message: '日付別料金を追加しました。' })
        return true
      } catch (error) {
        setFeedback({
          type: 'error',
          message:
            error instanceof DuplicateRateOverrideError
              ? 'この日付・客室タイプ・人数の料金はすでに設定されています。'
              : '日付別料金を追加できませんでした。',
        })
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [loadRates],
  )

  const editOverride = useCallback(
    async (
      overrideId: string,
      input: RateOverrideUpdateInput,
    ): Promise<boolean> => {
      setIsMutating(true)
      setFeedback(null)
      try {
        await updateRateOverride(overrideId, input)
        await loadRates(false)
        setFeedback({ type: 'success', message: '日付別料金を更新しました。' })
        return true
      } catch {
        setFeedback({
          type: 'error',
          message: '日付別料金を更新できませんでした。',
        })
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [loadRates],
  )

  const removeOverride = useCallback(
    async (overrideId: string): Promise<boolean> => {
      setIsMutating(true)
      setFeedback(null)
      try {
        await deleteRateOverride(overrideId)
        await loadRates(false)
        setFeedback({ type: 'success', message: '日付別料金を削除しました。' })
        return true
      } catch {
        setFeedback({
          type: 'error',
          message: '日付別料金を削除できませんでした。',
        })
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [loadRates],
  )

  return {
    ...data,
    isLoading,
    isMutating,
    loadError,
    feedback,
    loadRates,
    saveBaseRates,
    addOverride,
    editOverride,
    removeOverride,
  }
}
