# MM 3.0 design round 4 (DR4): follow every match live

For every agent building Midweek Madness 3.0 sessions S3 to S7 (plan
`~/.claude/plans/midweek-madness-3.md`, tracking issue #267). Read this in
full, then the artboards your session names. It sits on top of
`design/mm2-dr3/HANDOFF.md` (DR3) and `design/ux-review/HANDOFF.md` (DR2),
which still hold for everything this note doesn't change. Where this note
and an artboard disagree, this note wins; where either disagrees with an ADR,
the ADR wins until a new ADR changes it.

**Status: awaiting the owner's approval** (S1 pause point, 2026-10-11).
Nothing here is built. The owner's decisions go under "Owner decisions" at
the end.

## The canvas

- **Private Claude Design canvas** "Midweek Madness 3.0 (DR4)",
  <https://claude.ai/artifact/LsMTcZJQCRBD3pXiYrem5W>, which only the owner
  can open. A build agent reads an artboard with the Artifact tool's `read`
  action (`path: project/<file>`).
- **37 artboards on seven pages, A to G.** Most boards are drawn at 320 and
  412 px, some also at 1440 px (`lg`). The file name says which:
  `A1-Match-Yours-64-412.dc.html`. A blue sticky beside each row says what it
  shows and why.
- **Generated, not hand-drawn.** A scratch generator (restored from
  `design/midweek/build/` at the tag `docs-archive-2026-10`, not kept) did
  three things:
  - rendered the real components from `src/`, with `next/link` and
    `next/navigation` stubbed;
  - compiled the app's own `globals.css` with Tailwind;
  - measured every artboard in Chromium and failed if any scrolled sideways.
  The revised and new components were written as TSX in the app's idiom, so
  their class lists in the artboards can be lifted as they are.
- **Blue-grey dashed boxes** (B1, F1, E3) are design notes, not app copy.
- **One theme (DR4-13).** FLUT has no light theme, so "both themes" can't
  apply. C2 shows the shoot-out in greyscale instead, as a check that colour
  never carries meaning alone.

### The data

The sample is today's engine and renderer on the invented world of
`tests/sim/midweek-sample.ts` (22 entrants, 5 rounds), with invented club
names. Nothing is a real member, club or Player. Times are Wed 7 Oct,
Amsterdam: the lock is at 19:55, and the rounds kick off at 20:00, 20:15,
20:30, 20:45 and 21:00.

- **"You" are Sanne**, who never set a club name, so `Sanne's Club`. Sanne
  has a bye, beats Eline 2–0 in round 2, and loses the quarter-final to
  Sophie Saints 1–3.
- **Eline's club is 80 characters**, the most Settings allows: `Sportclub
  Elinewijk Zondagmiddag Veteranen Zeven Tegen Zeven Haarlem-Noord 1923`.
- **Quarter-final 3**, Stijnfeld United v Bartcelona, is 2–2 and goes to 4–3
  on penalties (10 kicks). Joristown Rovers win the final 3–0 against Niels
  Newcastle.
- **Every number is the real function's output:** `liveView` at the board's
  moment, `matchRatings`, `rateNight`, `squadBalance`, `roundPayouts` and
  `predictionCoins`.

## Boards

| File | Moment | Shows |
|---|---|---|
| `A1-Match-Yours-64` (320, 412, 1440) | 20:33:20 | Your match live: the running clock, the feed newest on top, the Why |
| `A2-Match-Other-Pens` (320, 412, 1440) | 20:35:10 | Another member's match, six kicks into its shoot-out: the tally, the kicks and moments in one feed |
| `A3-Match-Final-32` (320, 412) | 21:01:40 | The final live, for everyone |
| `B1-Clock-States` (320, 412) | five moments | Ticking, a chance arriving after its minute, held at 90′, penalties, full time |
| `B2-Evening-YourMatch` (320, 412, 1440) | 20:33:20 | `/midweek`: `Your match` with the clock, `This round` all live (Q5) |
| `C1-Report-Shootout` (320, 412, 1440) | full time | The report: the readable shoot-out (#263), per-match ratings |
| `C2-Report-Shootout-NoColour` (320) | full time | The same in greyscale |
| `D1-PreMatch-Yours` (320, 412, 1440) | 20:20:10 | Your next match before kick-off |
| `D2-PreMatch-Other-Out` (320, 412) | 20:20:10 | Another pairing, seen by Eline (out) with its call card |
| `D3-Evening-BetweenRounds` (320, 412) | 20:20:10 | `/midweek` between rounds: the pre-match links, a pairing still waiting |
| `E1-Report-Rated-FullTime` (320, 412) | 20:21 | Your round-2 report, ratings in the Why mid-evening; the 80-character club on the scoreboard |
| `E2-Evening-Out-Rated` (320, 412, 1440) | 20:35:10 | `Your five against Sophie` under `Your night`, calls |
| `E3-Complete-NightRatings` (320, 412) | 21:08 | The hand-over to DR3's night ratings |
| `F1-Rows-States` (320, 412) | various | Every `MidweekMatchRow` state |
| `F2-Bracket-Live` (320, 412, 1440) | 20:35:10 | The bracket live, the `lg` tree with equal-height pairings (#216) |
| `G1-ClubNames` (1200) | n/a | Club or account name, per place (Q7) |

## Decisions (DR4)

**DR4-1. One live feed, newest on top (S3).** `MidweekLiveFeed`
replaces `MidweekLaneTimeline live` on a live match page. From the top:

- the kicks so far, newest first;
- a divider `Penalties · 2–2 at 90′`;
- the report's moments so far, newest first (Q8);
- `Kick-off 20:30` at the foot.

The newest item has the brass outline and the `mw-chance-in` slide, and
screen readers hear `Latest.` first. Lanes are as today: one lane with a
side rail below 600 px of the feed's own width, two lanes either side of a
minute-and-score spine from 600 px. The heading is `How it's going` with
`Newest first`. The full-time report keeps `How it went`, oldest first (Q4).

**DR4-2. The running clock lives in the scoreboard (S3).**
`MidweekScoreboard`, live:

- **The Live marker** moves to its own row under the score, so long club
  names keep their width.
- **The minute ticks every second** on the client. It knows only the
  kick-off, the schedule version and the server's render time (the offset to
  the device clock). It is held at 90′ until the next poll.
