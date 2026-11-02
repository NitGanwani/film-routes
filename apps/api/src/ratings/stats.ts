import { RATING } from '@film-routes/shared';
import type { Db } from '../db.js';

export type RatingSummary = {
  /** Average with one decimal, or null until enough people have voted. */
  average: number | null;
  votes: number;
};

const NO_VOTES: RatingSummary = { average: null, votes: 0 };

/**
 * The overall score of each route, calculated from the votes every time (it is
 * never stored, so it cannot drift out of sync). The rounding is done by
 * Postgres on exact decimals: rounding a float in JavaScript can misplace a
 * half, like 7.25.
 */
export async function ratingSummaries(
  db: Db,
  routeIds: string[],
): Promise<Map<string, RatingSummary>> {
  const rows = await db.$queryRaw<
    { route_id: string; votes: number; average: number }[]
  >`
    SELECT route_id,
           COUNT(*)::int AS votes,
           ROUND(AVG(score)::numeric, 1)::float8 AS average
    FROM route_ratings
    WHERE route_id = ANY(${routeIds}::uuid[])
    GROUP BY route_id`;

  return new Map(
    rows.map((row) => [
      row.route_id,
      {
        votes: row.votes,
        // A single 10 must not look like a masterpiece.
        average: row.votes >= RATING.minVotesToShowAverage ? row.average : null,
      },
    ]),
  );
}

export const summaryOf = (
  summaries: Map<string, RatingSummary>,
  routeId: string,
): RatingSummary => summaries.get(routeId) ?? NO_VOTES;
