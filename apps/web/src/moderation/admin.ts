import {
  MODERATION_LIMITS,
  REPORT_REASONS,
  type ReportReason,
} from '@film-routes/shared';

export type HideProblem = 'reason_required' | 'reason_too_long';

/** What the API receives to take a route down. */
export type HideBody = { reason: string };

/** The same two rules the API enforces: the author reads this reason. */
export function hideProblem(reason: string): HideProblem | null {
  const text = reason.trim();
  if (text === '') return 'reason_required';
  if (text.length > MODERATION_LIMITS.hideReasonMaxLength) {
    return 'reason_too_long';
  }
  return null;
}

/** The request body for a valid reason; null if it is not valid. */
export function hideBody(reason: string): HideBody | null {
  return hideProblem(reason) === null ? { reason: reason.trim() } : null;
}

/**
 * The reasons a route was reported for, the most repeated first; ties keep the
 * order of the sheet people report from, so the line always reads the same.
 */
export function reasonCounts(
  byReason: Partial<Record<ReportReason, number>>,
): { reason: ReportReason; count: number }[] {
  return REPORT_REASONS.flatMap((reason, index) => {
    const count = byReason[reason] ?? 0;
    return count > 0 ? [{ reason, count, index }] : [];
  })
    .sort((a, b) => b.count - a.count || a.index - b.index)
    .map(({ reason, count }) => ({ reason, count }));
}

/** How many pages a list of `total` entries makes (at least one). */
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
