import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search } from 'lucide-react'
import {
  getJapanDateTime,
  parseBookingSearchParams,
  validateBookingSearch,
} from '../../features/booking/validation'
import type { BookingSearchParams } from '../../features/booking/types'

type Props = { compact?: boolean; isLoading?: boolean }

export function BookingSearch({ compact = false, isLoading = false }: Props) {
  const navigate = useNavigate()
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
        <Field label="チェックイン">
          <input
            className="admin-input"
            type="date"
            min={japanToday}
            value={form.checkIn}
            onChange={(event) =>
              setForm({ ...form, checkIn: event.target.value })
            }
          />
        </Field>
        <Field label="チェックアウト">
          <input
            className="admin-input"
            type="date"
            min={form.checkIn || japanToday}
            value={form.checkOut}
            onChange={(event) =>
              setForm({ ...form, checkOut: event.target.value })
            }
          />
        </Field>
        <Field label="大人">
          <Select
            value={form.adults}
            onChange={(value) => setForm({ ...form, adults: value })}
            min={1}
            max={16}
          />
        </Field>
        <Field label="子ども（有料）">
          <Select
            value={form.paidChildren}
            onChange={(value) => setForm({ ...form, paidChildren: value })}
            min={0}
            max={12}
          />
        </Field>
        <Field label="未就学児（添い寝）">
          <Select
            value={form.freePreschoolChildren}
            onChange={(value) =>
              setForm({ ...form, freePreschoolChildren: value })
            }
            min={0}
            max={8}
          />
        </Field>
        <Field label="客室数">
          <Select
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
          {isLoading ? '確認中…' : '空室を検索'}
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
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
}) {
  return (
    <select
      className="admin-input"
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
