import {
  ROUTE_LIMITS,
  type Emotion,
  type Locale,
  type RouteVisibility,
} from '@film-routes/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import type {
  Emotion as DbEmotion,
  Locale as DbLocale,
  Visibility as DbVisibility,
} from '../../generated/prisma/enums.js';
import type { Db } from '../db.js';
import { HttpError } from '../errors.js';
import { posterUrl, type FilmService } from '../films/service.js';
import type {
  AddStepInput,
  CreateRouteInput,
  UpdateRouteInput,
  UpdateStepInput,
} from './schemas.js';

type Tx = Prisma.TransactionClient;

// Parked positions must not collide with any real one (1..maxSteps).
const PARK_OFFSET = 100;

const routeNotFound = () =>
  new HttpError(404, 'route_not_found', 'Route not found');
const stepNotFound = () =>
  new HttpError(404, 'step_not_found', 'Step not found');
const routeLocked = () =>
  new HttpError(
    409,
    'route_locked',
    'Travelers have already joined this route, so its films can no longer be changed',
  );
const routeTooShort = () =>
  new HttpError(
    409,
    'route_too_short',
    `A shared route needs at least ${ROUTE_LIMITS.minSteps} films`,
  );

const toDbLocale = (locale: Locale): DbLocale =>
  locale === 'es' ? 'ES' : 'EN';
const toDbEmotion = (emotion: Emotion) => emotion.toUpperCase() as DbEmotion;
const toDbVisibility = (visibility: RouteVisibility) =>
  visibility.toUpperCase() as DbVisibility;

const detailInclude = {
  steps: {
    orderBy: { position: 'asc' },
    include: { film: { include: { translations: true } } },
  },
  _count: { select: { enrollments: true } },
} satisfies Prisma.RouteInclude;

type RouteRow = Prisma.RouteGetPayload<{ include: typeof detailInclude }>;

function toDetail(route: RouteRow) {
  return {
    id: route.id,
    title: route.title,
    description: route.description,
    locale: route.locale.toLowerCase() as Locale,
    visibility: route.visibility.toLowerCase() as RouteVisibility,
    /** True once a traveler has joined: films can no longer be changed. */
    locked: route._count.enrollments > 0,
    createdAt: route.createdAt,
    updatedAt: route.updatedAt,
    steps: route.steps.map((step) => ({
      id: step.id,
      position: step.position,
      noteBefore: step.noteBefore,
      noteAfter: step.noteAfter,
      authorEmotion: (step.authorEmotion?.toLowerCase() ??
        null) as Emotion | null,
      film: {
        tmdbId: step.film.tmdbId,
        // Shown in the language the author wrote the route in.
        title:
          step.film.translations.find((item) => item.locale === route.locale)
            ?.title ?? step.film.originalTitle,
        originalTitle: step.film.originalTitle,
        releaseYear: step.film.releaseYear,
        runtimeMinutes: step.film.runtimeMinutes,
        posterUrl: posterUrl(step.film.posterPath),
      },
    })),
  };
}

export type RouteDetail = ReturnType<typeof toDetail>;

