import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  ADMIN_LOCALE_STORAGE_KEY,
  adminTranslations,
  translateAdminText,
  type AdminLocale,
  type AdminTranslationKey,
} from './admin-translations'
import { AdminLocaleContext } from './admin-locale-context'
import { useLocalizedDom } from './useLocalizedDom'

export function AdminLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AdminLocale>(readStoredLocale)

  const setLocale = useCallback((nextLocale: AdminLocale) => {
    setLocaleState(nextLocale)
    try {
      window.localStorage.setItem(ADMIN_LOCALE_STORAGE_KEY, nextLocale)
    } catch {
      // The in-memory selection still works when storage is unavailable.
    }
  }, [])

  const t = useCallback(
    (key: AdminTranslationKey) => adminTranslations[locale][key],
    [locale],
  )
  const translate = useCallback(
    (value: string) => translateAdminText(value, locale),
    [locale],
  )
  useLocalizedDom({
    locale,
    rootSelector: '[data-admin-i18n-root]',
    ignoreSelector: '[data-admin-i18n-ignore]',
    translate,
  })

  const value = useMemo(
    () => ({ locale, setLocale, t, translate }),
    [locale, setLocale, t, translate],
  )

  return (
    <AdminLocaleContext.Provider value={value}>
      {children}
    </AdminLocaleContext.Provider>
  )
}

function readStoredLocale(): AdminLocale {
  if (typeof window === 'undefined') return 'ja'
  try {
    return window.localStorage.getItem(ADMIN_LOCALE_STORAGE_KEY) === 'ko'
      ? 'ko'
      : 'ja'
  } catch {
    return 'ja'
  }
}
