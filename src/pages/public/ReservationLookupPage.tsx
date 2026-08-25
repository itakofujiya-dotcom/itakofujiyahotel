import { useState, type FormEvent } from 'react'
import { PageHero } from '../../components/common/PageHero'
import { RateConfirmDialog } from '../../features/admin-rates/RateConfirmDialog'
import {
  buildLocalizedCancellationDescription,
  formatLocalizedCount,
  formatLocalizedYen,
  getLocalizedCancellationQuoteLabel,
  getLocalizedMealPlanLabel,
  getLocalizedPaymentMethodLabel,
  getLocalizedPaymentStatusLabel,
  getLocalizedReservationStatusLabel,
  getLocalizedRoomTypeName,
} from '../../features/booking/public-labels'
import { formatBookingDate } from '../../features/booking/booking-format'
import {
  cancelPublicReservation,
  lookupPublicReservation,
  PublicReservationError,
  requestCancellationNotifications,
} from '../../features/public-reservation/public-reservation-api'
import type { PublicReservationLookup } from '../../features/public-reservation/types'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'
import { hotelSettings, hotelTelephoneHref } from '../../data/hotel'

export function ReservationLookupPage() {
  const { locale, t } = useSiteTranslation()
  const [reservationNumber, setReservationNumber] = useState('')
  const [contact, setContact] = useState('')
  const [reservation, setReservation] =
    useState<PublicReservationLookup | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!reservationNumber.trim() || !contact.trim()) {
      setError(t('reservation.missingInput'))
      return
    }
    setIsLoading(true)
    setError(null)
    setReservation(null)
    try {
      setReservation(
        await lookupPublicReservation({ reservationNumber, contact }),
      )
    } catch {
      setError(t('reservation.lookupFailed'))
    } finally {
      setIsLoading(false)
    }
  }

  async function cancelReservation() {
    if (!reservation || isCancelling) return
    setIsCancelling(true)
    setError(null)
    try {
      const cancelResult = await cancelPublicReservation({
        reservationNumber,
        contact,
      })
      console.info('[cancellation-email] after-cancel-rpc')

      try {
        console.info('[cancellation-email] preparing')
        const notificationReservationNumber =
          cancelResult.reservationNumber.trim()
        const notificationContact = contact.trim()

        if (!notificationReservationNumber || !notificationContact) {
          console.error('[cancellation-email] identifiers-missing', {
            hasReservationNumber: Boolean(notificationReservationNumber),
            hasContact: Boolean(notificationContact),
          })
        } else {
          console.info('[cancellation-email] invoking')
          const notificationResult = await requestCancellationNotifications({
            reservationNumber: notificationReservationNumber,
            contact: notificationContact,
          })
          console.info('[cancellation-email] invoke-returned', {
            hasError: Boolean(notificationResult.error),
          })

          if (notificationResult.error) {
            console.error('[cancellation-email] failed', {
              errorType: notificationResult.error.name,
              message: notificationResult.error.message,
            })
          } else {
            console.info('[cancellation-email] success')
          }
        }
      } catch (notificationError) {
        console.error('[cancellation-email] failed', {
          errorType:
            notificationError instanceof Error
              ? notificationError.name
              : 'UnknownError',
          message:
            notificationError instanceof Error
              ? notificationError.message
              : 'Cancellation email invocation failed.',
        })
      }

      const refreshed = await lookupPublicReservation({
        reservationNumber,
        contact,
      })
      setReservation(refreshed)
      setShowCancelDialog(false)
    } catch (cancelError) {
      setShowCancelDialog(false)
      if (cancelError instanceof PublicReservationError) {
        if (cancelError.code === 'ALREADY_CANCELLED')
          setError(t('reservation.alreadyCancelled'))
        else if (cancelError.code === 'ONLINE_CANCELLATION_WINDOW_CLOSED')
          setError(t('reservation.contactHotel'))
        else if (cancelError.code === 'RESERVATION_NOT_CANCELLABLE')
          setError(t('reservation.notCancellable'))
        else setError(t('reservation.cancelFailed'))
      } else setError(t('reservation.cancelFailed'))
    } finally {
      setIsCancelling(false)
    }
  }

  return (
    <>
      <PageHero
        eyebrow="RESERVATION"
        title={t('reservation.pageTitle')}
        description={t('reservation.pageDescription')}
      />
      <section className="page-shell py-14 lg:py-20">
        <form
          onSubmit={(event) => void lookup(event)}
          className="mx-auto max-w-3xl border border-line bg-surface p-6 shadow-soft sm:p-8"
          noValidate
        >
          <h2 className="font-serif text-2xl">{t('reservation.formTitle')}</h2>
          <p className="mt-3 text-sm leading-7 text-muted">
            {t('reservation.formHelp')}
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label>
              <span className="mb-2 block text-xs font-semibold text-muted">
                {t('reservation.number')}
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
                {t('reservation.contact')}
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
            disabled={isLoading || isCancelling}
            className="mt-6 min-h-12 bg-accent px-7 text-sm font-semibold text-white disabled:opacity-50"
          >
            {isLoading ? t('reservation.lookingUp') : t('reservation.lookup')}
          </button>
        </form>

        {error && (
          <p
            className="mx-auto mt-6 max-w-3xl border border-red-200 bg-red-50 p-5 text-sm leading-7 text-red-800"
            role="alert"
          >
            {error}{' '}
            {error === t('reservation.contactHotel') && (
              <a className="font-semibold underline" href={hotelTelephoneHref}>
                {hotelSettings.telephone}
              </a>
            )}
          </p>
        )}
        {reservation && (
          <ReservationResult
            reservation={reservation}
            onCancel={() => setShowCancelDialog(true)}
          />
        )}
      </section>

      {showCancelDialog && reservation && (
        <RateConfirmDialog
          title={t('reservation.cancelTitle')}
          description={buildLocalizedCancellationDescription(
            reservation,
            locale,
          )}
          confirmLabel={t('reservation.cancelConfirm')}
          cancelLabel={t('reservation.back')}
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
  onCancel,
}: {
  reservation: PublicReservationLookup
  onCancel: () => void
}) {
  const { locale, t } = useSiteTranslation()
  return (
    <div className="mx-auto mt-8 max-w-3xl space-y-6">
      <section className="border border-line bg-surface p-6 shadow-soft sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">{t('reservation.number')}</p>
            <h2 className="mt-1 text-xl font-bold">
              {reservation.reservationNumber}
            </h2>
          </div>
          <span className="bg-[#eee7d9] px-3 py-1 text-xs font-semibold">
            {getLocalizedReservationStatusLabel(
              reservation.reservationStatus,
              locale,
            )}
          </span>
        </div>
        <dl className="mt-6 grid gap-5 text-sm sm:grid-cols-2">
          <ResultRow
            label={t('reservation.guest')}
            value={reservation.guestName}
          />
          <ResultRow
            label={t('reservation.kana')}
            value={reservation.guestKana || '—'}
          />
          <ResultRow
            label={t('reservation.stay')}
            value={`${formatBookingDate(reservation.checkIn, locale)}〜${formatBookingDate(reservation.checkOut, locale)}`}
          />
          <ResultRow
            label={t('reservation.nights')}
            value={formatLocalizedCount(
              reservation.stayNights,
              'nights',
              locale,
            )}
          />
          <ResultRow
            label={t('reservation.rooms')}
            value={formatLocalizedCount(reservation.roomCount, 'rooms', locale)}
          />
          <ResultRow
            label={t('reservation.paymentMethod')}
            value={
              reservation.paymentMethod
                ? getLocalizedPaymentMethodLabel(
                    reservation.paymentMethod,
                    locale,
                  )
                : t('reservation.needsReview')
            }
          />
          <ResultRow
            label={t('reservation.paymentStatus')}
            value={
              reservation.paymentStatus
                ? getLocalizedPaymentStatusLabel(
                    reservation.paymentStatus,
                    locale,
                  )
                : t('reservation.needsReview')
            }
          />
          <ResultRow
            label={t('reservation.total')}
            value={formatLocalizedYen(reservation.totalAmountYen, locale)}
          />
          <ResultRow
            label={t('reservation.request')}
            value={reservation.guestNote || t('reservation.none')}
          />
        </dl>
      </section>

      <section className="border border-line bg-surface p-6 shadow-soft sm:p-8">
        <h2 className="font-serif text-xl">{t('reservation.roomDetails')}</h2>
        <div className="mt-5 divide-y divide-line">
          {reservation.rooms.map((room) => (
            <div key={room.roomIndex} className="py-4 first:pt-0">
              <p className="font-semibold">
                {t('reservation.room')} {room.roomIndex + 1} ·{' '}
                {getLocalizedRoomTypeName(room.roomTypeNameJa, locale)}
              </p>
              <p className="mt-2 text-sm text-muted">
                {t('reservation.adults')}{' '}
                {formatLocalizedCount(room.adultGuestCount, 'people', locale)} ·{' '}
                {t('reservation.children')}{' '}
                {formatLocalizedCount(room.paidChildCount, 'people', locale)} ·{' '}
                {t('reservation.preschool')}{' '}
                {formatLocalizedCount(
                  room.freePreschoolCount,
                  'people',
                  locale,
                )}
              </p>
              <p className="mt-1 text-sm">
                {getLocalizedMealPlanLabel(room.mealPlan, locale)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border border-line bg-surface p-6 shadow-soft sm:p-8">
        <h2 className="font-serif text-xl">{t('reservation.cancellation')}</h2>
        <p className="mt-4 text-sm leading-7">
          {getLocalizedCancellationQuoteLabel(
            reservation.policyCode,
            reservation.policyDescriptionJa,
            reservation.feePercent,
            locale,
          )}
        </p>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
          <ResultRow
            label={
              reservation.reservationStatus === 'cancelled'
                ? t('reservation.appliedRate')
                : t('reservation.currentRate')
            }
            value={`${reservation.feePercent}%`}
          />
          <ResultRow
            label={
              reservation.reservationStatus === 'cancelled'
                ? t('reservation.confirmedFee')
                : t('reservation.currentFee')
            }
            value={formatLocalizedYen(reservation.feeYen, locale)}
          />
          <ResultRow
            label={t('reservation.refundTarget')}
            value={formatLocalizedYen(reservation.refundTargetYen, locale)}
          />
        </dl>
        {reservation.cancellable && reservation.feeYen === 0 && (
          <p className="mt-4 border border-green-200 bg-green-50 p-4 text-sm text-green-900">
            {t('reservation.freeCancellation')}
          </p>
        )}
        {reservation.refundTargetYen > 0 && (
          <p className="mt-4 border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            {t('reservation.refundNotice')}
          </p>
        )}
        {reservation.cancellable ? (
          <button
            type="button"
            onClick={onCancel}
            className="mt-6 min-h-12 border border-red-300 px-6 text-sm font-semibold text-red-700"
          >
            {t('reservation.cancelButton')}
          </button>
        ) : (
          <p className="mt-5 text-sm leading-7 text-muted">
            {reservation.onlineCancellationReason === 'CONTACT_HOTEL'
              ? t('reservation.contactHotel')
              : t('reservation.notCancellable')}{' '}
            {reservation.onlineCancellationReason === 'CONTACT_HOTEL' && (
              <a className="font-semibold underline" href={hotelTelephoneHref}>
                {hotelSettings.telephone}
              </a>
            )}
          </p>
        )}
      </section>
    </div>
  )
}

function ResultRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  )
}
