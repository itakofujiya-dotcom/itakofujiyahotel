import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BookingMissing } from '../../components/booking/BookingMissing'
import { BookingSteps } from '../../components/booking/BookingSteps'
import { BookingSummary } from '../../components/booking/BookingSummary'
import {
  hasBookingGuestErrors,
  validateBookingGuest,
  type BookingGuestErrors,
} from '../../features/booking/guest-validation'
import {
  readBookingDraft,
  readBookingGuestDraft,
  writeBookingGuestDraft,
} from '../../features/booking/storage'
import type { BookingGuestDraft } from '../../features/booking/types'

const initialGuest: BookingGuestDraft = {
  name: '',
  nameKanaOrRoman: '',
  telephone: '',
  email: '',
  expectedCheckInTime: '16:00',
  guestNote: '',
}

const checkInTimes = ['16:00', '17:00', '18:00', '19:00', '20:00', '21:00']

export function BookingDetailsPage() {
  const navigate = useNavigate()
  const [booking] = useState(readBookingDraft)
  const [storedGuest] = useState(readBookingGuestDraft)
  const [guest, setGuest] = useState<BookingGuestDraft>(
    storedGuest ?? initialGuest,
  )
  const [errors, setErrors] = useState<BookingGuestErrors>({})

  if (!booking) return <BookingMissing current={2} />

  function update<K extends keyof BookingGuestDraft>(
    key: K,
    value: BookingGuestDraft[K],
  ) {
    setGuest((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextGuest = {
      ...guest,
      name: guest.name.trim(),
      nameKanaOrRoman: guest.nameKanaOrRoman.trim(),
      telephone: guest.telephone.trim(),
      email: guest.email.trim(),
      guestNote: guest.guestNote.trim(),
    }
    const nextErrors = validateBookingGuest(nextGuest)
    setErrors(nextErrors)
    if (hasBookingGuestErrors(nextErrors)) return
    writeBookingGuestDraft({
      ...nextGuest,
      bookingRequestId: storedGuest?.bookingRequestId ?? crypto.randomUUID(),
    })
    navigate('/booking/confirm')
  }

  const searchQuery = new URLSearchParams({
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    adults: String(booking.adults),
    paidChildren: String(booking.paidChildren),
    freePreschoolChildren: String(booking.freePreschoolChildren),
    roomCount: String(booking.roomCount),
  })

  return (
    <section className="page-shell py-12 lg:py-18">
      <BookingSteps current={2} />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div>
          <p className="eyebrow">GUEST DETAILS</p>
          <h1 className="font-serif text-3xl sm:text-4xl">お客様情報</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            ご予約に必要な情報をご入力ください。
          </p>
          <form
            onSubmit={submit}
            noValidate
            className="mt-8 border border-line bg-surface p-6 shadow-soft sm:p-8"
          >
            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="氏名" error={errors.name} required>
                <input
                  className="admin-input"
                  autoComplete="name"
                  value={guest.name}
                  onChange={(event) => update('name', event.target.value)}
                  placeholder="山田 太郎"
                />
              </Field>
              <Field
                label="フリガナ / 英文名"
                error={errors.nameKanaOrRoman}
                required
              >
                <input
                  className="admin-input"
                  autoComplete="name"
                  value={guest.nameKanaOrRoman}
                  onChange={(event) =>
                    update('nameKanaOrRoman', event.target.value)
                  }
                  placeholder="ヤマダ タロウ / TARO YAMADA"
                />
              </Field>
              <Field label="電話番号" error={errors.telephone} required>
                <input
                  className="admin-input"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={guest.telephone}
                  onChange={(event) => update('telephone', event.target.value)}
                  placeholder="090-1234-5678 / +82-10-1234-5678"
                />
              </Field>
              <Field label="メールアドレス" error={errors.email} required>
                <input
                  className="admin-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={guest.email}
                  onChange={(event) => update('email', event.target.value)}
                  placeholder="guest@example.com"
                />
              </Field>
              <Field
                label="チェックイン予定時間"
                error={errors.expectedCheckInTime}
                required
              >
                <select
                  className="admin-input"
                  value={guest.expectedCheckInTime}
                  onChange={(event) =>
                    update('expectedCheckInTime', event.target.value)
                  }
                >
                  {checkInTimes.map((time) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-muted">
                  フロント受付時間は16:00〜22:00です。
                </p>
              </Field>
            </div>
            <div className="mt-6">
              <Field label="ご要望" error={errors.guestNote}>
                <textarea
                  className="admin-input min-h-32 py-3"
                  value={guest.guestNote}
                  maxLength={1000}
                  onChange={(event) => update('guestNote', event.target.value)}
                  placeholder="ご要望がございましたらご入力ください。"
                />
                <p className="mt-2 text-xs leading-6 text-muted">
                  送迎をご希望の場合は、ご予約後にホテルへお問い合わせください。
                </p>
              </Field>
            </div>
            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
              <Link
                to={`/booking?${searchQuery.toString()}`}
                className="inline-flex min-h-12 items-center justify-center border border-ink px-6 text-sm font-semibold hover:bg-ink hover:text-white"
              >
                検索条件を変更
              </Link>
              <button
                type="submit"
                className="min-h-12 bg-accent px-7 text-sm font-semibold text-white hover:bg-accent-hover"
              >
                予約内容を確認
              </button>
            </div>
          </form>
        </div>
        <BookingSummary booking={booking} />
      </div>
    </section>
  )
}

function Field({
  label,
  error,
  required = false,
  children,
}: {
  label: string
  error?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block text-sm font-medium">
      <span>
        {label}
        {required && <span className="ml-2 text-xs text-accent">必須</span>}
      </span>
      <span className="mt-2 block">{children}</span>
      {error && (
        <span className="mt-2 block text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
