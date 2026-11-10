import { describe, expect, it } from 'vitest';
import { otherTheme, parseTheme } from './theme.js';

describe('parseTheme', () => {
  it('accepts exactly the two themes', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
  });

  it('treats anything else as no choice', () => {
    expect(parseTheme(null)).toBeNull();
    expect(parseTheme('')).toBeNull();
    expect(parseTheme('Dark')).toBeNull();
    expect(parseTheme('auto')).toBeNull();
    expect(parseTheme(1)).toBeNull();
  });
});

describe('otherTheme', () => {
  it('flips between the two', () => {
    expect(otherTheme('light')).toBe('dark');
    expect(otherTheme('dark')).toBe('light');
  });
});
