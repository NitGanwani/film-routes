import { DEFAULT_LOCALE, LOCALES } from '@film-routes/shared';
import { z } from 'zod';

// Usernames and emails are stored lowercase, so we normalise before anything
// else sees them and the unique constraints behave case-insensitively.
const username = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,30}$/, '3-30 characters: letters, numbers and _');

const email = z.string().trim().toLowerCase().pipe(z.email().max(254));

// The upper bound stops someone from sending a huge string to make argon2 work.
const newPassword = z.string().min(10).max(128);

export const registerSchema = z.object({
  username,
  email,
  password: newPassword,
  locale: z.enum(LOCALES).default(DEFAULT_LOCALE),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).max(256),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
