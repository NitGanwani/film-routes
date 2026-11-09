import { assertEmailVerified } from '../auth/verified.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { ratingSummaries, summaryOf } from './stats.js';

export function createRatingService(db: Db) {
  /**
   * The person's enrollment in the route. Not following it looks the same as
   * the route not existing. Someone the author removed can no longer take part,
   * though a vote they already gave stays counted: otherwise an author could
   * erase a bad vote by removing whoever gave it.
   */
  async function enrollmentOf(userId: string, routeId: string) {
    const enrollment = await db.enrollment.findUnique({
      where: { routeId_travelerId: { routeId, travelerId: userId } },
      include: { route: { select: { hiddenAt: true } } },
    });
    if (!enrollment) {
      throw new HttpError(404, 'route_not_found', 'Route not found');
    }
    if (enrollment.status === 'REMOVED') {
      throw new HttpError(
        403,
        'removed_from_route',
        'The author has removed you from this route',
      );
    }
    // A hidden route is closed to everyone, votes included.
    if (enrollment.route.hiddenAt) {
      throw new HttpError(410, 'route_hidden', 'This route has been hidden');
    }
    return enrollment;
  }

  const summaryFor = async (routeId: string) =>
    summaryOf(await ratingSummaries(db, [routeId]), routeId);

  return {
    /**
     * Gives or changes the person's score. Only someone who completed the
     * route can vote, and each person has exactly one vote per route.
     */
    async rate(userId: string, routeId: string, score: number) {
      await assertEmailVerified(db, userId);
      const enrollment = await enrollmentOf(userId, routeId);
      if (!enrollment.completedAt) {
        throw new HttpError(
          409,
          'route_not_completed',
          'Complete the route to rate it',
        );
      }

      // One atomic INSERT ... ON CONFLICT DO UPDATE: two simultaneous votes
      // from the same person end as one row, with no retry needed.
      await db.routeRating.upsert({
        where: { routeId_userId: { routeId, userId } },
        create: { routeId, userId, score },
        update: { score },
      });
      return { rating: { score }, summary: await summaryFor(routeId) };
    },

    /** The person's own vote, and whether they are able to give one. */
    async getMine(userId: string, routeId: string) {
      const enrollment = await enrollmentOf(userId, routeId);
      const rating = await db.routeRating.findUnique({
        where: { routeId_userId: { routeId, userId } },
        select: { score: true },
      });
      return {
        rating,
        canRate: enrollment.completedAt !== null,
        summary: await summaryFor(routeId),
      };
    },
  };
}

export type RatingService = ReturnType<typeof createRatingService>;