- **A 3 px progress line in Live pink** runs along the bottom edge, from 0′
  to 90′, with a notch at half time (an SVG `width`, because the CSP forbids
  inline styles). It fills during a shoot-out and goes at full time.
- **Held at 90′ it shows nothing new**: no `full time`, no `added time`, no
  `penalties`. The next poll brings either.
- **During a shoot-out** it shows `Live · pens 2–2`, as today.

`role="timer"` sits on the marker's row. The evening's `Your match` uses the
same scoreboard (B2).

**DR4-3. Every match is watched live (S3).** `InPlayMatch` loses its "other
match" branch. Every in-play match gets the live layout:

- **Kickers:** `Quarter-final 2 · your match · live`, `Quarter-final 3 ·
  live`, `The final · live`.
- **Polling:** the match page polls every 10 s, every 5 s once its shoot-out
  has begun.
- **The foot line:** `Updated 20:33:20 · checks every 10 seconds` (`5
  seconds` in a shoot-out).

The evening and the bracket keep 20 s (Q6).

**DR4-4. A kick is readable at a glance (#263, S3).** Each kick is a feed
item in its side's lane:

- `Pen 3`, then the outcome as a tag in the kicking side's colour: filled for
  a goal, with the tally after it (`GOAL 3–2`), or outlined for a miss
  (`MISS`);
- then `{taker} v {keeper}`, both in their side's colour, and for a miss one
  word: `saved`, `off the woodwork` or `wide`;
- no prose before full time.

The keeper comes from the stored penalty event's `keeper` slot. The renderer
already uses it, so `ShootoutKick` gains `keeper` (a field, no text change).

**DR4-5. The full-time shoot-out (S3).** `MidweekShootout` becomes, in order:

1. the tally;
2. the intro line;
3. every kick in order as the feed showed it, each with its own line of
   commentary under it;
4. a coin toss's line last, if there was one.

The decider is outlined in brass with a `Decider` chip. The tally's dots
follow the list: dot 3 is `Pen 3`. A miss's dot is now ringed in the side's
colour instead of grey.

Which line belongs to which kick follows the renderer's own rule
(`renderShootout`): line 0 is the intro; then one line per kick not scored
and one for the decider; a toss adds a last line. Either return a per-kick
line index from the renderer or apply the rule on the page. No phrase
changes.

**DR4-6. Rows (Q5, S4).** In `MidweekMatchRow`:

- **A match in play** shows a score beside each club, `Live`, and the minute
  (`64′`) or `pens`, with a link to watch it. In a shoot-out the kicks scored
  show in brackets, as at full time.
- **An upcoming pairing whose two clubs are both settled** says `Pre-match`
  over its kick-off and links to the pre-match (dense: `20:45` over
  `Pre ›`). One still waiting on a feeder has no link.
- **Club names** stay on one line each, cut with an ellipsis. Each side's
  wrapper needs `min-w-0`, or a long name pushes past the row in the tree.

The row's group label carries the whole sentence:
`Live, 64th minute: Laura Lazio 1, Niels Newcastle 2. Watch it.`

**DR4-7. The pre-match (Q2, S5).**

- **Where.** A new page, `/midweek/[weekStart]/next/[round]/[pairing]`. It
  opens when both feeders have ended (when calls open). At kick-off it polls
  once and becomes the live match page.
- **Its head.** Both clubs in their colours, `v`, `kick-off 20:30` and the
  ticking countdown.
- **Its line.** `Both fives as they were locked at 19:55, with this week's
  Power. The chances before kick-off and each card's day roll come at
  kick-off, when this page turns into the live match.`
- **Each five**, under a heading with the club and `{account}'s five`
  (DR4-11):
  - the plusses per line (`Attack 5 ✓ enough`, `Defence 2 ! 1 short`), and
    `Defence 1 short: the five plays at ×0.88.`;
  - the cards strongest first: this week's Power as the Why's pill and bar,
    without the day roll; the mini card; `archetype · tier · OVR`; and
    `in goal`, `trialist`, `injured`.
- **What it never shows:** the win chance, the day rolls, anything from
  `midweek_matches_public` for this match.
- **A member who is out** sees the evening's call card for this match above
  the fives, the same component and states. DR3-6 becomes: calls are made on
  the evening and on the pre-match; the bracket stays read-only.
- **The ways in:** the `Your night` next row gets `Pre-match →`. Between
  rounds the evening lists the next round as soon as one of its pairings is
  settled (D3), above `This round`.

**DR4-8. Per-match ratings from full time (Q1, S6).**

- **The report:** from the match's full time, not the week's end, the Why
  shows each card's rating for that match (both sides, the key, the foot
  sentence).