export function createRouteService(
  db: Db,
  films: FilmService,
  now: () => Date = () => new Date(),
) {
  const loadDetail = async (client: Db | Tx, routeId: string) =>
    toDetail(
      await client.route.findUniqueOrThrow({
        where: { id: routeId },
        include: detailInclude,
      }),
    );

  /**
   * Runs `work` in a transaction holding a lock on the route row, so two edits
   * to the same route (and, later, a traveler joining) cannot interleave. The
   * query also checks ownership: someone else's route looks like it does not
   * exist.
   */
  function withRouteLock<T>(
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
        throw routeNotFound();
      }
      return work(tx);
    });
  }

  async function assertNoTravelers(tx: Tx, routeId: string) {
    if ((await tx.enrollment.count({ where: { routeId } })) > 0) {
      throw routeLocked();
    }
  }

  const touch = (tx: Tx, routeId: string) =>
    tx.route.update({ where: { id: routeId }, data: { updatedAt: now() } });

  /**
   * Gives the steps positions 1..n in the order given. A direct swap would
   * break the unique (route, position) rule halfway, so every step is first
   * parked out of range and then placed in its final spot.
   */
  async function rewritePositions(
    tx: Tx,
    routeId: string,
    orderedStepIds: string[],
  ) {
    await tx.routeStep.updateMany({
      where: { routeId },
      data: { position: { increment: PARK_OFFSET } },
    });
    for (const [index, id] of orderedStepIds.entries()) {
      await tx.routeStep.update({
        where: { id },
        data: { position: index + 1 },
      });
    }
  }

  return {
    async createRoute(userId: string, input: CreateRouteInput) {
      const author = await db.user.findUniqueOrThrow({
        where: { id: userId },
        select: { locale: true },
      });
      const route = await db.route.create({
        data: {
          authorId: userId,
          title: input.title,
          description: input.description ?? null,
          locale: input.locale ? toDbLocale(input.locale) : author.locale,
        },
        include: detailInclude,
      });
      return toDetail(route);
    },

    async listRoutes(userId: string) {
      const routes = await db.route.findMany({
        where: { authorId: userId },
        orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { steps: true, enrollments: true } } },
      });
      return routes.map((route) => ({
        id: route.id,
        title: route.title,
        description: route.description,
        locale: route.locale.toLowerCase() as Locale,
        visibility: route.visibility.toLowerCase() as RouteVisibility,
        stepCount: route._count.steps,
        locked: route._count.enrollments > 0,
        createdAt: route.createdAt,
        updatedAt: route.updatedAt,
      }));
    },

    async getRoute(userId: string, routeId: string) {
      const route = await db.route.findFirst({
        where: { id: routeId, authorId: userId },
        include: detailInclude,
      });
      if (!route) {
        throw routeNotFound();
      }
      return toDetail(route);
    },

    updateRoute(userId: string, routeId: string, patch: UpdateRouteInput) {
      return withRouteLock(userId, routeId, async (tx) => {
        // Sharing a route (anything but private) needs a complete path.
        if (patch.visibility && patch.visibility !== 'private') {
          const steps = await tx.routeStep.count({ where: { routeId } });
          if (steps < ROUTE_LIMITS.minSteps) {
            throw routeTooShort();
          }
        }
        await tx.route.update({
          where: { id: routeId },
          data: {
            title: patch.title,
            description: patch.description,
            visibility: patch.visibility
              ? toDbVisibility(patch.visibility)
              : undefined,
          },
        });
        return loadDetail(tx, routeId);
      });
    },

    deleteRoute(userId: string, routeId: string) {
      return withRouteLock(userId, routeId, async (tx) => {
        await assertNoTravelers(tx, routeId);
        await tx.route.delete({ where: { id: routeId } });
      });
    },

    async addStep(userId: string, routeId: string, input: AddStepInput) {
      const owned = await db.route.findFirst({
        where: { id: routeId, authorId: userId },
        select: { id: true },
      });
      if (!owned) {
        throw routeNotFound();
      }

      // This is the moment a film is "chosen", so it is stored here. It runs
      // before the lock: no row lock is held while waiting on TMDB.
      const film = await films.ensureFilm(input.tmdbId);

      return withRouteLock(userId, routeId, async (tx) => {
        await assertNoTravelers(tx, routeId);

        const count = await tx.routeStep.count({ where: { routeId } });
        if (count >= ROUTE_LIMITS.maxSteps) {
          throw new HttpError(
            409,
            'route_full',
            `A route can have at most ${ROUTE_LIMITS.maxSteps} films`,
          );
        }
        const duplicate = await tx.routeStep.findUnique({
          where: { routeId_filmId: { routeId, filmId: film.id } },
          select: { id: true },
        });
        if (duplicate) {
          throw new HttpError(
            409,
            'film_already_in_route',
            'This film is already in the route',
          );
        }

        await tx.routeStep.create({
          data: {
            routeId,
            filmId: film.id,
            position: count + 1,
            noteBefore: input.noteBefore ?? null,
            noteAfter: input.noteAfter ?? null,
            authorEmotion: input.authorEmotion
              ? toDbEmotion(input.authorEmotion)
              : null,
          },
        });
        await touch(tx, routeId);
        return loadDetail(tx, routeId);
      });
    },

    /** Notes and the author's emotion stay editable even with travelers. */
    updateStep(
      userId: string,
      routeId: string,
      stepId: string,
      patch: UpdateStepInput,
    ) {
      return withRouteLock(userId, routeId, async (tx) => {
        const step = await tx.routeStep.findFirst({
          where: { id: stepId, routeId },
          select: { id: true },
        });
        if (!step) {
          throw stepNotFound();
        }
        await tx.routeStep.update({
          where: { id: stepId },
          data: {
            noteBefore: patch.noteBefore,
            noteAfter: patch.noteAfter,
            authorEmotion:
              patch.authorEmotion === undefined
                ? undefined
                : patch.authorEmotion && toDbEmotion(patch.authorEmotion),
          },
        });
        await touch(tx, routeId);
        return loadDetail(tx, routeId);
      });
    },

    removeStep(userId: string, routeId: string, stepId: string) {
      return withRouteLock(userId, routeId, async (tx) => {
        await assertNoTravelers(tx, routeId);

        const route = await tx.route.findUniqueOrThrow({
          where: { id: routeId },
          select: { visibility: true },
        });
        const steps = await tx.routeStep.findMany({
          where: { routeId },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        if (!steps.some((step) => step.id === stepId)) {
          throw stepNotFound();
        }
        const remaining = steps.filter((step) => step.id !== stepId);
        if (
          route.visibility !== 'PRIVATE' &&
          remaining.length < ROUTE_LIMITS.minSteps
        ) {
          throw routeTooShort();
        }

        await tx.routeStep.delete({ where: { id: stepId } });
        await rewritePositions(
          tx,
          routeId,
          remaining.map((step) => step.id),
        );
        await touch(tx, routeId);
        return loadDetail(tx, routeId);
      });
    },

    reorderSteps(userId: string, routeId: string, stepIds: string[]) {
      return withRouteLock(userId, routeId, async (tx) => {
        await assertNoTravelers(tx, routeId);

        const current = await tx.routeStep.findMany({
          where: { routeId },
          select: { id: true },
        });
        const sameSteps =
          stepIds.length === current.length &&
          new Set(stepIds).size === stepIds.length &&
          current.every((step) => stepIds.includes(step.id));
        if (!sameSteps) {
          throw new HttpError(
            400,
            'invalid_order',
            'Send every step of the route exactly once',
          );
        }

        await rewritePositions(tx, routeId, stepIds);
        await touch(tx, routeId);
        return loadDetail(tx, routeId);
      });
    },
  };
}

export type RouteService = ReturnType<typeof createRouteService>;
