import type { Emotion, EnrollmentStatus, Locale } from '@film-routes/shared';

/** Mirrors what the API returns; kept by hand while it is this small. */
export type User = {
  id: string;
  username: string;
  email: string;
  locale: Locale;
  emailVerified: boolean;
  isAdmin: boolean;
};

export type RatingSummary = { average: number | null; votes: number };

export type PublicRouteSummary = {
  id: string;
  title: string;
  description: string | null;
  locale: Locale;
  author: string;
  stepCount: number;
  completions: number;
  rating: RatingSummary;
  /** First films' posters in route order; null = TMDB has none. */
  posters: (string | null)[];
  createdAt: string;
};

export type PublicRoutesPage = {
  routes: PublicRouteSummary[];
  page: number;
  pageSize: number;
  total: number;
};

export type Film = {
  tmdbId: number;
  /** In the language the route was written in. */
  title: string;
  /** Both languages, so each viewer reads it in their own. */
  titles: Record<Locale, string>;
  originalTitle: string;
  releaseYear: number | null;
  runtimeMinutes: number | null;
  posterUrl: string | null;
};

/** A public route as anyone sees it: the films, never the notes. */
export type PublicRouteDetail = PublicRouteSummary & {
  steps: { position: number; film: Film }[];
};

export type JoinResult = {
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    startedAt: string;
    completedAt: string | null;
  };
  route: {
    id: string;
    title: string;
    description: string | null;
    locale: Locale;
    author: string;
    stepCount: number;
  };
};

export type StepState = 'pending' | 'started' | 'closed';

export type JourneyStep = {
  id: string;
  position: number;
  film: Film;
  state: StepState;
  recommendedNext: boolean;
  /** Null while locked: see `noteBeforeLocked`. */
  noteBefore: string | null;
  noteBeforeLocked: boolean;
  noteAfter: string | null;
  noteAfterLocked: boolean;
  authorEmotion: Emotion | null;
  seenBefore: boolean;
  startedAt: string | null;
  watchedAt: string | null;
  myEmotion: Emotion | null;
  myComment: string | null;
};

export type Journey = {
  route: {
    id: string;
    title: string;
    description: string | null;
    locale: Locale;
    author: string;
  };
  enrollment: {
    id: string;
    status: EnrollmentStatus;
    startedAt: string;
    completedAt: string | null;
    closedSteps: number;
    stepCount: number;
  };
  steps: JourneyStep[];
};

export type JourneySummary = {
  enrollmentId: string;
  status: EnrollmentStatus;
  startedAt: string;
  completedAt: string | null;
  closedSteps: number;
  route: {
    id: string;
    title: string;
    locale: Locale;
    author: string;
    stepCount: number;
    posters: (string | null)[];
    hidden: boolean;
  };
};

export type CloseStepBody = {
  emotion: Emotion;
  comment?: string;
  seenBefore: boolean;
};
