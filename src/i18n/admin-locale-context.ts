import { createContext } from 'react'
import type { AdminLocale, AdminTranslationKey } from './admin-translations'

export type AdminLocaleContextValue = {
  locale: AdminLocale
  setLocale: (locale: AdminLocale) => void
  t: (key: AdminTranslationKey) => string
  translate: (value: string) => string
}

export const AdminLocaleContext = createContext<AdminLocaleContextValue | null>(
  null,
)
