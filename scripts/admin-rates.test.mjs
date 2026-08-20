import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateRoomTotal,
  applyRateRule,
  formatYen,
  getAppliedSelectionDates,
  getBaseRateChanges,
  parseYenInput,
  parseSignedInteger,
  getRuleDateApplicationPlan,
  getSelectableWeekendDates,
  getSundayStartCalendarDays,
  validateRateOverrideInput,
} from '../src/features/admin-rates/rate-helpers.ts'

const japaneseType = {
  id: 'japanese-type',
  code: 'japanese',
  name_ja: '和室',
  display_order: 1,
}
const japaneseRates = [13500, 8500, 8500, 8500].map((price, index) => ({
  id: `japanese-${index + 1}`,
  room_type_id: japaneseType.id,
  guest_count: index + 1,
  valid_from: '2026-08-20',
  valid_to: '2099-12-31',
  price_per_person_yen: price,
  room_type: japaneseType,
}))

test('formats yen and calculates a per-room total', () => {
  assert.equal(formatYen(8500), '8,500円')
  assert.equal(calculateRoomTotal(8500, 4), 34000)
})

test('accepts only non-negative integer price input', () => {
  assert.equal(parseYenInput('13500'), 13500)
  assert.equal(parseYenInput('0'), 0)
  assert.equal(parseYenInput('-1'), null)
  assert.equal(parseYenInput('8.5'), null)
  assert.equal(parseYenInput(''), null)
})

test('detects only changed base-rate rows', () => {
  const drafts = Object.fromEntries(
    japaneseRates.map((rate) => [rate.id, String(rate.price_per_person_yen)]),
  )
  drafts['japanese-1'] = '13600'
  assert.deepEqual(getBaseRateChanges(japaneseRates, drafts), [
    {
      id: 'japanese-1',
      guest_count: 1,
      previousPrice: 13500,
      nextPrice: 13600,
    },
  ])
})

test('rejects invalid and past date-specific rates', () => {
  const validInput = {
    room_type_id: japaneseType.id,
    stay_date: '2026-12-31',
    guest_count: 2,
    price_per_person_yen: 12000,
    reason: '年末料金',
  }
  assert.equal(validateRateOverrideInput(validInput, '2026-08-20'), null)
  assert.equal(
    validateRateOverrideInput(
      { ...validInput, stay_date: '2026-08-19' },
      '2026-08-20',
    ),
    '過去の日付には料金を登録できません。',
  )
  assert.equal(
    validateRateOverrideInput(
      { ...validInput, price_per_person_yen: -1 },
      '2026-08-20',
    ),
    '料金は0以上の整数で入力してください。',
  )
})

test('applies fixed, discount, percentage, and zero-floor adjustments', () => {
  assert.equal(applyRateRule(8500, 'fixed_amount', 1000), 9500)
  assert.equal(applyRateRule(9500, 'fixed_amount', -500), 9000)
  assert.equal(applyRateRule(8500, 'percentage', 20), 10200)
  assert.equal(applyRateRule(300, 'fixed_amount', -500), 0)
  assert.equal(parseSignedInteger('-500'), -500)
})

test('separates new, conflicting, and unchanged date assignments', () => {
  const current = new Map([
    ['2026-08-22', 'weekend'],
    ['2026-08-23', 'busy'],
  ])
  assert.deepEqual(
    getRuleDateApplicationPlan(
      ['2026-08-22', '2026-08-23', '2026-08-29'],
      current,
      'weekend',
    ),
    {
      newDates: ['2026-08-29'],
      conflictingDates: ['2026-08-23'],
      unchangedDates: ['2026-08-22'],
    },
  )
})

test('selects only future weekends in the displayed month', () => {
  const result = getSelectableWeekendDates(
    new Date('2026-08-01T12:00:00'),
    new Date('2026-08-20T00:00:00'),
  )
  assert.deepEqual(result, [
    '2026-08-22',
    '2026-08-23',
    '2026-08-29',
    '2026-08-30',
  ])
})

test('builds an exact Sunday-first calendar grid for August 2026', () => {
  const days = getSundayStartCalendarDays(new Date(2026, 7, 1))
  const augustFirst = days.findIndex(
    (day) =>
      day.getFullYear() === 2026 && day.getMonth() === 7 && day.getDate() === 1,
  )
  const augustSecond = days.findIndex(
    (day) =>
      day.getFullYear() === 2026 && day.getMonth() === 7 && day.getDate() === 2,
  )

  assert.equal(days[0].getDay(), 0)
  assert.equal(augustFirst % 7, 6)
  assert.equal(days[augustFirst].getDay(), 6)
  assert.equal(augustSecond % 7, 0)
  assert.equal(days[augustSecond].getDay(), 0)
})

test('recognizes August 22 and 23, 2026 as Saturday and Sunday', () => {
  assert.equal(new Date(2026, 7, 22).getDay(), 6)
  assert.equal(new Date(2026, 7, 23).getDay(), 0)
})

test('bulk removal targets only selected dates with assignments', () => {
  const selected = ['2026-08-22', '2026-08-23', '2026-08-24']
  const assigned = new Set(['2026-08-22', '2026-08-23'])

  assert.deepEqual(getAppliedSelectionDates(selected, assigned), [
    '2026-08-22',
    '2026-08-23',
  ])
})
