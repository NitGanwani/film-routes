import type {
  Emotion,
  EnrollmentStatus,
  Locale,
  RouteVisibility,
} from '@film-routes/shared';

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
  /** The first film's wide backdrop, the route's cover; null = none. */
  coverUrl: string | null;
  createdAt: string;
};

/** One of the signed-in author's own routes (`GET /routes`): no pictures, no stats. */
export type AuthorRouteSummary = {
  id: string;
  title: string;
  description: string | null;
  locale: Locale;
  visibility: RouteVisibility;
  stepCount: number;
  /** Someone has joined: the films can no longer be changed. */
  locked: boolean;
  /** A moderator took it down; the reason is only in the route itself. */
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

/** One film of the author's route, with the notes only the author (and travelers who reach it) read. */
export type AuthorStep = {
  id: string;
  position: number;
  noteBefore: string | null;
  noteAfter: string | null;
  authorEmotion: Emotion | null;
  film: Film;
};

/** One of the author's routes in full (`GET /routes/:id`). */
export type AuthorRouteDetail = {
  id: string;
  title: string;
  description: string | null;
  locale: Locale;
  visibility: RouteVisibility;
  /** Someone has joined: the films can no longer be changed. */
  locked: boolean;
  moderation: {
    hidden: boolean;
    hiddenAt: string | null;
    reason: string | null;
  };
  createdAt: string;
  updatedAt: string;
  steps: AuthorStep[];
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
  /** Poster at a normal size (w342). */
  posterUrl: string | null;
  /** Poster for small thumbnails (w185). */
  posterUrlSmall: string | null;
  /** Wide backdrop (w1280); null when TMDB has none. */
  backdropUrl: string | null;
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
    /** The first film's backdrop, the card's cover; null = none. */
    coverUrl: string | null;
    hidden: boolean;
  };
};

export type CloseStepBody = {
  emotion: Emotion;
  comment?: string;
  seenBefore: boolean;
};

/** A film as the search offers it, in the language that was asked for. */
export type FilmSearchResult = {
  tmdbId: number;
  title: string;
  originalTitle: string;
  releaseYear: number | null;
  posterUrl: string | null;
  posterUrlSmall: string | null;
  backdropUrl: string | null;
};

export type FilmSearchPage = {
  page: number;
  totalPages: number;
  results: FilmSearchResult[];
};
