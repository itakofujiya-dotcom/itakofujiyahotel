import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { SiteLocale } from '../../i18n/public-translations'

export function formatBookingDate(date: string, locale: SiteLocale = 'ja') {
  return new Intl.DateTimeFormat(getDateLanguageTag(locale), {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(parseHotelDate(date))
}

export function formatShortBookingDate(
  date: string,
  locale: SiteLocale = 'ja',
) {
  return new Intl.DateTimeFormat(getDateLanguageTag(locale), {
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(parseHotelDate(date))
}

export function getStayNights(checkIn: string, checkOut: string) {
  return differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
}

function parseHotelDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function getDateLanguageTag(locale: SiteLocale): 'ja-JP' | 'ko-KR' {
  return locale === 'ja' ? 'ja-JP' : 'ko-KR'
}
