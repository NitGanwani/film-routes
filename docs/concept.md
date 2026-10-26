# Concept

> Working title: **film-routes**. The final name is still undecided; it is only
> used for the repo and package scope, so renaming is cheap.

## One-line pitch

Build a short, guided path of films for one specific person, and see how each
film lands for them.

## The problem

Recommending a film to someone is easy. Getting them to _enjoy_ it is not:
the wrong entry point turns people off a director, a genre or a whole cinema.
Today the options are a message ("watch X, it's great"), a flat list, or a
yearly challenge tracked by hand. None of them guides the person step by step
or tells the recommender what happened.

## Core idea

A **route** is an ordered sequence of 3 to 10 films with the author's notes.

- The **guide** (author) picks the films and writes, for each step:
  - a spoiler-free **note before** ("watch for how the silence is used"),
  - a **note after**, locked until the traveler marks the film as watched,
  - their own **emotion** for that film.
- The **traveler** (follower) opens a link on their phone, sees only the
  current step, and moves forward at their own pace.
- At each step the traveler records one **emotion** with a single tap
  (optionally a 280-character comment). The guide then sees their feeling
  next to their own ("you: sadness, them: joy").

## Principles

1. **Low friction for the traveler.** No external accounts. Progress is
   self-reported: a "Start now" button, an optional reminder when the runtime
   ends, and one tap to confirm. No pausing the film, no logging minute by
   minute.
2. **Independent.** Only film metadata comes from outside (TMDB). Letterboxd,
   Trakt or similar integrations could be optional extras, never requirements.
3. **Private by default.** Reactions are visible only to the traveler and the
   route's author. This also removes most moderation needs.
4. **Spoiler-aware.** Notes unlock progressively; nothing about step N+1 is
   revealed before step N is done.
5. **Bilingual from day one.** Interface in Spanish and English. Emotions and
   statuses are stored as neutral enum values and translated in the client.
6. **Mobile first.** A responsive web app that installs as a PWA. A native
   shell (Capacitor) or an Expo client can come later against the same API.

## Roles and main flows

| Flow                | Who      | Summary                                                         |
| ------------------- | -------- | --------------------------------------------------------------- |
| Create a route      | Guide    | Search films (TMDB), order them, write notes, set visibility.   |
| Invite someone      | Guide    | Generate a personal, single-use link.                           |
| Accept and follow   | Traveler | Open the link, sign up or log in, start the route.              |
| Watch a step        | Traveler | "Start now" → reminder → confirm watched → emotion (+ comment). |
| Read the aftermath  | Both     | The note after unlocks; the guide sees the emotion comparison.  |
| Browse public paths | Anyone   | Public routes can be listed and started without an invitation.  |

## MVP scope

In:

- Registration and login (access token + rotating refresh token).
- Film search and caching from TMDB, in Spanish and English.
- Create, edit and publish routes with ordered steps and notes.
- Personal invitation links, enrollments and per-step progress.
- One-tap emotion + optional comment, and the guide's comparison view.
- Responsive PWA, i18n (es/en).

Out (for now):

- Minute-level reactions, mood-based discovery as a headline feature,
  film clubs, group "what shall we watch" voting, native store apps.
- Push notifications beyond what a PWA offers (iOS requires the PWA to be
  installed; the fallback is an in-app prompt the next time it is opened).
- Importing history from Letterboxd or Trakt.

## What is (and is not) new

A research pass on 2026-10-19 found the individual ingredients elsewhere:
mood-based discovery (Letterboxd nanogenres, many small apps), recommending to a
friend (FriendsRecommend, Flixie), curated lists with notes and manually
tracked yearly challenges (Letterboxd). It did **not** find a product combining
a route built for one specific person, notes that unlock progressively, and an
emotion comparison between guide and traveler. "Not found" is not "does not
exist": re-check the app stores and Product Hunt before making any claim in the
public README.

## Technical decisions

| Area            | Choice                                          | Why                                                                         |
| --------------- | ----------------------------------------------- | --------------------------------------------------------------------------- |
| Repo            | npm workspaces monorepo                         | One place for API, web and shared code; a mobile client can join later.     |
| API             | Node 24, Express 5, TypeScript, Zod             | Familiar stack; the learning goal is Postgres, security and deployment.     |
| Database        | PostgreSQL 17 + Prisma 7                        | Relational model with real constraints; Prisma 7 is the stable line.        |
| Shared code     | `packages/shared`, exported as TypeScript       | Enums, limits and (later) Zod schemas used by API and web; no build step.   |
| Film data       | TMDB API                                        | Free for non-commercial use with attribution. IMDb's API is paid (AWS).     |
| Web (planned)   | React, Vite, TanStack Query, react-i18next, PWA | Server state does not need Redux; PWA gives the mobile experience for free. |
| Auth            | Bearer access token + rotating refresh token    | Works the same for the web and a future native client; no cookie coupling.  |
| Local database  | Docker Compose                                  | Reproducible; also used for integration tests.                              |
| Deploy (target) | Free tiers, decided when we get there           | Free-plan terms change often; verify before choosing.                       |

TypeScript is pinned to 6.0.x because `typescript-eslint` does not yet support
7.x. Prisma is pinned to the 7.x line; 8.x is still a release candidate.

## Open questions

- Should a step's `StepProgress` carry the route id so the database itself
  guarantees a progress row cannot point at a step of a different route
  (composite foreign keys)? Currently enforced in the application layer.
- Reordering steps with the `(route_id, position)` unique constraint needs a
  two-phase update inside a transaction; decide the approach when building the
  edit endpoint.
- Public routes: how to avoid abuse without heavy moderation (rate limits,
  report button, author reputation)?
- Final product name and domain.
