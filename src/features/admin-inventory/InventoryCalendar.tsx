import {
  addDays,
  addMonths,
  format,
  isAfter,
  isBefore,
  isSameMonth,
  startOfDay,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getSundayStartCalendarDays } from '../admin-rates/rate-helpers'
import {
  getInventoryCalendarSummaries,
  getInventoryByDate,
  getSelectableInventoryWeekendDates,
  toggleInventoryDateSelection,
} from './inventory-helpers'
import type {
  RoomTypeAvailability,
  RoomTypeCapacity,
  RoomTypeInventory,
} from './types'

export function InventoryCalendar({
  month,
  selectedDates,
  capacities,
  inventory,
  availability,
  maxBookingDays,
  onMonthChange,
  onSelectionChange,
}: {
  month: Date
  selectedDates: ReadonlySet<string>
  capacities: RoomTypeCapacity[]
  inventory: RoomTypeInventory[]
  availability: RoomTypeAvailability[]
  maxBookingDays: number
  onMonthChange: (month: Date) => void
  onSelectionChange: (dates: Set<string>) => void
}) {
  const today = startOfDay(new Date())
  const bookingEnd = addDays(today, maxBookingDays)
  const inventoryByDate = getInventoryByDate(inventory)
  const days = getSundayStartCalendarDays(month)

  function selectWeekends() {
    const next = new Set(selectedDates)
    for (const stayDate of getSelectableInventoryWeekendDates(
      month,
      today,
      bookingEnd,
    ))
      next.add(stayDate)
    onSelectionChange(next)
  }

  return (
    <section className="border border-line bg-surface p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(subMonths(month, 1))}
          className="grid size-11 place-items-center"
          aria-label="前の月"
        >
          <ChevronLeft />
        </button>
        <h2 className="font-serif text-xl">{format(month, 'yyyy年M月')}</h2>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          className="grid size-11 place-items-center"
          aria-label="次の月"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold text-muted">
        {['日', '月', '火', '水', '木', '金', '土'].map((weekday) => (
          <div key={weekday} className="py-2">
            {weekday}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 border-l border-t border-line">
        {days.map((day) => {
          const stayDate = format(day, 'yyyy-MM-dd')
          const sameMonth = isSameMonth(day, month)
          const disabled =
            !sameMonth || isBefore(day, today) || isAfter(day, bookingEnd)
          const selected = selectedDates.has(stayDate)
          const rows = inventoryByDate.get(stayDate) ?? []
          const summaries = getInventoryCalendarSummaries(
            capacities,
            rows,
            availability,
            stayDate,
          )
          const allStopped =
            rows.length === capacities.length &&
            summaries.every((summary) => summary.sellableQuantity === 0)

          return (
            <button
              key={stayDate}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() =>
                onSelectionChange(
                  toggleInventoryDateSelection(selectedDates, stayDate),
                )
              }
              className={`min-h-24 border-b border-r border-line p-1.5 text-left align-top transition sm:min-h-28 sm:p-2 ${!sameMonth ? 'bg-stone-50 text-muted/40' : ''} ${selected ? 'ring-2 ring-inset ring-accent' : ''} ${disabled ? 'cursor-not-allowed opacity-45' : 'hover:bg-background'}`}
            >
              <span className="text-xs sm:text-sm">{format(day, 'd')}</span>
              {!disabled && (
                <span className="mt-2 block space-y-1 text-[9px] text-muted sm:text-[10px]">
                  {summaries.map((summary) => (
                    <span key={summary.roomTypeId} className="block truncate">
                      {summary.code === 'japanese' ? '和' : '洋'}{' '}
                      {summary.sellableQuantity}
                      {summary.isDefault ? '*' : ''}
                    </span>
                  ))}
                </span>
              )}
              {allStopped && (
                <span className="mt-1 block rounded bg-red-700 px-1 py-0.5 text-center text-[9px] text-white">
                  販売停止
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={selectWeekends}
          className="min-h-10 border border-line px-4 text-xs font-semibold"
        >
          この月の土日を選択
        </button>
        <button
          type="button"
          onClick={() => onSelectionChange(new Set())}
          className="min-h-10 border border-line px-4 text-xs font-semibold"
        >
          すべて選択解除
        </button>
      </div>
      <p className="mt-3 text-sm font-semibold">
        選択中: {selectedDates.size}日
      </p>
      <p className="mt-3 text-xs text-muted">
        *
        は日別の販売数が未設定で、active客室数を販売上限に使う日です。表示数は予約済み客室を差し引いた残数です。編集可能期間は本日から
        {maxBookingDays}日後までです。
      </p>
    </section>
  )
}
