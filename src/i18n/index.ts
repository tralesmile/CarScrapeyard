// Tiny translation layer (P1.9): t('key', { count: 2 }). English is the fallback for any missing key.

import { en, type MessageKey } from './en';

export type { MessageKey };
export type Catalog = Partial<Record<MessageKey, string>>;
export type Params = Record<string, string | number>;

const catalogs: Record<string, Catalog> = { en };
let locale = 'en';
let rules = new Intl.PluralRules('en');

/** Register a translation (e.g. from a lazily loaded file). Missing keys fall back to English. */
export function registerLocale(code: string, catalog: Catalog): void {
  catalogs[code] = catalog;
}

export function setLocale(code: string): void {
  locale = catalogs[code] ? code : 'en';
  rules = new Intl.PluralRules(locale);
}

export function getLocale(): string {
  return locale;
}

/** The best supported locale for a browser language list such as navigator.languages. */
export function pickLocale(languages: readonly string[]): string {
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0]!;
    if (catalogs[base]) return base;
  }
  return 'en';
}

function lookup(key: string): string | undefined {
  return (catalogs[locale] as Record<string, string>)[key] ?? (en as Record<string, string>)[key];
}

/** A message id; plural keys are written without their _one/_other suffix. */
export type BaseKey = MessageKey extends infer K ? (K extends `${infer B}_${'one' | 'other'}` ? B : K) : never;

export function t(key: BaseKey, params: Params = {}): string {
  let raw: string | undefined;
  if (typeof params.count === 'number') raw = lookup(`${key}_${rules.select(params.count)}`) ?? lookup(`${key}_other`);
  raw ??= lookup(key);
  if (raw === undefined) return key;
  return raw.replace(/\{(\w+)\}/g, (_, name: string) => (name in params ? String(params[name]) : `{${name}}`));
}
