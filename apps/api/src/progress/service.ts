import type { Emotion, EnrollmentStatus, Locale } from '@film-routes/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type { Emotion as DbEmotion } from '../../generated/prisma/enums.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { countsAsTraveler, type Tx } from '../routes/locking.js';
import { toFilm } from '../routes/service.js';
import type { CloseStepInput } from './schemas.js';

export type StepState = 'pending' | 'started' | 'closed';

const routeNotFound = () =>
  new HttpError(404, 'route_not_found', 'Route not found');
const stepAlreadyClosed = () =>
  new HttpError(409, 'step_already_closed', 'This film is already closed');

const lower = <T extends string>(value: T) =>
  value.toLowerCase() as Lowercase<T>;
const toEmotion = (emotion: DbEmotion | null) =>
  emotion ? (lower(emotion) as Emotion) : null;

const closedProgress = { emotion: { not: null } } as const;

/** Steps of a route with the progress of exactly one enrollment attached. */
const journeyInclude = (enrollmentId: string) =>
  ({
    author: { select: { username: true } },
    steps: {
      orderBy: { position: 'asc' },
      include: {
        film: { include: { translations: true } },
        progress: { where: { enrollmentId } },
      },
    },
  }) satisfies Prisma.RouteInclude;

type JourneyRoute = Prisma.RouteGetPayload<{
  include: ReturnType<typeof journeyInclude>;
}>;
type StepRow = JourneyRoute['steps'][number];
type ProgressRow = StepRow['progress'][number];

/** A film is closed once the emotion is in: that is what finishes it. */
function stepState(progress: ProgressRow | undefined): StepState {
  if (progress?.emotion) return 'closed';
  if (progress?.startedAt) return 'started';
  return 'pending';
}

