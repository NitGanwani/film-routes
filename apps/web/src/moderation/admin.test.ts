import { MODERATION_LIMITS } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import { hideBody, hideProblem, pageCount, reasonCounts } from './admin.js';

describe('hideProblem', () => {
  it('asks for a reason: the author needs to know what to fix', () => {
    expect(hideProblem('')).toBe('reason_required');
    expect(hideProblem('   \n ')).toBe('reason_required');
  });

  it('measures the reason without the spaces around it', () => {
    const max = MODERATION_LIMITS.hideReasonMaxLength;
    expect(hideProblem(` ${'a'.repeat(max)} `)).toBeNull();
    expect(hideProblem('a'.repeat(max + 1))).toBe('reason_too_long');
  });
});

describe('hideBody', () => {
  it('sends the reason trimmed', () => {
    expect(hideBody('  Destripa el final  ')).toEqual({
      reason: 'Destripa el final',
    });
  });

  it('is null while the reason is not valid', () => {
    expect(hideBody(' ')).toBeNull();
  });
});

describe('reasonCounts', () => {
  it('puts the most repeated reason first and leaves out the ones with none', () => {
    expect(reasonCounts({ spoiler: 1, spam: 3, offensive: 0 })).toEqual([
      { reason: 'spam', count: 3 },
      { reason: 'spoiler', count: 1 },
    ]);
  });

  it('keeps the order of the report sheet when counts tie', () => {
    expect(reasonCounts({ other: 2, spoiler: 2, offensive: 2 })).toEqual([
      { reason: 'spoiler', count: 2 },
      { reason: 'offensive', count: 2 },
      { reason: 'other', count: 2 },
    ]);
  });

  it('is empty when nothing was said', () => {
    expect(reasonCounts({})).toEqual([]);
  });
});

describe('pageCount', () => {
  it('is never less than one page, even for an empty list', () => {
    expect(pageCount(0, 20)).toBe(1);
  });

  it('rounds up', () => {
    expect(pageCount(20, 20)).toBe(1);
    expect(pageCount(21, 20)).toBe(2);
  });
});
