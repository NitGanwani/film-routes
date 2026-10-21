import type { z } from 'zod';
import { HttpError } from './errors.js';

/** Parses a request body, turning any problem into a 400 the client can read. */
export function parseBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): z.output<T> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'body'}: ${issue.message}`)
      .join('; ');
    throw new HttpError(400, 'validation_error', problems);
  }
  return result.data;
}
