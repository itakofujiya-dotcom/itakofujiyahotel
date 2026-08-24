import { useMemo, useState } from 'react'
import {
  addMonths,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { GuestNameWithKana } from '../../components/admin/GuestNameWithKana'
import { getSundayStartCalendarDays } from '../admin-rates/rate-helpers'
import {
  getReservationCalendarCardInfo,
  getReservationCalendarCounts,
  getReservationDetailPath,
  isNewOnlineReservation,
} from './reservation-helpers'
import type { ReservationListItem } from './types'
import { NewReservationBadge } from './NewReservationBadge'
import { ReservationStatusBadge } from './ReservationStatusBadge'

export function ReservationCalendar({
  reservations,
}: {
  reservations: ReservationListItem[]
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateFromUrl = searchParams.get('date')
  const initialDate =
    dateFromUrl && /^\d{4}-\d{2}-\d{2}$/.test(dateFromUrl)
      ? dateFromUrl
      : format(new Date(), 'yyyy-MM-dd')
  const [month, setMonth] = useState(() =>
    startOfMonth(new Date(`${initialDate}T00:00:00`)),
  )
  const [selectedDate, setSelectedDate] = useState(initialDate)
  const days = getSundayStartCalendarDays(month)
  const selected = useMemo(
    () => getReservationCalendarCounts(reservations, selectedDate),
    [reservations, selectedDate],
  )

  function selectDate(stayDate: string) {
    setSelectedDate(stayDate)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('date', stayDate)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <section className="border border-line bg-surface p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(subMonths(month, 1))}
            className="grid size-11 place-items-center"
            aria-label="前の月"
          >
            <ChevronLeft />
          </button>
          <h2 className="font-serif text-xl">{format(month, 'yyyy年M月')}</h2>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            className="grid size-11 place-items-center"
            aria-label="次の月"
          >
            <ChevronRight />
          </button>
        </div>
        <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-muted">
          {['日', '月', '火', '水', '木', '金', '土'].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-t border-line">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const counts = getReservationCalendarCounts(reservations, key)
            const active = key === selectedDate
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => selectDate(key)}
                className={`min-h-24 border-b border-r border-line p-1.5 text-left align-top transition sm:min-h-28 sm:p-2 ${!isSameMonth(day, month) ? 'bg-stone-50 text-muted/45' : 'hover:bg-background'} ${active ? 'ring-2 ring-inset ring-accent' : ''}`}
              >
                <span className="text-xs sm:text-sm">{format(day, 'd')}</span>
                <span className="mt-2 block space-y-1 text-[9px] leading-4 sm:text-[10px]">
                  {counts.checkIns.length > 0 && (
                    <span className="block text-green-700">
                      IN {counts.checkIns.length}
                    </span>
                  )}
                  {counts.checkOuts.length > 0 && (
                    <span className="block text-blue-700">
                      OUT {counts.checkOuts.length}
                    </span>
                  )}
                  {counts.staying.length > 0 && (
                    <span className="block text-muted">
                      宿泊 {counts.staying.length}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section className="border border-line bg-surface p-6">
        <h3 className="font-serif text-xl">
          {format(new Date(`${selectedDate}T00:00:00`), 'yyyy年M月d日')}
        </h3>
        <div className="mt-5 grid gap-6 md:grid-cols-3">
          <ReservationDayGroup
            label="チェックイン"
            reservations={selected.checkIns}
            selectedDate={selectedDate}
          />
          <ReservationDayGroup
            label="チェックアウト"
            reservations={selected.checkOuts}
            selectedDate={selectedDate}
          />
          <ReservationDayGroup
            label="宿泊中"
            reservations={selected.staying}
            selectedDate={selectedDate}
          />
        </div>
      </section>
    </div>
  )
}

function ReservationDayGroup({
  label,
  reservations,
  selectedDate,
}: {
  label: string
  reservations: ReservationListItem[]
  selectedDate: string
}) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-muted">
        {label} ({reservations.length})
      </h4>
      <div className="mt-3 space-y-2">
        {reservations.length === 0 ? (
          <p className="text-sm text-muted">該当なし</p>
        ) : (
          reservations.map((reservation) => {
            const info = getReservationCalendarCardInfo(reservation)
            return (
              <Link
                key={reservation.id}
                to={getReservationDetailPath(reservation.id)}
                state={{
                  reservationsReturnTo: `/admin/reservations?date=${selectedDate}`,
                }}
                className="block cursor-pointer border border-line p-3 text-sm transition hover:border-accent hover:bg-background focus-visible:bg-background"
              >
                <span className="flex items-start justify-between gap-2">
                  <GuestNameWithKana
                    name={reservation.guest.name}
                    nameKanaOrRoman={reservation.guest.name_kana_or_roman}
                    nameClassName="font-semibold"
                  />
                  {isNewOnlineReservation(reservation) && (
                    <NewReservationBadge compact />
                  )}
                </span>
                <span className="mt-1 block text-xs font-medium text-muted">
                  {reservation.reservation_number}
                </span>
                <span className="mt-2 block text-xs text-muted">
                  {info.roomTypes || '客室タイプ未設定'} · {info.paidGuests}名
                </span>
                <span className="mt-1 block">
                  <ReservationStatusBadge status={reservation.status} compact />
                </span>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
