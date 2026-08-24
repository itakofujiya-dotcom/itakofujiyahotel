import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'
import {
  ADMIN_LOCALE_STORAGE_KEY,
  adminTranslations,
  translateAdminText,
} from '../src/i18n/admin-translations.ts'

test('keeps Japanese as the default resource and provides Korean navigation', () => {
  assert.equal(adminTranslations.ja['navigation.dashboard'], 'ダッシュボード')
  assert.equal(adminTranslations.ko['navigation.dashboard'], '대시보드')
  assert.equal(adminTranslations.ko['navigation.reservations'], '예약관리')
  assert.equal(adminTranslations.ja['navigation.sales'], '売上管理')
  assert.equal(adminTranslations.ko['navigation.sales'], '매출관리')
  assert.equal(ADMIN_LOCALE_STORAGE_KEY, 'admin_locale')
})

test('switches core reservation, payment, meal, and room labels to Korean', () => {
  assert.equal(translateAdminText('予約確定', 'ko'), '예약 확정')
  assert.equal(translateAdminText('キャンセル済み', 'ko'), '취소 완료')
  assert.equal(translateAdminText('銀行振込', 'ko'), '계좌이체')
  assert.equal(translateAdminText('支払い済み', 'ko'), '결제 완료')
  assert.equal(translateAdminText('朝食付き', 'ko'), '조식 포함')
  assert.equal(translateAdminText('朝食・夕食付き', 'ko'), '조식·석식 포함')
  assert.equal(translateAdminText('和室', 'ko'), '다다미방')
  assert.equal(translateAdminText('洋室', 'ko'), '침대방')
})

test('translates required admin sections and cancellation messages', () => {
  assert.equal(translateAdminText('顧客メモ', 'ko'), '고객 메모')
  assert.equal(translateAdminText('基本設定', 'ko'), '기본설정')
  assert.equal(translateAdminText('変更を保存', 'ko'), '변경사항 저장')
  assert.equal(
    translateAdminText('返金対応が必要です', 'ko'),
    '환불 처리가 필요합니다',
  )
  assert.equal(translateAdminText('キャンセル料', 'ko'), '취소 수수료')
})

test('uses explicit keys for reservation tabs and managed booking action', () => {
  assert.equal(adminTranslations.ja['reservations.tab.list'], '一覧')
  assert.equal(adminTranslations.ko['reservations.tab.list'], '목록')
  assert.equal(
    adminTranslations.ja['reservations.action.createManaged'],
    '電話・管理者予約を登録',
  )
  assert.equal(
    adminTranslations.ko['reservations.action.createManaged'],
    '전화·관리자 예약 등록',
  )
  const page = readFileSync(
    new URL('../src/pages/admin/ReservationsAdminPage.tsx', import.meta.url),
    'utf8',
  )
  assert.match(page, /t\('reservations\.tab\.list'\)/)
  assert.match(page, /t\('reservations\.action\.createManaged'\)/)
})

test('removes reservation page Japanese remnants in Korean mode', () => {
  const cases = {
    一覧: '목록',
    '電話・管理者予約を登録': '전화·관리자 예약 등록',
    運営フィルター: '운영 필터',
    有効なチェックイン: '유효한 체크인',
    有効なチェックアウト: '유효한 체크아웃',
    '銀行振込・未入金': '계좌이체·미입금',
    チェックイン日: '체크인 날짜',
    チェックアウト日: '체크아웃 날짜',
    宿泊日: '숙박일',
    食事プラン: '식사 플랜',
    客室を追加: '객실 추가',
    客室料金: '객실 요금',
    夕食追加: '석식 추가',
    客室合計: '객실 합계',
    処理日時: '처리 일시',
  }
  for (const [japanese, korean] of Object.entries(cases))
    assert.equal(translateAdminText(japanese, 'ko'), korean)
})

