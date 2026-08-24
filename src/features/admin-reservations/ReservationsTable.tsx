import { format } from 'date-fns'
import { Link } from 'react-router-dom'
import { GuestNameWithKana } from '../../components/admin/GuestNameWithKana'
import { formatYen } from '../admin-rates/rate-helpers'
import {
  bookingSourceLabels,
  isNewOnlineReservation,
} from './reservation-helpers'
import type { ReservationListItem } from './types'
import { NewReservationBadge } from './NewReservationBadge'
import { PaymentStatusBadge } from './PaymentStatusBadge'
import { ReservationStatusBadge } from './ReservationStatusBadge'
import { mealPlanLabels } from '../booking/meal-plan'

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
      <table className="min-w-[1280px] w-full text-left text-sm">
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
              '支払い',
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
                <span className="flex items-center gap-2">
                  {isNewOnlineReservation(reservation) && (
                    <NewReservationBadge />
                  )}
                  <span>{reservation.reservation_number}</span>
                </span>
              </td>
              <td className="px-4 py-4">
                <GuestNameWithKana
                  name={reservation.guest.name}
                  nameKanaOrRoman={reservation.guest.name_kana_or_roman}
                />
              </td>
              <td className="px-4 py-4">
                {reservation.check_in.replaceAll('-', '/')}
              </td>
              <td className="px-4 py-4">
                {reservation.check_out.replaceAll('-', '/')}
              </td>
              <td className="px-4 py-4">
                <div className="space-y-1">
                  {reservation.rooms.map((room) => (
                    <p key={room.id}>
                      {room.room_type.name_ja} ·{' '}
                      <span className="text-xs text-muted">
                        {mealPlanLabels[room.meal_plan]}
                      </span>
                    </p>
                  ))}
                </div>
              </td>
              <td className="px-4 py-4">
                {reservation.adults + reservation.paid_children}名
              </td>
              <td className="px-4 py-4">
                {bookingSourceLabels[reservation.booking_source]}
              </td>
              <td className="px-4 py-4">
                <ReservationStatusBadge status={reservation.status} />
              </td>
              <td className="px-4 py-4">
                {reservation.payment ? (
                  <PaymentStatusBadge status={reservation.payment.status} />
                ) : (
                  <span className="text-xs font-semibold text-red-700">
                    要確認
                  </span>
                )}
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
