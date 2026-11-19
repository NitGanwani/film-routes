import { MODERATION_LIMITS, type ReportReason } from '@film-routes/shared';
import type { IconName } from '../components/Icon.js';

/**
 * Each reason has its own drawing next to its name, so none of them is told
 * apart by anything but its shape and its words.
 */
export const REASON_ICON: Record<ReportReason, IconName> = {
  spoiler: 'eye-off',
  offensive: 'alert',
  spam: 'link',
  other: 'info',
};

export type ReportForm = {
  reason: ReportReason | null;
  note: string;
};

export type ReportProblem = 'reason_required' | 'note_too_long';

/** What the API receives: the note is left out when it is empty. */
export type ReportBody = {
  reason: ReportReason;
  note?: string;
};

/** The same two rules the API enforces, so the person hears it before sending. */
export function reportProblem(form: ReportForm): ReportProblem | null {
  if (!form.reason) return 'reason_required';
  if (form.note.trim().length > MODERATION_LIMITS.reportNoteMaxLength) {
    return 'note_too_long';
  }
  return null;
}

/** The request body for a valid form. Returns null if the form is not valid. */
export function reportBody(form: ReportForm): ReportBody | null {
  if (reportProblem(form) !== null || !form.reason) return null;
  const note = form.note.trim();
  return { reason: form.reason, ...(note === '' ? {} : { note }) };
}
