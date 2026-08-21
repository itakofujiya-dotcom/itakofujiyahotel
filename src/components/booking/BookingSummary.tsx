import { formatYen } from '../../features/admin-rates/rate-helpers'
import {
  formatBookingDate,
  getStayNights,
} from '../../features/booking/booking-format'
import type { BookingDraft } from '../../features/booking/types'

export function BookingSummary({ booking }: { booking: BookingDraft }) {
  const paidGuests = booking.adults + booking.paidChildren
  return (
    <aside className="border border-line bg-surface p-6 shadow-soft lg:sticky lg:top-24">
      <p className="eyebrow">RESERVATION SUMMARY</p>
      <h2 className="font-serif text-2xl">ご予約内容</h2>
      <dl className="mt-5 space-y-4 text-sm">
        <SummaryRow
          label="チェックイン"
          value={formatBookingDate(booking.checkIn)}
        />
        <SummaryRow
          label="チェックアウト"
          value={formatBookingDate(booking.checkOut)}
        />
        <SummaryRow
          label="宿泊数"
          value={`${getStayNights(booking.checkIn, booking.checkOut)}泊`}
        />
        <SummaryRow
          label="客室タイプ"
          value={booking.selectedRoomType.nameJa}
        />
        <SummaryRow label="客室数" value={`${booking.roomCount}室`} />
        <SummaryRow
          label="宿泊人数"
          value={`有料 ${paidGuests}名${booking.freePreschoolChildren ? ` · 添い寝 ${booking.freePreschoolChildren}名` : ''}`}
        />
      </dl>
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