test('removes known Japanese and English remnants from Korean admin UI', () => {
  assert.equal(translateAdminText('カレンダー', 'ko'), '캘린더')
  assert.equal(translateAdminText('該当なし', 'ko'), '해당 없음')
  assert.equal(translateAdminText('すべて', 'ko'), '전체')
  assert.equal(translateAdminText('入力範囲: 0〜8室', 'ko'), '입력 범위: 0〜8실')
  assert.equal(
    translateAdminText('週末料金（+1,000円）', 'ko'),
    '주말 요금 (+1,000엔)',
  )
  assert.equal(
    translateAdminText('高度な料金設定（最終金額の直接指定）', 'ko'),
    '고급 요금 설정 (최종 금액 직접 지정)',
  )
  assert.equal(translateAdminText('SELECTED DATES', 'ko'), '선택 날짜')
  assert.equal(
    translateAdminText('LEGACY OVERRIDES', 'ko'),
    '날짜별 최종 금액',
  )
  assert.equal(translateAdminText('CALENDAR APPLICATION', 'ko'), '캘린더 적용')
  assert.equal(translateAdminText('IN 3', 'ko'), '체크인 3')
  assert.equal(translateAdminText('OUT 2', 'ko'), '체크아웃 2')
  assert.equal(translateAdminText('NEW', 'ko'), '신규')
  assert.equal(translateAdminText('カード', 'ko'), '카드')
  assert.equal(translateAdminText('本日チェックイン', 'ko'), '오늘 체크인')
  assert.equal(
    translateAdminText('客室（2/4室）', 'ko'),
    '객실 (2/4실)',
  )
})

test('formats Japanese calendar text naturally in Korean', () => {
  assert.equal(translateAdminText('2026年8月24日', 'ko'), '2026년 8월 24일')
  assert.equal(translateAdminText('2026年8月', 'ko'), '2026년 8월')
  assert.equal(
    translateAdminText('2026/08/24 15:00', 'ko'),
    '2026년 08월 24일 15:00',
  )
  assert.equal(translateAdminText('選択中: 4日', 'ko'), '선택 중: 4일')
})

test('never changes API payload codes or the Japanese locale output', () => {
  for (const value of [
    'pending',
    'confirmed',
    'checked_in',
    'checked_out',
    'cancelled',
    'no_show',
    'bank_transfer',
    'pay_at_hotel',
    'breakfast',
    'breakfast_dinner',
  ])
    assert.equal(translateAdminText(value, 'ko'), value)
  assert.equal(translateAdminText('予約管理', 'ja'), '予約管理')
})

test('provider wraps the app and both admin entry screens expose localization roots', () => {
  const app = readFileSync(
    new URL('../src/app/App.tsx', import.meta.url),
    'utf8',
  )
  const layout = readFileSync(
    new URL('../src/layouts/AdminLayout.tsx', import.meta.url),
    'utf8',
  )
  const login = readFileSync(
    new URL('../src/pages/admin/LoginPage.tsx', import.meta.url),
    'utf8',
  )
  assert.match(app, /<AdminLocaleProvider>/)
  assert.match(layout, /data-admin-i18n-root/)
  assert.match(layout, /<AdminLocaleSwitcher/)
  assert.match(login, /data-admin-i18n-root/)
  assert.match(login, /<AdminLocaleSwitcher/)
})

test('locale provider persists selection and translates dynamic attributes', () => {
  const provider = readFileSync(
    new URL('../src/i18n/AdminLocaleProvider.tsx', import.meta.url),
    'utf8',
  )
  const commonDom = readFileSync(
    new URL('../src/i18n/useLocalizedDom.ts', import.meta.url),
    'utf8',
  )
  assert.match(provider, /localStorage\.setItem\(ADMIN_LOCALE_STORAGE_KEY/)
  assert.match(provider, /localStorage\.getItem\(ADMIN_LOCALE_STORAGE_KEY\)/)
  assert.match(provider, /useLocalizedDom/)
  assert.match(commonDom, /'placeholder', 'title', 'aria-label'/)
  assert.match(commonDom, /MutationObserver/)
})
