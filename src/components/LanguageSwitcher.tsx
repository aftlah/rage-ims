import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { AppLocale } from '@/i18n'

type LanguageSwitcherProps = {
  className?: string
  compact?: boolean
}

export function LanguageSwitcher({
  className = '',
  compact = false,
}: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation()
  const current = (i18n.language.startsWith('en') ? 'en' : 'id') as AppLocale

  function setLocale(locale: AppLocale) {
    void i18n.changeLanguage(locale)
  }

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-lg border border-border/60 bg-muted/20 p-0.5 ${className}`}
      role="group"
      aria-label={t('language.label')}
    >
      {!compact ? (
        <span className="hidden pl-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase sm:inline">
          <Languages className="mr-1 inline size-3" aria-hidden />
          {t('language.label')}
        </span>
      ) : null}
      {(['en', 'id'] as const).map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => setLocale(locale)}
          className={[
            'rounded-md px-2.5 py-1.5 text-[11px] font-bold tracking-wide uppercase transition-colors min-h-[2rem] min-w-[2.25rem]',
            current === locale
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:text-foreground',
          ].join(' ')}
          aria-pressed={current === locale}
        >
          {locale}
        </button>
      ))}
    </div>
  )
}
