import { useContext } from 'react'
import { AdminLocaleContext } from './admin-locale-context'

export function useAdminTranslation() {
  const context = useContext(AdminLocaleContext)
  if (!context)
    throw new Error('useAdminTranslation must be used in AdminLocaleProvider')
  return context
}
