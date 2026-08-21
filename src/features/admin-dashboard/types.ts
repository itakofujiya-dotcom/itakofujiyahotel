export type DashboardMetrics = {
  todayCheckIns: number
  todayCheckOuts: number
  staying: number
  newReservations: number
  pendingReservations: number
  pendingPayments: number
}

export type DashboardMetricKey = keyof DashboardMetrics
