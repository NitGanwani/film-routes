import type { TFunction } from 'i18next';
import { ApiError } from '../api/client.js';

/** The text for an error, in the current language. Unknown codes get a generic one. */
export function errorMessage(t: TFunction, error: unknown): string {
  const code = error instanceof ApiError ? error.code : 'unknown';
  return t(`errors.${code}`, { defaultValue: t('errors.unknown') });
}
