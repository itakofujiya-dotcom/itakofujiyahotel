import { createContext } from 'react'
import type { SiteLocale, SiteTranslationKey } from './public-translations'

export type SiteLocaleContextValue = {
  locale: SiteLocale
  setLocale: (locale: SiteLocale) => void
  t: (key: SiteTranslationKey) => string
  translate: (value: string) => string
}

export const SiteLocaleContext = createContext<SiteLocaleContextValue | null>(
  null,
)
