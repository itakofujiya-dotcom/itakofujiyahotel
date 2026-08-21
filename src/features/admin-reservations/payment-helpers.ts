import type {
  PaymentMethod,
  PaymentStatus,
  ReservationPayment,
  ReservationStatus,
} from './types'

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  pay_at_hotel: '現地払い',
  bank_transfer: '銀行振込',
  card: 'カード',
}

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: '未払い',
  awaiting_payment: '入金待ち',
  paid: '支払い済み',
  refunded: '返金済み',
  cancelled: '支払い取消',
}

export type PaymentAction = 'mark_paid' | 'restore_unpaid' | 'mark_refunded'

export function getRestorePaymentStatus(method: PaymentMethod): PaymentStatus {
  return method === 'bank_transfer' ? 'awaiting_payment' : 'pending'
}

export function getAllowedPaymentActions(
  payment: Pick<ReservationPayment, 'status'>,
): PaymentAction[] {
  if (['pending', 'awaiting_payment'].includes(payment.status))
    return ['mark_paid']
  if (payment.status === 'paid') return ['restore_unpaid', 'mark_refunded']
  return []
}

export function getPaymentActionTarget(
  payment: Pick<ReservationPayment, 'method' | 'status'>,
  action: PaymentAction,
): PaymentStatus | null {
  if (
    action === 'mark_paid' &&
    ['pending', 'awaiting_payment'].includes(payment.status)
  )
    return 'paid'
  if (payment.status !== 'paid') return null
  if (action === 'restore_unpaid')
    return getRestorePaymentStatus(payment.method)
  if (action === 'mark_refunded') return 'refunded'
  return null
}

export function isPaymentOutstanding(
  payment: Pick<ReservationPayment, 'status'> | null,
): boolean {
  return Boolean(
    payment && ['pending', 'awaiting_payment'].includes(payment.status),
  )
}

export function getPaymentWarning(
  reservationStatus: ReservationStatus,
  payment: Pick<ReservationPayment, 'status'> | null,
): { title: string; description: string } | null {
  if (reservationStatus === 'cancelled' && payment?.status === 'paid')
    return {
      title: '返金対応が必要です',
      description:
        '支払い済みの予約がキャンセルされています。返金対応後に返金済みとして記録してください。',
    }
  if (reservationStatus === 'checked_in' && isPaymentOutstanding(payment))
    return {
      title: '未払いです',
      description: 'チェックアウト前に支払い状況を確認してください。',
    }
  return null
}

export function formatJapanDateTime(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
