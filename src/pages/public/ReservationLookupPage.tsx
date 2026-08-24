import { useState, type FormEvent } from 'react'
import { PageHero } from '../../components/common/PageHero'
import { RateConfirmDialog } from '../../features/admin-rates/RateConfirmDialog'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import { mealPlanLabels } from '../../features/booking/meal-plan'
import { formatBookingDate } from '../../features/booking/booking-format'
import {
  cancelPublicReservation,
  lookupPublicReservation,
  PublicReservationError,
} from '../../features/public-reservation/public-reservation-api'
import type { PublicReservationLookup } from '../../features/public-reservation/types'
import type { SiteLocale } from '../../i18n/public-translations'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'

const reservationStatusLabels = {
  pending: '確認待ち',
  confirmed: '予約確定',
  cancelled: 'キャンセル済み',
  checked_in: 'チェックイン済み',
  checked_out: 'チェックアウト済み',
  no_show: '無連絡不泊',
} as const

const paymentMethodLabels = {
  pay_at_hotel: '現地払い',
  bank_transfer: '銀行振込',
  card: 'カード',
} as const

const paymentStatusLabels = {
  pending: '未払い',
  awaiting_payment: '入金待ち',
  paid: '支払い済み',
  refunded: '返金済み',
  cancelled: '支払い取消',
} as const