export function createProgressService(
  db: Db,
  now: () => Date = () => new Date(),
) {
  /**
   * Locks the traveler's own enrollment row for the rest of the transaction.
   * Everything that changes progress goes through here, so two taps at the same
   * time (a double click, or two devices) are handled one after the other.
   */
  async function lockOwnEnrollment(tx: Tx, userId: string, routeId: string) {
    const rows = await tx.$queryRaw<{ id: string; status: string }[]>`
      SELECT id, status::text AS status FROM enrollments
      WHERE route_id = ${routeId}::uuid AND traveler_id = ${userId}::uuid
      FOR UPDATE`;
    const enrollment = rows[0];
    if (!enrollment) {
      // Not following it (or it does not exist): the same answer either way.
      throw routeNotFound();
    }
    if (enrollment.status === 'REMOVED') {
      throw new HttpError(
        403,
        'removed_from_route',
        'The author has removed you from this route',
      );
    }
    return enrollment;
  }

  function assertFollowing(enrollment: { status: string }) {
    if (enrollment.status === 'ABANDONED') {
      throw new HttpError(
        409,
        'not_following',
        'You left this route; join it again with its link',
      );
    }
  }

  async function stepOfRoute(tx: Tx, routeId: string, stepId: string) {
    const step = await tx.routeStep.findFirst({
      where: { id: stepId, routeId },
      select: { id: true },
    });
    if (!step) {
      throw new HttpError(404, 'step_not_found', 'Step not found');
    }
  }

  async function loadJourney(client: Db | Tx, userId: string, routeId: string) {
    const enrollment = await client.enrollment.findUnique({
      where: { routeId_travelerId: { routeId, travelerId: userId } },
    });
    if (!enrollment) {
      throw routeNotFound();
    }
    if (enrollment.status === 'REMOVED') {
      throw new HttpError(
        403,
        'removed_from_route',
        'The author has removed you from this route',
      );
    }
    const route = await client.route.findUniqueOrThrow({
      where: { id: routeId },
      include: journeyInclude(enrollment.id),
    });
    return toJourney(route, enrollment);
  }

  /**
   * The traveler's view. The film list is open from the start; what unlocks
   * as they go are the notes and the author's emotion:
   *  - note before: the recommended next film, any film they started, or closed
   *  - note after and the author's emotion: only once the film is closed
   */
  function toJourney(
    route: JourneyRoute,
    enrollment: {
      id: string;
      status: string;
      startedAt: Date;
      completedAt: Date | null;
    },
  ) {
    const states = route.steps.map((step) => stepState(step.progress[0]));
    // Following the order is advice, not a rule: this only says what to show
    // as "up next".
    const nextIndex = states.findIndex((state) => state !== 'closed');

    return {
      route: {
        id: route.id,
        title: route.title,
        description: route.description,
        locale: lower(route.locale) as Locale,
        author: route.author.username,
      },
      enrollment: {
        id: enrollment.id,
        status: lower(enrollment.status) as EnrollmentStatus,
        startedAt: enrollment.startedAt,
        completedAt: enrollment.completedAt,
        closedSteps: states.filter((state) => state === 'closed').length,
        stepCount: route.steps.length,
      },
      steps: route.steps.map((step, index) => {
        const progress = step.progress[0];
        const state = states[index]!;
        const recommendedNext = index === nextIndex;
        const noteBeforeLocked = state === 'pending' && !recommendedNext;
        const closed = state === 'closed';
        return {
          id: step.id,
          position: step.position,
          film: toFilm(step.film, route.locale),
          state,
          recommendedNext,
          noteBefore: noteBeforeLocked ? null : step.noteBefore,
          noteBeforeLocked,
          noteAfter: closed ? step.noteAfter : null,
          noteAfterLocked: !closed,
          authorEmotion: closed ? toEmotion(step.authorEmotion) : null,
          seenBefore: progress?.seenBefore ?? false,
          startedAt: progress?.startedAt ?? null,
          watchedAt: progress?.watchedAt ?? null,
          myEmotion: toEmotion(progress?.emotion ?? null),
          myComment: progress?.comment ?? null,
        };
      }),
    };
  }

  return {
    /** The routes this person follows, with how far along they are. */
    async listJourneys(userId: string) {
      const rows = await db.enrollment.findMany({
        where: { travelerId: userId, ...countsAsTraveler },
        orderBy: { startedAt: 'desc' },
        include: {
          route: {
            select: {
              id: true,
              title: true,
              locale: true,
              author: { select: { username: true } },
              _count: { select: { steps: true } },
            },
          },
          _count: { select: { progress: { where: closedProgress } } },
        },
      });
      return rows.map((row) => ({
        enrollmentId: row.id,
        status: lower(row.status) as EnrollmentStatus,
        startedAt: row.startedAt,
        completedAt: row.completedAt,
        closedSteps: row._count.progress,
        route: {
          id: row.route.id,
          title: row.route.title,
          locale: lower(row.route.locale) as Locale,
          author: row.route.author.username,
          stepCount: row.route._count.steps,
        },
      }));
    },

    getJourney(userId: string, routeId: string) {
      return loadJourney(db, userId, routeId);
    },

    /** "Start now": remembers when, and unlocks the note before. Repeatable. */
    startStep(userId: string, routeId: string, stepId: string) {
      return db.$transaction(async (tx) => {
        const enrollment = await lockOwnEnrollment(tx, userId, routeId);
        assertFollowing(enrollment);
        await stepOfRoute(tx, routeId, stepId);

        const existing = await tx.stepProgress.findUnique({
          where: {
            enrollmentId_stepId: { enrollmentId: enrollment.id, stepId },
          },
        });
        if (existing?.emotion) {
          throw stepAlreadyClosed();
        }
        if (!existing) {
          await tx.stepProgress.create({
            data: { enrollmentId: enrollment.id, stepId, startedAt: now() },
          });
        } else if (!existing.startedAt) {
          await tx.stepProgress.update({
            where: { id: existing.id },
            data: { startedAt: now() },
          });
        }
        return loadJourney(tx, userId, routeId);
      });
    },

    /**
     * Confirms the film as watched (or already seen) and records the emotion,
     * which unlocks the note after and the author's emotion. Closing the last
     * film completes the route.
     */
    closeStep(
      userId: string,
      routeId: string,
      stepId: string,
      input: CloseStepInput,
    ) {
      return db.$transaction(async (tx) => {
        const enrollment = await lockOwnEnrollment(tx, userId, routeId);
        assertFollowing(enrollment);
        await stepOfRoute(tx, routeId, stepId);

        const existing = await tx.stepProgress.findUnique({
          where: {
            enrollmentId_stepId: { enrollmentId: enrollment.id, stepId },
          },
        });
        if (existing?.emotion) {
          throw stepAlreadyClosed();
        }

        const closedAt = now();
        const data = {
          watchedAt: closedAt,
          seenBefore: input.seenBefore ?? false,
          emotion: input.emotion.toUpperCase() as DbEmotion,
          comment: input.comment ?? null,
        };
        if (existing) {
          await tx.stepProgress.update({ where: { id: existing.id }, data });
        } else {
          await tx.stepProgress.create({
            data: { enrollmentId: enrollment.id, stepId, ...data },
          });
        }

        // The enrollment row is locked, so this count cannot race with a
        // second close of another film finishing at the same instant.
        const [closed, total] = await Promise.all([
          tx.stepProgress.count({
            where: { enrollmentId: enrollment.id, ...closedProgress },
          }),
          tx.routeStep.count({ where: { routeId } }),
        ]);
        if (closed === total && enrollment.status !== 'COMPLETED') {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { status: 'COMPLETED', completedAt: closedAt },
          });
        }
        return loadJourney(tx, userId, routeId);
      });
    },

    /** Leaves the route. Progress is kept: the link brings them back to it. */
    leave(userId: string, routeId: string) {
      return db.$transaction(async (tx) => {
        const enrollment = await lockOwnEnrollment(tx, userId, routeId);
        if (enrollment.status === 'COMPLETED') {
          throw new HttpError(
            409,
            'route_completed',
            'You already completed this route',
          );
        }
        if (enrollment.status === 'ACTIVE') {
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { status: 'ABANDONED' },
          });
        }
      });
    },

    /**
     * The author's comparison: for every film, what they felt next to what the
     * traveler felt. Only the author of the route can read it.
     */
    async getTravelerJourney(
      authorId: string,
      routeId: string,
      enrollmentId: string,
    ) {
      const route = await db.route.findFirst({
        where: { id: routeId, authorId },
        select: { id: true },
      });
      if (!route) {
        throw routeNotFound();
      }
      const enrollment = await db.enrollment.findFirst({
        where: { id: enrollmentId, routeId },
        include: { traveler: { select: { username: true } } },
      });
      if (!enrollment) {
        throw new HttpError(404, 'traveler_not_found', 'Traveler not found');
      }

      const full = await db.route.findUniqueOrThrow({
        where: { id: routeId },
        include: journeyInclude(enrollment.id),
      });
      const steps = full.steps.map((step) => {
        const progress = step.progress[0];
        const state = stepState(progress);
        const authorEmotion = toEmotion(step.authorEmotion);
        const travelerEmotion = toEmotion(progress?.emotion ?? null);
        return {
          id: step.id,
          position: step.position,
          film: toFilm(step.film, full.locale),
          state,
          authorEmotion,
          travelerEmotion,
          travelerComment: progress?.comment ?? null,
          seenBefore: progress?.seenBefore ?? false,
          watchedAt: progress?.watchedAt ?? null,
          // Only comparable once both sides have an emotion.
          sameEmotion:
            authorEmotion && travelerEmotion
              ? authorEmotion === travelerEmotion
              : null,
        };
      });

      return {
        traveler: {
          enrollmentId: enrollment.id,
          username: enrollment.traveler.username,
          status: lower(enrollment.status) as EnrollmentStatus,
          startedAt: enrollment.startedAt,
          completedAt: enrollment.completedAt,
          closedSteps: steps.filter((step) => step.state === 'closed').length,
          stepCount: steps.length,
        },
        steps,
      };
    },
  };
}

export type ProgressService = ReturnType<typeof createProgressService>;
