import { describe, expect, it } from 'vitest';
import { formatAverage } from './format.js';

describe('formatAverage', () => {
  it('uses the decimal comma in Spanish and the point in English', () => {
    expect(formatAverage(7.8, 'es')).toBe('7,8');
    expect(formatAverage(7.8, 'en')).toBe('7.8');
  });

  it('always shows one decimal', () => {
    expect(formatAverage(8, 'es')).toBe('8,0');
    expect(formatAverage(10, 'en')).toBe('10.0');
  });

  it('rounds to one decimal', () => {
    expect(formatAverage(7.84, 'en')).toBe('7.8');
    expect(formatAverage(7.86, 'en')).toBe('7.9');
  });
});
