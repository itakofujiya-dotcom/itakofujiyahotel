import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isWeekend,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type {
  BaseRateChange,
  BaseRoomRate,
  RateOverrideCreateInput,
  RateAdjustmentType,
} from './types'

export function formatYen(value: number): string {
  return `${new Intl.NumberFormat('ja-JP').format(value)}円`
}

export function calculateRoomTotal(
  pricePerPerson: number,
  guestCount: number,
): number {
  return pricePerPerson * guestCount
}

export function applyRateRule(
  basePrice: number,
  adjustmentType: RateAdjustmentType,
  adjustmentValue: number,
): number {
  const adjustment =
    adjustmentType === 'fixed_amount'
      ? adjustmentValue
      : Math.round((basePrice * adjustmentValue) / 100)
  return Math.max(0, basePrice + adjustment)
}

export function formatAdjustment(
  adjustmentType: RateAdjustmentType,
  adjustmentValue: number,
): string {
  const prefix = adjustmentValue > 0 ? '+' : ''
  return adjustmentType === 'fixed_amount'
    ? `${prefix}${new Intl.NumberFormat('ja-JP').format(adjustmentValue)}円`
    : `${prefix}${adjustmentValue}%`
}

export function getSelectableWeekendDates(month: Date, today: Date): string[] {
  return eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  })
    .filter((day) => isWeekend(day) && !isBefore(day, today))
    .map((day) => format(day, 'yyyy-MM-dd'))
}

export function getSundayStartCalendarDays(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
  })
}

export function getAppliedSelectionDates(
  selectedDates: Iterable<string>,
  assignmentDates: ReadonlySet<string>,
): string[] {
  return [...new Set(selectedDates)].filter((date) => assignmentDates.has(date))
}

export function getRuleDateApplicationPlan(
  stayDates: string[],
  assignmentRuleByDate: ReadonlyMap<string, string>,
  nextRuleId: string,
) {
  const newDates: string[] = []
  const conflictingDates: string[] = []
  const unchangedDates: string[] = []
  for (const stayDate of stayDates) {
    const currentRuleId = assignmentRuleByDate.get(stayDate)
    if (!currentRuleId) newDates.push(stayDate)
    else if (currentRuleId === nextRuleId) unchangedDates.push(stayDate)
    else conflictingDates.push(stayDate)
  }
  return { newDates, conflictingDates, unchangedDates }
}

export function parseYenInput(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null
}

export function parseSignedInteger(value: string): number | null {
  if (!/^-?\d+$/.test(value.trim())) return null
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) ? parsed : null
}

export function getBaseRateChanges(
  rates: BaseRoomRate[],
  drafts: Record<string, string>,
): BaseRateChange[] | null {
  const changes: BaseRateChange[] = []
  for (const rate of rates) {
    const nextPrice = parseYenInput(drafts[rate.id] ?? '')
    if (nextPrice === null) return null
    if (nextPrice !== rate.price_per_person_yen) {
      changes.push({
        id: rate.id,
        guest_count: rate.guest_count,
        previousPrice: rate.price_per_person_yen,
        nextPrice,
      })
    }
  }
  return changes
}

export function validateRateOverrideInput(
  input: RateOverrideCreateInput,
  today: string,
): string | null {
  if (!input.room_type_id) return '客室タイプを選択してください。'
  if (!input.stay_date) return '適用日を選択してください。'
  if (input.stay_date < today) return '過去の日付には料金を登録できません。'
  if (input.guest_count < 1 || input.guest_count > 4)
    return '人数を選択してください。'
  if (
    !Number.isSafeInteger(input.price_per_person_yen) ||
    input.price_per_person_yen < 0
  )
    return '料金は0以上の整数で入力してください。'
  return null
}
