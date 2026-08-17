import en from './en.json';
import fr from './fr.json';

export const DEFAULT_LOCALE = 'en';
export const MESSAGES: Record<string, Record<string, string>> = { en, fr };

/** The SDK gives tags like "fr-CA"; match on the language subtag only. */
export function resolveLocale(contextLocale?: string | null): string {
  const tag = String(contextLocale || DEFAULT_LOCALE).toLowerCase().split('-')[0];
  return MESSAGES[tag] ? tag : DEFAULT_LOCALE;
}