- **The evening:** under `Your night`, a new `MidweekMatchRatings`,
  `Your five against {Sophie}`, with `{Quarter-final} · out of 10 for this
  match` and `Report →`. Best first, the 38 px disc, no ★ and no lines. It
  shows the member's latest match from its full time until the next one
  ends.
- **The week's end:** DR3's night ratings take its place, unchanged (E3).

**DR4-9. Long club names (#262, S7).**

- **Scoreboard and pre-match head:** at most two lines (`line-clamp-2`),
  `hyphens-auto`, the whole name in the group's label.
- **Rows, the tree and the shoot-out tally:** one line with an ellipsis.
- **The Why's and the pre-match's side headings:** wrap in full, since they
  have the width.
- **Report text:** wraps, as today.

**DR4-10. Equal-height pairings (#216, S4).** Each tree group becomes a
two-row grid (`grid grid-rows-2`, `grid-rows-1` for a single row) instead of
`flex flex-col` with `flex-1` children. Its two pairings are then always
equally tall, so the bracket line from the group's quarter points meets each
pairing's middle. Confirm with the CI trace first, as #267 says; the tooltip
half of #216 is a test fix.

**DR4-11. Whose club it is.** Only the pre-match's five headings name both
(`Sophie Saints` / `Sophie's five`): it is the one place a member studies an
opponent before deciding a call.

**DR4-12. Trialists keep the account name.** A trialist is a Player, named
after the member who fielded it: `Eline's first trialist`. With club names
it would read `Stijnfeld United's second trialist`, or 95 characters for
Eline. So `ReportSide` carries the club for the team's mentions and the
account for trialist labels (S7). Phrase choice is keyed on the seed hash,
not on names, so no line changes.

**DR4-13. One theme.** See "The canvas".

## Club or account name (Q7, G1)

| Place | Name |
|---|---|
| Bracket and evening rows, the `lg` tree, the shoot-out tally | Club, one line |
| Scoreboard, pre-match head | Club, up to two lines |
| Feed, report text, headline, facts, the Why | Club |
| Results, champion, Home's card, share images | Club |
| Pre-match five headings | Both (DR4-11) |
| Trialists in any text | Account (DR4-12) |
| `Your night`, calls, the split, your calls, the picker, ratings' per-match chips | Account |
| Result message (SQL) | Unchanged |

S7 checks the Chronicle's Midweek lines and the share images against this
table, and adds any place it finds.

## Data, and the real moment each may show

The gating rule in the plan holds for every surface: nothing carries a
result, a later event, a later kick's prose, or anything implying a match's
length before its real moment.

| Surface | Data | Source | From |
|---|---|---|---|
| Clock | Kick-off, schedule version, server render time | Match row (`reveal_at`), tournament, the render | Kick-off; holds at 90′ |
| Feed moments | The report's moments up to now | `loadLiveMatch` + `liveView` (ADR-115) | Each at its own minute |
| Kicks | Side, round, kicker, outcome, keeper, tally | The same, plus the penalty event's `keeper` | Each at its own 5 s |
| Kick commentary | `ShootoutReport.lineParts` | The renderer | Full time only |
| Row score and pens | Goal events by side; penalty events scored | `midweek_events_public` (member read) | Each event's moment |
| Row minute | Kick-off | Match row | Kick-off; `pens` once a penalty event shows |
| Pre-match pairing | Both feeders' winners | `midweek_matches_public` at their full time | Both feeders' end |
| Pre-match fives | Cards, archetype, keeper slot, injury, Power | `midweek_entries_public` (Power from round 1's kick-off) | Both feeders' end |
| Plusses per line | `squadBalance(archetypes, keeperSlot)` | Engine, client-safe | Same |
| Per-match ratings | `matchRatings(input)` | The report input already loaded | The match's full time |
| Club names | `side_*_club`, `club_name` (names set in S2) | The S2 view columns, falling back to the account name | Always |

The authenticated E2E checks the plan asks for, at 320 and 412 px:

- one minute into a match;
- mid shoot-out, where no prose is in the payload and no `ends_at` exists;
- between rounds, on the pre-match, where no win chance and no day roll are
  in the payload;
- one second before a match's end, where no rating is in the payload.

## Components

- **New:**
  - `MidweekLiveFeed`;
  - `MidweekKickRow` (feed and report);
  - `MidweekShootoutTally` (replaces `MidweekShootoutLive`'s rows);
  - the pre-match page with `MidweekPreMatchBoard` and `MidweekPreMatchFive`;
  - `MidweekMatchRatings`;
  - a client clock inside the scoreboard.
- **Revised:**
  - `MidweekScoreboard` (clock row, progress line, clamp);
  - `MidweekShootout` (DR4-5);
  - `InPlayMatch` (one live layout);
  - `MidweekMatchRow` (DR4-6);
  - `MidweekBracket`'s tree (DR4-10);
  - `MidweekPath` (`Pre-match →`);
  - `MidweekWhyList` (ratings from full time);
  - the evening's round sections (D3);
  - `MidweekLivePoller`'s foot copy (10 s / 5 s).
- **Retired:**
  - the `In play · result at full time` scoreboard and row;
  - the `You're not in this match…` paragraph;
  - `MidweekShootoutLive`'s `Last kick` line (the feed carries it).

## Records the build needs

Each build session adds its ADR (ADR-145 onward) and updates
`docs/PRODUCT.md`:

- **S3:** the feed, clock, every match live and the shoot-out; amends
  ADR-115.
- **S4:** rows, the bracket and #216; amends ADR-115.
- **S5:** the pre-match and calls there; amends ADR-118 and DR3-6.
- **S6:** ratings from full time; amends ADR-117.
- **S7:** club names and trialist labels; amends ADR-111 where it names
  managers.

None of these needs a migration beyond S2's.

## Owner decisions (DR4)

_None yet: the owner reviews the canvas and this note (S1 pause point)._
