import { useContext } from 'react'
import { SiteLocaleContext } from './site-locale-context'

export function useSiteTranslation() {
  const context = useContext(SiteLocaleContext)
  if (!context)
    throw new Error('useSiteTranslation must be used in SiteLocaleProvider')
  return context
}
