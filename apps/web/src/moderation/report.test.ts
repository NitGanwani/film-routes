import { MODERATION_LIMITS, REPORT_REASONS } from '@film-routes/shared';
import { describe, expect, it } from 'vitest';
import {
  REASON_ICON,
  reportBody,
  reportProblem,
  type ReportForm,
} from './report.js';

const form = (overrides: Partial<ReportForm> = {}): ReportForm => ({
  reason: 'spoiler',
  note: '',
  ...overrides,
});

describe('reportProblem', () => {
  it('needs a reason', () => {
    expect(reportProblem(form({ reason: null }))).toBe('reason_required');
    expect(reportBody(form({ reason: null }))).toBeNull();
  });

  it('accepts a note of exactly the maximum length, counted after trimming', () => {
    const note = 'a'.repeat(MODERATION_LIMITS.reportNoteMaxLength);
    expect(reportProblem(form({ note }))).toBeNull();
    expect(reportProblem(form({ note: ` ${note} ` }))).toBeNull();
  });

  it('rejects a note one character over the maximum', () => {
    const note = 'a'.repeat(MODERATION_LIMITS.reportNoteMaxLength + 1);
    expect(reportProblem(form({ note }))).toBe('note_too_long');
    expect(reportBody(form({ note }))).toBeNull();
  });
});

describe('reportBody', () => {
  it('sends the reason and the trimmed note', () => {
    expect(
      reportBody(form({ reason: 'other', note: '  mira esto  ' })),
    ).toEqual({ reason: 'other', note: 'mira esto' });
  });

  it('leaves the note out when it is empty or only spaces', () => {
    expect(reportBody(form({ note: '' }))).toEqual({ reason: 'spoiler' });
    expect(reportBody(form({ note: '   ' }))).toEqual({ reason: 'spoiler' });
  });
});

describe('REASON_ICON', () => {
  it('has a drawing for every reason, all different', () => {
    const icons = REPORT_REASONS.map((reason) => REASON_ICON[reason]);
    expect(new Set(icons).size).toBe(REPORT_REASONS.length);
  });
});
