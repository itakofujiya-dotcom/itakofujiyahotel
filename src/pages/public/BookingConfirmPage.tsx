import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookingMissing } from '../../components/booking/BookingMissing'
import { BookingSteps } from '../../components/booking/BookingSteps'
import { BookingSummary } from '../../components/booking/BookingSummary'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import {
  createPublicReservation,
  getPublicBookingInformation,
  requestReservationCreatedNotifications,
} from '../../features/booking/booking-api'
import {
  formatBookingDate,
  formatShortBookingDate,
  getStayNights,
} from '../../features/booking/booking-format'
import {
  completeBooking,
  readBookingDraft,
  readBookingGuestDraft,
  writeBookingDraft,
} from '../../features/booking/storage'
import { canSubmitPublicBooking } from '../../features/booking/guest-validation'
import type {
  BookingDraft,
  CancellationPolicy,
} from '../../features/booking/types'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'
import {
  getLocalizedCancellationPolicyLabel,
  getLocalizedMealPlanLabel,
  getLocalizedRoomTypeName,
} from '../../features/booking/public-labels'

const fallbackPolicies = [
  ['7日前まで', '無料'],
  ['6〜4日前', '30%'],
  ['3〜2日前', '50%'],
  ['前日・当日', '100%'],
  ['無連絡不泊', '100%'],
] as const

