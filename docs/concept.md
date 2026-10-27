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
- The **traveler** (follower) opens a link on their phone, sees the **whole
  list of films** from the start (they may have already seen some), and moves
  forward at their own pace. What is revealed progressively are the _notes_
  and the _emotions_, not the films.
- At each step the traveler records one **emotion** with a single tap
  (optionally a 280-character comment). The guide then sees their feeling
  next to their own ("you: sadness, them: joy").

### What the traveler sees, and when

| Item                       | Visible                                           |
| -------------------------- | ------------------------------------------------- |
| Title, description, author | Always                                            |
| Full list of films         | From the moment they join (and before, if public) |
| Note before (step N)       | When it is their turn to watch film N             |
| Note after (step N)        | When they close film N (emotion registered)       |
| Guide's emotion (step N)   | When they register their own emotion for film N   |

### Progress rules

1. A film can be **watched through the route** ("Start now" → confirm watched)
   or marked **already seen before**.
2. **Closing a film always requires one emotion** (comment optional), including
   films the traveler had already seen. The emotion is the point of the
   product, so it is never optional.
3. **Order is a recommendation, not an obligation.** The app suggests following
   the order and highlights the next film, but does not block the others. The
   notes are written to be read in order, so the UI nudges, the API allows.
4. The route is **completed** when every film is closed.
5. A traveler can leave a route (progress is kept and they can come back).
   The author can remove a traveler; a removed traveler cannot rejoin.

## Principles

1. **Low friction for the traveler.** No external accounts. Progress is
   self-reported: a "Start now" button, an optional reminder when the runtime
   ends, and one tap to confirm. No pausing the film, no logging minute by
   minute.
2. **Independent.** Only film metadata comes from outside (TMDB). Letterboxd,
   Trakt or similar integrations could be optional extras, never requirements.
3. **Private by default.** Reactions are visible only to the traveler and the
   route's author. This also removes most moderation needs.
4. **Spoiler-aware.** Notes unlock progressively: the note before appears on the
   traveler's turn and the note after only once the film is closed. The film
   list itself is not a secret. Spoilers cannot be detected automatically (and
   TMDB forbids AI use of its content), so the answer is UI guidance for
   authors plus a "this note spoiled me" report later.
5. **Bilingual from day one.** Interface in Spanish and English. Emotions and
   statuses are stored as neutral enum values and translated in the client.
6. **Mobile first.** A responsive web app that installs as a PWA. A native
   shell (Capacitor) or an Expo client can come later against the same API.

## Roles and main flows

| Flow                | Who      | Summary                                                         |
| ------------------- | -------- | --------------------------------------------------------------- |
| Create a route      | Guide    | Search films (TMDB), order them, write notes, set visibility.   |
| Invite people       | Guide    | Generate a link with an optional use cap and expiry.            |
| Unpublish           | Guide    | Back to private: no new travelers; those inside can finish.     |
| Accept and follow   | Traveler | Open the link, sign up or log in, start the route.              |
| Watch a step        | Traveler | "Start now" → reminder → confirm watched → emotion (+ comment). |
| Already seen        | Traveler | Mark a film as seen before, then record the emotion.            |
| Read the aftermath  | Both     | The note after unlocks; the guide sees the emotion comparison.  |
| Rate a route        | Traveler | After completing it: one rating from 1 to 10.                   |
| Browse public paths | Anyone   | Public routes can be listed and started without an invitation.  |

## Editing rules for the author

- While **nobody has joined**, the route is fully editable (films, order, notes).
- From the moment **someone joins**, films cannot be added, removed or
  reordered: the traveler already sees the list and changing it would move
  the ground under them. Title, description and notes stay editable.
  Travelers the author removes do not count.
- The author is **warned before publishing or inviting**: "Once someone joins,
  you can no longer change the films."
- Escape hatch: **unpublishing**. A route with an error can stop being offered
  (it leaves listings and links stop working) while people already inside keep
  going. "New version of a route" is deferred until it is really needed.

## Public routes and ratings

- A public route can be listed and started **without an invitation**. Before
  starting, anyone sees the title, description, author, film list, rating and
  number of completions. **No notes.**
- **Only people who completed a route can rate it**, with a single whole-number
  score from 1 to 10 on the route as a whole (not on films, not on emotions).
  This avoids drive-by votes and review bombing. One vote per person and route,
  which they can change later.
- The route's **overall score is the average of its votes, shown with one
  decimal** (e.g. 7.2) and recalculated as votes come in. It is not shown until
  the route has a minimum number of votes, so a single 10 does not look like a
  masterpiece.
- Rankings (later): best rated with a minimum number of votes, most completed,
  newest. Completion rate is a quality signal as well.
- Deferred: genre filter / author tags, reports and moderation, "this note
  spoiled me" button.

## MVP scope

In:

- Registration and login (access token + rotating refresh token).
- Film search and caching from TMDB, in Spanish and English.
- Create, edit and publish routes with ordered steps and notes.
- Reusable invitation links, enrollments and per-step progress (including
  "already seen").
- One-tap emotion + optional comment, and the guide's comparison view.
- Unpublishing a route.
- Responsive PWA, i18n (es/en).

Next (after the progress feature): public route listing, ratings by people who
completed a route, reports/moderation.

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
- Public routes: how to avoid abuse without heavy moderation (rate limits,
  report button, author reputation)?
- Should "already seen" films count towards the completion rate and the
  guide's comparison the same as films watched through the route?
- Revisit the locking rule if real use shows authors need new versions.
- Final product name and domain.
