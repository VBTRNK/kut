# Pack tiers — S0 review package

First local slice of [#223](https://github.com/VBTRNK/kut/issues/223): artwork,
motion and an interactive preview. It does not change the real shop, database,
admin controls or paid opening flow. Read [the brief](BRIEF.md), the
[copy and contract audit](COPY_AUDIT.md) and the [checkpoint](CHECKPOINT.md).
Staged plan: `~\.claude\plans\kut-issue-223.md` (revision 1).

```powershell
node design/pack-tiers/build.mjs
```

Open `.release-evidence/issue-223/design/index.html`:

- `index.html`: launch shop (420-coin wallet, so Silver shows "Need 80 more").
- `comparison.html`: all three packs, 1,250 coins; try each Open → Pay.
- `opening.html?receipt=regular|silver|gold`: sealed pack → tap → reveal →
  summary. Reload or Replay shows the same fixed cards.
- `storyboards.html`: seven frames per pack; frames 2, 3, 4 and 6 are the real animation, paused.
- `celebrations.html`: each tier's reveal celebration, with Play again.
- `history.html`: a card that fell a tier since opening, and a pre-tier opening.
- `admin.html` and `admin-conflict.html`: the S3 economy screen; edit prices
  and toggles to see drafts and warnings.

The builder renders the real AppNav, Block, Button, Tag, PageHeader,
BottomSheet, LiveCard, `packSummary`, rating helpers and `packRevealReducer`
with the app's compiled CSS. No server, account or network. Fonts fall back to
Arial/Georgia. Players, prices and wallets are invented fixtures.

Key screenshots are committed in [docs/design/pack-tiers](../../docs/design/pack-tiers/):
the launch shop (390/1440), all three packs (colour and grayscale),
storyboards, celebrations, older receipts, admin (390/1440 and a draft), and a
Gold opening's backs and result. The builder writes the rest (every pack's
confirmation, mid-gesture, backs and result; conflict) to the ignored
`.release-evidence/issue-223/design/screens/`.

The builder checks 320/390/768/1440 px for sideways scroll; keyboard reach,
focus ring and sheet focus trap; pay → opening; each pack's own animations,
gesture length and backs hold; unaided tier/rating/card; the card waiting for
a tap; per-tier celebrations; summary focus, skip, replay/reload stability;
admin drafts, warnings, suggestions, invalid prices and conflict; reduced
motion; 200% zoom on page content; no errors or requests. Report: `.release-evidence/issue-223/design/verification.txt`.
These checks prove the prototype only. Purchase locking, persistence,
authorization and old-schema behaviour are S1/S2 acceptance work.
