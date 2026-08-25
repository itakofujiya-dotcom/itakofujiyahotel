import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { URL } from 'node:url'

function read(relativePath) {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const app = read('../src/app/App.tsx')
const footer = read('../src/components/layout/Footer.tsx')
const bookingConfirm = read('../src/pages/public/BookingConfirmPage.tsx')
const policyPage = read('../src/pages/public/PolicyPage.tsx')
const policyContent = read('../src/content/policies.ts')
const translations = read('../src/i18n/public-translations.ts')
const globalStyles = read('../src/styles/global.css')

const documents = {
  termsJa: read('../src/content/policies/terms-ja.txt'),
  termsKo: read('../src/content/policies/terms-ko.txt'),
  privacyJa: read('../src/content/policies/privacy-ja.txt'),
  privacyKo: read('../src/content/policies/privacy-ko.txt'),
  cancellationJa: read('../src/content/policies/cancellation-ja.txt'),
  cancellationKo: read('../src/content/policies/cancellation-ko.txt'),
}

test('registers three public policy routes and preserves the legacy route', () => {
  assert.match(app, /path: '\/terms', element: <PolicyPage kind="terms"/)
  assert.match(app, /path: '\/privacy', element: <PolicyPage kind="privacy"/)
  assert.match(
    app,
    /path: '\/cancellation-policy',[\s\S]*<PolicyPage kind="cancellation"/,
  )
  assert.match(
    app,
    /path: '\/policies', element: <Navigate to="\/terms" replace/,
  )
})

test('ships the supplied Japanese and Korean policy documents', () => {
  assert.match(documents.termsJa, /^宿泊約款/)
  assert.match(documents.termsKo, /^숙박약관/)
  assert.match(documents.privacyJa, /^プライバシーポリシー/)
  assert.match(documents.privacyKo, /^개인정보처리방침/)
  assert.match(documents.cancellationJa, /^キャンセルポリシー/)
  assert.match(documents.cancellationKo, /^취소정책/)
  assert.match(policyContent, /Record<PolicyKind, Record<SiteLocale, string>>/)
  assert.match(policyPage, /getPolicyDocument\(kind, locale\)/)
  assert.match(policyPage, /data-site-i18n-ignore/)
})

test('footer links directly to all three policy pages', () => {
  assert.match(footer, /to="\/terms">宿泊約款/)
  assert.match(footer, /to="\/privacy">プライバシーポリシー/)
  assert.match(footer, /to="\/cancellation-policy">キャンセルポリシー/)
  assert.ok(translations.includes("['宿泊約款', '숙박약관']"))
  assert.ok(
    translations.includes("['プライバシーポリシー', '개인정보처리방침']"),
  )
})

test('booking consent links open documents without replacing booking state', () => {
  for (const path of ['/privacy', '/terms', '/cancellation-policy'])
    assert.ok(bookingConfirm.includes(`to="${path}"`))
  assert.match(bookingConfirm, /target="_blank"/)
  assert.match(bookingConfirm, /rel="noreferrer"/)
  assert.match(
    bookingConfirm,
    /disabled={!privacyConsent \|\| !policyConsent \|\| isSubmitting}/,
  )
})

test('published cancellation documents match the database policy boundaries', () => {
  for (const document of [documents.cancellationJa, documents.termsJa]) {
    assert.match(document, /8日前まで[\s\S]*無料/)
    assert.match(document, /7日前～4日前[\s\S]*30％/)
    assert.match(document, /3日前～2日前[\s\S]*50％/)
    assert.match(document, /前日[\s\S]*100％/)
    assert.match(document, /当日[\s\S]*100％/)
    assert.match(document, /無断不泊（No-show）[\s\S]*100％/)
  }
  for (const document of [documents.cancellationKo, documents.termsKo]) {
    assert.match(document, /8일 전까지[\s\S]*무료/)
    assert.match(document, /7일 전~4일 전[\s\S]*30%/)
    assert.match(document, /3일 전~2일 전[\s\S]*50%/)
    assert.match(document, /전날[\s\S]*100%/)
    assert.match(document, /당일[\s\S]*100%/)
    assert.match(document, /노쇼\(No-show\)[\s\S]*100%/)
  }
  assert.match(
    documents.cancellationJa,
    /オンラインでのキャンセルはチェックイン日の8日前まで可能です。/,
  )
  assert.match(
    documents.cancellationJa,
    /それ以降のキャンセルについては、ホテルまで直接お問い合わせください。/,
  )
  assert.match(
    documents.cancellationKo,
    /온라인 취소는 체크인 8일 전까지 가능합니다\./,
  )
  assert.match(
    documents.cancellationKo,
    /그 이후의 취소는 호텔로 직접 문의해 주세요\./,
  )
})

test('policy layout prevents long content from widening the viewport', () => {
  assert.match(policyPage, /max-w-\[1500px\]/)
  assert.match(
    policyPage,
    /xl:grid-cols-\[minmax\(0,960px\)_minmax\(240px,280px\)\]/,
  )
  assert.match(policyPage, /min-w-0/)
  assert.match(policyPage, /overflow-hidden/)
  assert.match(policyPage, /break-words/)
  assert.match(policyPage, /\[overflow-wrap:anywhere\]/)
  assert.doesNotMatch(policyPage, /overflow-x-hidden/)
})

test('builds stable localized article anchors and supports direct hashes', () => {
  assert.match(policyPage, /return `article-\$\{articleNumber\}`/)
  assert.match(policyPage, /id=\{section\.id\}/)
  assert.match(policyPage, /scroll-mt-32/)
  assert.match(policyPage, /window\.location\.hash\.slice\(1\)/)
  assert.match(policyPage, /scrollIntoView\(\{ block: 'start' \}\)/)
  assert.match(globalStyles, /scroll-behavior: smooth/)
})

test('uses a sticky desktop TOC and a compact mobile/tablet TOC', () => {
  assert.match(policyPage, /<details className="[^"]*xl:hidden/)
  assert.match(
    policyPage,
    /<aside className="hidden min-w-0 self-start xl:sticky xl:top-28 xl:block"/,
  )
  assert.doesNotMatch(policyPage, /<div className="sticky top-28/)
  assert.match(policyPage, /max-h-\[calc\(100vh-8rem\)\]/)
  assert.match(policyPage, /max-h-[^"\n]*overflow-y-auto/)
  assert.match(policyPage, /<nav aria-label=\{label\}>/)
  assert.match(policyPage, /aria-current=\{isActive \? 'location'/)
  assert.match(translations, /'policy\.tableOfContents': '目次'/)
  assert.match(translations, /'policy\.tableOfContents': '목차'/)
})

test('tracks the currently read policy section without hardcoded titles', () => {
  assert.match(policyPage, /const headerOffset = 128/)
  assert.match(policyPage, /getBoundingClientRect\(\)\.top <= headerOffset/)
  assert.match(policyPage, /window\.addEventListener\('scroll'/)
  assert.match(policyPage, /window\.addEventListener\('hashchange'/)
  assert.match(policyPage, /document\.documentElement\.scrollHeight - 2/)
  assert.doesNotMatch(policyPage, /第1条 宿泊契約の申込み/)
})

test('Japanese policy documents do not expose Korean drafting notes', () => {
  for (const document of [
    documents.termsJa,
    documents.privacyJa,
    documents.cancellationJa,
  ])
    assert.doesNotMatch(document, /[가-힣]/)
})
