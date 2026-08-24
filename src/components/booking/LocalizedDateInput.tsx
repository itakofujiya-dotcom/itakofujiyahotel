import type { ChangeEvent } from 'react'
import { getSiteLanguageTag } from '../../i18n/public-translations'
import { useSiteTranslation } from '../../i18n/useSiteTranslation'

type Props = {
  label: string
  min: string
  value: string
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

export function LocalizedDateInput({
  label,
  min,
  value,
  onChange,
}: Props) {
  const { locale, t } = useSiteTranslation()
  const formatHint = t('booking.dateInputFormat')

  return (
    <span className="relative block">
      <input
        key={`${label}-${locale}`}
        className={`admin-input localized-date-input ${value ? '' : 'localized-date-input--empty'}`}
        type="date"
        lang={getSiteLanguageTag(locale)}
        aria-label={`${label} (${formatHint})`}
        title={formatHint}
        min={min}
        value={value}
        onChange={onChange}
      />
      {!value && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center bg-surface pr-2 text-sm text-muted"
        >
          {formatHint}
        </span>
      )}
    </span>
  )
}
