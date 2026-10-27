import type { Prisma } from '../../generated/prisma/client.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';

export type Tx = Prisma.TransactionClient;

/** Travelers that still count: someone the author removed no longer locks it. */
export const countsAsTraveler = { status: { not: 'REMOVED' } } as const;

/**
 * Runs `work` in a transaction holding an exclusive lock on the route row, so
 * two edits to the same route cannot interleave, and nobody can join while the
 * author is checking whether the route is still free to change. The query also
 * checks ownership: someone else's route looks like it does not exist.
 */
export function withRouteLock<T>(
  db: Db,
  userId: string,
  routeId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM routes
      WHERE id = ${routeId}::uuid AND author_id = ${userId}::uuid
      FOR UPDATE`;
    if (rows.length === 0) {
      throw new HttpError(404, 'route_not_found', 'Route not found');
    }
    return work(tx);
  });
}

/**
 * Shared lock taken by travelers joining: any number can join at once, but
 * none while the author holds the exclusive lock, and the author cannot start
 * editing in the middle of a join.
 */
export async function lockRouteForJoin(tx: Tx, routeId: string) {
  await tx.$queryRaw`SELECT id FROM routes WHERE id = ${routeId}::uuid FOR SHARE`;
}
