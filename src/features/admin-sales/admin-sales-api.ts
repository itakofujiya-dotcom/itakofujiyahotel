import { supabase } from '../../lib/supabase/client'
import type { Database, Json } from '../../types/database'
import type {
  PaymentMethod,
  PaymentStatus,
  ReservationStatus,
} from '../admin-reservations/types'
import { salesPageSize } from './sales-helpers'
import type {
  SalesDateRange,
  SalesDetail,
  SalesPaymentFilter,
  SalesPaymentMethodSummary,
  SalesReport,
  SalesRoomSummary,
  SalesSort,
  SalesStatusFilter,
  SalesSummary,
} from './types'

export async function fetchAdminSalesReport({
  range,
  paymentMethod,
  status,
  sort,
  page,
  pageSize = salesPageSize,
}: {
  range: SalesDateRange
  paymentMethod: SalesPaymentFilter
  status: SalesStatusFilter
  sort: SalesSort
  page: number
  pageSize?: number
}): Promise<SalesReport> {
  const method = paymentMethod === 'all' ? null : paymentMethod
  const [summaryResult, detailsResult] = await Promise.all([
    supabase.rpc('get_admin_sales_summary', {
      p_start_date: range.startDate,
      p_end_date: range.endDate,
      p_payment_method: method,
    }),
    supabase.rpc('get_admin_sales_details', {
      p_start_date: range.startDate,
      p_end_date: range.endDate,
      p_payment_method: method,
      p_status_filter: status,
      p_sort: sort,
      p_page: page,
      p_page_size: pageSize,
    }),
  ])

  if (summaryResult.error || detailsResult.error) {
    const error = summaryResult.error ?? detailsResult.error!
    console.error('[Admin sales] Failed to load sales report.', {
      code: error.code,
      message: error.message,
    })
    throw new Error(`SALES_${error.code}`)
  }

  return {
    summary: parseSummary(summaryResult.data),
    details: detailsResult.data.map(parseDetail),
    totalCount: Number(detailsResult.data[0]?.total_count ?? 0),
  }
}

function parseSummary(value: Json): SalesSummary {
  const summary = asRecord(value)
  const paymentMethods = Array.isArray(summary.paymentMethods)
    ? summary.paymentMethods.map(parsePaymentMethodSummary)
    : []
  return {
    reservationRevenueYen: asNumber(summary.reservationRevenueYen),
    collectedYen: asNumber(summary.collectedYen),
    reservationCount: asNumber(summary.reservationCount),
    completedStayCount: asNumber(summary.completedStayCount),
    cancellationFeeYen: asNumber(summary.cancellationFeeYen),
    refundTargetYen: asNumber(summary.refundTargetYen),
    paymentMethods,
  }
}

function parsePaymentMethodSummary(value: Json): SalesPaymentMethodSummary {
  const summary = asRecord(value)
  return {
    method: asPaymentMethod(summary.method),
    reservationRevenueYen: asNumber(summary.reservationRevenueYen),
    collectedYen: asNumber(summary.collectedYen),
    reservationCount: asNumber(summary.reservationCount),
  }
}

type SalesDetailRow =
  Database['public']['Functions']['get_admin_sales_details']['Returns'][number]

function parseDetail(detail: SalesDetailRow): SalesDetail {
  return {
    reservationId: detail.reservation_id,
    eventDate: detail.event_date,
    reservationNumber: detail.reservation_number,
    guestName: detail.guest_name,
    checkIn: detail.check_in,
    checkOut: detail.check_out,
    rooms: parseRooms(detail.rooms),
    paymentMethod:
      detail.payment_method === null
        ? null
        : asPaymentMethod(detail.payment_method),
    paymentStatus:
      detail.payment_status === null
        ? null
        : asPaymentStatus(detail.payment_status),
    reservationStatus: asReservationStatus(detail.reservation_status),
    reservationAmountYen: Number(detail.reservation_amount_yen),
    recognizedRevenueYen: Number(detail.recognized_revenue_yen),
    collectedYen: Number(detail.collected_yen),
    cancellationFeeYen: Number(detail.cancellation_fee_yen),
    refundTargetYen: Number(detail.refund_target_yen),
    paymentIssue:
      detail.payment_issue === 'missing' || detail.payment_issue === 'multiple'
        ? detail.payment_issue
        : null,
  }
}

function parseRooms(value: Json): SalesRoomSummary[] {
  if (!Array.isArray(value)) return []
  return value.map((room) => {
    const item = asRecord(room)
    return {
      roomTypeNameJa: asString(item.roomTypeNameJa),
      roomCount: asNumber(item.roomCount),
    }
  })
}

function asRecord(value: Json): Record<string, Json | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('INVALID_SALES_RESPONSE')
  return value
}

function asString(value: Json | undefined): string {
  if (typeof value !== 'string') throw new Error('INVALID_SALES_RESPONSE')
  return value
}

function asNumber(value: Json | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('INVALID_SALES_RESPONSE')
  return value
}

function asPaymentMethod(value: Json | undefined): PaymentMethod {
  if (!['pay_at_hotel', 'bank_transfer', 'card'].includes(String(value)))
    throw new Error('INVALID_SALES_PAYMENT_METHOD')
  return value as PaymentMethod
}

function asPaymentStatus(value: string): PaymentStatus {
  if (
    !['pending', 'awaiting_payment', 'paid', 'refunded', 'cancelled'].includes(
      value,
    )
  )
    throw new Error('INVALID_SALES_PAYMENT_STATUS')
  return value as PaymentStatus
}

function asReservationStatus(value: string): ReservationStatus {
  if (
    ![
      'pending',
      'confirmed',
      'cancelled',
      'checked_in',
      'checked_out',
      'no_show',
    ].includes(value)
  )
    throw new Error('INVALID_SALES_RESERVATION_STATUS')
  return value as ReservationStatus
}
