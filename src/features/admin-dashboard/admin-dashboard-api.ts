import { supabase } from '../../lib/supabase/client'
import { fetchNewOnlineReservationCount } from '../admin-reservations/admin-reservations-api'
import type { DashboardMetrics } from './types'

type CountResult = {
  count: number | null
  error: { code: string; message: string } | null
}

export async function fetchDashboardMetrics(
  today: string,
): Promise<DashboardMetrics> {
  const [
    todayCheckIns,
    todayCheckOuts,
    staying,
    newReservations,
    pendingReservations,
    pendingPayments,
  ] = await Promise.all([
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('check_in', today)
      .not('status', 'in', '(cancelled,no_show,checked_out)'),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('check_out', today)
      .not('status', 'in', '(cancelled,no_show)'),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'checked_in')
      .lte('check_in', today)
      .gt('check_out', today),
    fetchNewOnlineReservationCount(),
    supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
    supabase
      .from('reservations')
      .select('id, payments!inner(method, status)', {
        count: 'exact',
        head: true,
      })
      .in('status', ['pending', 'confirmed', 'checked_in'])
      .eq('payments.method', 'bank_transfer')
      .eq('payments.status', 'pending'),
  ])

  return {
    todayCheckIns: requireCount(todayCheckIns, 'today check-ins'),
    todayCheckOuts: requireCount(todayCheckOuts, 'today check-outs'),
    staying: requireCount(staying, 'staying reservations'),
    newReservations,
    pendingReservations: requireCount(
      pendingReservations,
      'pending reservations',
    ),
    pendingPayments: requireCount(pendingPayments, 'pending payments'),
  }
}

function requireCount(result: CountResult, operation: string): number {
  if (result.error || result.count === null) {
    if (result.error)
      console.error(`[Admin dashboard] Failed to load ${operation}.`, {
        code: result.error.code,
        message: result.error.message,
      })
    throw new Error('DASHBOARD_COUNT_FAILED')
  }
  return result.count
}
