import { useCallback, useEffect, useState } from 'react'
import {
  applyRuleToDates,
  createRateRule,
  disableRateRule,
  DuplicateRateRuleDateError,
  fetchRateRuleDates,
  fetchRateRules,
  removeRateRuleFromDate,
  removeRateRulesFromDates,
  updateRateRule,
} from './rate-rules-api'
import type {
  RateRule,
  RateRuleCreateInput,
  RateRuleDate,
  RateRuleUpdateInput,
} from './types'

type Feedback = { type: 'success' | 'error'; message: string } | null

export function useRateRules() {
  const [rules, setRules] = useState<RateRule[]>([])
  const [ruleDates, setRuleDates] = useState<RateRuleDate[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isMutating, setIsMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const loadRuleData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true)
    setError(null)
    try {
      const [nextRules, nextDates] = await Promise.all([
        fetchRateRules(),
        fetchRateRuleDates(),
      ])
      setRules(nextRules)
      setRuleDates(nextDates)
    } catch {
      setError('特別料金情報の取得に失敗しました。')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadRuleData()
  }, [loadRuleData])

  const mutate = useCallback(
    async (operation: () => Promise<void>, successMessage: string) => {
      setIsMutating(true)
      setFeedback(null)
      try {
        await operation()
        await loadRuleData(false)
        setFeedback({ type: 'success', message: successMessage })
        return true
      } catch (caught) {
        setFeedback({
          type: 'error',
          message:
            caught instanceof DuplicateRateRuleDateError
              ? 'この日付にはすでに別の料金ルールが設定されています。'
              : '特別料金の更新に失敗しました。',
        })
        return false
      } finally {
        setIsMutating(false)
      }
    },
    [loadRuleData],
  )

  return {
    rules,
    ruleDates,
    isLoading,
    isMutating,
    error,
    feedback,
    loadRuleData,
    createRule: (input: RateRuleCreateInput) =>
      mutate(() => createRateRule(input), '特別料金ルールを追加しました。'),
    editRule: (id: string, input: RateRuleUpdateInput) =>
      mutate(() => updateRateRule(id, input), '特別料金ルールを更新しました。'),
    disableRule: (id: string) =>
      mutate(() => disableRateRule(id), '特別料金ルールを無効にしました。'),
    applyRule: (id: string, dates: string[], replace: boolean) =>
      mutate(
        () => applyRuleToDates(id, dates, replace),
        '選択した日付に料金ルールを適用しました。',
      ),
    removeDate: (date: string) =>
      mutate(
        () => removeRateRuleFromDate(date),
        '特別料金の適用を解除しました。基本料金が適用されます。',
      ),
    removeDates: (dates: string[]) =>
      mutate(
        () => removeRateRulesFromDates(dates),
        '特別料金の適用を解除しました。基本料金が適用されます。',
      ),
  }
}
