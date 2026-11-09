import { EMOTIONS } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import { en } from './en.js';
import { es } from './es.js';

/** Every key path of a nested object, e.g. "nav.login". */
function keysOf(value: object, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) =>
    typeof child === 'object' && child !== null
      ? keysOf(child, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe('translations', () => {
  it('have the same keys in Spanish and English', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(es).sort());
  });

  it('name every emotion of the shared catalogue, and only those', () => {
    for (const texts of [es.emotions, en.emotions]) {
      expect(Object.keys(texts).sort()).toEqual([...EMOTIONS].sort());
    }
  });

  it('use the same placeholders in both languages', () => {
    const placeholders = (text: string) =>
      (text.match(/{{\w+}}/g) ?? []).sort().join(',');
    const flatten = (value: object, prefix = ''): Record<string, string> =>
      Object.fromEntries(
        Object.entries(value).flatMap(([key, child]) =>
          typeof child === 'object' && child !== null
            ? Object.entries(flatten(child, `${prefix}${key}.`))
            : [[`${prefix}${key}`, String(child)]],
        ),
      );
    const spanish = flatten(es);
    const english = flatten(en);

    for (const [key, text] of Object.entries(spanish)) {
      expect(placeholders(english[key] ?? ''), key).toBe(placeholders(text));
    }
  });
});
