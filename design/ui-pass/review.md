# UI pass review (DR5, round 1)

The text version of the S1 review for the FLUT UI pass (issue #294). The
private Claude Design canvas "FLUT UI pass review (DR5)",
<https://claude.ai/artifact/FBoo1Hbs7bPwYQNR2aXpHN>, has the screenshots and
sketches; only the owner can open it.

**Status: awaiting the owner's picks.** The owner picks a Midweek structure
(C) and a match report direction (E), and answers F1 to F9. The answers
become DR5-1 onward. Nothing is built from this note; S2 generates the mocks
from the picks.

## How the review was made

- A scripted walk of a member's week on the local stack, 12 Oct 2026: 25
  pages before the lock, the evening live and the night after the final, at
  320, 412 and 1280 px.
- Each page's type measured at 412 px in its main area:
  - **sizes:** distinct font sizes;
  - **voices:** distinct combinations of family, size, weight, case and
    letter-spacing;
  - **colours:** distinct text colours.
- The data is the authenticated E2E's Midweek fixture. On the canvas, Player
  names are swapped for invented ones and photos are blanked. The owner's
  production screenshots were inputs; they are not on the canvas or here.

## A. The problems, ranked

| #   | Problem                                                                     | Where                                    | Measured at 412 px                                                         |
| --- | --------------------------------------------------------------------------- | ---------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Midweek is one long page that rearranges itself each moment of the evening  | `/midweek`                               | after the final 3,526 px, 16 sizes, 25 voices; before the lock 11 and 19   |
| 2   | The match report says everything in loud voices                             | `/midweek/[week]/match/[id]`             | 13 sizes (8.5 to 46 px), 21 voices, 13 text colours                        |
| 3   | Too many sizes, weights and kickers everywhere                              | every page                               | about 40 sizes in the code (27 arbitrary); pages use 7 to 16 each           |
| 4   | The week's result page stacks ratings, share, bracket, picks and seal       | `/midweek/[week]`                        | 3,928 px, 14 sizes, 24 voices; the bracket is three screens down           |
| 5   | Explanations where a member wants to act                                    | picker, trading, the Why, Packs, Market  | about 60 explanatory sentences (D)                                          |
| 6   | Controls stack up before the content                                        | `/club/collection`                       | first album slot at about 660 px of a 915 px screen                        |
| 7   | Home has two filled primary buttons                                         | `/`                                      | Pick your five and Open a pack, both full width                            |
| 8   | Every message row speaks in four voices                                     | `/messages`                              | 337 words for 15 rows                                                      |
| 9   | Card detail and player profile scroll sideways at 320 px                    | `/club/collection/[card]`, `/players/[slug]` | 30 px; filed as #295, outside this pass                                  |

The finding behind most of them: it is less the amount of content than how
many ways it is said.

## B. Design rules (proposed)

- **Six sizes, each with one role:**

  | Role    | Size              | Font                   | Use                                          |
  | ------- | ----------------- | ---------------------- | -------------------------------------------- |
  | Title   | 32 px, 40 from sm | Instrument Serif 400   | the page title and a report's headline only  |
  | Figure  | 40 px             | Archivo 800, tabular   | scores and the one big number on a tile      |
  | Heading | 20 px             | Archivo 600            | section and block headings                   |
  | Body    | 16 px             | Archivo 400            | everything read; names in it are 600         |
  | Small   | 14 px             | Archivo 400, ink-dim   | context, meta, times; replaces the kicker    |
  | Label   | 12 px             | Archivo 600, sentence case | tags, chips, column heads; the floor     |

- **Two families:** Instrument Serif for the Title, Archivo for everything
  else. Caveat and Permanent Marker stay on the card's injury cast. The share
  images keep the same two, so #215 is not triggered.
- **Three weights:** 400, 600 and 800. Black (900) only on the card face.
- **No kicker.** Context that matters is a Small line under the title.
- **Spacing:** 4, 8, 12, 16, 24, 32, 48. Block padding 16, rows 12 apart,
  blocks 24 apart on a phone and 32 from sm, page gutter 16.
- **Three surfaces:**
  - **page:** the board, no border;
  - **block:** panel, 1 px line, radius 16. A block has a heading or is one
    link (a tile);
  - **inset:** panel-2, radius 10, no border, only inside a block.
  A brass-tinted block means "needs you now", at most one per screen.
- **One primary action per screen:** one filled brass button. Everything
  else is an outline button, a tile or a link.
- **Colour has jobs:**
  - brass: action and now;
  - violet and teal: which side;
  - moss and brick: a good or bad number;
  - live pink: live.

  At most five text colours on a screen.
- **Tab, tile or link:**
  - tabs for views of the same thing, 2–4, one row per screen;
  - a tile for a place with state worth showing;
  - a row with › for a place without state;
  - a text link only in running text or once at the foot of a block.

  Filter chips are filters only, one row, never above tabs.

The canvas shows Home before and after at 412 px.

## C. Navigation

**Midweek.** Three structures, sketched at 412 px before the lock and live:

- **C1, Midweek tabs** (This week · Bracket · Past). Costs two tab rows under
  one header, and This week still changes shape each moment.
- **C2, one Now block and four tiles (recommended).** The hub fits one screen
  at every moment:
  - the Now block changes with the moment: your five before the lock, your
    match live, the champion and your result after the final;
  - four tiles sit in the same place all evening. Before the lock: Last week,
    Bracket, Past weeks, How it works. Live: Your night (Calls once you are
    out), Bracket, Your five, Past weeks;
  - each tile opens its own page. The picker moves to `/midweek/pick`.

  It is the most build of the three, but every piece is simpler than today's
  page. Gating is unchanged: each view reads what today's page reads, at the
  same moments.
- **C3, today's scroll with a sticky jump bar.** The cheapest. The page still
  changes shape, and the bar is a second tab-like row.

**The app:**

- **The five primary tabs hold.**
- **Tabs:** one tab row per screen.
- **Collection's lens chips** move into the Filters sheet Market already uses.
- **Jump chips:** no in-page jump chips.
- **Back:** one back link, top left.
- **Rows:** a row that is a link has no second link inside it.

**My listings (#237): the Market owns it.** Its tabs become Buy · Selling ·
Offers. Selling is market activity, the offers on your listings are already
there, and `my_collection_cards` already carries each card's active listing.

## D. The copy audit

The rule: keep a sentence only if a member needs it to act now, or privacy
requires it. Empty states, errors, confirmations and phrasebook lines are not
explanations and stay.

- **Result:** 57 sentences checked. 12 keep, 15 shorten, 9 move behind a
  link and 21 cut. The canvas has the full table.
- **Pre-decided cuts:** the ratings rule under "Hide each match" (only `How
  ratings work ›` stays) and `SHARE_NOTE`.
- **Privacy lines kept, shorter:**
  - "Members see the five you enter from 19:55.";
  - "Wanted cards stay private.";
  - the opt-out text.
- **Where moved text lands (#233): How it works, not a new FAQ.** It gains
  topic tiles at the top and an anchor per topic, and each page links to its
  anchor. Info toggles stay only where they are: the Why's factor tooltips
  (#279) and the fairness seal. S8 restructures How it works and closes #233.

## E. The match report

**Diagnosis:** the content is good; the voices and colours are the problem.

- **Voices:** a serif headline in two team colours, serif facts, a tracked
  kicker, prose with bold coloured names, ten kinds of capital tag, three
  Power pill colours, discs, bars and 8.5 px factor labels.
- **Colour:** every name is bold and violet or teal (DR1-5), up to four in a
  sentence, so prose reads like links.
- **Blocks:** every moment is a tinted, bordered box: five block styles on
  one page.
- **Repetition:** the score is in the headline, the scoreboard, often a fact,
  and every moment's tally.
- **Order:** on a phone the Why starts about 1,500 px down.

**Directions,** both with the same calm rules:

- names in ink;
- team colour only on the scoreboard, side headings, a 3 px lane rail and the
  shoot-out tally;
- moments as rows, not boxes;
- facts in Archivo;
- one tag style.

The directions:

- **E1, one calm column.**
- **E2, the same in two tabs, Match and Teams (recommended).** The Why is one
  tap away instead of 1,500 px down; the shoot-out sits on Match after the
  moments.

Both keep every phrasebook line and number (ADR-093).

## F. Decisions to revisit

| #   | Earlier decision                         | Recommended                                                                                                         |
| --- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| F1  | ADR-043, type roles and the kicker       | Serif only for the page title and the report headline; kickers retired; B becomes the rule                          |
| F2  | DR1-5, names in team colour everywhere   | Names in ink 600; team colour on the scoreboard, side headings, lane rails and shoot-out tally                      |
| F3  | DR4-1 and DR2, moments as tinted boxes   | Keep lanes and newest first; each moment a row with a side rail, no box                                             |
| F4  | DR3, the night's rating list             | Row = mini card, name, disc, line in Small; per-match chips go (each report's Teams tab has them)                    |
| F5  | ADR-114, Home's Open a pack button       | A tile while something is due; the primary button only when nothing is                                              |
| F6  | ADR-091, the privacy line                | One line by the save bar with Privacy ›; Settings' opt-out unchanged                                                |
| F7  | ADR-107, the picker at `/midweek`        | Only with C2: the picker moves to `/midweek/pick`; Compete still lands on `/midweek`                                |
| F8  | ADR-053, My listings deferred (#237)     | Market tabs Buy · Selling · Offers                                                                                   |
| F9  | DR3, the plusses panel                   | Keep rows, verdict and keeper line; the rule goes behind How plusses work ›                                          |

**Kept as they are:**

- the five primary tabs and Compete's section tabs;
- DR2-1;
- the Why rows (DR2-6 to DR2-8);
- the feed's lanes and order (DR4-1);
- the team colours (DR3-10) and the rating disc (DR3-4);
- the report's contents (ADR-093);
- Midweek gating.

## Owner decisions (DR5)

None yet. S1 pauses here for the owner's picks in C and E and answers to F.
