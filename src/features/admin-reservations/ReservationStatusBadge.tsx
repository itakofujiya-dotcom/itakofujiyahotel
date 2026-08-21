import { reservationStatusLabels } from './reservation-helpers'
import type { ReservationStatus } from './types'

export function ReservationStatusBadge({
  status,
  compact = false,
}: {
  status: ReservationStatus
  compact?: boolean
}) {
  return (
    <span
      className={`inline-flex items-center rounded bg-stone-100 font-semibold text-ink ${compact ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs'}`}
    >
      {reservationStatusLabels[status]}
    </span>
  )
}
