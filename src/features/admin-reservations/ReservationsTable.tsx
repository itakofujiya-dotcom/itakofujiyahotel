import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { formatYen } from '../admin-rates/rate-helpers'
import {
  bookingSourceLabels,
  reservationStatusLabels,
} from './reservation-helpers'
import type { ReservationListItem } from './types'

export function ReservationsTable({
  reservations,
}: {
  reservations: ReservationListItem[]
}) {
  if (reservations.length === 0)
    return (
      <div className="border border-dashed border-line bg-surface p-12 text-center">
        <h2 className="font-semibold">予約はまだありません。</h2>
        <p className="mt-3 text-sm text-muted">
          条件に一致する予約データがありません。
        </p>
      </div>
    )
  return (
    <div className="overflow-x-auto border border-line bg-surface">
      <table className="min-w-[1200px] w-full text-left text-sm">
        <thead className="border-b border-line bg-background text-xs text-muted">
          <tr>
            {[
              '予約番号',
              '予約者',
              'チェックイン',
              'チェックアウト',
              '客室タイプ',
              '人数',
              '予約経路',
              '予約状態',
              '合計金額',
              '作成日時',
              '操作',
            ].map((label) => (
              <th key={label} className="px-4 py-3 font-semibold">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {reservations.map((reservation) => (
            <tr
              key={reservation.id}
              className="border-b border-line last:border-b-0"
            >
              <td className="px-4 py-4 font-medium">
                {reservation.reservation_number}
                {reservation.booking_source === 'online' &&
                  !reservation.admin_seen_at && (
                    <span className="ml-2 rounded bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                      NEW
                    </span>
                  )}
              </td>
              <td className="px-4 py-4">{reservation.guest.name}</td>
              <td className="px-4 py-4">
                {reservation.check_in.replaceAll('-', '/')}
              </td>
              <td className="px-4 py-4">
                {reservation.check_out.replaceAll('-', '/')}
              </td>
              <td className="px-4 py-4">
                {reservation.rooms
                  .map((room) => room.room_type.name_ja)
                  .join('・')}{' '}
                × {reservation.rooms.length}
              </td>
              <td className="px-4 py-4">
                {reservation.adults + reservation.paid_children}名
              </td>
              <td className="px-4 py-4">
                {bookingSourceLabels[reservation.booking_source]}
              </td>
              <td className="px-4 py-4">
                <span className="rounded bg-stone-100 px-2 py-1 text-xs">
                  {reservationStatusLabels[reservation.status]}
                </span>
              </td>
              <td className="px-4 py-4">
                {formatYen(reservation.total_amount_yen ?? 0)}
              </td>
              <td className="px-4 py-4 text-xs">
                {format(new Date(reservation.created_at), 'yyyy/MM/dd HH:mm')}
              </td>
              <td className="px-4 py-4">
                <Link
                  to={`/admin/reservations/${reservation.id}`}
                  className="font-semibold text-accent"
                >
                  詳細
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
