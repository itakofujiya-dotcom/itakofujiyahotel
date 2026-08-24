import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  SITE_LOCALE_STORAGE_KEY,
  siteTranslations,
  translateSiteText,
  type SiteLocale,
  type SiteTranslationKey,
} from './public-translations'
import { SiteLocaleContext } from './site-locale-context'
import { useLocalizedDom } from './useLocalizedDom'

export function SiteLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SiteLocale>(readStoredLocale)
  const setLocale = useCallback((nextLocale: SiteLocale) => {
    setLocaleState(nextLocale)
    try {
      window.localStorage.setItem(SITE_LOCALE_STORAGE_KEY, nextLocale)
    } catch {
      // The current selection still works if browser storage is unavailable.
    }
  }, [])
  const t = useCallback(
    (key: SiteTranslationKey) => siteTranslations[locale][key],
    [locale],
  )
  const translate = useCallback(
    (value: string) => translateSiteText(value, locale),
    [locale],
  )

  useLocalizedDom({
    locale,
    rootSelector: '[data-site-i18n-root]',
    ignoreSelector: '[data-site-i18n-ignore]',
    translate,
  })

  const context = useMemo(
    () => ({ locale, setLocale, t, translate }),
    [locale, setLocale, t, translate],
  )
  return (
    <SiteLocaleContext.Provider value={context}>
      {children}
    </SiteLocaleContext.Provider>
  )
}

function readStoredLocale(): SiteLocale {
  if (typeof window === 'undefined') return 'ja'
  try {
    return window.localStorage.getItem(SITE_LOCALE_STORAGE_KEY) === 'ko'
      ? 'ko'
      : 'ja'
  } catch {
    return 'ja'
  }
}
