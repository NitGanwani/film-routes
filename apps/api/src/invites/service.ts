import type { EnrollmentStatus, Locale } from '@film-routes/shared';
import { Prisma } from '../../generated/prisma/client.js';
import { generateOpaqueToken, hashOpaqueToken } from '../auth/tokens.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { lockRouteForJoin } from '../routes/locking.js';
import {
  DEFAULT_INVITE_EXPIRY_DAYS,
  type CreateInviteInput,
} from './schemas.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const routeNotFound = () =>
  new HttpError(404, 'route_not_found', 'Route not found');
const inviteNotFound = () =>
  new HttpError(404, 'invite_not_found', 'Invitation not found');
const gone = (code: string, message: string) =>
  new HttpError(410, code, message);

type InviteRow = {
  id: string;
  maxUses: number | null;
  usesCount: number;
  expiresAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
};

export type InviteStatus = 'active' | 'revoked' | 'expired' | 'exhausted';

function inviteStatus(invite: InviteRow, now: Date): InviteStatus {
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt && invite.expiresAt <= now) return 'expired';
  if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
    return 'exhausted';
  }
  return 'active';
}

/** Why a link cannot be used, as the error the traveler sees. */
function unusable(status: Exclude<InviteStatus, 'active'>) {
  switch (status) {
    case 'revoked':
      return gone('invite_revoked', 'The author has revoked this link');
    case 'expired':
      return gone('invite_expired', 'This link has expired');
    case 'exhausted':
      return gone(
        'invite_exhausted',
        'This link has reached its limit of uses',
      );
  }
}

