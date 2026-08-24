import { Languages } from 'lucide-react'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'

export function SiteLocaleSwitcher() {
  const { locale, setLocale, t } = useSiteTranslation()
  return (
    <div
      className="inline-flex shrink-0 items-center gap-0.5"
      aria-label={t('common.language')}
      data-site-i18n-ignore
    >
      <Languages size={15} className="hidden text-muted sm:block" />
      {(['ko', 'ja'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setLocale(option)}
          aria-pressed={locale === option}
          className={`min-h-9 px-2 text-[11px] font-semibold transition sm:px-2.5 sm:text-xs ${
            locale === option ? 'bg-moss text-white' : 'text-muted'
          }`}
        >
          {option === 'ko' ? t('common.korean') : t('common.japanese')}
        </button>
      ))}
    </div>
  )
}
