import { STORAGE_KEYS } from '../config/game';
import { buildLocaleCandidates, resolveRuntimeBases } from './assets';

export const LOCALES = ['en', 'zh-TW', 'zh-CN', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export type Messages = Record<string, string>;

export function isLocale(value: string | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function getInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEYS.locale);
  if (isLocale(saved)) return saved;
  const browser = navigator.language;
  if (browser.startsWith('zh-TW') || browser.startsWith('zh-HK')) return 'zh-TW';
  if (browser.startsWith('zh')) return 'zh-CN';
  if (browser.startsWith('ja')) return 'ja';
  return 'en';
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const { appBase, styleBase, commonPath } = await resolveRuntimeBases();
  const localeFallbacks = locale === 'en' ? ['en'] : [locale, 'en'];
  for (const localeFallback of localeFallbacks) {
    const relativePath = `config/language/${localeFallback}.json`;
    const candidates = buildLocaleCandidates(relativePath, styleBase, commonPath, appBase);
    for (const candidate of candidates) {
      try {
        const response = await fetch(candidate);
        if (response.ok) return (await response.json()) as Messages;
      } catch {
        // Each language file independently advances to its next fallback.
      }
    }
  }
  console.warn('Class Break locale fallback exhausted', locale);
  return {};
}

export function translate(messages: Messages, key: string, values?: Record<string, string | number>): string {
  const template = messages[key] ?? key;
  if (!values) return template;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
