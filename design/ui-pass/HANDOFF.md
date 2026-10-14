# UI pass design round 5 (DR5): the system, Midweek, the report and the rest of the app

For every agent building the UI pass sessions S4 onward (plan
`~/.claude/plans/flut-ui-pass.md`, tracking issue #294). Read this in full,
then the artboards your session names. It sits on top of `review.md` (DR5-1
to DR5-10) and `design/mm3/HANDOFF.md` (DR4), which still hold for everything
this note doesn't change. Where this note and an artboard disagree, this note
wins; where either disagrees with an ADR, the ADR wins until a new ADR
changes it.

**Status:**

- **Round 2** (S2: the system, Midweek, the report) was answered by the
  owner on 12 Oct 2026. Q1 to Q4 as recommended, plus three changes the
  canvas now shows (see "Owner decisions (DR5, round 2)").
- **Round 3** (S3: the rest of the app, pages G to M) was answered by the
  owner on 12 Oct 2026: Q5 to Q8 as recommended, the Chronicle as a tile of
  its own on Home, and the re-split build with five adjustments (see "Owner
  decisions (round 3)" and "Records the build needs").

Built so far: S4 (the foundations, ADR-153), S5 (the hub, its routes, the
picker and Home's block, ADR-154), S6 (the week, bracket, night, calls and
pre-match, ADR-155) and S7 (the match report, ADR-156). Since S7 the A2
board's "before" side no longer rebuilds: its components are retired.

## The canvas

- **Private Claude Design canvas** "FLUT UI pass, mocks (DR5)",
  <https://claude.ai/artifact/UwL1GERjSw4DMSxmY1rDJM>, which only the owner
  can open. A build agent reads an artboard with the Artifact tool's `read`
  action (`path: project/<file>`).
- **99 artboards from 51 boards on 13 pages:** A to F (round 2) and G to M
  (round 3, see "Round 3"). Most boards are at
  320 and 412 px, some also at 1440 px. The file name says which:
  `B5-Hub-YourMatch-412.dc.html`. A blue sticky beside each row says what it
  shows and why.
- **Generated, not drawn.** A generator built on the MM3 one, kept in this
  repo at `design/ui-pass/build/` since S3, does four things:
  - it stores the sample week as the member views' rows;
  - it calls the app's real functions on those rows;
  - it renders the DR5 components (TSX in the app's idiom) with the app's
    compiled `globals.css`, plus the six type tokens below;
  - it measures every artboard in Chromium and fails on any sideways scroll.
- **Its source is in `design/ui-pass/build/`** (a copy is on the canvas
  under `project/source/`), so every agent can read it without the canvas.
  `ui.tsx`, `midweek.tsx`, `report.tsx`, `pages.tsx` and `app.tsx` (round 3)
  are the TSX; lift the components from there, not from the artboards'
  flattened HTML. `node design/ui-pass/build/build.mjs [--shots <dir>]`
  rebuilds every artboard into `.release-evidence/ui-pass-mocks/` (ignored),
  `voices.mjs` measures one and `clipped.mjs` lists text cut off by an
  ellipsis. It is design-only: nothing in the app imports it.
- **The screenshot review fixed eleven defects before the owner saw them.**
  Four came from the sideways-scroll check:
  - long club names widened `auto` grid tracks;
  - a word ("Quarters") was set as a Figure;
  - a five of mini cards wrapped at 320 px;
  - a tile's title widened its track.

  Seven came from reading the screenshots:
  - the Compete tab's `Live` badge squeezed "Midweek" to "Mid…";
  - the Teams heading repeated its own tab on a phone;
  - the desktop report had no lanes (its column is under 600 px);
  - the picker never showed the plusses (Sanne owns no Goalkeeper);
  - the picker had no card grid at `lg`;
  - `Privacy ›` broke its arrow onto its own line;
  - two tiles said the same thing at the draw.

### The data

The DR4 sample: today's engine and renderer on the invented world of
`tests/sim/midweek-sample.ts`, 22 entrants, Wed 7 Oct 2026, lock 19:55, rounds
at 20:00, 20:15, 20:30, 20:45 and 21:00. Nothing is a real member, club or
Player.

- **"You" are Sanne** (`Sanne's Club`): a bye, then beats Eline 2–0 in round 2,
  then loses the quarter-final to Sophie Saints 1–3. Quarter-final 3,
  Stijnfeld United v Bartcelona, goes 2–2 and 4–3 on penalties. Joristown
  Rovers win the final 3–0.
- **Before the lock** is Mon 12 Oct, 12:00, with the sample week as last week.
- **The picker boards use Julia's collection.** It has nine Players and one
  Goalkeeper. Sanne owns no Goalkeeper, so her picker would never show the
  plusses count.
- **Every number and line comes from the app's own functions:**
  - the bracket, the night and the evening: `assembleBracket`, `myNight`,
    `eveningPhase`, `firstMatch`, `liveView`;
  - the report: `reportInputFromRows`, `renderStoredReport`, `matchRatings`;
  - ratings: `nightRatings`, `latestMatchRatings`;
  - calls: `callCards`, `settledStatus`;
  - the pre-match and the picker: `preMatchSide`, `lineCount`, `lineVerdict`;
  - copy helpers: `finishStat`, `finalLine`, `countdownText`.
- **The only invented inputs are member choices:** Sanne's two calls and the
  club's split on them.

## Boards and routes

| Board | Route | Moment | Shows |
|---|---|---|---|
| `A1-Foundations` (1200) | n/a | n/a | The scale, weights, spacing, surfaces, colour jobs, the primitives with their props |
| `A2-Before-After-Report` (944) | report | full time | The report's top at 412 px, today's real components against DR5 |
| `B1-Hub-Pick` (320, 412, 1440) | `/midweek` | Mon 12:00 | Not picked: the brass Now block, four tiles |
| `B2-Hub-Saved` (320, 412) | `/midweek` | Mon 12:00 | Saved: a plain block, the five as mini cards |
| `B3-Hub-Draw` (320, 412) | `/midweek` | 19:57 | The draw: your first match, both possible opponents after a bye |
| `B4-Hub-Between` (320, 412) | `/midweek` | 20:20:10 | Your next match and its pre-match |
| `B5-Hub-YourMatch` (320, 412, 1440) | `/midweek` | 20:33:20 | Your match live |
| `B6-Hub-Out` (320, 412) | `/midweek` | 20:35:10 | Out, a call open |
| `B7-Hub-FinalLive` (320, 412) | `/midweek` | 21:01:40 | The final, for everyone |
| `C1-Pick-Empty` (320, 412, 1440) | `/midweek/pick` | Mon 12:00 | Nothing picked; from `lg` two columns and the card grid |
| `C2-Pick-Editing` (320, 412) | `/midweek/pick` | Mon 12:00 | Three picked, unsaved, the plusses |
| `C3-Pick-Saved` (320, 412) | `/midweek/pick` | Mon 12:00 | Saved |
| `D1-Bracket-Live` (320, 412, 1440) | `/midweek/[week]/bracket` | 20:35:10 | A block per round, latest first; from `lg` the real tree |
| `D2-Night-Out` (320, 412) | `/midweek/[week]/night` | 20:35:10 | Your rounds, your five rated for the last match |
| `D3-Calls-Open` (320, 412) | `/midweek/[week]/calls` | 20:35:10 | Calls, one open with a pick |
| `D4-PreMatch` (320, 412) | `/midweek/[week]/next/3/1` | 20:20:10 | The pre-match, restyled |
| `D5-PreMatch-Call` (320, 412) | `/midweek/[week]/next/4/0` | 20:35:10 | Out: a pre-match with its call block on top |
| `E1-Hub-Champion` (320, 412, 1440) | `/midweek` | 21:08 | After the final: the champion, your result, next week |
| `E2-Week-Past` (320, 412) | `/midweek/[week]` | later | A past week |
| `E3-Night-Complete` (320, 412) | `/midweek/[week]/night` | 21:08 | The night's ratings, your calls, share |
| `E4-Home-Entry` (320, 412) | `/` | three moments | Home's Midweek block |
| `F1-Report-Live-Yours` (320, 412) | report | 20:33:20 | Your match live, Match tab |
| `F2-Report-Live-Teams` (412) | report `?tab=teams` | 20:33:20 | Live, Teams tab |
| `F3-Report-Live-Pens` (320, 412) | report | 20:35:10 | Another match mid shoot-out |
| `F4-Report-FullTime-Match` (320, 412) | report | full time | Facts, moments, the shoot-out |
| `F5-Report-FullTime-Teams` (320, 412) | report `?tab=teams` | full time | The Why with ratings |
| `F6-Report-Desktop` (1440) | report | full time | Both tabs side by side, the moments in two lanes |
| `F7-Report-LongClub` (320) | report | full time | The 80-character club |

## Foundations

### The type scale (DR5-3, from `review.md` B)

S4 adds these six tokens to `globals.css` as they stand in the generator's
`css.mjs`. Every text size outside the card face becomes one of them.

| Role | Utility | Size / line height | Family and weight | Job |
|---|---|---|---|---|
| Title | `text-title sm:text-title-lg` | 32/1.1, 40/1.05 from `sm` | Instrument Serif 400 | The page title and a report's headline only |
| Figure | `text-figure` | 40/1 | Archivo 800, tabular | Scores and the one big number on a tile; never words |
| Heading | `text-heading` | 20/1.3 | Archivo 600 | Section and block headings |
| Body | `text-body` | 16/1.5 | Archivo 400; 600 to name | Everything read |
| Small | `text-small` | 14/1.45 | Archivo 400, ink-dim | Context, meta, times; replaces the kicker |
| Label | `text-label` | 12/1.35 | Archivo 600, sentence case | Tags, chips, column heads; the floor |

- **Weights:** 400, 600, 800 (`font-semibold`, `font-extrabold`). Black (900)
  only on the card face. No tracked capitals and no kicker anywhere.
- **Spacing:** Tailwind 1, 2, 3, 4, 6, 8, 12 (4 to 48 px). 16 inside a block,
  8 to 12 between rows, 24 between blocks on a phone and 32 from `sm`. Page
  gutter 16, 32 from `sm`.
- **Surfaces:** page (the board), block (`Block`: panel, 1 px line, radius 16,
  padding 16), inset (`Inset`: panel-2, radius 12; the review said 10, and 12
  is Tailwind's step). A brass block means "needs you now", at most one per
  screen.
- **Measured** with S1's method (distinct sizes, voices and text colours in the
  main area at 412 px):

  | Page | Sizes | Voices | Text colours |
  |---|---|---|---|
  | Today's report (S1) | 13 | 21 | 13 |
  | DR5 report, Match tab | 6 | 10 | 7 |
  | DR5 report, Teams tab | 5 | 6 | 9 |
  | `/midweek` while your match plays | 6 | 9 | 8 |
  | `/midweek` after the final | 6 | 9 | 5 |
  | `/midweek/pick` editing | 5 | 8 | 6 |

  Every size on every board is one of the six. The "at most five text
  colours" rule does not hold on a match page; the owner amended it (Q2).

### Primitives (`ui.tsx`; S4 moves them into `src/components/ui/`)

| Primitive | Props | Notes |
|---|---|---|
| `PAGE`, `COLUMN` | class strings | The board ground and gutter; the phone column (`max-w-2xl`, `minmax(0,1fr)`), which a page widens only where columns help |
| `PageHeader` | `{ title, sub?, back?, id? }` | One back link (`‹ Midweek`, Small, brass), the Title, a Small line |
| `Block` | `{ title?, id?, aside?, tone: "plain" \| "now", children, className? }` | Heading with an optional Small or tag on the right; `minmax(0,1fr)` columns so long names can't widen it |
| `Inset` | `{ children, className? }` | Only inside a block |
| `SectionNav` | `{ label, tabs: { key, label, href, badge? }[], active }` | 2–4 link segments, Small 600; a badge only on a tab you are not on |
| `LinkTile` | `{ href?, title, state, tone: "plain" \| "live" \| "now" }` | The whole tile links; without `href` a dashed tile that isn't a place yet |
| `LinkRow` | `{ href, title, meta?, end? }` | A row with ›, one link per row |
| `InfoLink` | `{ href, children }` | `How ratings work ›`: the one way to an explanation |
| `Tag` | `{ tone, children }` | Every chip and tag: neutral, you, won, out, auto, warn, live (with the pulse), goal |
| `Figure` | `{ children, className? }` | Scores and money |
| `Button` | `{ href?, kind: "primary" \| "secondary", wide?, children }` | One primary per screen |
| `Stat` | `{ label, value, note?, tone? }` | A Label, a Figure and a Small in an inset |

`SectionNav` replaces `SectionTabs`' segmented variant (same links and
`aria-current`; the `row` variant stays for Admin). `Tag` replaces `Chip` and
`LiveMarker`. `PageHeader` replaces `MidweekPageHead`, `Block` the ad hoc
`PANEL` and `NOW_CARD` strings.

## Decisions (S2, approved by the owner)

**DR5-11. The routes behind the tiles (C2).** Each tile opens a page of its
own (Q1, approved):

- **`/midweek`:** the hub, with Compete's tabs.
- **`/midweek/pick`:** the picker; after the lock, your locked five,
  read-only.
- **`/midweek/[week]`:** a week. Its result, the final in a line, and tiles.
- **`/midweek/[week]/bracket`:** the bracket.
- **`/midweek/[week]/night`:** your rounds, your five's ratings, your calls in
  a line, the share images.
- **`/midweek/[week]/calls`:** the calls.
- **`/midweek/[week]/picks`:** who picked whom.

The report, the pre-match and `/midweek/past` keep their routes. Each page
reads what today's page reads, at the same moments: gating is unchanged.
Sub-pages have a back link and no Compete tabs (one tab row per screen).

**DR5-12. The hub at each moment.** The tiles keep their places all evening
(DR5-1):

| Moment | Title · Small | Now block | Tiles |
|---|---|---|---|
| Picking, not picked | Midweek Madness · `Wed 14 Oct · locks 19:55` | Your five (brass): empty slots, `Locks in 2 days, 7 h`, **Pick your five** | Last week · Bracket (dashed) · Past weeks · How it works |
| Picking, saved | the same | Your five (plain): mini cards, ✓ Saved, Change your five | the same |
| Draw (lock to round 1) | `Wed 7 Oct · the draw is out` | Your first match: `firstMatch`'s line, each five as mini cards | Your night · Bracket · Your five · Past weeks |
| Your match live | `… · quarter-finals are live` | Your match (brass): scoreboard and **Watch it**; no moment (owner) | the same; Bracket in live pink |
| Between rounds, still in | `… · round 2 is live` | Your next match (brass): the pairing, the countdown, **Pre-match** once open | the same |
| Out | `… · you're out` | You're out: where it ended, coins so far, **Make your calls** while one is open | **Calls** · Bracket · Your five · Past weeks |
| The final | `… · the final is live` | The final (brass), as Your match | as before |
| After the final (D4) | **`{Club} are champions`** · `Midweek Madness · Wed 7 Oct` | Your night: the coins (Figure), your finish (Heading), **Pick next week's five** when next week is open | Your night · Bracket · Calls · Past weeks; the final and the champion's five as mini cards below (Q4) |

- **The sticky evening clock** (`MidweekClock`, ADR-113) is retired (Q3). The
  Now block and the Bracket tile carry the moment.
- **No moments on the hub:** the Now block shows a live match's score and
  minute only; its chances are on the match page (owner).
- **From `lg`** the tiles sit beside the Now block, two by two.

**DR5-13. The picker on its own page.** From the top:

1. `Your five`: five slots, each a mini card with name and `Archetype · OVR`,
   or a dashed `Trialist · OVR 30`. `Empty slots play a trialist` sits on
   the right of the heading.
2. The plusses per line: three insets, the verdict and the keeper line from
   `lineVerdict` and `keeperLine`, then `How plusses work ›` (DR5-10).
3. The save bar: status tag, one line, **Save your five**, Load last week's,
   and the privacy sentence with `Privacy ›` (DR5-8). It is sticky on a
   phone while unsaved, as today.
4. `Your cards` with a **Filter** button: the archetype chips move into the
   sheet Market uses (C). Then one row per Player, and from `lg` the card
   grid with the five and the save bar sticky on the left.

**DR5-14. The evening's pages.**

- **Bracket:** a block per round, the latest round first. Rounds more than
  15 minutes from kick-off are left out until then. Each block carries `Live`,
  `Played` or `Kick-off 20:45`.
- **Rows** (`MidweekMatchRow` restyled): two club lines with scores (pens in
  brackets), the state on the right (`64′` or `Pens` tag, the kick-off,
  `Pre-match`), your pairing in brass. One link per row. Once you're out a
  row also carries `Your call: Niels` or `Call open` (`rowCalls`), and a
  settled pairing links to its pre-match.
- **From `lg`** the tree stays `MidweekBracket`'s (DR4-10). S6 moves its type
  onto the scale without changing its structure.
- **Your night:** `Round by round` as link rows, then the ratings block. Until
  the week completes it shows your latest match (`Against Sophie`), after it
  the night's ratings. Then `Your calls` as one row and Share the night.
- **Rating rows (DR5-6):** mini card, name, the card's line in Small, the disc,
  `★ Best`. The per-match chips go.
- **Calls:** one Small line with `How calls work ›` replaces `CALLS_FOOT`.
  Each call is a block with two buttons; an open call you haven't made is
  the brass block. Each call links to its match: `Pre-match ›` while it is
  open, `Watch it ›` in play, `Report ›` once ended (owner).
- **Ways to the calls**, once you're out:
  - the hub's **Make your calls** while one is open, and its Calls tile;
  - each bracket row you can call, which opens its pre-match;
  - the pre-match itself, which carries the call block above both fives
    (DR4-7, `D5-PreMatch-Call`), so reading the fives and calling is one page.
- **The pre-match:** the pairing as the Title, a Small line with the
  kick-off and countdown. Each five is a block with its colour as a 3 px top
  rail. The Power foot goes behind `How Power works ›`.

**DR5-15. The match report (E2, DR5-2 to DR5-5, as E3).**

- **Header:** `‹ Bracket`, the headline (or `Club v Club` live) in plain ink,
  a Small line (`Quarter-final 3 · full time · your match`). The kicker
  `Quarter-final 3 · out at 20:30` goes.
- **Scoreboard:** a block with the two colours as a strip, each club in its
  colour at Body 600 (Heading from `sm`, two lines at most), the score as a
  Figure in ink. Tags under each club: `✓ Through` or `Out`, `You`, `Auto`.
  Live: `Live · 64′` under the score and the pink progress line.
- **Tabs:** `Match · Teams` as links (`?tab=teams`), so each view has its own
  address and the poller keeps the tab. From `lg` both render side by side
  and the tabs hide.
- **Match:**
  - the facts as Body bullets;
  - `How it went` (oldest first) or `How it's going · Newest first` live;
  - rows with a 3 px rail on the moment's side, one tag style;
  - the newest live item slides in, with no outline (owner: it fought the
    team rails); screen readers still hear it first.
- **Lanes:** from 520 px of the list's own width the moments sit in two lanes
  round a minute-and-score spine. That covers the desktop column (about
  595 px); a phone's list is about 380 px. DR4 said 600 px.
- **The shoot-out:** a `Penalties` block. Live: the tally above the feed.
  At full time, after the moments: the tally, the intro, every kick with its
  line, the decider outlined.
- **Teams:**
  - the chances before kick-off, and the key (`Power going in`,
    `Rating, out of 10`) from full time;
  - each side a block with a top rail: rows of Power pill, name, Small meta,
    bar, rating disc;
  - `Show every factor` and `How Power works ›` at the foot.
- **Names** keep their side's colour at the line's own weight (DR5-4).
  `ReportText` gains `plain` for the headline and the live title.

**DR5-16. Home's Midweek block.** One Now-style block linking into Midweek:
brass with a primary button while something is due (not picked; your match
live), plain once nothing is (after the final). Home doesn't poll (Q11), so
no feed. S3 places it on the new Home.

## Copy

Phrasebook lines (headlines, facts, moments, kicks, ratings' lines) are
unchanged (ADR-093). `{…}` is data. **Cut** strings are removed, **moved**
ones go to How it works (#233, S11 in the revised split).

**The hub and tiles:**

- `Midweek Madness`; `{Wed 14 Oct} · locks {19:55}`;
  `{Wed 7 Oct} · {the phase title, lower case}`.
- Now titles:
  - `Your five`, `Your first match`, `Your match`, `The final`;
  - `Your next match`, `You're out`, `Your night`.
- Asides: `Locks {in 2 days, 7 h}`, `✓ Saved`, `{Round 2} · {20:15}`,
  `+{50} · paid after the final`.
- Lines:
  - `Not picked yet, so an auto squad would play.`;
  - `Saved {Mon 12 Oct, 09:41}. Change them until Wed 19:55.`;
  - `Kick-off {in 10 min}.`;
  - `Its pre-match opens when the other match ends.`;
  - `Lost to {Sophie} {1–3} in the {quarter-finals}.`;
  - `Call the winners still to come.`;
  - `Next Wednesday is open: {Wed 14 Oct}, locks {19:55}.`;
  - `{50} for wins, {4} for calls`.
- Buttons: `Pick your five`, `Change your five`, `Watch it`, `Pre-match`,
  `Make your calls`, `Pick next week's five`.
- After the final: `{Club} are champions`, `Midweek Madness · {Wed 7 Oct}`;
  the block `The final` with `{Club}. {finalLine}` and `Report ›`; stat
  labels `You`, `Your finish`.
- Tiles:
  - Last week: `Out in the {quarter-finals} · +{50}`;
  - Bracket:
    - `Drawn at 19:55`;
    - `{Round 1} at {20:00}`;
    - `{Quarter-finals} · {4} live`;
    - `Won by {Club}`;
  - Past weeks: `Every week's result`;
  - How it works: `Plusses, Power, ratings`;
  - Your night:
    - `Starts {20:00}`;
    - `{Quarter-finals} now · win +{50}`;
    - `Through · +{50} so far`;
    - `+{50} · your ratings`;
  - Your five: `Locked at 19:55`;
  - Calls: `{1} open`, `{2} right so far`, `{2} of {2} right`,
    `Nothing open`;
  - Who picked whom: `Owners and picks`.
- **Cut:**
  - `Five of your cards, one knockout…` (lede);
  - `Everyone watches it live. Chance by chance, on this page.`;
  - `The champion is named and coins are paid when the final ends…` (the
    aside says it);
  - `Form, pick boost and the chances before kick-off appear…`;
  - `{N} FLUT Coins paid across the club.`;
  - the last-week strip's kicker.

**The picker:**

- `Pick your five`, `‹ Midweek`, `Your five`, `Empty slots play a trialist`,
  `Trialist`, `OVR 30`, `Remove`, `Your cards`, `Filter`, `Add`, `✓ In`,
  `✓ In your five`.
- **Shortened:** `Add a Goalkeeper to see your count.` (`NO_KEEPER_COUNT`).
- **Kept:** `lineVerdict`, `keeperLine`.
- The save bar:
  - tags `✓ Saved`, `Not saved`, `Not picked`;
  - lines `Save to make it count.`, `Not picked: an auto squad plays.`;
  - buttons `Save your five`, `Load last week's` (shortened), `Change your
    five`;
  - `Members see the five you enter from 19:55. Privacy ›` (DR5-8).
- **Moved:** `LINE_RULE` (`How plusses work ›`).
- **Cut:**
  - `One slot per Player. Where you own two copies…` (the ×2 says it);
  - `Trialists are handicapped…`;
  - `Plays here if you leave it empty…`.

**Your night, calls, bracket, pre-match:**

- Your night:
  - `Your night`, `Round by round`, `Bye`;
  - `Beat {Eline} {2–0}`, `Lost to {Sophie} {1–3}`, `Playing {Sophie} now`,
    `Next: {Sophie}`;
  - `+{50} paid`;
  - `Against {Sophie}` with `{Quarter-final} · out of 10`;
  - `Your five's ratings` with `Mean of {2} matches`;
  - `★ Best`, `How ratings work ›`;
  - `Your calls` with `weeklyCallsLine`;
  - `Share the night` (its buttons as today).
- **Cut:**
  - `RATING_RULE` (pre-decided);
  - `SHARE_NOTE` (pre-decided);
  - `Images for the club's group chat`;
  - `Out of 10, for this match only. Your five's night ratings…`.
- Calls:
  - `Calls`;
  - `{Wed 7 Oct} · +{2} FLUT Coins a correct call, paid after the final`;
  - `Call the winners still to come. Everyone sees the split from kick-off.
    How calls work ›` replaces `CALLS_FOOT` (moved);
  - `settledStatus` kept;
  - `{6} picked`, `✓ Right`, `Wrong`;
  - `Pre-match ›`, `Watch it ›`, `Report ›`;
  - on bracket rows: `Your call: {Niels}`, `Call open`.
- Bracket: `Bracket`, `Live`, `Played`, `Kick-off {20:45}`, `Bye`, `Pens`,
  `Pre-match`.
- Pre-match:
  - `{Club} v {Club}`;
  - `{Quarter-final 2} · kick-off {20:30}, {in 10 min}`;
  - `Both fives as locked at 19:55.` (shortened);
  - `{Sophie}'s five`, `How Power works ›`, `Updated {20:20:10}`.
- **Moved:** the pre-match's Power foot.

**The report:**

- `‹ Bracket` (was `← {Wed 7 Oct} bracket`), the Small line
  `{Quarter-final 3} · full time · your match` or `· live`, `Match`, `Teams`.
- Scoreboard: `✓ Through`, `Out`, `You`, `Auto` (was `Auto squad`),
  `full time`, `{4–3} on pens`, `Live · {64}′`, `Live · pens {2–2}`.
- Match:
  - `How it went`; `How it's going` with `Newest first`;
  - `Penalties` with `{10} kicks` or `{6} kicks so far`;
  - `Penalties · {2–2} at 90′`, `Kick-off {20:30}`;
  - tags `Goal`, `Save`, `Block`, `Woodwork`, `Wide`, `Goal {2–1}`, `Miss`,
    `Decider`, now in sentence case.
- Teams:
  - `Teams` (from `lg`), `Chances before kick-off`;
  - `Power going in`, `Rating, out of 10` (shortened from the key's two
    sentences);
  - `{43}% before kick-off · auto squad · no keeper · {Defence} {1} short`;
  - `Show every factor` / `Hide the factors`, `How Power works ›`.
- Foot: `Updated {20:35:10} · checks every {5} seconds`.
- **Cut:**
  - the kicker;
  - `· one every 5 seconds`.
- **Moved:** the Why's 60-word foot.

**Home:**

- Not picked: `Pick your five`, `Locks {in …}`,
  `Midweek Madness, {Wed 14 Oct}. Not picked yet, so an auto squad would
  play.`
- Your match live: `Your match`,
  `Quarter-finals live. Watch it chance by chance.`, `Watch it`.
- After the final: `{Club} are champions`,
  `You went out in the quarter-finals: +{50} paid.`, `Midweek`.

## Components

- **New (S4):** the primitives above.
- **New (S5 and S6, Midweek):**
  - the hub's Now blocks (`NowFive`, `NowDraw`, `NowMatch`, `NowNext`,
    `NowOut`, `NowResult`) and `HubTiles`;
  - `ChampionBlock`, `MiniFive`;
  - the pages behind the tiles (DR5-11).
- **Revised (S5 and S6):**
  - `MidweekMatchRow`, `MidweekPath` (as link rows), `MidweekRatingList`
    (DR5-6);
  - `MidweekPredictions` (call blocks), `MidweekPreMatchFive`;
  - the picker (split into slots, plusses, save bar, list), `LastWeek`;
  - `MidweekEntryCard` and `MidweekLiveCard` (Home).
- **Revised (S7, the report):**
  - `MidweekScoreboard` (`MatchScoreboard`);
  - `MidweekMomentRow`, `MidweekKickRow` (one `LaneRow`, rails, 520 px
    lanes);
  - `MidweekLiveFeed`, `MidweekLaneTimeline`;
  - `MidweekShootout` and `MidweekShootoutTally` (one `Penalties` block);
  - `MidweekWhyList` (the Teams panel), `PlayerName`/`ReportText`
    (weight, `plain`).
- **Retired:**
  - `MidweekPageHead`'s kicker, `MidweekSectionHead`'s serif;
  - `Chip` and `LiveMarker` (into `Tag`);
  - `MidweekClock` (Q3);
  - the latest moment on the hub's live block;
  - the newest item's brass outline on the live feed (the slide stays);
  - the Week-Complete champion banner and its `Stat` strip (Q4);
  - `MidweekJumpLinks`.

## Owner decisions (DR5, round 2)

The owner's answers of 12 Oct 2026:

- **Q1:** as recommended. The tiles open sub-pages under `/midweek/[week]/`
  (DR5-11).
- **Q2:** as recommended. Text is ink, ink-dim, ink-faint and brass, plus only
  the colours with a job on that screen: sides, live, a good or bad number,
  Power bands.
- **Q3:** as recommended. `MidweekClock` is retired. Also, the hub's live
  block shows no moment, only the score, the minute and Watch it.
- **Q4:** as recommended. After the final the hub's title names the champion,
  and their five are mini cards.
- **Calls lead to their pre-match.** Each call block links to its match
  (`Pre-match ›`, `Watch it ›`, `Report ›`). Bracket rows show your call
  and link to the pre-match, which carries the call (DR5-14).
- **No newest outline.** The live feed's newest item loses its brass outline
  (amends DR4-1 and DR5-5); it still slides in.

## Round 3: the rest of the app (S3, approved)

**Status: answered by the owner, 12 Oct 2026** (DR5-17 to DR5-26; Q5 to Q8
as recommended; see "Owner decisions (round 3)"). Pages G to M of the canvas,
43 artboards from 23 boards. They use the round 2 system unchanged, plus a
few primitives.

### The data

The same invented world as the Midweek boards (`app-world.mjs` beside
`world.mjs`), stored as the member views' rows: `player_directory`,
`my_collection_cards`, `active_market_listings`, `my_trade_offers`,
`club_value_leaderboard`, `activity_feed`, `user_notifications`,
`chronicle_weeks`.

- **"You" are Sanne again,** on Mon 12 Oct 12:00: 9 cards, 8 of 30 Players,
  two of them listed, one offer in, one sent.
- **Derived by the app's own functions:**
  - card stats from `ARCHETYPE_OFFSETS`, tiers from `getRarityTier`, discard
    values from `calculateLiveDiscardValue`;
  - album slots from `buildSlots`, `applyLens` and `paginate`;
  - pack chips from `packSummary`, ownership chips from `countOwnedCopies`
    and `ownershipDisplayData`;
  - Home's feed from `foldActivity` and `describeFoldedActivity`;
  - messages from `groupMessages`, `messageTarget` and `presentNotification`;
  - the Chronicle's lines from `issueStandfirst`, `formatChronicleDate` and
    `formatReportedCount`;
  - the lock countdown from `countdownText`.
- **Invented inputs:**
  - coin balances, listing prices and expiries, the offers;
  - the risers' deltas, the activity and message rows;
  - the Chronicle's sessions.
- **Checked:** no board scrolls sideways, and only the 80-character club
  name is cut off by an ellipsis (as DR4-9 intends). The screenshot review
  fixed eleven defects:
  - the completion bar drew at 100 px (SVG aspect ratio);
  - page 1 offered `‹ Page 1`;
  - a listing's price tag sat on the shirt name and said the price twice;
  - the ownership note truncated at 320 px;
  - Compete's `Pick` badge squeezed "Midweek" to "M…" at 320 px;
  - every standings row truncated its counts;
  - Settings said "Club name" twice;
  - Packs said 250 three times;
  - Home's Now block ran the full desktop width;
  - section tabs ran the full desktop width;
  - on Home at 320 px, `1,389` and `Open a pack` were cut off in two-up
    tiles (found after publishing; the tiles now stack below 360 px).
- **Measured** at 412 px (S1's method, main area): every page uses 3 to 6 of
  the six sizes, 4 to 9 voices and 4 to 6 text colours. S1 measured 7 to 16
  sizes per page today.

### Boards and routes

| Board | Route | Shows |
|---|---|---|
| `G1-Home-Due` (320, 412, 1440) | `/` | Mon 12 Oct: Pick your five is due, a session report too |
| `G2-Home-Quiet` (412) | `/` | Thu 8 Oct: nothing due, Open a pack is the primary |
| `H1-Collection-Album` (320, 412, 1440) | `/club/collection` | The album, page 1; a spread from `lg` |
| `H2-Collection-Filter` (412) | `/club/collection` | The Filter sheet, open on Gaps |
| `H3-Collection-Manage` (412) | `?view=manage` | The grid with the toolbar |
| `H4-Collection-Trading` (320, 412) | `/club/collection/wanted` | Wanted and your copies |
| `H5-Card-Detail` (412) | `/club/collection/[card]` | A card's page: why, list, discard |
| `I1-Packs` (320, 412, 1440) | `/club/packs` | The pack and the tier ladder |
| `I2-Pack-Confirm` (412) | `/club/packs` | The confirm sheet |
| `I3-Reveal-Summary` (320, 412) | `/club/packs/[opening]` | After the reveal |
| `J1-Market-Buy` (320, 412, 1440) | `/market` | Buy |
| `J2-Market-Listing` (412, 1440) | `/market/[listing]` | A listing with the offer form |
| `J3-Market-Selling` (320, 412) | `/market/selling` | Your listings (#237) |
| `J4-Market-Offers` (320, 412) | `/market/offers` | Offers in and sent |
| `K1-Standings` (320, 412) | `/leaderboard` | The standings |
| `K2-Players` (412, 1440) | `/players` | The directory |
| `L1-Chronicle` (320, 412) | `/chronicle` | The issues |
| `L2-Chronicle-Week` (412) | `/chronicle/[week]` | One issue |
| `L3-Messages` (320, 412) | `/messages` | The inbox |
| `M1-Settings` (320, 412) | `/settings` | Settings |
| `M2-How-It-Works` (412) | `/how-it-works` | Topic tiles and one topic (#233) |
| `M3-Login` (320, 412) | `/login` | Sign in |
| `M4-Welcome` (320, 412) | `/welcome` | The sealed starter pack |

### Primitives added (`app.tsx`; S4 moves them into `src/components/ui/`)

| Primitive | Props | Notes |
|---|---|---|
| `FigureTile` | `{ href, label, value, note? }` | A place whose state is one number: a Small label with ›, a Figure |
| `Toolbar` | `{ placeholder, value?, on?, summary? }` | Search and one Filter button (with the count of filters on), a Small result line |
| `FilterSheet` | groups of `{ label, options, on }`, a result | `FilterBar`'s `BottomSheet`, restyled: a row of choice chips per field, Clear, one primary naming the result |
| `Field` | `{ label, value?, placeholder?, help?, type? }` | The label in Small 600, the input, a Small help line |
| `Switch` | `{ on, label }` | `role="switch"`; its state is also a Tag beside it |
| `CardGrid` | `{ children, wide?: 4 \| 5 }` | Cards two across on a phone (about 140 px at 320, the face's floor), 3 from `sm`, 4 or 5 from `lg` |

- **`SectionNav`** gains `lg:max-w-md`: tabs never stretch across a desktop.
- **A section tab's badge** is a word when it fits (`Offers 1`), else a
  brass dot with the word for screen readers (Compete's `Pick` on Standings
  and Players). The primary tab bar keeps its word badges.
- **The app chrome** (`AppNav`) moves onto the scale in S4. The tab bar's
  labels are 10 to 11 px today, under the Label floor. S4 measures 12 px
  labels at 320 px ("Collection" is the longest) and flags it if they don't
  fit.

### Decisions (approved by the owner)

**DR5-17. Home.**

- **Header:** the Title and a Small date. The kicker
  `Terrible Football Haarlem` goes.
- **The Now block:** the soonest thing due (`orderNowCards`), with the hub's
  rules (DR5-16): brass and a primary button.
- **Tiles under it:**
  - Club Value and Rank as `FigureTile`s;
  - Open a pack as a tile while something is due, the one primary when
    nothing is (DR5-7);
  - anything else due (the session report, the rehab check-in) as a tile
    with its state in brass.
- **From 360 px** the tiles sit two across; below it they stack, because a
  Figure such as `1,389` doesn't fit half a 320 px column. **From `lg`** they
  sit beside the Now block.
- **Top risers:** rows with a mini card and a `▲ +4` tag on a phone, the five
  cards from `lg` (Q8).
- **The Chronicle** is a tile of its own between Top risers and Club
  activity (owner): its icon, `This week's Chronicle`, and the latest
  issue's week and standfirst as its state. It is Home's way in; the
  session messages (`Session report ready`, `Attendance reward`) also lead
  to an issue, and the Home tab stays lit on `/chronicle`. `LinkTile` gains
  an optional `icon`.
- **Club activity:** plain rows.
- **Cut:** the risers' lede and `New here? How FLUT works →` (the account
  menu has it).
- Amends ADR-114 (Home's layout).

**DR5-18. Collection.**

- **Header:** the Title, then one Small line, `8 of 30 Players · 9 cards ·
  Club Value 1,389 ›`, and the completion bar. Then Album · Manage · Trading.
- **The album:**
  - the lens chips and the two menus go into the Filter sheet (C): Show (All,
    Gaps, Specialists), Type, Tier;
  - a Small line says which lens and which page;
  - a page is a block with a Heading and `2 of 9`;
  - gaps are dashed with the Player's name; `×2` and `Listed` are Tags;
  - page buttons below; from `lg` a spread of two pages, and the buttons step
    by spread;
  - the first slot moves up from about 660 px to about 330 px on a phone.
- **Manage:** the toolbar; `Listed · 60` as a Tag on the card.
- **Trading:**
  - the page keeps the Collection title with its tab (it was "Trading
    preferences");
  - Wanted is a block of rows, each saying where to get the card, with
    `Add a wanted card` opening the sheet. The two long `details` lists go;
  - Your copies is a block of rows with one button each; a listed copy says
    why it can't be available.
- **The card page:** back link, the name as the Title, then three blocks:
  - Why this rating (insets);
  - List on the market (a `Field`);
  - Discard.

  #295 (its sideways scroll) is fixed on its own.
- **The archetype nudge** stays, as one link row under the tabs, only for an
  All-rounder.

**DR5-19. Packs.**

- **The page:** no kicker, no lede (the coin pill has the balance).
- **The pack** keeps its art as a brass block:
  - a Heading;
  - `3 Live Cards. Duplicates can happen.`;
  - `Open for 250 coins`;
  - `Leaves you 990.`
- **The ladder:** rows, with `How tiers work ›`.
- **The confirm sheet:** a Heading, one line, Not now and Pay.
- **The reveal summary:**
  - the Title `Your new Live Cards`;
  - `TFH Pack · 2 new Players. Album 8 / 30.` in Small;
  - each chip as a Tag under its card.

  The reveal itself (tap to flip) keeps its show, with its labels moved onto
  the scale.

**DR5-20. Market** (DR5-9, #237).

- **Tabs:** Buy · Selling · Offers.
- **Buy:**
  - no kicker or lede; the toolbar;
  - no price tag on the card: `Buy for 280` (secondary) carries the price;
  - the seller in Small, the ownership chip on the card as today (KB-026).
- **A listing:**
  - back link, the name as the Title;
  - a Buy now block: the price as a Figure, discard value and seller in
    Small, the button pinned above the tab bar on a phone as today;
  - an Or make an offer block, whose escrow line stays.
- **Selling** (new, `/market/selling`):
  - your active listings as rows: mini card, name, `43 h left · 1 offer`, the
    price;
  - each row opens its listing;
  - listing still starts from the card.

  No new data: `my_collection_cards` has `active_listing_price` and
  `active_listing_expires_at`, and `my_trade_offers` has `listing_id`.
- **Offers:**
  - `On your listings`, then `You sent`;
  - an open offer on your listing is the screen's brass block, with Accept
    as its primary;
  - a sent offer has Withdraw; an answered one shows its tag.

**DR5-21. Standings and Players.**

- **Standings:**
  - Compete's tabs, the Title, and one Small line,
    `By Club Value: coins plus what your cards are worth.`;
  - the lede moves behind `See the maths ›`;
  - one table in a block, Label heads;
  - rank in ink: the top three lose their brass, which means action;
  - your row tinted, with a `You` tag;
  - on a phone the club alone under the name; cards and Players are columns
    from `sm` (Q6).
- **Players:** the tabs, the Title with the count, the toolbar, the grid.
  The lede is cut.

**DR5-22. The Chronicle.**

- **The index:**
  - the masthead (4 px brass rules, tracked capitals) becomes the Title and
    `One issue per football week · 5 issues`;
  - the latest issue is a block with its standfirst and `Read the issue`;
  - earlier issues are link rows.
- **An issue:**
  - the week as the Title, the dates in Small, the standfirst in Body;
  - a block per session: the weekday as Heading, attendance and G+A on the
    right, reports and bibs in Small, rows of name and count with kudos in
    Small;
  - Crossings as rows with tier Tags; its explanation is cut.

**DR5-23. Messages.**

- **A row:** the title (Body, 600 while unread) and the body in Small, with
  the time and a `New` tag on the right. Four voices per row become two.
- **Gone:** the tracked kicker and the inline `Bracket →`; the row is the
  link (C).
- **Kept:** the day groups from `groupMessages`, under a Label head, and
  `Mark all read`.

**DR5-24. Settings.**

- **Header:** `Signed in as Sanne · sanne` in the Small line.
- **Your club:** a block with the club name `Field`.
- **Midweek Madness:**
  - the switch in the block's heading, the state as a Tag;
  - the three privacy lines kept and shortened (ADR-091).
- **Rows:** My card and How FLUT works as link rows; Admin tools as a row
  for admins.
- **Sign out:** secondary.

**DR5-25. How it works becomes the FAQ (#233).**

- **Topic tiles at the top:** Cards and ratings, Packs and discard, Market
  and trading, Club Value, Midweek Madness, What others see.
- **An anchor per topic,** and every `How … works ›` in the app lands on
  one: `#plusses`, `#power`, `#ratings`, `#calls`, `#trading`, `#cards`,
  `#privacy`.
- **The numbered serif sections** become blocks with a Heading and Body.
- **Built in steps (owner, from Codex's review):** S4 lays the skeleton,
  the tiles and an anchor per topic on today's sections. Each build session
  then moves the explanations it cuts from its screens into their anchor in
  the same PR, so every `How … works ›` link lands on its text from the day
  it ships. S11 rewrites what is left and closes #233.

**DR5-26. Sign-in and welcome.**

- **The crest lockup** stays as the brand mark, with its own type (Q5).
- **Login:**
  - `Sign in` as the Title;
  - `FLUT is for invited members.`;
  - the fields as `Field`s, the email hint shortened;
  - one primary.
- **Welcome:**
  - the lockup centred, the Title;
  - the sealed pack with a Label instead of tracked capitals;
  - one Body line, one primary.

### Pages without mocks (foundations only)

These take the scale, the primitives and the copy audit's verdicts in their
build session, with no artboard:

- the player profile;
- Club Value;
- My card;
- the session report;
- the invite page;
- Admin.

Their copy rows are in S1's table (the review canvas, `D-Copy-Audit`); its
Card page rows apply to the card page (DR5-18).

### Copy (round 3)

Phrasebook lines, the server's message wording and empty states are
unchanged. **Cut** strings go; **moved** ones go to How it works (DR5-25).

- **Home:**
  - `This week in FLUT`, `Mon 12 Oct`;
  - tiles `Club Value ›`, `Rank ›`, `Open a pack` with
    `{250} coins · {3} cards`, `Your report` with `+50 · closes {Thu}`;
  - `Top risers`, `Players ›`, `{Playmaker} · OVR {66}`, `▲ +{4}`;
  - `Club activity`, `This week's Chronicle` with `Week of {5 October}`.
  - **Cut:** the kicker, the risers' lede, `New here? How FLUT works →`.
- **Collection:**
  - `{8} of {30} Players · {9} cards · Club Value {1,389} ›`;
  - `{All Players} · page {1} of {4}`, `Filter`, `Page {1}`, `{2} of {9}`;
  - `‹ Page {n}`, `Page {n} ›`, `Pages {3}–{4} ›`, `Show all pages ›`;
  - the sheet: `Filter`, `Clear`, `Show`, `Type`, `Tier`, `Sort`,
    `Show {22} Players`;
  - Manage: `Search your cards`, `Listed · {60}`;
  - Trading:
    - `Wanted`, `{2} of 100`, `Wanted cards stay private.` (shortened);
    - `Not in your collection · listed from {60} ›`, `{Lieke} has one`;
    - `Add a wanted card`, `How trading works ›`;
    - `Your copies`, `{1} of 30`, `Make available`, `Make private`;
    - `Listed cards can’t also be available.`
  - The card page:
    - `Why this rating`, `How ratings move ›`;
    - `List on the market`, `25 to 240 coins. The card is locked while
      listed.` (shortened);
    - `Discard`, `This can’t be undone.` (shortened), `Discard for {22}`.
  - **Cut:** `My club` (kicker), `TFH players collected`, `Lens`, the
    trading intro's second sentence (moved), `Market listings and members
    with matching available copies appear here.`, the card page's two rating
    sentences (D).
- **Packs:**
  - `{3} Live Cards. Duplicates can happen.` (shortened);
  - `Open for {250} coins`, `Leaves you {990}.`;
  - `The tier ladder`, `How tiers work ›`;
  - the sheet: `Open a {TFH Pack}?`, `{250} coins for {3} Live Cards. You
    keep {990}.`, `Not now`, `Pay {250}`;
  - the summary: `Your new Live Cards`, `View your Collection`, `Open
    another`.
  - **Cut:** `Pack store` (kicker), the page lede, the ladder's foot
    (moved), `Pack opening saved — the result was fixed before this
    reveal.`
- **Market:**
  - `Buy`, `Selling`, `Offers`, `Search Players`, `{9} listings · newest
    first`;
  - `Sold by {Joris}`, `Buy for {280}`, `Your listing`;
  - a listing: `Buy now`, `Discard value {117} · sold by {Joris}`, `Buy for
    {280} coins`, `Or make an offer`, `Coins`, `Add cards`, `Coins and
    cards are held until the seller answers, or for {12} h.` (shortened),
    `Send offer`;
  - Selling: `Your listings`, `{2} active`, `{43} h left · {1} offer`,
    `List a card from its page in your Collection.`;
  - Offers: `On your listings`, `You sent`, `{Bas V.} · {60} asked`, `From
    {Joris} · {9} h left`, `{35} coins + {Umut C. (30)}`, `Open`,
    `Declined`, `Accept`, `Decline`, `Withdraw`.
  - **Cut:** `Transfer market` (kicker), both ledes (the 5% moves to where a
    seller sets a price), `What this card pays out if you discard it.`
- **Standings and Players:**
  - `Standings`, `By Club Value: coins plus what your cards are worth.`,
    `Member and club`, `Value`, `Cards`, `Players`, `You`, `See the maths ›`;
  - `Players`, `{30} Players`, `Highest OVR first`.
  - **Moved:** the standings lede. **Cut:** the players lede and both
    kickers.
- **Chronicle:**
  - `FLUT Chronicle`, `One issue per football week · {5} issues`, `Read the
    issue`, `Earlier issues`, `‹ All issues`;
  - `{Monday 5 October}`, `{16} in · {21} G+A`, `{14} of {16} reports ·
    bibs by {Hidde P.}`, `Crossings`.
  - **Cut:** `Latest issue`, `Matchday {1} · {Session}`, `This week’s
    promotions`, the Crossings sentence.
- **Messages:** `Messages`, `{3} new`, `Mark all read`, `New`. **Cut:**
  `FLUT inbox`, `opening one marks it read`, `Nothing new. Each message
  opens what it is about.`, each row's kicker and its `{Bracket} →`.
- **Settings:**
  - `Signed in as {Sanne} · {sanne}`, `Your club`, `Club name`, `Shown in
    the standings and on Midweek. Leave it blank for {Sanne's Club}.`, `Save
    club name`;
  - `Midweek Madness`, `Taking part`, the three privacy lines as on the
    board;
  - `My card` with `Photo and archetype`, `How FLUT works`, `Sign out`.
  - **Cut:** `Account` (kicker), `A knockout for five of your cards, every
    Wednesday.`
- **How it works:** `How FLUT works`, `Attendance drives every card. Here is
  how the rest follows.`, the six tile titles and states on the board, `Back
  to the topics ↑`.
- **Login and Welcome:**
  - `Sign in`, `FLUT is for invited members.` (shortened), `Username`, `Or
    the email address you joined with.` (shortened), `Password`;
  - `Your starter pack is waiting`, `Sealed starter pack`, `250 FLUT Coins
    and three Live Cards are already yours.` (shortened), `Open your starter
    pack`.

### Owner decisions (round 3)

The owner's answers of 12 Oct 2026, all as recommended:

- **Q5. The lockup keeps its own type.** The crest lockup's tracked
  `FOOTBALL LEAGUE ULTIMATE TEAM` is the brand mark and is exempt from "no
  tracked capitals", like the card face (`design/flut`, ADR-137).
- **Q6. Standings on a phone show the club alone.** The counts are columns
  from `sm`. This amends the archived spec (§39, KB-005: both counts at
  every width).
- **Q7. Filters live in the sheet at every width.** One toolbar (search,
  Filter) everywhere; the desktop loses its inline tier chips and sort
  select.
- **Q8. Top risers are rows on a phone,** with a mini card and the rise; the
  five cards from `lg`.
- **The Chronicle is a tile of its own on Home,** distinct from the activity
  rows (DR5-17).

## Records the build needs

The build sessions as revised in S3 (plan rev. 3, approved by the owner
with five adjustments from a Codex review, all already in this split or
added to it):

- **S4 stays small:** foundations and the shared shell only; each page moves
  onto the scale in its own session, so no page is touched twice.
- **Midweek is two PRs** (S5, S6), each verifying timing and privacy on its
  own routes.
- **The rest of the app is three PRs** by area (S8, S9, S10).
- **Explanations move with their screens:** a session that cuts an
  explanation moves it into its How it works anchor in the same PR, so a
  `How … works ›` link always lands on its text (DR5-25). S11 catches
  leftovers.
- **The generator is in the repo** (`design/ui-pass/build/`), not only on
  the private canvas or in scratch space.

Each session adds its ADR (from ADR-153, in order), updates
`docs/PRODUCT.md` where what a member sees changes, and records any changed
rule in `docs/decisions.md`, in the same PR:

- **S4 Foundations:**
  - the scale, the primitives of both rounds, `SectionNav` in place of
    `SectionTabs`' segmented variant, the app chrome on the scale;
  - a ratchet check on arbitrary text sizes outside the card face: a count
    that may only fall, which S11 sets to zero;
  - How it works' skeleton: topic tiles and an anchor per topic on today's
    sections (DR5-25).
  - Amends ADR-043 (type roles, the kicker), DR1-5 (DR5-4) and
    `SectionTabs`.
- **S5 Midweek I:**
  - the hub, the routes (DR5-11), the picker at `/midweek/pick` and Home's
    Midweek block (DR5-16);
  - amends ADR-107 (`/midweek` lands on the hub), ADR-113 (the clock,
    retired), ADR-091 (the privacy line) and DR3 (the plusses rule).
- **S6 Midweek II:**
  - the bracket, your night, calls, the pre-match and a past week (DR5-14);
  - amends ADR-118 and DR3-6 (calls on their page), ADR-117 and DR3
    (rating rows).
- **S7 The report:**
  - amends ADR-111 and ADR-115/147 (its layout), DR4-1 (the 520 px lanes,
    no newest outline) and DR2's Why foot;
  - closes #279.
- **S8 Home, Collection and Packs:** DR5-17 to DR5-19. Amends ADR-114
  (Home).
- **S9 Market:** DR5-20 with the Selling tab. Amends ADR-053 and ADR-051;
  closes #237.
- **S10 The rest:**
  - Standings, Players, the Chronicle, Messages, Settings, Login and
    Welcome (DR5-21 to DR5-24, DR5-26);
  - the pages without mocks, and Admin on the foundations.
- **S11 Close-out:**
  - How it works rewritten as the FAQ (DR5-25, closes #233) and a sweep for
    leftover copy;
  - the ratchet to zero, `PRODUCT.md` checked whole.

No migration. Gating is unchanged: every page reads what today's pages read,
at the same moments.

### S10 implementation (ADR-160)

DR5-21–24/26 and the pages without mocks use the foundations. Report windows,
provisional Chronicle aggregates and the opt-out confirmation remain. Crossings
stack name and tier tags below 360 px to keep long names readable. Players uses
`Show Players`, with no numeric preview of unapplied filters. The shared crest
keeps Q5's own type; the sealed starter pack uses the approved 4:3 surface.
Admin keeps its existing workflows and warnings, with the type scale and 44 px
controls. S11 owns the FAQ rewrite and the final type/copy sweep.
