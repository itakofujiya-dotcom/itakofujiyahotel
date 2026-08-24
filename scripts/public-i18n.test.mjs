import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
    "['和室', '화실']",
    "['洋室', '양실']",
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

test('keeps public room names independent from Korean admin room labels', () => {
  assert.ok(translations.includes("['和室', '화실']"))
  assert.ok(translations.includes("['洋室', '양실']"))
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
