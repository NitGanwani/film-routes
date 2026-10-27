import { EMOTIONS, ROUTE_LIMITS } from '@film-routes/shared';
import { z } from 'zod';
import { routeParamsSchema } from '../routes/schemas.js';

export const travelerParamsSchema = routeParamsSchema.extend({
  enrollmentId: z.uuid(),
});

/**
 * Closing a film always needs an emotion: it is the point of the product, so
 * it is required even for films the traveler had already seen.
 */
export const closeStepSchema = z.object({
  emotion: z.enum(EMOTIONS),
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
