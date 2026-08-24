import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { URL } from 'node:url'

const translations = readFileSync(
  new URL('../src/i18n/public-translations.ts', import.meta.url),
  'utf8',
)
const adminTranslations = readFileSync(
  new URL('../src/i18n/admin-translations.ts', import.meta.url),
  'utf8',
)
const combinedTranslations = `${translations}\n${adminTranslations}`
const provider = readFileSync(
  new URL('../src/i18n/SiteLocaleProvider.tsx', import.meta.url),
  'utf8',
)
const commonDom = readFileSync(
  new URL('../src/i18n/useLocalizedDom.ts', import.meta.url),
  'utf8',
)
const app = readFileSync(new URL('../src/app/App.tsx', import.meta.url), 'utf8')
const layout = readFileSync(
  new URL('../src/layouts/PublicLayout.tsx', import.meta.url),
  'utf8',
)
const header = readFileSync(
  new URL('../src/components/layout/Header.tsx', import.meta.url),
  'utf8',
)
const bookingSearch = readFileSync(
  new URL('../src/components/booking/BookingSearch.tsx', import.meta.url),
  'utf8',
)
const localizedDateInput = readFileSync(
  new URL(
    '../src/components/booking/LocalizedDateInput.tsx',
    import.meta.url,
  ),
  'utf8',
)
const bookingFormat = readFileSync(
  new URL('../src/features/booking/booking-format.ts', import.meta.url),
  'utf8',
)

test('uses a site locale key independent from the admin locale', () => {
  assert.match(translations, /SITE_LOCALE_STORAGE_KEY = 'site_locale'/)
  assert.doesNotMatch(translations, /SITE_LOCALE_STORAGE_KEY = 'admin_locale'/)
  assert.match(provider, /localStorage\.getItem\(SITE_LOCALE_STORAGE_KEY\)/)
  assert.match(provider, /localStorage\.setItem\(SITE_LOCALE_STORAGE_KEY/)
})

test('wraps public and admin locale providers without sharing state', () => {
  assert.match(app, /<SiteLocaleProvider>/)
  assert.match(app, /<AdminLocaleProvider>/)
  assert.match(layout, /data-site-i18n-root/)
  assert.match(provider, /data-site-i18n-root/)
  assert.match(commonDom, /document\.documentElement\.lang = locale/)
})

test('exposes the locale switcher in the header for desktop and mobile widths', () => {
  assert.match(header, /<SiteLocaleSwitcher/)
  assert.match(header, /flex items-center gap-2/)
  assert.match(header, /lg:hidden/)
})

test('contains translations for navigation, booking, cancellation, and policy UI', () => {
  for (const expected of [
    "['客室', '객실']",
    "['館内施設', '호텔 시설']",
    "['空室検索・宿泊予約', '객실 검색·숙박 예약']",
    "['食事プラン', '식사 플랜']",
    "['予約確認・キャンセル', '예약 조회·취소']",
    "['キャンセル料', '취소 수수료']",
    "['返金対象額', '환불 대상 금액']",
    "['ご利用案内', '이용 안내']",
  ])
    assert.ok(combinedTranslations.includes(expected), `missing ${expected}`)
})

test('contains fixed-code display translations while preserving DB code strings', () => {
  for (const expected of [
    "['和室', '다다미방']",
    "['洋室', '침대방']",
    "['朝食付き', '조식 포함']",
    "['朝食・夕食付き', '조식·석식 포함']",
    "['銀行振込', '계좌이체']",
    "['現地払い', '현장결제']",
    "['予約確定', '예약 확정']",
  ])
    assert.ok(combinedTranslations.includes(expected), `missing ${expected}`)

  for (const code of [
    'pending',
    'confirmed',
    'bank_transfer',
    'pay_at_hotel',
    'breakfast',
    'breakfast_dinner',
  ])
    assert.doesNotMatch(translations, new RegExp(`'${code}', '[가-힣]`))
})

test('uses the approved Korean room names in public and admin UI', () => {
  assert.ok(translations.includes("['和室', '다다미방']"))
  assert.ok(translations.includes("['洋室', '침대방']"))
  assert.ok(adminTranslations.includes("['和室', '다다미방']"))
  assert.ok(adminTranslations.includes("['洋室', '침대방']"))
})

test('uses the common DOM localization foundation for admin and public UI', () => {
  const adminProvider = readFileSync(
    new URL('../src/i18n/AdminLocaleProvider.tsx', import.meta.url),
    'utf8',
  )
  assert.match(provider, /useLocalizedDom/)
  assert.match(adminProvider, /useLocalizedDom/)
  assert.match(commonDom, /'placeholder', 'title', 'aria-label'/)
  assert.match(commonDom, /MutationObserver/)
})

test('localizes native booking controls explicitly instead of relying on browser UI language', () => {
  for (const expected of [
    "'booking.checkIn': 'チェックイン'",
    "'booking.checkIn': '체크인'",
    "'booking.dateInputFormat': '年. 月. 日.'",
    "'booking.dateInputFormat': '연도. 월. 일.'",
  ])
    assert.ok(translations.includes(expected), `missing ${expected}`)

  assert.match(bookingSearch, /<LocalizedDateInput/)
  assert.match(localizedDateInput, /type="date"/)
  assert.match(localizedDateInput, /lang=\{getSiteLanguageTag\(locale\)\}/)
  assert.match(localizedDateInput, /localized-date-input--empty/)
  assert.match(localizedDateInput, /t\('booking\.dateInputFormat'\)/)
})

test('formats public booking dates with the active locale in Japan time', () => {
  assert.match(bookingFormat, /new Intl\.DateTimeFormat/)
  assert.match(bookingFormat, /timeZone: 'Asia\/Tokyo'/)
  assert.match(bookingFormat, /locale: SiteLocale = 'ja'/)
  assert.doesNotMatch(bookingFormat, /yyyy年M月d日/)
})

test('does not hardcode Korean UI copy in Japanese-first public render files', () => {
  const roots = [
    'src/pages/public',
    'src/components/booking',
    'src/components/layout',
    'src/components/rooms',
    'src/features/booking',
    'src/features/public-reservation',
    'src/data',
  ]
  const files = roots.flatMap((root) =>
    readdirSync(new URL(`../${root}/`, import.meta.url), {
      recursive: true,
    })
      .filter((name) => /\.(ts|tsx)$/.test(name))
      .map((name) => join(root, name)),
  )

  for (const file of files) {
    if (
      file.endsWith('PolicyPage.tsx') ||
      file.endsWith('public-labels.ts')
    )
      continue
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(source, /[가-힣]/, `unexpected Korean copy in ${file}`)
  }
})
