# Pack tiers — design brief

Issue [#223](https://github.com/VBTRNK/kut/issues/223), S0. **Approved by the
owner on 15 October 2026**: this brief and the prototype are the design S2 and
S3 build. Not built yet; the shop still sells today's single pack.

## Direction: packs made of card materials

FLUT already has a material ladder on its Live cards (`globals.css`): uncoated
Common stock, brushed Silver plate, hot Gold foil, each with its pennant. The
packs reuse it, so they read as FLUT objects rather than a new art style. Shape
differs as well as material, so they stay apart in grayscale and without colour.

| Pack | Wrapper | Opening gesture (tap the pack) | Time |
| --- | --- | --- | --- |
| Regular (`tfh-pack`) | Common stock, press grain, printed brass pennant, crimped and perforated | The strip tears off; paper drops; card backs rise | 1.2 s |
| Silver (`tfh-silver-pack`) | Silver plate's brushed metal as a rigid sleeve with a thumb notch; Silver pennant | Light sweeps the steel; the sleeve slides off | 1.4 s |
| Gold (`tfh-gold-pack`) | Gold card's hot foil as a two-door wallet under a pennant seal | The seal breaks; the doors swing open | 1.6 s |

After the gesture the three backs fan out and hold for 1 s, so card 1 arrives
2.2 / 2.4 / 2.6 s after the tap.

Card backs inside are the board with a brass pennant: no face or tier is shown
before the reveal names it. No ambient motion in the shop, no Special imagery,
no three-high-cards art. Wrappers are materials, not card grades.

## Shop

- Offers are Block tiles: art, name, "3 Live Cards", the promise, one button,
  "Leaves you N." Phone: a compact row (art left), so both launch offers fit
  above the fold. From `sm`: a shelf of upright tiles; the tier ladder keeps
  its side column (`lg:max-w-6xl` leaves room for three tiles).
- Promise: Regular "No minimum tier"; premiums "At least 1 Silver+ / Gold+"
  with the tier icon. No taglines or footnotes; duplicates and low companion
  cards are explained in the FAQ (S2), and "at least 1" stays explicit.
- Every affordable offer has the brass primary button (owner decision; a
  deliberate exception to DR5's one-primary rule on this screen). Unaffordable:
  today's disabled "Need N more coins" and "Earn coins by attending published
  sessions."
- Launch omits Gold. The design comparison shows it with an "Off at launch" tag.

## Confirm, open, results

- Confirmation is the real `BottomSheet`: pack thumbnail, "Open a Silver pack?",
  "500 coins for 3 Live Cards, at least 1 Silver+. You keep 750.", Not now /
  Pay 500. Stale-quote and pending behaviour stay as in `OpenPackForm`.
- Paying lands on the opening page (`/club/packs/[openingId]`), not a modal.
  It opens sealed on the pack's stage (Regular keeps today's brass stage, Silver
  steel, Gold brighter brass). **The tap is the gesture**; the backs hold, then
  card 1 follows on its own. Tier (1.1 s) and rating (1 s) advance by
  themselves; the revealed card waits for a tap ("Tap for the next card"). A
  tap during the gesture, hold, tier or rating jumps straight to the card.
- Summary is PackReveal's: "Your new Live Cards", sub line
  "Silver pack · Paid 500 coins · 1 new Player. Album 19 / 36.", chips from
  `packSummary`. A card whose tier has moved since shows "Gold 64 when opened";
  otherwise there is no extra receipt text. Old openings show their stored
  name and price only. "Replay opening" restarts the presentation.
- Starter stays separate: its own sealed screen and copy, no paid wrapper.

## Celebrations (on the revealed card, by its tier)

Common: none. Bronze: a small bronze burst. Silver: more confetti in steel and
white, plus the card's own light sweep. Gold: a full gold burst and warm glow.
Holo: pearl confetti and two iridescent rings. Elite: the stage dims, still
rays rise, gold leaf falls and the card lifts. No sound, flash, spin or shake;
confetti offsets are static generated CSS (CSP-safe); reduced motion never
plays them. Review page: `celebrations.html`.

## Accessibility

Native buttons; visible focus on the stage; the status line announces
"Card 1 of 3 · Silver" politely, including the automatic steps (each under
5 s, and Skip all stays available). Summary takes focus after Skip all and at
the end. Skip all is available sealed, mid-gesture and on every step. Reduced
motion opens at the summary, replay stays there, and a mid-gesture preference
change skips. Sheet: focus on open, Tab wraps, Escape returns focus.

## For S2

Promote `PackArt` and the CSS into the app; add an optional `pack` (stored
slug → art, unknown slugs neutral) and a sealed phase to `PackReveal`, with
stage focus, status and replay. Remove the hard-coded brass tile in
`OpenPackForm`. The prototype's `preview.js` only stands in for React state.

## Admin economy (S3), previewed in `admin.html`

- One Packs block: per pack the art, promise and qualifying pool, an on/off
  Switch with an On/Off tag (Regular "Always on"), a price Field with
  "Suggested N", and its discard return with the existing health band.
- Editing previews at once: health, value table and "Unsaved: Silver 500 →
  300". Warnings ("Check") appear for a non-Target return, a premium that beats
  Regular per coin (worst measure only), or Regular already meeting a floor in
  90%+ of packs. They never disable Apply; only invalid prices do. "Use
  suggested prices" fills the form without saving.
- A newer revision by another admin shows an alert and reloads their values
  (`admin-conflict.html`). The revision line names who applied it and when.
- Below: Value at these prices (per 1,000 coins: cards, discard coins,
  Silver+/Gold+/Holo+, Elite once any exist; per pack: any Silver+/Gold+/Holo+
  and coins removed), Openings by price paid (7/28 days), Coins and wallets.
- Preview numbers: per-pack figures from `scripts/analyze-pack-tiers.mjs` on
  the 15 Oct roster fixture (it reproduces 250/500/750 suggestions); usage,
  wallets and flows are example figures. S1's SQL is the real source.
