import type { CancellationPolicy, MealPlan } from './types'
import type { SiteLocale } from '../../i18n/public-translations'

const roomTypeLabels = {
  和室: { ja: '和室', ko: '다다미방' },
  洋室: { ja: '洋室', ko: '침대방' },
} as const

const localizedMealPlanLabels: Record<
  MealPlan,
  Record<SiteLocale, string>
> = {
  breakfast: { ja: '朝食付き', ko: '조식 포함' },
  breakfast_dinner: { ja: '朝食・夕食付き', ko: '조식·석식 포함' },
}

const cancellationPolicyLabels: Record<
  string,
  Record<SiteLocale, string>
> = {
  free_7_plus: {
    ja: '宿泊日の7日前まで：キャンセル料無料',
    ko: '체크인 7일 전까지: 취소 수수료 무료',
  },
  days_6_to_4: {
    ja: '宿泊日の6～4日前：宿泊料金の30％',
    ko: '체크인 6~4일 전: 숙박요금의 30%',
  },
  days_3_to_2: {
    ja: '宿泊日の3～2日前：宿泊料金の50％',
    ko: '체크인 3~2일 전: 숙박요금의 50%',
  },
  previous_day: {
    ja: '宿泊日前日：宿泊料金の100％',
    ko: '체크인 전날: 숙박요금의 100%',
  },
  same_day: {
    ja: '宿泊日当日：宿泊料金の100％',
    ko: '체크인 당일: 숙박요금의 100%',
  },
  no_show: {
    ja: '無連絡不泊：宿泊料金の100％',
    ko: '노쇼: 숙박요금의 100%',
  },
}

export function getLocalizedRoomTypeName(
  roomTypeNameJa: string,
  locale: SiteLocale,
): string {
  return (
    roomTypeLabels[roomTypeNameJa as keyof typeof roomTypeLabels]?.[locale] ??
    roomTypeNameJa
  )
}

export function getLocalizedRoomAlt(
  roomTypeNameJa: string,
  locale: SiteLocale,
): string {
  const roomName = getLocalizedRoomTypeName(roomTypeNameJa, locale)
  return locale === 'ja' ? roomName + 'の客室' : roomName + ' 객실'
}

export function getLocalizedRoomCapacity(
  standardCapacity: number,
  maxCapacity: number,
  locale: SiteLocale,
): string {
  return locale === 'ja'
    ? '基本 ' + standardCapacity + '名 / 最大 ' + maxCapacity + '名'
    : '기준 ' + standardCapacity + '명 / 최대 ' + maxCapacity + '명'
}

export function getLocalizedFrontDeskHours(
  startTime: string,
  endTime: string,
  locale: SiteLocale,
): string {
  return locale === 'ja'
    ? 'フロント受付時間は' + startTime + '〜' + endTime + 'です。'
    : '프런트 접수 시간은 ' + startTime + '~' + endTime + '입니다.'
}

export function getLocalizedArrivalContact(
  telephone: string,
  locale: SiteLocale,
): string {
  return locale === 'ja'
    ? '送迎や到着時間の変更は、ホテル（' +
        telephone +
        '）へお問い合わせください。'
    : '픽업이나 도착 시간 변경은 호텔(' +
        telephone +
        ')로 문의해 주세요.'
}

export function getLocalizedMealPlanLabel(
  mealPlan: MealPlan,
  locale: SiteLocale,
): string {
  return localizedMealPlanLabels[mealPlan][locale]
}

export function getLocalizedCancellationPolicyLabel(
  policy: Pick<
    CancellationPolicy,
    | 'code'
    | 'descriptionJa'
    | 'feePercent'
    | 'isNoShow'
    | 'minDaysBefore'
    | 'maxDaysBefore'
  >,
  locale: SiteLocale,
): string {
  const knownLabel = cancellationPolicyLabels[policy.code]?.[locale]
  if (knownLabel) return knownLabel
  if (locale === 'ja') return policy.descriptionJa ?? policy.code
  if (policy.isNoShow) return '노쇼: 숙박요금의 ' + policy.feePercent + '%'

  const range =
    policy.minDaysBefore === policy.maxDaysBefore
      ? '체크인 ' + (policy.minDaysBefore ?? 0) + '일 전'
      : policy.maxDaysBefore === null
        ? '체크인 ' + (policy.minDaysBefore ?? 0) + '일 전까지'
        : '체크인 ' +
          policy.maxDaysBefore +
          '~' +
          (policy.minDaysBefore ?? 0) +
          '일 전'
  return policy.feePercent === 0
    ? range + ': 취소 수수료 무료'
    : range + ': 숙박요금의 ' + policy.feePercent + '%'
}

export function getLocalizedCancellationQuoteLabel(
  code: string,
  descriptionJa: string | null,
  feePercent: number,
  locale: SiteLocale,
): string {
  const knownLabel = cancellationPolicyLabels[code]?.[locale]
  if (knownLabel) return knownLabel
  if (locale === 'ja') return descriptionJa ?? code
  return '취소 수수료: 숙박요금의 ' + feePercent + '%'
}
