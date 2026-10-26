import type { z } from 'zod';
import { HttpError } from './errors.js';

/** Parses a body, query or path params, turning any problem into a 400. */
export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    throw new HttpError(400, 'validation_error', problems);
  }
  return result.data;
}
