import { STORAGE_KEYS } from '../config/game';
import { buildLocaleCandidates, resolveRuntimeBases } from './assets';

export const LOCALES = ['en', 'zh-TW', 'zh-CN', 'ja'] as const;
export type Locale = (typeof LOCALES)[number];
export type Messages = Record<string, string>;
export type MessagePacks = Record<Locale, Messages>;

const messagesByLocale = new Map<Locale, Promise<Messages>>();

export function isLocale(value: string | null): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function getInitialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEYS.locale);
  if (isLocale(saved)) return saved;
  return 'en';
}

export async function loadMessages(locale: Locale): Promise<Messages> {
  const existing = messagesByLocale.get(locale);
  if (existing) return existing;
  const loading = loadMessagesFromCandidates(locale);
  messagesByLocale.set(locale, loading);
  return loading;
}

async function loadMessagesFromCandidates(locale: Locale): Promise<Messages> {
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

export async function preloadAllMessages(
  onProgress: (loaded: number, total: number) => void,
): Promise<MessagePacks> {
  let loaded = 0;
  const packs = await Promise.all(LOCALES.map(async (locale) => {
    const messages = await loadMessages(locale);
    loaded += 1;
    onProgress(loaded, LOCALES.length);
    return [locale, messages] as const;
  }));
  return Object.fromEntries(packs) as MessagePacks;
}

export function translate(messages: Messages, key: string, values?: Record<string, string | number>): string {
  const template = messages[key] ?? key;
  if (!values) return template;
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
