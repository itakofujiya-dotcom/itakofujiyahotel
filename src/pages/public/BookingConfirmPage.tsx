import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookingMissing } from '../../components/booking/BookingMissing'
import { BookingSteps } from '../../components/booking/BookingSteps'
import { BookingSummary } from '../../components/booking/BookingSummary'
import { formatYen } from '../../features/admin-rates/rate-helpers'
import {
  createPublicReservation,
  getPublicBookingInformation,
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

const fallbackPolicies = [
  ['7日前まで', '無料'],
  ['6〜4日前', '30%'],
  ['3〜2日前', '50%'],
  ['前日・当日', '100%'],
  ['無連絡不泊', '100%'],
] as const

export function BookingConfirmPage() {
  const navigate = useNavigate()
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
      const result = await createPublicReservation(booking, guest)
      if (result.ok) {
        completeBooking(result)
        navigate('/booking/complete', { replace: true })
        return
      }
      if (result.code === 'PRICE_CHANGED') {
        const updated = {
          ...booking,
          totalAmountYen: result.newTotalAmountYen,
          nightlyPrices: result.nightlyPrices,
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
                ['チェックイン', formatBookingDate(booking.checkIn)],
                ['チェックアウト', formatBookingDate(booking.checkOut)],
                [
                  '宿泊数',
                  `${getStayNights(booking.checkIn, booking.checkOut)}泊`,
                ],
                ['客室タイプ', booking.selectedRoomType.nameJa],
                ['客室数', `${booking.roomCount}室`],
                ['大人', `${booking.adults}名`],
                ['子ども', `${booking.paidChildren}名`],
                ['添い寝', `${booking.freePreschoolChildren}名`],
              ]}
            />
            {booking.roomCount > 1 && (
              <div className="mt-5 border-t border-line pt-4 text-sm text-muted">
                {booking.guestDistribution.map((count, index) => (
                  <p key={index} className="mt-1">
                    {index + 1}室目 {count}名
                  </p>
                ))}
              </div>
            )}
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
              {booking.nightlyPrices.map((night) => (
                <div key={night.stayDate} className="py-4 first:pt-0">
                  <p className="font-semibold">
                    {formatShortBookingDate(night.stayDate)}
                  </p>
                  {night.rooms.map((room) => (
                    <p key={room.roomIndex} className="mt-2 text-sm text-muted">
                      {room.roomIndex + 1}室目 ·{' '}
                      {formatYen(room.pricePerPersonYen)} × {room.guestCount}名
                      {room.isSpecialRate && (
                        <span className="ml-2 text-accent">特別料金</span>
                      )}
                    </p>
                  ))}
                  <p className="mt-2 text-right font-medium">
                    {formatYen(night.nightTotalYen)}
                  </p>
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
                      <span>{policy.descriptionJa ?? policy.code}</span>
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
            <Consent checked={privacyConsent} onChange={setPrivacyConsent}>
              個人情報の取扱いに同意します。
            </Consent>
            <Consent checked={policyConsent} onChange={setPolicyConsent}>
              宿泊条件・キャンセルポリシーを確認し、同意します。
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
  children,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  children: React.ReactNode
}) {
  return (
    <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm first:mt-0">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 size-5 accent-[#994a32]"
      />
      <span className="leading-6">{children}</span>
    </label>
  )
}
