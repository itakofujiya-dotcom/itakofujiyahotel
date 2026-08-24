import { Languages } from 'lucide-react'
import { useAdminTranslation } from '../../i18n/useAdminTranslation'

export function AdminLocaleSwitcher({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale, t } = useAdminTranslation()
  const inactive = dark ? 'text-white/55' : 'text-muted'
  const active = dark ? 'bg-white text-[#26302b]' : 'bg-moss text-white'

  return (
    <div
      className="inline-flex items-center gap-1"
      aria-label={t('common.language')}
      data-admin-i18n-ignore
    >
      <Languages size={15} aria-hidden="true" />
      {(['ko', 'ja'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={`min-h-9 px-2.5 text-xs font-semibold transition ${
            locale === option ? active : inactive
          }`}
        >
          {option === 'ko' ? t('common.korean') : t('common.japanese')}
        </button>
      ))}
    </div>
  )
}
