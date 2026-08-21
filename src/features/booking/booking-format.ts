import { differenceInCalendarDays, format, parseISO } from 'date-fns'

export function formatBookingDate(date: string) {
  return format(parseISO(date), 'yyyy年M月d日')
}

export function formatShortBookingDate(date: string) {
  return format(parseISO(date), 'M月d日')
}

export function getStayNights(checkIn: string, checkOut: string) {
  return differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
}