export function createInviteService(
  db: Db,
  now: () => Date = () => new Date(),
) {
  const toInvite = (invite: InviteRow) => ({
    id: invite.id,
    maxUses: invite.maxUses,
    usesCount: invite.usesCount,
    expiresAt: invite.expiresAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
    status: inviteStatus(invite, now()),
  });

  async function ownedRoute(userId: string, routeId: string) {
    const route = await db.route.findFirst({
      where: { id: routeId, authorId: userId },
      select: { id: true, visibility: true },
    });
    if (!route) {
      throw routeNotFound();
    }
    return route;
  }

  type JoinResult = {
    created: boolean;
    enrollment: {
      id: string;
      status: string;
      startedAt: Date;
      completedAt: Date | null;
    };
  };

  return {
    /**
     * The token is returned here and never again: only its hash is stored, so
     * a lost link cannot be recovered, only replaced.
     */
    async createInvite(
      userId: string,
      routeId: string,
      input: CreateInviteInput,
    ) {
      const route = await ownedRoute(userId, routeId);
      if (route.visibility === 'PRIVATE') {
        throw new HttpError(
          409,
          'route_not_shared',
          'Share the route before inviting people to it',
        );
      }

      const days =
        input.expiresInDays === undefined
          ? DEFAULT_INVITE_EXPIRY_DAYS
          : input.expiresInDays;
      const { token, hash } = generateOpaqueToken();
      const invite = await db.routeInvite.create({
        data: {
          routeId,
          createdById: userId,
          tokenHash: hash,
          maxUses: input.maxUses ?? null,
          expiresAt:
            days === null ? null : new Date(now().getTime() + days * DAY_MS),
        },
      });
      return { ...toInvite(invite), token };
    },

    async listInvites(userId: string, routeId: string) {
      await ownedRoute(userId, routeId);
      const invites = await db.routeInvite.findMany({
        where: { routeId },
        orderBy: { createdAt: 'desc' },
      });
      return invites.map(toInvite);
    },

    /** Revoking keeps the row, so the usage history stays visible. */
    async revokeInvite(userId: string, routeId: string, inviteId: string) {
      const invite = await db.routeInvite.findFirst({
        where: { id: inviteId, routeId, route: { authorId: userId } },
      });
      if (!invite) {
        throw inviteNotFound();
      }
      if (!invite.revokedAt) {
        await db.routeInvite.update({
          where: { id: inviteId },
          data: { revokedAt: now() },
        });
      }
    },

    /**
     * Joins the route behind a link. Joining twice is harmless: it returns the
     * existing enrollment without using up another place.
     */
    async acceptInvite(userId: string, token: string) {
      const invite = await db.routeInvite.findUnique({
        where: { tokenHash: hashOpaqueToken(token) },
        include: {
          route: {
            select: {
              id: true,
              title: true,
              description: true,
              locale: true,
              visibility: true,
              authorId: true,
              author: { select: { username: true } },
              _count: { select: { steps: true } },
            },
          },
        },
      });
      if (!invite) {
        throw inviteNotFound();
      }

      const status = inviteStatus(invite, now());
      if (status === 'revoked' || status === 'expired') {
        throw unusable(status);
      }
      if (invite.route.authorId === userId) {
        throw new HttpError(
          409,
          'cannot_join_own_route',
          'You cannot follow your own route',
        );
      }

      const join = (): Promise<JoinResult> =>
        db.$transaction(async (tx) => {
          // Shared lock: many can join at once, but not while the author is
          // changing the route's films.
          await lockRouteForJoin(tx, invite.routeId);

          const route = await tx.route.findUniqueOrThrow({
            where: { id: invite.routeId },
            select: { visibility: true },
          });
          if (route.visibility === 'PRIVATE') {
            throw gone(
              'invite_unavailable',
              'The author is no longer sharing this route',
            );
          }

          const existing = await tx.enrollment.findUnique({
            where: {
              routeId_travelerId: {
                routeId: invite.routeId,
                travelerId: userId,
              },
            },
          });
          if (existing) {
            if (existing.status === 'REMOVED') {
              throw new HttpError(
                403,
                'removed_from_route',
                'The author has removed you from this route',
              );
            }
            if (existing.status === 'ABANDONED') {
              // Coming back after leaving: progress is kept, no place used.
              const resumed = await tx.enrollment.update({
                where: { id: existing.id },
                data: { status: 'ACTIVE' },
              });
              return { created: false, enrollment: resumed };
            }
            return { created: false, enrollment: existing };
          }

          // Atomic: the WHERE re-checks every rule at the moment of the update,
          // so two people racing for the last place cannot both get it.
          const used = await tx.$executeRaw`
            UPDATE route_invites SET uses_count = uses_count + 1
            WHERE id = ${invite.id}::uuid
              AND revoked_at IS NULL
              AND (expires_at IS NULL OR expires_at > ${now()}::timestamptz)
              AND (max_uses IS NULL OR uses_count < max_uses)`;
          if (used === 0) {
            // The same person may have just joined in a parallel request that
            // took the last place: that is not an error for them.
            const joinedMeanwhile = await tx.enrollment.findUnique({
              where: {
                routeId_travelerId: {
                  routeId: invite.routeId,
                  travelerId: userId,
                },
              },
            });
            if (joinedMeanwhile && joinedMeanwhile.status !== 'REMOVED') {
              return { created: false, enrollment: joinedMeanwhile };
            }

            const fresh = await tx.routeInvite.findUniqueOrThrow({
              where: { id: invite.id },
            });
            const reason = inviteStatus(fresh, now());
            throw unusable(reason === 'active' ? 'exhausted' : reason);
          }

          const enrollment = await tx.enrollment.create({
            data: {
              routeId: invite.routeId,
              travelerId: userId,
              inviteId: invite.id,
            },
          });
          return { created: true, enrollment };
        });

      let result: JoinResult;
      try {
        result = await join();
      } catch (error) {
        // The same person joined twice at the same instant and lost the race
        // on the unique (route, traveler) rule. Retrying finds the winner.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          result = await join();
        } else {
          throw error;
        }
      }

      return {
        created: result.created,
        enrollment: {
          id: result.enrollment.id,
          status: result.enrollment.status.toLowerCase() as EnrollmentStatus,
          startedAt: result.enrollment.startedAt,
          completedAt: result.enrollment.completedAt,
        },
        // Only what the traveler needs to know they joined. The film list and
        // the notes come from the route view.
        route: {
          id: invite.route.id,
          title: invite.route.title,
          description: invite.route.description,
          locale: invite.route.locale.toLowerCase() as Locale,
          author: invite.route.author.username,
          stepCount: invite.route._count.steps,
        },
      };
    },
  };
}

export type InviteService = ReturnType<typeof createInviteService>;
