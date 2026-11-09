# Prompts for the design pass (Claude Desktop)

Three prompts, run in order, in the **same conversation** so the model keeps the
design system in context. Attach `docs/design-brief.md` (or paste it) to the
first one only.

Rules to save credits:

- Ask for **code only, no explanations** (already in the prompts).
- Never ask "regenerate everything". For changes ask for **only the modified
  parts** ("return only the changed CSS rules / the changed screen").
- If something is wrong, batch all your corrections into **one** message.
- Save each result to `docs/design/` as soon as you get it.

---

## Prompt 1 · Design system + the two hero screens

```
Read the attached design brief. You are designing a mobile-first PWA called
"film-routes" (working title).

Deliver ONE self-contained HTML file (inline CSS, tiny vanilla JS only if it
helps show states). No frameworks, no external images (use CSS gradients as
poster placeholders). Spanish copy.

Part A - design system, as CSS variables on :root, with a dark theme under
prefers-color-scheme: dark:
  - colors (background, surface, text, muted text, border, primary, accent,
    success, warning, danger) and the 8 emotion colors (joy, tenderness, awe,
    thoughtful, tension, fear, sadness, discomfort). Each emotion also needs a
    simple inline-SVG icon. Do not rely on color alone.
  - typography scale (pick fonts available on Google Fonts), spacing scale,
    radius, shadows.
  - components shown on one "style guide" section: buttons, chips, cards,
    inputs, banner, emotion picker (grid) and read-only emotion chip.

Part B - two mobile screens (390px wide frame), shown side by side below the
style guide:
  1. Journey view of a 5-film route with these films in different states:
     closed (with my emotion + the guide's emotion revealed + note after),
     started ("watching now"), recommended next (note before visible),
     pending (note before locked, clearly intentional), pending-out-of-order.
  2. The close-a-film sheet: "I've watched it" / "I had already seen it", the
     emotion picker, optional 280-char comment with counter, confirm button.

Output only the file. No explanations.
```

Review it, then fix everything in ONE message:
`Apply these changes and return only the modified CSS rules and screens: ...`

---

## Prompt 2 · The rest of the mobile screens

```
Using exactly the same design system (reuse the same CSS variables; do not
change them), add these mobile screens (390px) to the same file, Spanish copy,
as new sections. Return ONLY the new sections' HTML plus any NEW CSS rules.

  1. Explore: sort tabs (Nuevas / Populares / Mejor valoradas), route cards
     (title, author, number of films, strip of 3 poster thumbnails, rating or
     "pocas valoraciones", completions).
  2. Public route page (no account): description, author, films WITHOUT notes,
     rating, completions, sticky "Empezar esta ruta" button.
  3. Route completed + rating 1-10 (whole numbers) and a share/continue action.
  4. My routes (author): cards with state badges (privada / con enlace /
     pública), "bloqueada" (travelers joined), and "retirada por moderación"
     with the reason.
  5. Route editor: film search with poster results, ordered list with reorder
     handles, per-film notes (before/after) and author's emotion, visibility
     selector, and the warning "Una vez que alguien se una, ya no podrás
     cambiar las películas".
  6. Comparison view (author): one traveler across all films, my emotion vs.
     theirs, same/different, their comment.
  7. Invitations: create-link form (max uses, expiry), list with status and
     uses, copy and revoke.
  8. Log in / Sign up / Email not confirmed banner.

No explanations.
```

---

## Prompt 3 · Desktop, secondary screens and dark-mode check

```
Same file, same design system. Return ONLY new sections/rules.

  1. Desktop (1280px) versions of Explore and Journey view (use the extra
     width well: e.g. two columns on the journey, with notes beside the film).
  2. Settings and delete account (shows "borrarás 3 rutas y afectará a 12
     personas", asks for the password), and the report-a-route modal
     (reason + optional note).
  3. Admin, plain and functional: report queue grouped by route with reason
     breakdown, and the review screen (full route with notes, reports list,
     "Retirar" with required reason, "Descartar denuncias", "Restaurar").
  4. States: loading skeletons, empty states (no routes yet, no travelers
     yet), error state, and the "route hidden by moderation" screen shown to a
     traveler who was in the middle of it.
  5. TMDB attribution footer: logo placeholder + the required sentence.

Finally, list in 8 lines max any contrast or tap-target problem you know the
design still has.
```
