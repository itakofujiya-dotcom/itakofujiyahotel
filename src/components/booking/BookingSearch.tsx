import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  getJapanDateTime,
  parseBookingSearchParams,
  validateBookingSearch,
} from '../../features/booking/validation'
import type { BookingSearchParams } from '../../features/booking/types'
import { getSiteLanguageTag } from '../../i18n/public-translations'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'

type Props = { compact?: boolean; isLoading?: boolean }

export function BookingSearch({ compact = false, isLoading = false }: Props) {
  const navigate = useNavigate()
  const { locale, t } = useSiteTranslation()
  const languageTag = getSiteLanguageTag(locale)
  const [searchParams] = useSearchParams()
  const initial = parseBookingSearchParams(searchParams)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<BookingSearchParams>(
    initial ?? {
      checkIn: '',
      checkOut: '',
      adults: 2,
      paidChildren: 0,
      freePreschoolChildren: 0,
      roomCount: 1,
    },
  )
  const japanToday = getJapanDateTime().date

  function submit(event: FormEvent) {
    event.preventDefault()
    const message = validateBookingSearch(form)
    if (message) {
      setError(message)
      return
    }
    setError(null)
    const query = new URLSearchParams({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: String(form.adults),
      paidChildren: String(form.paidChildren),
      freePreschoolChildren: String(form.freePreschoolChildren),
      roomCount: String(form.roomCount),
    })
    navigate(`/booking?${query.toString()}`)
  }

  return (
    <form
      onSubmit={submit}
      className={`bg-surface shadow-soft ${compact ? 'p-5' : 'p-5 sm:p-7 lg:p-8'}`}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[1.2fr_1.2fr_.7fr_.8fr_.9fr_.7fr_auto] xl:items-end">
        <Field label={t('booking.checkIn')}>
          <input
            key={`check-in-${locale}`}
            className="admin-input"
            type="date"
            lang={languageTag}
            aria-label={`${t('booking.checkIn')} (${t('booking.dateInputFormat')})`}
            title={t('booking.dateInputFormat')}
            min={japanToday}
            value={form.checkIn}
            onChange={(event) =>
              setForm({ ...form, checkIn: event.target.value })
            }
          />
        </Field>
        <Field label={t('booking.checkOut')}>
          <input
            key={`check-out-${locale}`}
            className="admin-input"
            type="date"
            lang={languageTag}
            aria-label={`${t('booking.checkOut')} (${t('booking.dateInputFormat')})`}
            title={t('booking.dateInputFormat')}
            min={form.checkIn || japanToday}
            value={form.checkOut}
            onChange={(event) =>
              setForm({ ...form, checkOut: event.target.value })
            }
          />
        </Field>
        <Field label={t('booking.adults')}>
          <Select
            lang={languageTag}
            value={form.adults}
            onChange={(value) => setForm({ ...form, adults: value })}
            min={1}
            max={16}
          />
        </Field>
        <Field label={t('booking.paidChildren')}>
          <Select
            lang={languageTag}
            value={form.paidChildren}
            onChange={(value) => setForm({ ...form, paidChildren: value })}
            min={0}
            max={12}
          />
        </Field>
        <Field label={t('booking.preschoolChildren')}>
          <Select
            lang={languageTag}
            value={form.freePreschoolChildren}
            onChange={(value) =>
              setForm({ ...form, freePreschoolChildren: value })
            }
            min={0}
            max={8}
          />
        </Field>
        <Field label={t('booking.roomCount')}>
          <Select
            lang={languageTag}
            value={form.roomCount}
            onChange={(value) => setForm({ ...form, roomCount: value })}
            min={1}
            max={4}
          />
        </Field>
        <button
          className="flex min-h-11 items-center justify-center gap-2 bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
          type="submit"
          disabled={isLoading}
        >
          <Search size={17} />
          {isLoading ? t('booking.searching') : t('booking.search')}
        </button>
      </div>
      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-muted">
        {label}
      </span>
      {children}
    </label>
  )
}

function Select({
  value,
  onChange,
  min,
  max,
  lang,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  lang: string
}) {
  return (
    <select
      className="admin-input"
      lang={lang}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {Array.from({ length: max - min + 1 }, (_, index) => index + min).map(
        (item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ),
      )}
    </select>
  )
}
