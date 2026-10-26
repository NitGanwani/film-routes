/**
 * Values shared by the API and the web client.
 * Keep these in sync with the enums in apps/api/prisma/schema.prisma.
 * User-facing labels live in the web i18n files, never here or in the database.
 */

export const LOCALES = ['es', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'es';

/** Fixed catalogue of feelings a traveler can pick with a single tap. */
export const EMOTIONS = [
  'joy',
  'tenderness',
  'awe',
  'thoughtful',
  'tension',
  'fear',
  'sadness',
  'discomfort',
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export const ROUTE_VISIBILITIES = ['private', 'unlisted', 'public'] as const;
export type RouteVisibility = (typeof ROUTE_VISIBILITIES)[number];

export const ENROLLMENT_STATUSES = [
  'active',
  'completed',
  'abandoned',
] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

/** Route size limits: a route is a short, curated path, not a long list. */
export const ROUTE_LIMITS = {
  minSteps: 2,
  maxSteps: 12,
  titleMaxLength: 120,
  descriptionMaxLength: 1000,
  noteMaxLength: 1000,
  commentMaxLength: 280,
} as const;
