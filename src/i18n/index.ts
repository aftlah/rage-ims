import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './locales/en.json'
import id from './locales/id.json'

export const LOCALE_STORAGE_KEY = 'rage-ims-locale'
export const supportedLocales = ['en', 'id'] as const
export type AppLocale = (typeof supportedLocales)[number]

function readStoredLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY)
    if (stored === 'en' || stored === 'id') return stored
  } catch {
    /* ignore */
  }
  return 'id'
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    id: { translation: id },
  },
  lng: readStoredLocale(),
  fallbackLng: 'id',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng
  document.title = i18n.t('app.title')
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, lng)
  } catch {
    /* ignore */
  }
})

document.documentElement.lang = i18n.language
document.title = i18n.t('app.title')

export default i18n
