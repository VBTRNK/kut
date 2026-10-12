# UI pass design round 5 (DR5): the system, Midweek and the match report

For every agent building the UI pass sessions S4 onward (plan
`~/.claude/plans/flut-ui-pass.md`, tracking issue #294). Read this in full,
then the artboards your session names. It sits on top of `review.md` (DR5-1
to DR5-10) and `design/mm3/HANDOFF.md` (DR4), which still hold for everything
this note doesn't change. Where this note and an artboard disagree, this note
wins; where either disagrees with an ADR, the ADR wins until a new ADR
changes it.

**Status: awaiting the owner's review** (S2, 12 Oct 2026). The questions are
at the end. Nothing here is built yet. S3 adds the rest of the app to this
note.

## The canvas

- **Private Claude Design canvas** "FLUT UI pass, mocks (DR5)",
  <https://claude.ai/artifact/UwL1GERjSw4DMSxmY1rDJM>, which only the owner
  can open. A build agent reads an artboard with the Artifact tool's `read`
  action (`path: project/<file>`).
- **54 artboards from 27 boards on six pages, A to F.** Most boards are at
  320 and 412 px, some also at 1440 px. The file name says which:
  `B5-Hub-YourMatch-412.dc.html`. A blue sticky beside each row says what it
  shows and why.
- **Generated, not drawn.** A scratch generator, built on the MM3 one and not
  kept in the repo, does four things:
  - it stores the sample week as the member views' rows;
  - it calls the app's real functions on those rows;
  - it renders the DR5 components (TSX in the app's idiom) with the app's
    compiled `globals.css`, plus the six type tokens below;
  - it measures every artboard in Chromium and fails on any sideways scroll.
- **Its source is on the canvas** under `project/source/`. `ui.tsx.txt`,
  `midweek.tsx.txt`, `report.tsx.txt` and `pages.tsx.txt` are the TSX; lift
  the components from there, not from the artboards' flattened HTML.
  `README.txt` says how to rebuild.
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
  colours" rule does not hold on a match page: see question Q2.

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

## Decisions (S2, proposed)

**DR5-11. The routes behind the tiles (C2).** Each tile opens a page of its
own (question Q1):

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
| Your match live | `… · quarter-finals are live` | Your match (brass): scoreboard, the newest moment, **Watch it** | the same; Bracket in live pink |
| Between rounds, still in | `… · round 2 is live` | Your next match (brass): the pairing, the countdown, **Pre-match** once open | the same |
| Out | `… · you're out` | You're out: where it ended, coins so far, **Make your calls** while one is open | **Calls** · Bracket · Your five · Past weeks |
| The final | `… · the final is live` | The final (brass), as Your match | as before |
| After the final (D4) | **`{Club} are champions`** · `Midweek Madness · Wed 7 Oct` | Your night: the coins (Figure), your finish (Heading), **Pick next week's five** when next week is open | Your night · Bracket · Calls · Past weeks; the final and the champion's five as mini cards below (Q4) |

- **The sticky evening clock** (`MidweekClock`, ADR-113) is not on the hub.
  The Now block and the Bracket tile carry the moment (question Q3).
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
  `Pre-match`), your pairing in brass. One link per row.
- **From `lg`** the tree stays `MidweekBracket`'s (DR4-10). S5 moves its type
  onto the scale without changing its structure.
- **Your night:** `Round by round` as link rows, then the ratings block. Until
  the week completes it shows your latest match (`Against Sophie`), after it
  the night's ratings. Then `Your calls` as one row and Share the night.
- **Rating rows (DR5-6):** mini card, name, the card's line in Small, the disc,
  `★ Best`. The per-match chips go.
- **Calls:** one Small line with `How calls work ›` replaces `CALLS_FOOT`.
  Each call is a block with two buttons; an open call you haven't made is
  the brass block.
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
  - the newest live item outlined in brass.
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
ones go to How it works (#233, S8).

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
  - `{6} picked`, `✓ Right`, `Wrong`.
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
- **New (S5):**
  - the hub's Now blocks (`NowFive`, `NowDraw`, `NowMatch`, `NowNext`,
    `NowOut`, `NowResult`) and `HubTiles`;
  - `ChampionBlock`, `MiniFive`;
  - the pages behind the tiles (DR5-11).
- **Revised (S5):**
  - `MidweekMatchRow`, `MidweekPath` (as link rows), `MidweekRatingList`
    (DR5-6);
  - `MidweekPredictions` (call blocks), `MidweekPreMatchFive`;
  - the picker (split into slots, plusses, save bar, list), `LastWeek`;
  - `MidweekEntryCard` and `MidweekLiveCard` (Home).
- **Revised (S6):**
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
  - `MidweekClock` on the hub (Q3);
  - the Week-Complete champion banner and its `Stat` strip (Q4);
  - `MidweekJumpLinks`.

## Questions for the owner

Each has a recommendation. The owner's answers amend DR5-11 to DR5-16 where they differ.

- **Q1. The routes (DR5-11).**
  - **Recommended:** sub-pages under `/midweek/[week]/`.
  - **The alternative:** one `/midweek/[week]` page with tabs
    (Bracket · Your night · Calls). That needs four tabs on some weeks and
    keeps one long page per tab.
- **Q2. Text colours.** "At most five text colours on a screen" (`review.md`
  B) can't hold on a match page:
  - ink, ink-dim, ink-faint and brass already make four;
  - the two team colours (DR3-10) and Power's four bands (DR2-8) both stay.

  **Recommended:** ink, ink-dim, ink-faint and brass, plus only the colours
  with a job on that screen (sides, live, a good or bad number, Power bands).
- **Q3. The evening clock** (`MidweekClock`, ADR-113).
  - **Recommended:** retire it.
  - **Why:** in C2 the Now block says what is happening to you and the
    Bracket tile says where the evening is (`Quarter-finals · 4 live`). The
    strip would be a second tab-like row on a hub that should fit one screen.
- **Q4. After the final** (presentation of owner decision D4).
  - **Recommended:** the hub's title names the champion
    (`Joristown Rovers are champions`).
  - **Their five:** mini cards in a `The final` block, not five full cards
    under a 54 px serif banner.
  - **Your night:** two figures and next week's button.
  - **Why:** it fits the one-screen hub; the full cards are a tap away on
    the final's report.

## Records the build needs

Each build session adds its ADR (from ADR-153) and updates `docs/PRODUCT.md`:

- **S4:** the scale, the primitives, the one-row tabs. Amends ADR-043 (type
  roles, the kicker), DR1-5 (DR5-4) and `SectionTabs`.
- **S5:**
  - the hub, the routes, the picker's move, the evening's pages and Home's
    block;
  - amends ADR-107 (`/midweek` lands on the hub), ADR-113 (the clock, if
    retired), ADR-114 (Home's block), ADR-091 (the privacy line), ADR-118
    and DR3-6 (calls on their page), ADR-117 and DR3 (rating rows, the
    plusses rule).
- **S6:** the report. Amends ADR-111 and ADR-115/147 (its layout), DR4-1 (the
  520 px lanes) and DR2's Why foot. Closes #279.

No migration. Gating is unchanged: every page reads what today's pages read,
at the same moments.
