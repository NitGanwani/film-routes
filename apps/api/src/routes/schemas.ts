import {
  EMOTIONS,
  LOCALES,
  ROUTE_LIMITS,
  ROUTE_VISIBILITIES,
} from '@film-routes/shared';
import { z } from 'zod';

export const routeParamsSchema = z.object({ routeId: z.uuid() });
export const stepParamsSchema = routeParamsSchema.extend({
  stepId: z.uuid(),
});

const title = z.string().trim().min(1).max(ROUTE_LIMITS.titleMaxLength);

// Free text: trimmed, and an empty string means "no text".
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === '' ? null : value));

const description = text(ROUTE_LIMITS.descriptionMaxLength);
const note = text(ROUTE_LIMITS.noteMaxLength);
const emotion = z.enum(EMOTIONS);

const hasAnyField = (value: Record<string, unknown>) =>
  Object.values(value).some((field) => field !== undefined);
const atLeastOne = { message: 'Provide at least one field to change' };

export const createRouteSchema = z.object({
  title,
  description: description.optional(),
  // Language the author writes in; defaults to the author's own locale.
  locale: z.enum(LOCALES).optional(),
});

/** `null` clears a field, leaving it out keeps the current value. */
export const updateRouteSchema = z
  .object({
    title: title.optional(),
    description: description.nullable().optional(),
    visibility: z.enum(ROUTE_VISIBILITIES).optional(),
  })
  .refine(hasAnyField, atLeastOne);

export const addStepSchema = z.object({
  tmdbId: z.number().int().positive(),
  noteBefore: note.optional(),
  noteAfter: note.optional(),
  authorEmotion: emotion.nullable().optional(),
});

export const updateStepSchema = z
  .object({
    noteBefore: note.nullable().optional(),
    noteAfter: note.nullable().optional(),
    authorEmotion: emotion.nullable().optional(),
  })
  .refine(hasAnyField, atLeastOne);

export const reorderSchema = z.object({
  stepIds: z.array(z.uuid()).min(1).max(ROUTE_LIMITS.maxSteps),
});

export type CreateRouteInput = z.output<typeof createRouteSchema>;
export type UpdateRouteInput = z.output<typeof updateRouteSchema>;
export type AddStepInput = z.output<typeof addStepSchema>;
export type UpdateStepInput = z.output<typeof updateStepSchema>;
