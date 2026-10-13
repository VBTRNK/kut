# E2E quarantine evidence

A skipped or `fixme` test stops producing replacement failure traces. Before
quarantining a failing test, record enough evidence in its tracking issue to
investigate after CI artifacts expire, then link that record from the skip
reason. This applies to failure quarantines, not conditional skips for a
fixture, browser scope or production-only test.

## Recording rule

1. Check the issue, PR, committed docs and local evidence for an existing
   diagnostic summary or durable copy. Reuse it; fill only the missing facts.
2. Record the failing run/job link and commit, exact test title/file,
   Playwright project, browser/version and OS, and the actual viewport at the
   failure (including any test override).
3. Preserve the decisive facts: failed assertion and expected/actual values,
   relevant actions, pointer/focus/scroll state or layout measurements. Separate
   observations from hypotheses; name the source if someone else inspected
   the trace. A screenshot alone or an expiring artifact link is insufficient.
4. State the hypothesis to revisit, the next discriminating reproduction, and
   the condition for removing the quarantine. Update the record when a later
   investigation changes the diagnosis.
5. Keep public records sanitized: no private member data, credentials, session
   material or unreviewed authenticated traces. If the summary cannot preserve
   the necessary evidence, keep only the needed raw evidence in a durable,
   access-controlled location and record its location and access requirements.
   Preserve it before artifact expiry; do not rely on retention extensions.

Use this small template in the issue (or link an existing record that supplies
the same facts):

```text
Failing run/job and commit:
Test title/file; project; browser/version; OS; actual viewport:
Observed assertion/actions/measurements (source):
Hypothesis and next reproduction:
Remove quarantine when:
Evidence retained at; artifact expiry; remaining gaps:
```

The authenticated action retains failed `test-results` for seven days. Leave
that default in place unless a concrete investigation needs more time; a
longer retention period does not replace this record.

## Preserved diagnosis: #216 / KB-042

Recorded 13 October 2026 for [#278](https://github.com/VibeTrunk/kut/issues/278).
The existing sanitized investigation and S4 PR already preserve the useful
trace facts; no additional raw trace download is needed for this diagnosis.
No matching raw trace copy was found in this checkout's `.release-evidence`.

**Run and environment.** [Run 37944131510, failed authenticated job](https://github.com/VibeTrunk/kut/actions/runs/37944131510/job/113865899021),
9 October 2026, commit `d4c92afa5149ac3bd222a3c41f15949e672cacba`.
Linux Chromium, Playwright 1.63.0, project `authenticated-pixel7`.
The historical config uses the Pixel 7 viewport, 412 × 839; the bracket test
overrides it to 1280 × 900. The exact Chromium binary version was not retained
in the existing summary; the commit pins the Playwright version.
GitHub artifact metadata checked on 13 October reports
`e2e-authenticated-results` expiring **16 October 2026, 14:32:31 UTC**
(16:32:31 Europe/Amsterdam). This record does not depend on that artifact.

**Bracket test:** `tests/e2e-authenticated/mobile.spec.ts`,
"from lg, every bracket line meets the match it leads to (KB-031)".

- The original job log reports round 1, group 1: **6.4375 px** from the
  expected quarter point, against a **≤1 px** tolerance, across all retries.
- The [#216 investigation](https://github.com/VibeTrunk/kut/issues/216#issuecomment-6110729271)
  reproduced it on Windows with the real component and five-entrant fixture
  shape: a two-line match beside a one-line bye. With the match first, row
  heights were 63.9 / 41.8 px and the error 5.5 px; bye first, 4.6 px.
  Names were non-wrapping and truncated, disproving the Linux-font/wrapping
  hypothesis. Flex halves were unequal because of their content heights.
- Equal grid rows (`grid grid-rows-2`, pair `flex-1` removed) measured **0.0 px**
  in every group. [S4 PR #275](https://github.com/VibeTrunk/kut/pull/275)
  shipped this and removed the Linux quarantine; it reports both #216 tests
  passing locally and in Linux CI.
- If it regresses, reproduce a match/bye pair in both orders at 1280 × 900
  and measure pairing middles against the group's quarter points. The
  acceptance condition remains ≤1 px for every connector; do not restore the
  disproved font hypothesis without new evidence.

**Tooltip test:** the same file, "a completed week's bracket and a match
report fit the screen", at 412 × 839. The original job log confirms a
visibility failure in this test on all retries; the 320 × 568 case passed
according to #216.

- S4's [trace investigation in PR #275](https://github.com/VibeTrunk/kut/pull/275)
  records a pointer at **(108, 563)** after "Show every factor". Focusing
  `Form` scrolled another factor under the pointer; Chromium's hover replaced
  the requested explanation. S4 moved the pointer away before focusing.
  These trace facts are attributed to S4, not a new inspection here.
- The later [#279 investigation](https://github.com/VibeTrunk/kut/issues/279)
  revisited whether a keyboard user with a resting mouse had the same problem.
  [PR #304](https://github.com/VibeTrunk/kut/pull/304) reproduced the product
  defect: `onMouseEnter` cleared the focused/tapped factor. It made focus/tap
  authoritative over hover and removed the pointer workaround from the test.
  Its regression focuses Form then hovers another factor; the old rule failed
  at Pixel 7, 320 px and 1440 px, while the fix passed.
- If it regresses, expand factors and tab while leaving the mouse where
  scrolling brings another factor beneath it. The focused explanation must
  remain visible; also check hover without focus, touch and Escape dismissal.
  S4's test-only conclusion was superseded by #304's verified product fix.

Both tests now run without the #216 quarantine. Their current regression
assertions and the sanitized facts above preserve the diagnosis after expiry.
