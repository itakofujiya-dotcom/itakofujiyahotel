import { differenceInCalendarDays } from 'date-fns'
import type { BookingSearchParams } from './types'

export type JapanDateTime = { date: string; time: string }

export function getJapanDateTime(now = new Date()): JapanDateTime {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return {
    date: `${value('year')}-${value('month')}-${value('day')}`,
    time: `${value('hour')}:${value('minute')}`,
  }
}

export function distributePaidGuests(
  paidGuests: number,
  roomCount: number,
): number[] | null {
  if (
    !Number.isInteger(paidGuests) ||
    !Number.isInteger(roomCount) ||
    roomCount < 1 ||
    roomCount > 4 ||
    paidGuests < roomCount ||
    paidGuests > roomCount * 4
  )
    return null
  const base = Math.floor(paidGuests / roomCount)
  const remainder = paidGuests % roomCount
  return Array.from(
    { length: roomCount },
    (_, index) => base + (index < remainder ? 1 : 0),
  )
}

export function validateBookingSearch(
  values: BookingSearchParams,
  japanNow = getJapanDateTime(),
): string | null {
  if (!values.checkIn || !values.checkOut)
    return 'チェックイン日とチェックアウト日を選択してください。'
  if (values.checkIn < japanNow.date) return '過去の日付は選択できません。'
  if (values.checkOut <= values.checkIn)
    return 'チェックアウト日はチェックイン日より後にしてください。'

  const checkIn = new Date(`${values.checkIn}T00:00:00`)
  const checkOut = new Date(`${values.checkOut}T00:00:00`)
  const today = new Date(`${japanNow.date}T00:00:00`)
  if (differenceInCalendarDays(checkOut, checkIn) > 10)
    return '宿泊は最大10泊までです。'
  if (differenceInCalendarDays(checkIn, today) > 40)
    return 'ご予約は本日から40日後までです。'
  if (values.checkIn === japanNow.date && japanNow.time > '12:00')
    return '当日のご予約受付は12:00までです。'
  if (
    !Number.isInteger(values.adults) ||
    values.adults < 1 ||
    !Number.isInteger(values.paidChildren) ||
    values.paidChildren < 0 ||
    !Number.isInteger(values.freePreschoolChildren) ||
    values.freePreschoolChildren < 0
  )
    return '人数を確認してください。'
  if (
    !distributePaidGuests(values.adults + values.paidChildren, values.roomCount)
  )
    return '有料のお客様は1室あたり1〜4名になるように指定してください。'
  return null
}

export function calculateMinimumAvailability({
  activeRooms,
  stayDates,
  inventoryByDate,
  bookedByDate,
}: {
  activeRooms: number
  stayDates: string[]
  inventoryByDate: ReadonlyMap<string, number>
  bookedByDate: ReadonlyMap<string, number>
}): number {
  if (stayDates.length === 0) return 0
  return Math.min(
    ...stayDates.map((date) => {
      const configured = inventoryByDate.get(date) ?? activeRooms
      const sellable = Math.min(configured, activeRooms)
      return Math.max(0, sellable - (bookedByDate.get(date) ?? 0))
    }),
  )
}

export function parseBookingSearchParams(
  params: URLSearchParams,
): BookingSearchParams | null {
  const checkIn = params.get('checkIn') ?? ''
  const checkOut = params.get('checkOut') ?? ''
  if (!checkIn || !checkOut) return null
  const parseInteger = (name: string, fallback: number) => {
    const value = Number(params.get(name) ?? fallback)
    return Number.isInteger(value) ? value : fallback
  }
  return {
    checkIn,
    checkOut,
    adults: parseInteger('adults', 2),
    paidChildren: parseInteger('paidChildren', 0),
    freePreschoolChildren: parseInteger('freePreschoolChildren', 0),
    roomCount: parseInteger('roomCount', 1),
  }
}
