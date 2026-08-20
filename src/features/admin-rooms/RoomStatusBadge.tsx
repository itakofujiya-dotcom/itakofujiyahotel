import { getRoomSalesStatusLabel } from './room-helpers'
import type { RoomSalesStatus } from './types'

const statusStyles: Record<RoomSalesStatus, string> = {
  active: 'bg-green-100 text-green-800',
  inactive: 'bg-stone-200 text-stone-700',
  admin_only: 'bg-blue-100 text-blue-800',
  maintenance: 'bg-amber-100 text-amber-900',
}

export function RoomStatusBadge({ status }: { status: RoomSalesStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      {getRoomSalesStatusLabel(status)}
    </span>
  )
}
