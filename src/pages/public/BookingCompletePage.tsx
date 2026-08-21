import { useEffect, useState } from 'react'
import { BookingMissing } from '../../components/booking/BookingMissing'
import { BookingSteps } from '../../components/booking/BookingSteps'
import { ButtonLink } from '../../components/common/ButtonLink'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import { getPublicBookingInformation } from '../../features/booking/booking-api'
import { formatBookingDate } from '../../features/booking/booking-format'
import { readBookingCompletion } from '../../features/booking/storage'
import type { PublicHotelInfo } from '../../features/booking/types'
import { hotelSettings } from '../../data/hotel'

export function BookingCompletePage() {
  const [completion] = useState(readBookingCompletion)
  const [hotel, setHotel] = useState<PublicHotelInfo>({
    telephone: hotelSettings.telephone,
    checkInTime: hotelSettings.checkIn,
    frontDeskOpen: hotelSettings.frontDeskOpen,
    frontDeskClose: hotelSettings.frontDeskClose,
  })

  useEffect(() => {
    void getPublicBookingInformation()
      .then((result) => setHotel(result.hotel))
      .catch(() => undefined)
  }, [])

  if (!completion) return <BookingMissing current={4} />

  return (
    <section className="page-shell py-12 lg:py-18">
      <BookingSteps current={4} />
      <div className="mx-auto max-w-3xl border border-line bg-surface p-6 text-center shadow-soft sm:p-10">
        <div
          className="mx-auto flex size-14 items-center justify-center rounded-full bg-green-100 text-2xl text-green-800"
          aria-hidden="true"
        >
          ✓
        </div>
        <p className="eyebrow mt-6">BOOKING COMPLETE</p>
        <h1 className="font-serif text-3xl sm:text-4xl">
          ご予約ありがとうございます。
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          ご予約内容を画面でご確認ください。
        </p>
        <div className="mt-7 bg-[#eee7d9] p-6">
          <p className="text-xs text-muted">予約番号</p>
          <p className="mt-2 break-all text-2xl font-bold tracking-wide sm:text-3xl">
            {completion.reservationNumber}
          </p>
          <p className="mt-3 text-xs leading-6 text-muted">
            予約確認・キャンセルの際に予約番号が必要です。大切に保管してください。
          </p>
        </div>
        <dl className="mx-auto mt-8 grid max-w-xl gap-5 text-left sm:grid-cols-2">
          <CompleteRow
            label="チェックイン"
            value={formatBookingDate(completion.checkIn)}
          />
          <CompleteRow
            label="チェックアウト"
            value={formatBookingDate(completion.checkOut)}
          />
          <CompleteRow label="客室タイプ" value={completion.roomTypeName} />
          <CompleteRow label="客室数" value={`${completion.roomCount}室`} />
          <CompleteRow
            label="宿泊人数"
            value={`大人 ${completion.adults}名 · 子ども ${completion.paidChildren}名 · 添い寝 ${completion.freePreschoolChildren}名`}
          />
          <CompleteRow
            label="予約料金"
            value={formatYen(completion.totalAmountYen)}
          />
          <CompleteRow label="お支払い方法" value="現地払い" />
          <CompleteRow label="予約状態" value="予約確定" />
          <CompleteRow
            label="チェックイン時間"
            value={`${hotel.checkInTime.slice(0, 5)}から`}
          />
          <CompleteRow label="ホテル電話番号" value={hotel.telephone} />
        </dl>
        <div className="mt-8 border-t border-line pt-6">
          <p className="font-semibold">
            お支払いはホテルにてお願いいたします。
          </p>
          <p className="mt-3 text-sm leading-7 text-muted">
            送迎や到着時間の変更は、ホテル（{hotel.telephone}
            ）へお問い合わせください。
          </p>
        </div>
        <ButtonLink to="/" className="mt-8">
          トップページへ
        </ButtonLink>
      </div>
    </section>
  )
}

function CompleteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line pb-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  )
}
