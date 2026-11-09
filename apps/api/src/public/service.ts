import { RATING, type Locale } from '@film-routes/shared';
import { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../db.js';
import {
  resumeEnrollment,
  retryOnDuplicate,
  toEnrollmentView,
} from '../enrollments/join.js';
import { HttpError } from '../errors.js';
import {
  ratingSummaries,
  summaryOf,
  type RatingSummary,
} from '../ratings/stats.js';
import { lockRouteForJoin } from '../routes/locking.js';
import { toFilm } from '../routes/service.js';
import type { ListQuery } from './schemas.js';

const routeNotFound = () =>
  new HttpError(404, 'route_not_found', 'Route not found');

// "Completed" is decided by the completion date, not the status: removing a
// traveler changes their status but must not erase the fact that they finished.
const completedOnly = { completedAt: { not: null } } as const;

// Nothing here may ever select the notes or the author's emotions: those are
// the traveler's to discover. Choosing fields explicitly (instead of loading
// whole rows) makes a leak impossible by construction.
const summarySelect = {
  id: true,
  title: true,
  description: true,
  locale: true,
  createdAt: true,
  author: { select: { username: true } },
  _count: {
    select: { steps: true, enrollments: { where: completedOnly } },
  },
} satisfies Prisma.RouteSelect;

type SummaryRow = Prisma.RouteGetPayload<{ select: typeof summarySelect }>;

const toSummary = (route: SummaryRow, rating: RatingSummary) => ({
  id: route.id,
  title: route.title,
  description: route.description,
  locale: route.locale.toLowerCase() as Locale,
  author: route.author.username,
  stepCount: route._count.steps,
  completions: route._count.enrollments,
  rating,
  createdAt: route.createdAt,
});

export function createPublicService(db: Db) {
  /** Ids of one page of public routes, in the order asked for. */
  async function pageOfIds({ sort, page, pageSize }: ListQuery) {
    const offset = (page - 1) * pageSize;
    if (sort === 'top') {
      // Only routes with enough votes are ranked, and they are ordered by the
      // score people actually see (rounded), then by how many voted, then the
      // newest. Without the minimum, one lone 10 would top the list.
      const rows = await db.$queryRaw<{ id: string }[]>`
        SELECT r.id FROM routes r
        JOIN route_ratings x ON x.route_id = r.id
        WHERE r.visibility = 'PUBLIC' AND r.hidden_at IS NULL
        GROUP BY r.id
        HAVING COUNT(x.id) >= ${RATING.minVotesToShowAverage}
        ORDER BY ROUND(AVG(x.score)::numeric, 1) DESC,
                 COUNT(x.id) DESC, r.created_at DESC, r.id DESC
        LIMIT ${pageSize} OFFSET ${offset}`;
      return rows.map((row) => row.id);
    }
    if (sort === 'new') {
      const rows = await db.route.findMany({
        where: { visibility: 'PUBLIC', hiddenAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: offset,
        take: pageSize,
        select: { id: true },
      });
      return rows.map((row) => row.id);
    }
    // Most completed first needs a filtered count, which Prisma cannot order
    // by, so the ranking is done in SQL. Ties: the newest first.
    const rows = await db.$queryRaw<{ id: string }[]>`
      SELECT r.id FROM routes r
      LEFT JOIN enrollments e
        ON e.route_id = r.id AND e.completed_at IS NOT NULL
      WHERE r.visibility = 'PUBLIC' AND r.hidden_at IS NULL
      GROUP BY r.id
      ORDER BY COUNT(e.id) DESC, r.created_at DESC, r.id DESC
      LIMIT ${pageSize} OFFSET ${offset}`;
    return rows.map((row) => row.id);
  }

  /** How many routes the list has, so the pages add up for each ordering. */
  async function totalRoutes(sort: ListQuery['sort']) {
    if (sort !== 'top') {
      return db.route.count({
        where: { visibility: 'PUBLIC', hiddenAt: null },
      });
    }
    const [row] = await db.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM (
        SELECT r.id FROM routes r
        JOIN route_ratings x ON x.route_id = r.id
        WHERE r.visibility = 'PUBLIC' AND r.hidden_at IS NULL
        GROUP BY r.id
        HAVING COUNT(x.id) >= ${RATING.minVotesToShowAverage}
      ) ranked`;
    return row?.total ?? 0;
  }

  /** What anyone sees before starting: the films, but none of the notes. */
  async function getRoute(routeId: string) {
    const route = await db.route.findFirst({
      where: { id: routeId, visibility: 'PUBLIC', hiddenAt: null },
      select: {
        ...summarySelect,
        steps: {
          orderBy: { position: 'asc' },
          select: {
            position: true,
            film: { include: { translations: true } },
          },
        },
      },
    });
    if (!route) {
      throw routeNotFound();
    }
    const ratings = await ratingSummaries(db, [route.id]);
    return {
      ...toSummary(route, summaryOf(ratings, route.id)),
      steps: route.steps.map((step) => ({
        position: step.position,
        film: toFilm(step.film, route.locale),
      })),
    };
  }

  return {
    getRoute,

    async listRoutes(query: ListQuery) {
      const [ids, total] = await Promise.all([
        pageOfIds(query),
        totalRoutes(query.sort),
      ]);
      const rows = await db.route.findMany({
        where: { id: { in: ids } },
        select: summarySelect,
      });
      const ratings = await ratingSummaries(db, ids);
      // The second query does not keep the order of the first.
      const byId = new Map(rows.map((row) => [row.id, row]));
      return {
        routes: ids.flatMap((id) => {
          const row = byId.get(id);
          return row ? [toSummary(row, summaryOf(ratings, id))] : [];
        }),
        page: query.page,
        pageSize: query.pageSize,
        total,
      };
    },

    /**
     * Starts a public route without an invitation. Only `public` routes can be
     * joined like this; an `unlisted` one still needs its link.
     */
    async joinRoute(userId: string, routeId: string) {
      const route = await db.route.findFirst({
        where: { id: routeId, visibility: 'PUBLIC', hiddenAt: null },
        select: { authorId: true },
      });
      if (!route) {
        throw routeNotFound();
      }
      if (route.authorId === userId) {
        throw new HttpError(
          409,
          'cannot_join_own_route',
          'You cannot follow your own route',
        );
      }

      const join = () =>
        db.$transaction(async (tx) => {
          // Shared lock: the author cannot unpublish or edit in the middle of
          // a join, and the check below sees the final state.
          await lockRouteForJoin(tx, routeId);
          const current = await tx.route.findUnique({
            where: { id: routeId },
            select: { visibility: true, hiddenAt: true },
          });
          if (current?.visibility !== 'PUBLIC' || current.hiddenAt) {
            throw routeNotFound();
          }

          const existing = await resumeEnrollment(tx, routeId, userId);
          if (existing) {
            return { created: false, enrollment: existing };
          }
          const enrollment = await tx.enrollment.create({
            data: { routeId, travelerId: userId },
          });
          return { created: true, enrollment };
        });

      const result = await retryOnDuplicate(join);
      const summary = await getRoute(routeId);
      return {
        created: result.created,
        enrollment: toEnrollmentView(result.enrollment),
        route: {
          id: summary.id,
          title: summary.title,
          description: summary.description,
          locale: summary.locale,
          author: summary.author,
          stepCount: summary.stepCount,
        },
      };
    },
  };
}

export type PublicService = ReturnType<typeof createPublicService>;
