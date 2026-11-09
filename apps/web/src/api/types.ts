import type { Locale } from '@film-routes/shared';

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
  createdAt: string;
};

export type PublicRoutesPage = {
  routes: PublicRouteSummary[];
  page: number;
  pageSize: number;
  total: number;
};