export function ReservationLookupPage() {
  const { locale } = useSiteTranslation()
  const [reservationNumber, setReservationNumber] = useState('')
  const [contact, setContact] = useState('')
  const [reservation, setReservation] =
    useState<PublicReservationLookup | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reservationNumber.trim() || !contact.trim()) {
      setError('予約番号とメールアドレスまたは電話番号を入力してください。')
      return
    }
    setIsLoading(true)
    setError(null)
    setSuccess(null)
    setReservation(null)
    try {
      setReservation(
        await lookupPublicReservation({ reservationNumber, contact }),
      )
    } catch {
      setError(
        '予約情報を確認できませんでした。予約番号と連絡先をご確認ください。',
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function cancelReservation() {
    if (!reservation || isCancelling) return
    setIsCancelling(true)
    setError(null)
    try {
      await cancelPublicReservation({ reservationNumber, contact })
      const refreshed = await lookupPublicReservation({
        reservationNumber,
        contact,
      })
      setReservation(refreshed)
      setShowCancelDialog(false)
      setSuccess(
        '予約をキャンセルしました。客室は再び販売可能な状態になりました。',
      )
    } catch (cancelError) {
      setShowCancelDialog(false)
      if (
        cancelError instanceof PublicReservationError &&
        cancelError.code === 'ALREADY_CANCELLED'
      )
        setError('この予約はすでにキャンセルされています。')
      else if (
        cancelError instanceof PublicReservationError &&
        cancelError.code === 'RESERVATION_NOT_CANCELLABLE'
      )
        setError('現在の予約状態ではキャンセルできません。')
      else
        setError(
          '予約をキャンセルできませんでした。時間をおいて再度お試しください。',
        )
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <>
      <PageHero
        eyebrow="RESERVATION"
        title="予約確認・キャンセル"
        description="予約番号とご予約時の連絡先を入力してください。"
      />
      <section className="page-shell py-14 lg:py-20">
        <form
          onSubmit={(event) => void lookup(event)}
          className="mx-auto max-w-3xl border border-line bg-surface p-6 shadow-soft sm:p-8"
          noValidate
        >
          <h1 className="font-serif text-2xl">ご予約を確認する</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            予約番号だけでは照会できません。ご予約時のメールアドレスまたは電話番号も入力してください。
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-semibold text-muted">
                予約番号
              </span>
              <input
                className="admin-input"
                value={reservationNumber}
                onChange={(event) => setReservationNumber(event.target.value)}
                placeholder="IFH-20260821-001"
                autoComplete="off"
              />
            </label>
            <label>
              <span className="mb-2 block text-xs font-semibold text-muted">
                メールアドレスまたは電話番号
              </span>
              <input
                className="admin-input"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="guest@example.com / 090-1234-5678"
                autoComplete="email"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 min-h-12 bg-accent px-7 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isLoading ? '確認しています...' : '予約を確認'}
          </button>
        </form>

        {error && (
          <p
            className="mx-auto mt-6 max-w-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            role="alert"
          >
            {error}
          </p>
        )}
        {success && (
          <p
            className="mx-auto mt-6 max-w-3xl border border-green-200 bg-green-50 p-5 text-sm text-green-800"
            role="status"
          >
            {success}
          </p>
        )}
        {reservation && (
          <ReservationResult
            reservation={reservation}
            locale={locale}
            onCancel={() => setShowCancelDialog(true)}
          />
        )}
      </section>

      {showCancelDialog && reservation && (
        <RateConfirmDialog
          title="予約をキャンセルしますか？"
          description={buildCancellationDescription(reservation, locale)}
          confirmLabel="キャンセルを確定"
          cancelLabel="戻る"
          destructive
          isMutating={isCancelling}
          onCancel={() => setShowCancelDialog(false)}
          onConfirm={() => void cancelReservation()}
        />
      )}
    </>
  )
}

function ReservationResult({
  reservation,
  locale,
  onCancel,
}: {
  reservation: PublicReservationLookup
  locale: SiteLocale
  onCancel: () => void
}) {
  return (
    <div className="mx-auto mt-8 max-w-3xl space-y-6">
      <section className="border border-line bg-surface p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">予約番号</p>
            <h2 className="mt-1 text-xl font-bold">
              {reservation.reservationNumber}
            </h2>
          </div>
          <span className="bg-[#eee7d9] px-3 py-1 text-xs font-semibold">
            {reservationStatusLabels[reservation.reservationStatus]}
          </span>
        </div>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <ResultRow label="予約者" value={reservation.guestName} />
          <ResultRow
            label="宿泊期間"
            value={`${formatBookingDate(reservation.checkIn, locale)}〜${formatBookingDate(reservation.checkOut, locale)}`}
          />
          <ResultRow
            label="お支払い方法"
            value={
              reservation.paymentMethod
                ? paymentMethodLabels[reservation.paymentMethod]
                : '要確認'
            }
          />
          <ResultRow
            label="お支払い状態"
            value={
              reservation.paymentStatus
                ? paymentStatusLabels[reservation.paymentStatus]
                : '要確認'
            }
          />
          <ResultRow
            label="予約料金"
            value={formatYen(reservation.totalAmountYen)}
          />
        </dl>
      </section>

      <section className="border border-line bg-surface p-6 shadow-soft sm:p-8">
        <h2 className="font-serif text-xl">客室情報</h2>
        <div className="mt-5 divide-y divide-line">
          {reservation.rooms.map((room) => (
            <div key={room.roomIndex} className="py-4 first:pt-0">
              <p className="font-semibold">
                客室 {room.roomIndex + 1} · {room.roomTypeNameJa}
              </p>
              <p className="mt-2 text-sm text-muted">
                大人 {room.adultGuestCount}名 · 子ども {room.paidChildCount}名 ·
                添い寝 {room.freePreschoolCount}名
              </p>
              <p className="mt-1 text-sm">{mealPlanLabels[room.mealPlan]}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-line bg-surface p-6 shadow-soft sm:p-8">
        <h2 className="font-serif text-xl">キャンセルについて</h2>
        <p className="mt-4 text-sm leading-7">
          {reservation.policyDescriptionJa ?? reservation.policyCode}
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <ResultRow
            label={
              reservation.reservationStatus === 'cancelled'
                ? '適用済みキャンセル率'
                : '現在のキャンセル率'
            }
            value={`${reservation.feePercent}%`}
          />
          <ResultRow
            label={
              reservation.reservationStatus === 'cancelled'
                ? '確定キャンセル料'
                : '現在のキャンセル料'
            }
            value={formatYen(reservation.feeYen)}
          />
          <ResultRow
            label="返金対象額"
            value={formatYen(reservation.refundTargetYen)}
          />
        </dl>
        {reservation.refundTargetYen > 0 && (
          <p className="mt-4 border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            返金対象額は自動では返金されません。ホテルでの確認後、別途返金対応を行います。
          </p>
        )}
        {reservation.cancellable ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-6 min-h-12 border border-red-300 px-6 text-sm font-semibold text-red-700"
          >
            予約をキャンセルする
          </button>
        ) : (
          <p className="mt-5 text-sm text-muted">
            現在の予約状態ではオンラインでキャンセルできません。
          </p>
        )}
      </section>
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  )
}

function buildCancellationDescription(
  reservation: PublicReservationLookup,
  locale: SiteLocale,
): string {
  const rooms = reservation.rooms
    .map((room) => `客室${room.roomIndex + 1} ${room.roomTypeNameJa}`)
    .join('・')
  return `予約番号\n${reservation.reservationNumber}\n\nチェックイン\n${formatBookingDate(reservation.checkIn, locale)}\n\n客室\n${rooms}\n\n予約料金: ${formatYen(reservation.totalAmountYen)}\nキャンセル率: ${reservation.feePercent}%\nキャンセル料: ${formatYen(reservation.feeYen)}\n返金対象額: ${formatYen(reservation.refundTargetYen)}\n\nキャンセル後、客室は再び販売可能になります。\nこの操作は取り消せません。\n返金が必要な場合も自動返金は行われません。`
}