export function BookingConfirmPage() {
  const navigate = useNavigate()
  const { locale } = useSiteTranslation()
  const [booking, setBooking] = useState<BookingDraft | null>(readBookingDraft)
  const [guest] = useState(readBookingGuestDraft)
  const [policies, setPolicies] = useState<CancellationPolicy[]>([])
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [policyConsent, setPolicyConsent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [priceChange, setPriceChange] = useState<{
    previous: number
    current: number
  } | null>(null)

  useEffect(() => {
    void getPublicBookingInformation()
      .then((result) => setPolicies(result.cancellationPolicies))
      .catch(() => setPolicies([]))
  }, [])

  if (!booking || !guest) return <BookingMissing current={3} />

  async function submit() {
    if (
      !booking ||
      !guest ||
      !canSubmitPublicBooking({
        privacyConsent,
        policyConsent,
        isSubmitting,
      })
    )
      return
    setIsSubmitting(true)
    setError(null)
    try {
      const result = await createPublicReservation(booking, guest, locale)
      if (result.ok) {
        try {
          await requestReservationCreatedNotifications(
            result.reservationId,
            guest.bookingRequestId,
          )
        } catch {
          // The reservation is already committed. Email delivery must not turn
          // a successful booking into an error or create a second reservation.
        }
        completeBooking(result)
        navigate('/booking/complete', { replace: true })
        return
      }
      if (result.code === 'PRICE_CHANGED') {
        const updated = {
          ...booking,
          totalAmountYen: result.newTotalAmountYen,
          rooms: result.rooms,
          searchedAt: new Date().toISOString(),
        }
        writeBookingDraft(updated)
        setBooking(updated)
        setPriceChange({
          previous: result.previousTotalAmountYen,
          current: result.newTotalAmountYen,
        })
        setPrivacyConsent(false)
        setPolicyConsent(false)
      } else if (result.code === 'BOOKING_NO_LONGER_AVAILABLE') {
        setError(
          '申し訳ありません。選択した客室は満室となりました。もう一度空室検索をお願いします。',
        )
      } else if (result.code === 'INVALID_BOOKING') {
        setError('予約内容を確認できませんでした。入力内容をご確認ください。')
      } else {
        setError('予約を確定できませんでした。時間をおいて再度お試しください。')
      }
    } catch {
      setError('予約を確定できませんでした。時間をおいて再度お試しください。')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="page-shell py-12 lg:py-18">
      <BookingSteps current={3} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <p className="eyebrow">CONFIRMATION</p>
          <h1 className="font-serif text-3xl sm:text-4xl">予約内容確認</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            内容をご確認のうえ、規約への同意後にご予約を確定してください。
          </p>

          {priceChange && (
            <div
              className="mt-7 border border-amber-300 bg-amber-50 p-5"
              role="alert"
            >
              <p className="font-semibold">料金が変更されました。</p>
              <p className="mt-2 text-lg">
                <span className="line-through">
                  {formatYen(priceChange.previous)}
                </span>
                <span className="mx-3">→</span>
                <strong>{formatYen(priceChange.current)}</strong>
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                最新の料金をご確認のうえ、同意欄を再度チェックして予約を確定してください。
              </p>
            </div>
          )}
          {error && (
            <div
              className="mt-7 border border-red-200 bg-red-50 p-5"
              role="alert"
            >
              <p className="text-sm leading-7 text-red-800">{error}</p>
              {error.includes('満室') && (
                <Link
                  to="/booking"
                  className="mt-4 inline-flex min-h-11 items-center bg-accent px-5 text-sm font-semibold text-white"
                >
                  空室検索に戻る
                </Link>
              )}
            </div>
          )}

          <ConfirmSection title="宿泊情報">
            <DefinitionGrid
              rows={[
                ['チェックイン', formatBookingDate(booking.checkIn, locale)],
                ['チェックアウト', formatBookingDate(booking.checkOut, locale)],
                [
                  '宿泊数',
                  `${getStayNights(booking.checkIn, booking.checkOut)}泊`,
                ],
                ['客室数', `${booking.roomCount}室`],
                ['大人', `${booking.adults}名`],
                ['子ども', `${booking.paidChildren}名`],
                ['添い寝', `${booking.freePreschoolChildren}名`],
              ]}
            />
            <div className="mt-5 space-y-4 border-t border-line pt-4">
              {booking.rooms.map((room) => (
                <div key={room.roomIndex} className="text-sm">
                  <p className="font-semibold">
                    客室 {room.roomIndex + 1} ·{' '}
                    {getLocalizedRoomTypeName(room.roomTypeNameJa, locale)}
                  </p>
                  <p className="mt-1 text-muted">
                    大人 {room.adultGuestCount}名 · 子ども {room.paidChildCount}
                    名 · 添い寝 {room.freePreschoolCount}名
                  </p>
                  <p className="mt-1 text-muted">
                    {getLocalizedMealPlanLabel(room.mealPlan, locale)}
                  </p>
                </div>
              ))}
            </div>
          </ConfirmSection>

          <ConfirmSection title="お客様情報">
            <DefinitionGrid
              rows={[
                ['氏名', guest.name],
                ['フリガナ / 英文名', guest.nameKanaOrRoman],
                ['電話', guest.telephone],
                ['メール', guest.email],
                ['チェックイン予定時間', guest.expectedCheckInTime],
                ['ご要望', guest.guestNote || 'なし'],
              ]}
            />
            <Link
              to="/booking/details"
              className="mt-5 inline-block text-sm font-semibold text-accent underline"
            >
              お客様情報を修正
            </Link>
          </ConfirmSection>

          <ConfirmSection title="料金詳細">
            <div className="divide-y divide-line">
              {booking.rooms.map((room) => (
                <div key={room.roomIndex} className="py-4 first:pt-0">
                  <p className="font-semibold">
                    客室 {room.roomIndex + 1} ·{' '}
                    {getLocalizedRoomTypeName(room.roomTypeNameJa, locale)}
                  </p>
                  {room.nightlyPrices.map((night) => (
                    <p key={night.stayDate} className="mt-2 text-sm text-muted">
                      {formatShortBookingDate(night.stayDate, locale)} ·{' '}
                      {formatYen(night.pricePerPersonYen)} × {night.guestCount}
                      名
                      {night.isSpecialRate && (
                        <span className="ml-2 text-accent">特別料金</span>
                      )}
                    </p>
                  ))}
                  <div className="mt-3 grid gap-1 text-sm sm:grid-cols-3">
                    <p>客室料金 {formatYen(room.baseRoomTotalYen)}</p>
                    <p>夕食追加 {formatYen(room.mealSurchargeYen)}</p>
                    <p className="font-semibold sm:text-right">
                      小計 {formatYen(room.subtotalYen)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-end justify-between border-t-2 border-ink pt-4">
              <span className="font-semibold">合計</span>
              <strong className="text-2xl">
                {formatYen(booking.totalAmountYen)}
              </strong>
            </div>
            <p className="mt-4 text-xs leading-6 text-muted">
              現在の料金をもとに表示しています。予約確定時に料金と空室状況を再確認します。
            </p>
          </ConfirmSection>

          <ConfirmSection title="お支払い方法">
            <p className="font-semibold">現地払い</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              ホテルにて現金またはクレジットカードでお支払いください。
            </p>
          </ConfirmSection>

          <ConfirmSection title="キャンセルポリシー">
            <div className="divide-y divide-line text-sm">
              {policies.length > 0
                ? policies.map((policy) => (
                    <div
                      key={policy.id}
                      className="flex justify-between gap-4 py-3 first:pt-0"
                    >
                      <span>
                        {getLocalizedCancellationPolicyLabel(policy, locale)}
                      </span>
                      <strong>
                        {policy.feePercent === 0
                          ? '無料'
                          : `${policy.feePercent}%`}
                      </strong>
                    </div>
                  ))
                : fallbackPolicies.map(([label, fee]) => (
                    <div
                      key={label}
                      className="flex justify-between gap-4 py-3 first:pt-0"
                    >
                      <span>{label}</span>
                      <strong>{fee}</strong>
                    </div>
                  ))}
            </div>
            <p className="mt-4 text-xs leading-6 text-muted">
              サイトからの取消受付期間外はホテルへ直接お問い合わせください。
            </p>
          </ConfirmSection>

          <div className="mt-7 border border-line bg-surface p-6 shadow-soft">
            <Consent
              checked={privacyConsent}
              onChange={setPrivacyConsent}
              label="プライバシーポリシーに同意します。"
            >
              <PolicyDocumentLink to="/privacy">内容を見る</PolicyDocumentLink>
            </Consent>
            <Consent
              checked={policyConsent}
              onChange={setPolicyConsent}
              label="宿泊約款およびキャンセルポリシーに同意します。"
            >
              <PolicyDocumentLink to="/terms">
                宿泊約款を見る
              </PolicyDocumentLink>
              <PolicyDocumentLink to="/cancellation-policy">
                キャンセルポリシーを見る
              </PolicyDocumentLink>
            </Consent>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!privacyConsent || !policyConsent || isSubmitting}
              className="mt-6 min-h-14 w-full bg-accent px-6 font-semibold text-white hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {isSubmitting ? '予約を確定しています...' : 'この内容で予約する'}
            </button>
          </div>
        </div>
        <BookingSummary booking={booking} />
      </div>
    </section>
  )
}

function ConfirmSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-7 border border-line bg-surface p-6 shadow-soft sm:p-8">
      <h2 className="font-serif text-2xl">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function DefinitionGrid({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function Consent({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  children: React.ReactNode
}) {
  const inputId = useId()
  return (
    <div className="mt-4 flex min-h-11 items-start gap-3 text-sm first:mt-0">
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 accent-[#994a32]"
      />
      <div className="min-w-0 flex-1">
        <label htmlFor={inputId} className="cursor-pointer leading-6">
          {label}
        </label>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{children}</div>
      </div>
    </div>
  )
}

function PolicyDocumentLink({
  to,
  children,
}: {
  to: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-accent underline decoration-accent/40 underline-offset-4 hover:text-accent-hover"
    >
      {children}
      <span className="sr-only">（新しいタブで開く）</span>
    </Link>
  )
}
