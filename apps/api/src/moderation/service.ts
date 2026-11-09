import type { ReportReason } from '@film-routes/shared';
import { Prisma } from '../../generated/prisma/client.js';
import type { ReportReason as DbReportReason } from '../../generated/prisma/enums.js';
import { assertEmailVerified } from '../auth/verified.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { detailInclude, toDetail } from '../routes/service.js';
import type {
  HideRouteInput,
  QueueQuery,
  ReportRouteInput,
} from './schemas.js';

const routeNotFound = () =>
  new HttpError(404, 'route_not_found', 'Route not found');

const lower = <T extends string>(value: T) =>
  value.toLowerCase() as Lowercase<T>;

export function createModerationService(
  db: Db,
  now: () => Date = () => new Date(),
) {
  async function assertRouteExists(routeId: string) {
    const route = await db.route.findUnique({
      where: { id: routeId },
      select: { id: true },
    });
    if (!route) {
      throw routeNotFound();
    }
  }

  return {
    // ─── Anyone with a confirmed email ──────────────────────────────────

    /**
     * Reports a route. You can report what you can legitimately see: anything
     * shared, or a route you are following. Anything else looks like it does not
     * exist. One report per person and route: the database enforces it, so two
     * simultaneous taps cannot add two.
     */
    async report(userId: string, routeId: string, input: ReportRouteInput) {
      await assertEmailVerified(db, userId);

      const route = await db.route.findUnique({
        where: { id: routeId },
        select: {
          authorId: true,
          visibility: true,
          hiddenAt: true,
          enrollments: {
            where: { travelerId: userId },
            select: { status: true },
          },
        },
      });
      const following = route?.enrollments.some(
        (enrollment) => enrollment.status !== 'REMOVED',
      );
      if (!route || (route.visibility === 'PRIVATE' && !following)) {
        throw routeNotFound();
      }
      if (route.authorId === userId) {
        throw new HttpError(
          409,
          'cannot_report_own_route',
          'You cannot report your own route',
        );
      }
      if (route.hiddenAt) {
        throw new HttpError(410, 'route_hidden', 'This route has been hidden');
      }

      try {
        const report = await db.routeReport.create({
          data: {
            routeId,
            reporterId: userId,
            reason: input.reason.toUpperCase() as DbReportReason,
            note: input.note ?? null,
          },
        });
        return {
          id: report.id,
          reason: input.reason,
          status: lower(report.status),
          createdAt: report.createdAt,
        };
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          throw new HttpError(
            409,
            'already_reported',
            'You already reported this route',
          );
        }
        throw error;
      }
    },

    // ─── Admins ─────────────────────────────────────────────────────────

    /**
     * Routes with open reports, grouped: the most reported first, then the one
     * waiting longest. Several reports on one route are one decision to make.
     */
    async queue({ page, pageSize }: QueueQuery) {
      const offset = (page - 1) * pageSize;
      const [groups, totals] = await Promise.all([
        db.$queryRaw<
          { routeId: string; reports: number; firstAt: Date; lastAt: Date }[]
        >`
          SELECT route_id AS "routeId", COUNT(*)::int AS reports,
                 MIN(created_at) AS "firstAt", MAX(created_at) AS "lastAt"
          FROM route_reports
          WHERE status = 'OPEN'
          GROUP BY route_id
          ORDER BY COUNT(*) DESC, MIN(created_at) ASC, route_id ASC
          LIMIT ${pageSize} OFFSET ${offset}`,
        db.$queryRaw<{ total: number }[]>`
          SELECT COUNT(DISTINCT route_id)::int AS total
          FROM route_reports WHERE status = 'OPEN'`,
      ]);

      const routeIds = groups.map((group) => group.routeId);
      const [routes, reasons] = await Promise.all([
        db.route.findMany({
          where: { id: { in: routeIds } },
          select: {
            id: true,
            title: true,
            visibility: true,
            hiddenAt: true,
            author: { select: { username: true } },
          },
        }),
        db.routeReport.groupBy({
          by: ['routeId', 'reason'],
          where: { routeId: { in: routeIds }, status: 'OPEN' },
          _count: { _all: true },
        }),
      ]);
      const routeById = new Map(routes.map((route) => [route.id, route]));

      return {
        routes: groups.flatMap((group) => {
          const route = routeById.get(group.routeId);
          if (!route) {
            return [];
          }
          const byReason: Partial<Record<ReportReason, number>> = {};
          for (const row of reasons) {
            if (row.routeId === group.routeId) {
              byReason[lower(row.reason)] = row._count._all;
            }
          }
          return [
            {
              routeId: route.id,
              title: route.title,
              author: route.author.username,
              visibility: lower(route.visibility),
              hidden: route.hiddenAt !== null,
              openReports: group.reports,
              byReason,
              firstReportAt: group.firstAt,
              lastReportAt: group.lastAt,
            },
          ];
        }),
        page,
        pageSize,
        total: totals[0]?.total ?? 0,
      };
    },

    /**
     * Everything needed to judge a route: its full content, notes included
     * (a spoiler report cannot be judged without reading them), and every
     * report about it, resolved ones too.
     */
    async getRoute(routeId: string) {
      const route = await db.route.findUnique({
        where: { id: routeId },
        include: {
          ...detailInclude,
          author: { select: { username: true } },
          hiddenBy: { select: { username: true } },
          reports: {
            orderBy: { createdAt: 'desc' },
            include: { reporter: { select: { username: true } } },
          },
        },
      });
      if (!route) {
        throw routeNotFound();
      }
      return {
        route: {
          ...toDetail(route),
          author: route.author.username,
          hiddenBy: route.hiddenBy?.username ?? null,
        },
        reports: route.reports.map((report) => ({
          id: report.id,
          reporter: report.reporter.username,
          reason: lower(report.reason),
          note: report.note,
          status: lower(report.status),
          createdAt: report.createdAt,
          resolvedAt: report.resolvedAt,
        })),
      };
    },

    /**
     * Takes the route down and closes its open reports as upheld. The UPDATE
     * only matches a route that is not hidden yet, so two admins acting at the
     * same moment cannot both "win".
     */
    hide(adminId: string, routeId: string, input: HideRouteInput) {
      return db.$transaction(async (tx) => {
        const at = now();
        const hidden = await tx.route.updateMany({
          where: { id: routeId, hiddenAt: null },
          data: {
            hiddenAt: at,
            hiddenReason: input.reason,
            hiddenById: adminId,
          },
        });
        if (hidden.count === 0) {
          const exists = await tx.route.findUnique({
            where: { id: routeId },
            select: { id: true },
          });
          throw exists
            ? new HttpError(
                409,
                'already_hidden',
                'This route is already hidden',
              )
            : routeNotFound();
        }
        const upheld = await tx.routeReport.updateMany({
          where: { routeId, status: 'OPEN' },
          data: { status: 'UPHELD', resolvedAt: at, resolvedById: adminId },
        });
        return {
          hiddenAt: at,
          reason: input.reason,
          reportsUpheld: upheld.count,
        };
      });
    },

    /** Lifts the hiding. The reports it closed stay as history. */
    async unhide(routeId: string) {
      const lifted = await db.route.updateMany({
        where: { id: routeId, hiddenAt: { not: null } },
        data: { hiddenAt: null, hiddenReason: null, hiddenById: null },
      });
      if (lifted.count === 0) {
        await assertRouteExists(routeId);
        throw new HttpError(409, 'not_hidden', 'This route is not hidden');
      }
    },

    /** The route is fine: closes all its open reports without acting. */
    async dismissRoute(adminId: string, routeId: string) {
      await assertRouteExists(routeId);
      const dismissed = await db.routeReport.updateMany({
        where: { routeId, status: 'OPEN' },
        data: { status: 'DISMISSED', resolvedAt: now(), resolvedById: adminId },
      });
      return { dismissed: dismissed.count };
    },

    /** Closes one report (a bad-faith one, say) and leaves the others open. */
    async dismissReport(adminId: string, reportId: string) {
      const dismissed = await db.routeReport.updateMany({
        where: { id: reportId, status: 'OPEN' },
        data: { status: 'DISMISSED', resolvedAt: now(), resolvedById: adminId },
      });
      if (dismissed.count === 0) {
        const exists = await db.routeReport.findUnique({
          where: { id: reportId },
          select: { id: true },
        });
        throw exists
          ? new HttpError(
              409,
              'report_already_resolved',
              'This report was already resolved',
            )
          : new HttpError(404, 'report_not_found', 'Report not found');
      }
    },
  };
}

export type ModerationService = ReturnType<typeof createModerationService>;
