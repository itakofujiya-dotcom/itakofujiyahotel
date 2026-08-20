import { useMemo, useState } from 'react'
import {
  addMonths,
  format,
  isBefore,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfToday,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  applyRateRule,
  calculateRoomTotal,
  formatAdjustment,
  formatYen,
  getAppliedSelectionDates,
  getRuleDateApplicationPlan,
  getSelectableWeekendDates,
  getSundayStartCalendarDays,
} from './rate-helpers'
import { RateConfirmDialog } from './RateConfirmDialog'
import type { BaseRoomRate, RateRule, RateRuleDate } from './types'

export function RateRuleCalendar({
  rules,
  ruleDates,
  baseRates,
  isMutating,
  onApply,
  onRemoveOne,
  onRemoveMany,
}: {
  rules: RateRule[]
  ruleDates: RateRuleDate[]
  baseRates: BaseRoomRate[]
  isMutating: boolean
  onApply: (
    ruleId: string,
    dates: string[],
    replace: boolean,
  ) => Promise<boolean>
  onRemoveOne: (stayDate: string) => Promise<boolean>
  onRemoveMany: (stayDates: string[]) => Promise<boolean>
}) {
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set())
  const [selectedRuleId, setSelectedRuleId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [replaceRequest, setReplaceRequest] = useState<{
    ruleId: string
    dates: string[]
  } | null>(null)
  const [removeRequest, setRemoveRequest] = useState<{
    kind: 'single' | 'multiple'
    assignments: RateRuleDate[]
  } | null>(null)
  const today = startOfToday()
  const activeRules = rules.filter((rule) => rule.is_active)
  const effectiveRuleId = activeRules.some((rule) => rule.id === selectedRuleId)
    ? selectedRuleId
    : (activeRules[0]?.id ?? '')
  const selectedRule =
    activeRules.find((rule) => rule.id === effectiveRuleId) ?? null
  const assignmentByDate = useMemo(
    () =>
      new Map(
        ruleDates.map((assignment) => [assignment.stay_date, assignment]),
      ),
    [ruleDates],
  )
  const assignmentRuleByDate = useMemo(
    () =>
      new Map(
        ruleDates.map((assignment) => [
          assignment.stay_date,
          assignment.rate_rule_id,
        ]),
      ),
    [ruleDates],
  )
  const assignmentDates = useMemo(
    () => new Set(ruleDates.map((assignment) => assignment.stay_date)),
    [ruleDates],
  )
  const selectedAppliedDates = getAppliedSelectionDates(
    selectedDates,
    assignmentDates,
  )
  const days = getSundayStartCalendarDays(month)

  function toggleDate(day: Date) {
    if (isBefore(day, today)) return
    const key = format(day, 'yyyy-MM-dd')
    setSelectedDates((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setError(null)
  }

  function selectWeekends() {
    const next = new Set(selectedDates)
    for (const stayDate of getSelectableWeekendDates(month, today))
      next.add(stayDate)
    setSelectedDates(next)
  }

  async function requestApply() {
    if (!effectiveRuleId || selectedDates.size === 0) {
      setError('料金ルールと適用する日付を選択してください。')
      return
    }
    const plan = getRuleDateApplicationPlan(
      [...selectedDates],
      assignmentRuleByDate,
      effectiveRuleId,
    )
    const targets = [...plan.newDates, ...plan.conflictingDates]
    if (targets.length === 0) {
      setError('選択した日付にはすでにこのルールが適用されています。')
      return
    }
    const hasConflicts = plan.conflictingDates.length > 0
    if (hasConflicts) {
      setReplaceRequest({ ruleId: effectiveRuleId, dates: targets })
      return
    }
    if (await onApply(effectiveRuleId, targets, false))
      setSelectedDates(new Set())
  }

  async function confirmReplace() {
    if (!replaceRequest) return
    if (await onApply(replaceRequest.ruleId, replaceRequest.dates, true)) {
      setReplaceRequest(null)
      setSelectedDates(new Set())
    }
  }

  async function confirmRemove() {
    if (!removeRequest) return
    const dates = removeRequest.assignments.map(
      (assignment) => assignment.stay_date,
    )
    const succeeded =
      removeRequest.kind === 'single'
        ? await onRemoveOne(dates[0])
        : await onRemoveMany(dates)
    if (succeeded) setRemoveRequest(null)
  }

  const singleSelectedAssignment =
    selectedDates.size === 1
      ? (assignmentByDate.get([...selectedDates][0]) ?? null)
      : null

  return (
    <section aria-labelledby="rule-calendar-heading">
      <p className="eyebrow">CALENDAR APPLICATION</p>
      <h2 id="rule-calendar-heading" className="font-serif text-2xl">
        日付への適用
      </h2>
      <p className="mt-3 text-sm text-muted">
        複数の日付を選び、同じ料金ルールをまとめて適用できます。
      </p>

      <div className="mt-6 border border-line bg-surface p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((value) => subMonths(value, 1))}
            className="grid size-11 place-items-center"
            aria-label="前の月"
          >
            <ChevronLeft />
          </button>
          <h3 className="font-serif text-xl">{format(month, 'yyyy年M月')}</h3>
          <button
            type="button"
            onClick={() => setMonth((value) => addMonths(value, 1))}
            className="grid size-11 place-items-center"
            aria-label="次の月"
          >
            <ChevronRight />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-muted">
          {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-t border-line">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const assignment = assignmentByDate.get(key)
            const selected = selectedDates.has(key)
            const past = isBefore(day, today)
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDate(day)}
                disabled={past}
                aria-pressed={selected}
                className={`min-h-20 border-b border-r border-line p-1.5 text-left align-top transition sm:min-h-24 sm:p-2 ${!isSameMonth(day, month) ? 'bg-stone-50 text-muted/50' : ''} ${selected ? 'ring-2 ring-inset ring-accent' : ''} ${past ? 'cursor-not-allowed opacity-45' : 'hover:bg-background'}`}
              >
                <span className="text-xs sm:text-sm">{format(day, 'd')}</span>
                {assignment && (
                  <span className="mt-2 block truncate rounded bg-moss px-1.5 py-1 text-[9px] text-white sm:text-[10px]">
                    {assignment.rate_rule.name_ja}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={selectWeekends}
            className="min-h-10 border border-line px-4 text-xs font-semibold"
          >
            この月の土日を選択
          </button>
          <button
            type="button"
            onClick={() => setSelectedDates(new Set())}
            className="min-h-10 border border-line px-4 text-xs font-semibold"
          >
            すべて選択解除
          </button>
        </div>

        {singleSelectedAssignment && (
          <div className="mt-5 border border-line bg-background p-4">
            <p className="font-semibold">
              {format(
                parseISO(singleSelectedAssignment.stay_date),
                'yyyy年M月d日',
              )}
            </p>
            <p className="mt-2 text-sm text-muted">
              適用中:{' '}
              <span className="text-ink">
                {singleSelectedAssignment.rate_rule.name_ja}（
                {formatAdjustment(
                  singleSelectedAssignment.rate_rule.adjustment_type,
                  singleSelectedAssignment.rate_rule.adjustment_value,
                )}
                ）
              </span>
            </p>
            <button
              type="button"
              onClick={() =>
                setRemoveRequest({
                  kind: 'single',
                  assignments: [singleSelectedAssignment],
                })
              }
              disabled={isMutating}
              className="mt-4 min-h-10 border border-red-200 px-4 text-xs font-semibold text-red-700 disabled:opacity-45"
            >
              適用を解除
            </button>
          </div>
        )}

        <div className="mt-6 grid gap-4 border-t border-line pt-6 md:grid-cols-[1fr_auto] md:items-end">
          <label>
            <span className="mb-2 block text-xs font-semibold text-muted">
              適用する料金ルール
            </span>
            <select
              value={effectiveRuleId}
              onChange={(e) => setSelectedRuleId(e.target.value)}
              className="admin-input"
              disabled={activeRules.length === 0}
            >
              {activeRules.length === 0 && (
                <option value="">有効なルールがありません</option>
              )}
              {activeRules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name_ja}（
                  {formatAdjustment(
                    rule.adjustment_type,
                    rule.adjustment_value,
                  )}
                  ）
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void requestApply()}
              disabled={
                isMutating || selectedDates.size === 0 || !effectiveRuleId
              }
              className="min-h-11 bg-moss px-5 text-sm font-semibold text-white disabled:opacity-45"
            >
              選択した日付に適用
            </button>
            {selectedAppliedDates.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setRemoveRequest({
                    kind: 'multiple',
                    assignments: selectedAppliedDates.map((date) =>
                      assignmentByDate.get(date)!,
                    ),
                  })
                }
                disabled={isMutating}
                className="min-h-11 border border-red-200 px-5 text-sm font-semibold text-red-700 disabled:opacity-45"
              >
                選択した日付の特別料金を解除
              </button>
            )}
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">
          選択中: {selectedDates.size}日
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        {selectedRule && selectedDates.size > 0 && (
          <RatePreview rule={selectedRule} baseRates={baseRates} />
        )}
      </div>

      {replaceRequest && (
        <RateConfirmDialog
          title="既存の料金ルールを置き換えますか？"
          description="選択した日付の一部には、すでに別の料金ルールが設定されています。選択中のルールに置き換えます。"
          isMutating={isMutating}
          onCancel={() => setReplaceRequest(null)}
          onConfirm={() => void confirmReplace()}
        />
      )}
      {removeRequest && (
        <RateConfirmDialog
          title={
            removeRequest.kind === 'single'
              ? '特別料金の適用を解除しますか？'
              : '選択した日付の特別料金を解除しますか？'
          }
          description={
            removeRequest.kind === 'single'
              ? `${format(parseISO(removeRequest.assignments[0].stay_date), 'yyyy年M月d日')}\n${removeRequest.assignments[0].rate_rule.name_ja}（${formatAdjustment(removeRequest.assignments[0].rate_rule.adjustment_type, removeRequest.assignments[0].rate_rule.adjustment_value)}）\n\n解除すると基本料金が適用されます。`
              : `対象: ${removeRequest.assignments.length}日\n\n解除した日付には基本料金が適用されます。`
          }
          confirmLabel={
            removeRequest.kind === 'single' ? '適用を解除' : '解除する'
          }
          destructive
          isMutating={isMutating}
          onCancel={() => setRemoveRequest(null)}
          onConfirm={() => void confirmRemove()}
        />
      )}
    </section>
  )
}

function RatePreview({
  rule,
  baseRates,
}: {
  rule: RateRule
  baseRates: BaseRoomRate[]
}) {
  const examples = baseRates.filter((rate) => rate.guest_count === 2)
  return (
    <div className="mt-6 bg-background p-4">
      <p className="text-xs font-semibold text-muted">
        2名利用時の価格プレビュー
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {examples.map((rate) => {
          const finalPrice = applyRateRule(
            rate.price_per_person_yen,
            rule.adjustment_type,
            rule.adjustment_value,
          )
          return (
            <div key={rate.id} className="text-sm">
              <span className="font-semibold">{rate.room_type.name_ja}</span>
              <p className="mt-1 text-muted">
                {formatYen(rate.price_per_person_yen)} →{' '}
                <span className="text-ink">{formatYen(finalPrice)} / 名</span>
              </p>
              <p className="text-xs text-muted">
                2名合計 {formatYen(calculateRoomTotal(finalPrice, 2))}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
