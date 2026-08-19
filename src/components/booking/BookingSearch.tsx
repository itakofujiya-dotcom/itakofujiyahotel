import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { format } from 'date-fns'
import { Search } from 'lucide-react'
import { validateBookingSearch } from '../../features/booking/validation'

type Props = { compact?: boolean }

export function BookingSearch({ compact = false }: Props) {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    checkIn: '',
    checkOut: '',
    adults: 2,
    children: 0,
    rooms: 1,
  })
  const today = format(new Date(), 'yyyy-MM-dd')

  function submit(event: FormEvent) {
    event.preventDefault()
    const params = {
      ...form,
      checkIn: form.checkIn ? new Date(`${form.checkIn}T00:00:00`) : null,
      checkOut: form.checkOut ? new Date(`${form.checkOut}T00:00:00`) : null,
    }
    const message = validateBookingSearch(params)
    if (message) {
      setError(message)
      return
    }
    const query = new URLSearchParams({
      checkIn: form.checkIn,
      checkOut: form.checkOut,
      adults: String(form.adults),
      children: String(form.children),
      rooms: String(form.rooms),
    })
    navigate(`/booking?${query.toString()}`)
  }

  return (
    <form
      onSubmit={submit}
      className={`bg-surface shadow-soft ${compact ? 'p-5' : 'p-5 sm:p-7 lg:p-8'}`}
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_.8fr_.8fr_.8fr_auto] lg:items-end">
        <Field label="チェックイン">
          <input
            className="admin-input"
            type="date"
            min={today}
            value={form.checkIn}
            onChange={(e) => setForm({ ...form, checkIn: e.target.value })}
          />
        </Field>
        <Field label="チェックアウト">
          <input
            className="admin-input"
            type="date"
            min={form.checkIn || today}
            value={form.checkOut}
            onChange={(e) => setForm({ ...form, checkOut: e.target.value })}
          />
        </Field>
        <Field label="大人">
          <Select
            value={form.adults}
            onChange={(value) => setForm({ ...form, adults: value })}
            min={1}
            max={4}
          />
        </Field>
        <Field label="子ども">
          <Select
            value={form.children}
            onChange={(value) => setForm({ ...form, children: value })}
            min={0}
            max={4}
          />
        </Field>
        <Field label="客室数">
          <Select
            value={form.rooms}
            onChange={(value) => setForm({ ...form, rooms: value })}
            min={1}
            max={4}
          />
        </Field>
        <button
          className="flex min-h-11 items-center justify-center gap-2 bg-accent px-6 text-sm font-semibold text-white hover:bg-accent-hover"
          type="submit"
        >
          <Search size={17} />
          空室を検索
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
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {Array.from({ length: max - min + 1 }, (_, i) => i + min).map((item) => (
        <option key={item} value={item}>
          {item}
        </option>
      ))}
    </select>
  )
}
