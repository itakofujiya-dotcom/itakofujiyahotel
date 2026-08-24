import cancellationJa from './policies/cancellation-ja.txt?raw'
import cancellationKo from './policies/cancellation-ko.txt?raw'
import privacyJa from './policies/privacy-ja.txt?raw'
import privacyKo from './policies/privacy-ko.txt?raw'
import termsJa from './policies/terms-ja.txt?raw'
import termsKo from './policies/terms-ko.txt?raw'
import type { SiteLocale } from '../i18n/public-translations'

export type PolicyKind = 'terms' | 'privacy' | 'cancellation'

export type PolicyDocument = {
  title: string
  hotelName: string
  content: string
}

const policySources: Record<PolicyKind, Record<SiteLocale, string>> = {
  terms: { ja: termsJa, ko: termsKo },
  privacy: { ja: privacyJa, ko: privacyKo },
  cancellation: { ja: cancellationJa, ko: cancellationKo },
}

export function getPolicyDocument(
  kind: PolicyKind,
  locale: SiteLocale,
): PolicyDocument {
  const lines = policySources[kind][locale]
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim()
    .split('\n')

  return {
    title: lines[0]?.trim() ?? '',
    hotelName: lines[1]?.trim() ?? '',
    content: lines.slice(2).join('\n').trim(),
  }
}
