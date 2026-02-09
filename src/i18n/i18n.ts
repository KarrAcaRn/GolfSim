import en from './locales/en.json';
import de from './locales/de.json';

type Translations = typeof en;
export type TranslationKey = keyof Translations;

const locales: Record<string, Record<string, string>> = { en, de };
let currentLocale = 'en';

export function setLocale(locale: string): void {
  if (locales[locale]) {
    currentLocale = locale;
  }
}

export function getLocale(): string {
  return currentLocale;
}

export function getAvailableLocales(): string[] {
  return Object.keys(locales);
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  let text = locales[currentLocale]?.[key] ?? locales['en'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{{${k}}}`, String(v));
    }
  }
  return text;
}
