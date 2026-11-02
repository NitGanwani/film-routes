import type { EnrollmentStatus } from '@film-routes/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { HttpError } from '../errors.js';
import type { Tx } from '../routes/locking.js';

type EnrollmentRow = {
  id: string;
  status: string;
  startedAt: Date;
  completedAt: Date | null;
};

export type JoinResult = { created: boolean; enrollment: EnrollmentRow };

/** What clients see of an enrollment. */
export const toEnrollmentView = (enrollment: EnrollmentRow) => ({
  id: enrollment.id,
  status: enrollment.status.toLowerCase() as EnrollmentStatus,
  startedAt: enrollment.startedAt,
  completedAt: enrollment.completedAt,
});

/**
 * Joining the same route twice is harmless, and the rules are the same whether
 * the person came with an invitation or from the public list: someone the
 * author removed stays out, and someone who left comes back with their
 * progress. Returns null when there is nothing to resume.
 */
export async function resumeEnrollment(
  tx: Tx,
  routeId: string,
  userId: string,
): Promise<EnrollmentRow | null> {
  const existing = await tx.enrollment.findUnique({
    where: { routeId_travelerId: { routeId, travelerId: userId } },
  });
  if (!existing) {
    return null;
  }
  if (existing.status === 'REMOVED') {
    throw new HttpError(
      403,
      'removed_from_route',
      'The author has removed you from this route',
    );
  }
  if (existing.status === 'ABANDONED') {
    return tx.enrollment.update({
      where: { id: existing.id },
      data: { status: 'ACTIVE' },
    });
  }
  return existing;
}

/**
 * The same person joined twice at the same instant and lost the race on the
 * unique (route, traveler) rule. Running the join again finds the winner.
 */
export async function retryOnDuplicate<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return work();
    }
    throw error;
  }
}
