import { supabase } from '../../lib/supabase/client'
import { calculateCustomerStats } from './customer-helpers'
import type {
  CustomerDetail,
  CustomerReservationHistory,
  CustomerSort,
  CustomerStats,
  CustomerSummary,
} from './types'

export const customerPageSize = 20

export async function fetchCustomers({
  search,
  sort,
  page,
}: {
  search: string
  sort: CustomerSort
  page: number
}): Promise<{ customers: CustomerSummary[]; totalCount: number }> {
  const { data, error } = await supabase.rpc('get_admin_customers', {
    p_search: search,
    p_sort: sort,
    p_page: page,
    p_page_size: customerPageSize,
  })
  if (error) throwCustomerError('load customers', error)
  return {
    customers: data.map((customer) => ({
      id: customer.id,
      name: customer.name,
      nameKanaOrRoman: customer.name_kana_or_roman,
      phone: customer.phone,
      email: customer.email,
      memo: customer.memo,
      totalReservations: Number(customer.total_reservations),
      completedStays: Number(customer.completed_stays),
      firstVisit: customer.first_visit,
      recentVisit: customer.recent_visit,
      totalNights: Number(customer.total_nights),
      averageVisitIntervalDays:
        customer.average_visit_interval_days === null
          ? null
          : Number(customer.average_visit_interval_days),
    })),
    totalCount: Number(data[0]?.total_count ?? 0),
  }
}

export async function fetchCustomerDetail(
  customerId: string,
): Promise<CustomerDetail> {
  const [customerResult, reservationsResult] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, name_kana_or_roman, phone, email, memo')
      .eq('id', customerId)
      .single(),
    supabase
      .from('reservations')
      .select(
        `
        id, reservation_number, check_in, check_out, status,
        rooms:reservation_rooms (room_type:room_types (name_ja)),
        payments (method, status)
      `,
      )
      .eq('customer_id', customerId)
      .order('check_in', { ascending: false }),
  ])
  if (customerResult.error || reservationsResult.error)
    throwCustomerError(
      'load customer detail',
      customerResult.error ?? reservationsResult.error!,
    )

  const reservations: CustomerReservationHistory[] =
    reservationsResult.data.map((reservation) => ({
      id: reservation.id,
      reservation_number: reservation.reservation_number,
      check_in: reservation.check_in,
      check_out: reservation.check_out,
      status: reservation.status,
      rooms: reservation.rooms,
      payment:
        reservation.payments.length === 1 ? reservation.payments[0] : null,
    }))
  const stats = calculateCustomerStats(reservations)
  const { name_kana_or_roman: nameKanaOrRoman, ...customer } =
    customerResult.data
  return {
    ...customer,
    nameKanaOrRoman,
    ...stats,
    reservations,
  }
}

export async function fetchCustomerVisitStats(
  customerId: string,
): Promise<CustomerStats> {
  const { data, error } = await supabase
    .from('reservations')
    .select('check_in, check_out, status')
    .eq('customer_id', customerId)
  if (error) throwCustomerError('load customer visit stats', error)
  return calculateCustomerStats(data)
}

export async function updateCustomerMemo(
  customerId: string,
  memo: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('customers')
    .update({ memo: memo.trim() || null })
    .eq('id', customerId)
    .select('id')
  if (error) throwCustomerError('update customer memo', error)
  if (data.length !== 1) throw new Error('CUSTOMER_MEMO_NOT_UPDATED')
}

function throwCustomerError(
  operation: string,
  error: { code: string; message: string },
): never {
  console.error(`[Admin customers] Failed to ${operation}.`, {
    code: error.code,
    message: error.message,
  })
  throw new Error(`CUSTOMER_${error.code}`)
}
