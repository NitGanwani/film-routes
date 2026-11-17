import { ROUTE_LIMITS } from '@film-routes/shared';
import { z } from 'zod';
import { emotionList } from '../emotions.js';
import { routeParamsSchema } from '../routes/schemas.js';

export const travelerParamsSchema = routeParamsSchema.extend({
  enrollmentId: z.uuid(),
});

/**
 * Closing a film always needs an emotion (one or two): it is the point of the
 * product, so it is required even for films the traveler had already seen.
 */
export const closeStepSchema = z.object({
  emotions: emotionList(1),
  comment: z
    .string()
    .trim()
    .max(ROUTE_LIMITS.commentMaxLength)
    .transform((value) => (value === '' ? null : value))
    .nullable()
    .optional(),
  seenBefore: z.boolean().optional(),
});

export type CloseStepInput = z.output<typeof closeStepSchema>;
