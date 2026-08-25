import type { CancellationPolicy, MealPlan } from './types'
import type { SiteLocale } from '../../i18n/public-translations'
import { formatBookingDate } from './booking-format'

const roomTypeLabels = {
  和室: { ja: '和室', ko: '다다미방' },
  洋室: { ja: '洋室', ko: '침대방' },
} as const

const localizedMealPlanLabels: Record<MealPlan, Record<SiteLocale, string>> = {
  breakfast: { ja: '朝食付き', ko: '조식 포함' },
  breakfast_dinner: { ja: '朝食・夕食付き', ko: '조식·석식 포함' },
}

const cancellationPolicyLabels: Record<string, Record<SiteLocale, string>> = {
  free_7_plus: {
    ja: '宿泊日の8日前まで：キャンセル料無料',
    ko: '체크인 8일 전까지: 취소 수수료 무료',
  },
  days_6_to_4: {
    ja: '宿泊日の4日前：宿泊料金の30％',
    ko: '체크인 4일 전: 숙박요금의 30%',
  },
  days_3_to_2: {
    ja: '宿泊日の2日前：宿泊料金の50％',
    ko: '체크인 2일 전: 숙박요금의 50%',
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
    : '픽업이나 도착 시간 변경은 호텔(' + telephone + ')로 문의해 주세요.'
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

export function getLocalizedReservationStatusLabel(
  value: string,
  locale: SiteLocale,
): string {
  const labels =
    locale === 'ko'
      ? {
          pending: '확인 대기',
          confirmed: '예약 확정',
          cancelled: '취소 완료',
          checked_in: '체크인 완료',
          checked_out: '체크아웃 완료',
          no_show: '노쇼',
        }
      : {
          pending: '確認待ち',
          confirmed: '予約確定',
          cancelled: 'キャンセル済み',
          checked_in: 'チェックイン済み',
          checked_out: 'チェックアウト済み',
          no_show: '無連絡不泊',
        }
  return labels[value as keyof typeof labels] || value
}

export function getLocalizedPaymentMethodLabel(
  value: string,
  locale: SiteLocale,
): string {
  const labels =
    locale === 'ko'
      ? { pay_at_hotel: '현장결제', bank_transfer: '계좌이체', card: '카드' }
      : { pay_at_hotel: '現地払い', bank_transfer: '銀行振込', card: 'カード' }
  return labels[value as keyof typeof labels] || value
}

export function getLocalizedPaymentStatusLabel(
  value: string,
  locale: SiteLocale,
): string {
  const labels =
    locale === 'ko'
      ? {
          pending: '미결제',
          awaiting_payment: '입금 대기',
          paid: '결제 완료',
          refunded: '환불 완료',
          cancelled: '결제 취소',
        }
      : {
          pending: '未払い',
          awaiting_payment: '入金待ち',
          paid: '支払い済み',
          refunded: '返金済み',
          cancelled: '支払い取消',
        }
  return labels[value as keyof typeof labels] || value
}

export function formatLocalizedYen(value: number, locale: SiteLocale): string {
  return `${new Intl.NumberFormat(locale === 'ko' ? 'ko-KR' : 'ja-JP').format(value)}${locale === 'ko' ? '엔' : '円'}`
}

export function formatLocalizedCount(
  value: number,
  kind: 'nights' | 'rooms' | 'people',
  locale: SiteLocale,
): string {
  const units =
    locale === 'ko'
      ? { nights: '박', rooms: '실', people: '명' }
      : { nights: '泊', rooms: '室', people: '名' }
  return `${value}${units[kind]}`
}

export function buildLocalizedCancellationDescription(
  reservation: {
    reservationNumber: string
    checkIn: string
    totalAmountYen: number
    feePercent: number | null
    feeYen: number | null
    refundTargetYen: number | null
    rooms: Array<{ roomIndex: number; roomTypeNameJa: string }>
  },
  locale: SiteLocale,
): string {
  const ko = locale === 'ko'
  if (
    reservation.feePercent === null ||
    reservation.feeYen === null ||
    reservation.refundTargetYen === null
  )
    return ko
      ? '온라인 취소 기간이 지났습니다. 호텔로 문의해 주세요.'
      : 'オンラインキャンセル受付期間を過ぎています。ホテルへお問い合わせください。'
  const rooms = reservation.rooms
    .map(
      (room) =>
        `${ko ? '객실' : '客室'} ${room.roomIndex + 1} ${getLocalizedRoomTypeName(room.roomTypeNameJa, locale)}`,
    )
    .join('・')
  return `${ko ? '예약번호' : '予約番号'}\n${reservation.reservationNumber}\n\n${ko ? '체크인' : 'チェックイン'}\n${formatBookingDate(reservation.checkIn, locale)}\n\n${ko ? '취소 대상 객실' : 'キャンセル対象客室'}\n${rooms}\n\n${ko ? '예약 총액' : '予約総額'}: ${formatLocalizedYen(reservation.totalAmountYen, locale)}\n${ko ? '취소 수수료율' : 'キャンセル料率'}: ${reservation.feePercent}%\n${ko ? '취소 수수료' : 'キャンセル料'}: ${formatLocalizedYen(reservation.feeYen, locale)}\n${ko ? '환불 예정 금액' : '返金予定額'}: ${formatLocalizedYen(reservation.refundTargetYen, locale)}\n\n${ko ? '이 작업은 되돌릴 수 없습니다.' : 'この操作は取り消せません。'}`
}
