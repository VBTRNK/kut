# Design packages

One line per feature on what was decided. The canvases are the owner's private
Claude Design artifacts, so a link below only opens for the owner. The artboard
sources (`*.dc.html`), their `canvas.json` indexes, the package build scripts
and the nav-audit page were archived at the git tag `docs-archive-2026-10`:

```powershell
git ls-tree -r --name-only docs-archive-2026-10 design | rg "dc.html"
git show docs-archive-2026-10:design/midweek/Picker-Saved.dc.html
```

Generated mocks render the real components with the app's compiled CSS,
fail on any sideways scroll, get a screenshot review, and take every number
from a real function, never typed in: in DR4 that review caught four defects
before the owner saw them.

The HANDOFF notes here say where they mention `BUILD_SPEC §N` or an old ADR;
read those from the same tag (see `docs/README.md`). Where a package drew
"KUT", read FLUT (`flut/HANDOFF.md`).

| Package                      | What we decided                                                                                                                                                         | Canvas                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Album, Chronicle, graph      | A bound Panini-style album, a weekly Chronicle issue and a rating-history graph. Built (ADR-047 to 049). Renders in `docs/design/`.                                       | Private                                                                 |
| `features/` (2026-09-05)     | Wanted cards with a copyable message and no matcher, goals and kudos reports, duplicate-sensitive Club Value, Special-edition scaffolding. Built (ADR-056 to 063). The 175-coin pack mockups are historical: the price is 250 (ADR-136). | Private; gallery in `features/index.html`                               |
| Navigation audit (2026-09-05) | Five primary tabs (ADR-053). A Market "My listings" tab was deferred (issue #237).                                                                                      | Archived at the tag                                                     |
| Injury cast (2026-09-23)     | A signed plaster cast replaces the "Injured" chip on Live cards. Built (ADR-084). `docs/design/injury-cast/README.md`.                                                  | <https://claude.ai/artifact/JJ1XHAugHcpSrQAkkyHFdb> (private)           |
| `midweek/` (2026-09-25)      | Midweek Madness entry and results pages, approved by the owner. Built (ADR-091 to 093). `midweek/HANDOFF.md`.                                                          | Private                                                                 |
| `ux-review/` (DR2, 2 Oct)    | MM 2.0 evening and a Compete section. Approved after three rounds. Built (ADR-104, 105, 110 to 113). `ux-review/HANDOFF.md`.                                            | Private                                                                 |
| `mm2-dr3/` (DR3, 3 Oct)      | Ratings, predictions for members who are out, share images, the plusses count and violet and teal team colours (DR3-10). Built (ADR-116 to 120). `mm2-dr3/HANDOFF.md`. | Private (canvas id `Xi7N3kMA2V2iC1zmtPvXVw`)                            |
| `mm3/` (DR4, 11 Oct)         | MM 3.0: every match live with a feed newest on top, a running clock, readable shoot-outs (#263), a between-rounds pre-match, per-match ratings from full time, live rows and equal-height bracket pairings (#216), club names (#262). Approved (#268); builds in S3–S7 of #267. `mm3/HANDOFF.md`. | <https://claude.ai/artifact/LsMTcZJQCRBD3pXiYrem5W> (private)           |
| `ui-pass/` (DR5, 12 Oct)     | The UI pass review: nine ranked problems, proposed design rules, Midweek and report directions, a copy audit and decisions to revisit. Answered (DR5-1 to DR5-10, #294): Midweek as a Now block with tiles, the report in Match and Teams tabs. `ui-pass/review.md`. | <https://claude.ai/artifact/FBoo1Hbs7bPwYQNR2aXpHN> (private)           |
| `ui-pass/` mocks (DR5, 12 Oct) | Generated mocks of the system (six type roles, primitives), Midweek's hub and the pages behind its tiles, and the report in Match and Teams tabs. DR5-11 to DR5-16, answered by the owner (calls lead to their pre-match; no newest outline). Round 3 (pages G to M) adds the rest of the app: DR5-17 to DR5-26, answered by the owner. The generator is in `ui-pass/build/`. `ui-pass/HANDOFF.md`. | <https://claude.ai/artifact/UwL1GERjSw4DMSxmY1rDJM> (private)           |
| `groundmasters/`             | Five card directions for the first Special edition. No direction chosen yet. Rules and open decisions are in issue #222.                                                | Private                                                                 |
| `card-animations/` (13 Oct)   | Approved: medium-intensity pearl refraction for Holo and seamless nine-second Gold foil. Implemented in shared card CSS; comparison and visual checks retained.            | Local animated comparison; see `card-animations/README.md`              |
| `pack-tiers/` (15 Oct, #223 S0) | Approved by the owner (15 Oct). Packs made of the card materials: Regular crimped stock (strip tears), Silver brushed sleeve (slides off), Gold foil wallet (seal breaks, doors open). Tap the pack to open; backs hold, tier and rating advance on their own; per-tier celebrations; real BottomSheet; S3 admin economy preview; mobile/desktop shops, storyboards, older receipts and copy audit. Not built yet; DB, shop/reveal and admin follow as S1–S3. | Local interactive preview; see `pack-tiers/README.md` |
| `flut/` (2026-10-08)         | The FLUT marks, lockup, icons and share images. Built (ADR-137). `flut/HANDOFF.md`. Supersedes the branding in every older package.                                     | Private ("FLUT Rebrand")                                                |
