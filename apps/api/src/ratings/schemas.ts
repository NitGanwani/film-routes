import { RATING } from '@film-routes/shared';
import { z } from 'zod';

/** A whole number: 7 is a vote, 7.5 is not. */
export const rateRouteSchema = z.object({
  score: z.number().int().min(RATING.min).max(RATING.max),
});

export type RateRouteInput = z.output<typeof rateRouteSchema>;
