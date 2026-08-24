import { formatYen } from '../../features/admin-rates/rate-helpers'
import {
  formatBookingDate,
  getStayNights,
} from '../../features/booking/booking-format'
import type { BookingDraft } from '../../features/booking/types'
import { mealPlanLabels } from '../../features/booking/meal-plan'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'

export function BookingSummary({ booking }: { booking: BookingDraft }) {
  const { locale } = useSiteTranslation()
  const paidGuests = booking.adults + booking.paidChildren
  return (
    <aside className="border border-line bg-surface p-6 shadow-soft lg:sticky lg:top-24">
      <p className="eyebrow">RESERVATION SUMMARY</p>
      <h2 className="font-serif text-2xl">ご予約内容</h2>
      <dl className="mt-5 space-y-4 text-sm">
        <SummaryRow
          label="チェックイン"
          value={formatBookingDate(booking.checkIn, locale)}
        />
        <SummaryRow
          label="チェックアウト"
          value={formatBookingDate(booking.checkOut, locale)}
        />
        <SummaryRow
          label="宿泊数"
          value={`${getStayNights(booking.checkIn, booking.checkOut)}泊`}
        />
        <SummaryRow label="客室数" value={`${booking.roomCount}室`} />
        <SummaryRow
          label="宿泊人数"
          value={`有料 ${paidGuests}名${booking.freePreschoolChildren ? ` · 添い寝 ${booking.freePreschoolChildren}名` : ''}`}
        />
      </dl>
      <div className="mt-5 space-y-3 border-t border-line pt-4 text-sm">
        {booking.rooms.map((room) => (
          <div key={room.roomIndex}>
            <p className="font-semibold">
              客室 {room.roomIndex + 1} · {room.roomTypeNameJa}
            </p>
            <p className="mt-1 text-xs text-muted">
              大人 {room.adultGuestCount}名 · 子ども {room.paidChildCount}名 ·{' '}
              {mealPlanLabels[room.mealPlan]}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 border-t border-line pt-5">
        <p className="text-xs text-muted">予定料金</p>
        <p className="mt-1 text-2xl font-semibold">
          {formatYen(booking.totalAmountYen)}
        </p>
      </div>
    </aside>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  )
}
