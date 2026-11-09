import { MODERATION_LIMITS, REPORT_REASONS } from '@film-routes/shared';
import { z } from 'zod';

export const reportParamsSchema = z.object({ reportId: z.uuid() });

// Free text: trimmed, and an empty string means "nothing".
const optionalNote = z
  .string()
  .trim()
  .max(MODERATION_LIMITS.reportNoteMaxLength)
  .transform((value) => (value === '' ? undefined : value))
  .optional();

export const reportRouteSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  note: optionalNote,
});

/** The reason is mandatory: the author needs to know what to fix. */
export const hideRouteSchema = z.object({
  reason: z.string().trim().min(1).max(MODERATION_LIMITS.hideReasonMaxLength),
});

export const queueQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type ReportRouteInput = z.output<typeof reportRouteSchema>;
export type HideRouteInput = z.output<typeof hideRouteSchema>;
export type QueueQuery = z.output<typeof queueQuerySchema>;
