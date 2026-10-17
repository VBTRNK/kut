# Academy design (#246 S1): Talents, First Team, Retired

For the agents building #246 S3 (UI) and S5 (named trialists). The rules are
ADR-165 and the #246 rules comment; this note only says how they look. Where
this note and an artboard disagree, this note wins; the ADR beats both.

**Status:** approved by the owner on 17 Oct 2026: Q1 to Q6 as recommended,
Q7 with a change, and the feedback below applied and accepted. Not built yet:
S2 is the migration, S3 the UI.

## The canvas

- Private Claude Design canvas "FLUT Academy, mocks (#246 S1)",
  <https://claude.ai/artifact/W7KGSDLa1tsCV1DPWNZhL6>; only the owner can open
  it. A build agent reads an artboard with the Artifact tool's `read` action
  (`path: project/<file>`).
- 42 artboards from 24 boards on five pages (Academy and stages, promotion
  moment, At risk and Retired, Midweek, Admin), at 320 and 412 px and, for the
  main pages, 1440. A blue sticky beside each row says what it shows.
- Dark only: the app has one theme (the Clubblad palette), so the plan's
  "light and dark" has no light side to draw.
- **Generated:** `node design/academy/build/build.mjs [--shots <dir>]` writes
  `.release-evidence/academy-mocks/` (ignored). It reuses the DR5 loader
  (`design/ui-pass/build/source.mjs`), renders the real `LiveCard`, app chrome
  and `src/components/ui` primitives with the compiled `globals.css`, and fails
  on any sideways scroll. `node design/ui-pass/build/clipped.mjs <files>`
  lists text cut off by an ellipsis (none at 320/412).
- **Numbers follow from attendance:** `build/world.mjs` holds an invented club
  (go-live 19 Oct 2026, "now" Wed 3 Feb 2027, no sessions over Christmas) and
  `build/lifecycle.mjs` mirrors the rules (progress, credits, the absence clock,
  sticky retirement). The world asserts what each board claims (Fenna promoted,
  Sven fading, Kees At risk at 10, Olaf retiring this week, Pim a comeback,
  Hidde paused by injury). S2's SQL is the authority; its tests can reuse this
  world. Ratings are the rules' worked examples or invented.

## What to lift (S3)

- `build/academy.tsx`: `Progress` (three pips: filled = a counted week played,
  brass ring = a credit, dashed = to come; words always beside it),
  `progressWords`, `AcademyBlock`, `WeekStrip`, `AtRiskBlock`, `RetiredBlock`,
  `TalentAdmin`, `AddPlayerBlock` (with `Choice`), and every page's copy.
- `build/academy.css`: the Retired treatment. S3 moves direction A into
  `globals.css` as `.live-card[data-retired]` beside the cast, set by the
  shared card adapter (`toLiveCardPlayer`) on current surfaces only, never in
  snapshot adapters. The mini gets the same fade with a red bar.

## Decisions (owner, 17 Oct 2026)

- **Q1, the Retired treatment (C1): A**, a red rubber stamp in the band under
  the shirt number (where the cast writes, never across a face or rating),
  colours faded. B (a black sash) covers the pennant at grid size; C (sepia and
  a brass plaque) turns every tier the same brown.
- **Q2, where the Academy lives (A1):** a block on Players, after the First
  Team grid on a phone and beside it from `lg`, with Retired as a row at the
  foot leading to `/players/retired`. No new tab or nav item.
- **Q3, a Talent's OVR (A2):** shown on their profile ("OVR now 45, Bronze"),
  since their card would start there.
- **Q4, the promotion message (B1):** to every member. At risk and Retired go
  to owners of copies only, as the rules say.
- **Q5, promotion on Home (B2):** a plain tile, "New: Fenna L.", for the
  promotion week; the Now block stays whatever is due.
- **Q6, Retired cards in the picker (D1):** listed, faded, tagged Retired and
  not pickable, so a member sees why.
- **Q7, the FAQ (E5):** two questions in Cards and ratings (`#academy`,
  `#retired`) and one in Midweek, keeping six topics (ADR-161). Credits are
  not explained to members.

## Owner feedback (17 Oct 2026), applied

- Players on a phone: the Academy block moved below the First Team grid.
- The week strip overlapped at 320 px: its labels are now day over month.
- **Add a Talent without a session (E6, E2, E3):** the roster's add form
  ("Add a Player") starts someone as a Talent (the default) or in the First
  Team, and a Talent can start with 0 to 2 credits and a reason. It offers a
  similar existing name first. Credits for an existing Talent stay on their
  roster row. A Talent with 2 credits and no game shows in the Academy and is
  promoted at their first counted week. Recording attendance can still add a
  Talent on the spot. This updates the #246 rules comment (registration).

Also shown without a question: At risk is a warn tag on the Players grid and a
block on profiles and owned cards, never a card treatment; the Chronicle gets a
"The roster" block (promotions, retirements, returns; At risk is not news);
Packs gets one "New in packs" inset for the promotion week; admin attendance
lists Talents and Retired Players with a word and offers a similar name before
adding a Talent; the roster gains Stage and Clock columns, Credit and
Promote/Bring back, and a go-live block (brass while due) with a confirmation.
