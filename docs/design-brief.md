# Design brief

Working title: **film-routes** (the final name is undecided; design the logo
and wordmark so it is easy to swap).

## What it is

A **route** is a short, ordered path of 3 to 10 films that one person (the
**guide**) builds for someone else (a **traveler**). The guide writes, per film:
a spoiler-free note _before_, a note _after_ (locked until the traveler has
watched it) and their own emotion. The traveler follows the route at their own
pace and closes each film with **one emotion** (one tap, plus an optional
280-character comment). The guide then sees how each film landed next to their
own feeling ("you: sadness, them: joy").

The product is about the **feeling of discovering cinema with someone's
guidance**, not about databases of films. It should feel warm, personal and a
little cinematic, not like a spreadsheet or like IMDb.

## Who and where

- Mostly **phones** (people open a link someone sent them). Design **mobile
  first**, then a comfortable desktop layout. It ships as an installable PWA.
- **Spanish and English** from day one. Spanish text is usually 20-30% longer:
  nothing should break with longer labels.
- Light **and** dark theme (follow the system setting).
- Accessibility: contrast AA, tap targets of at least 44px, and **never
  communicate an emotion by color alone** (each emotion needs an icon or
  shape plus a label).
- Film posters come from TMDB (portrait, 2:3). Some films have no poster: design
  the empty state.
- **Required by TMDB's terms:** show the TMDB logo and this sentence somewhere
  visible (footer or about page): _"This product uses the TMDB API but is not
  endorsed or certified by TMDB."_

## Things the design system must cover

1. **Eight emotions**, each with icon + color + label: joy, tenderness, awe,
   thoughtful, tension, fear, sadness, discomfort. A one-tap picker (grid) and a
   small read-only "chip" version used in lists and comparisons.
2. **Step states** of a film in a route: _pending_, _started_ ("watching now"),
   _closed_ (emotion given). Plus "recommended next" highlight. The order is
   advice, not an obligation, so nothing should look blocked because it is out
   of order.
3. **Locked content**: a note that is still locked must look intentionally
   locked (and say when it unlocks), not broken or empty.
4. **Comparison** guide vs. traveler for a film: two emotion chips, "same" or
   "different", the traveler's comment.
5. **Rating**: a whole number from 1 to 10 for the whole route; the average is
   shown with one decimal (7.2) only once enough people voted (otherwise show
   "not enough votes yet").
6. **Route card** (in lists): title, author, number of films, a strip of
   poster thumbnails, rating, number of completions.
7. **Banners / system states**: email not confirmed, route hidden by a
   moderator (with reason, for the author), route you follow was hidden, route
   locked because travelers joined ("films can no longer be changed"),
   loading, empty and error states.

## Screens

**Open to anyone (no account)**

- Explore: list of public routes, sorted by _new_, _popular_, _top rated_.
- Public route page: title, description, author, the **films (no notes)**,
  rating, completions, big "Start this route" button (asks to sign in).
- Sign up, log in, "forgot password", "reset password", "confirm email" result.
- Invitation landing (someone sent a link): who invited, what the route is,
  accept button.

**Traveler**

- My journeys: routes I follow with progress ("3 of 5").
- Journey view (the heart of the product): the list of films with their state;
  per film: "Start now" → note before → "I've watched it" (or "I had already
  seen it") → emotion picker + optional comment → note after and the guide's
  emotion are revealed.
- Route completed: celebration, then ask for the 1-10 rating.
- Leave a route.

**Guide (author)**

- My routes: list with state (private / unlisted / public), locked, hidden.
- Route editor: title, description, add films (search with posters), reorder
  (drag or up/down), per-film notes and emotion, visibility. Before sharing,
  warn: _"Once someone joins you can no longer change the films."_
- Invitations: create a link (optional max uses and expiry), copy, revoke, see
  uses.
- Travelers: who joined, progress, remove; and the **comparison view** for one
  traveler across all films.

**Account**

- Settings: language, email status, log out, delete account (shows how many
  routes and travelers will be affected, asks for the password).
- Report a route (modal: reason + optional note).

**Admin (internal, can be plainer)**

- Report queue grouped by route, with reasons breakdown.
- Review a route: full content with notes, list of reports, buttons _hide_
  (reason required) and _dismiss reports_; unhide.

## What to deliver

- A small **design system** I can implement: color tokens (light and dark),
  typography scale, spacing, radius, shadows, and the components above.
  CSS variables are ideal.
- High-fidelity **mobile** designs of the key screens (at least: Explore, Public
  route page, Journey view with its states, Emotion picker, Route editor,
  Comparison view), plus the desktop version of Explore and Journey.
- The same screens in **Spanish** (the longer language) so we can see the
  layout under pressure.
- Anything interactive as **HTML/CSS** is welcome (I will turn it into React
  components), but static images are fine too.

## Not in scope

No chat, no feed, no follower counts, no push notifications, no film reviews
or star ratings per film. Keep it focused on the route.
