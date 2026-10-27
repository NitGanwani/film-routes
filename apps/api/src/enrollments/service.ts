import type { EnrollmentStatus } from '@film-routes/shared';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { withRouteLock } from '../routes/locking.js';

type TravelerRow = {
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
  traveler: { username: string };
};

const toTraveler = (row: TravelerRow) => ({
  id: row.id,
  username: row.traveler.username,
  status: row.status.toLowerCase() as EnrollmentStatus,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
});

export function createEnrollmentService(db: Db) {
  return {
    /** Everyone who joined the author's route, in the order they joined. */
    async listTravelers(userId: string, routeId: string) {
      const route = await db.route.findFirst({
        where: { id: routeId, authorId: userId },
        select: { id: true },
      });
      if (!route) {
        throw new HttpError(404, 'route_not_found', 'Route not found');
      }
      const rows = await db.enrollment.findMany({
        where: { routeId },
        orderBy: { startedAt: 'asc' },
        include: { traveler: { select: { username: true } } },
      });
      return rows.map(toTraveler);
    },

    /**
     * Removes someone from the route. The row is kept as REMOVED (not deleted)
     * so they cannot simply join again with the same link.
     */
    removeTraveler(userId: string, routeId: string, enrollmentId: string) {
      return withRouteLock(db, userId, routeId, async (tx) => {
        const enrollment = await tx.enrollment.findFirst({
          where: { id: enrollmentId, routeId },
        });
        if (!enrollment) {
          throw new HttpError(404, 'traveler_not_found', 'Traveler not found');
        }
        if (enrollment.status !== 'REMOVED') {
          await tx.enrollment.update({
            where: { id: enrollmentId },
            data: { status: 'REMOVED' },
          });
        }
      });
    },
  };
}

export type EnrollmentService = ReturnType<typeof createEnrollmentService>;
