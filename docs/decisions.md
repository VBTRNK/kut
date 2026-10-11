# Decisions — FLUT

Record an ADR only for a game, economy, schema or security rule, in about 20
lines at most: context, decision, consequences. Newest at the bottom; numbering
continues from ADR-142.

ADR-001 to ADR-141 are at the git tag `docs-archive-2026-10`; read them with
`git show docs-archive-2026-10:docs/archive/decisions-2026.md | rg "ADR-099"`.
The ADRs below are in force, in their current form.

## ADR-140 — Process reset: merge to main deploys

Date: 2026-10-09, extended 2026-10-10 by S4 (VibeTrunk/kut#212). The original
text, with the transition rules S1–S3 ran under, is at the tag `docs-archive-2026-10`.

- A merge to `main` deploys to production through Vercel's Git integration.
  PR validation is the release check: `merge-gate` and `scan`, with the branch
  up to date. The CI authenticated E2E job (S2) replaced the local gate's
  browser run. Accepted: Vercel does not wait for the main-branch CI run.
- The merge authorizes that deployment only. No deployment records are kept.
  `docs/RELEASING.md` has the flow and the rollback.
- Superseded: ADR-071 (the fail-closed release gate), ADR-108 (the gate in the
  owner's session), ADR-123 (held main deployments), ADR-124 (merge authorizes
  a gated release), the deployment-record part of ADR-126 (full main CI stays),
  and ADR-128 to ADR-134 (gate checkout, preflight, E2E progress, release
  steps, release preparation, share-matrix attribution, Topic A monitoring).
- ADR-135 (cleanup) and the 14-day package-age rule were replaced by ADR-142.

## ADR-141 — Nightly encrypted kut backup in GitHub Actions, kut only

Date: 2026-10-09 (S3 spike, VibeTrunk/kut#212). Full text at the tag `docs-archive-2026-10`.

- No read-only role can read the auth tables on hosted (`postgres` has no grant
  option on schema `auth`), so the backup covers schema `kut` only.
- `.github/workflows/backup.yml` runs nightly at 03:41 UTC as the read-only
  `kut_backup` role through the Session pooler. A privilege audit and a
  denied-insert check come first; the role never holds write or migration
  rights, and never the `postgres` credential (which ADR-144 allows only in
  the `VibeTrunk/supabase` migration workflow).
- 2026-10-11: moved from 03:17 UTC, whose runs started about 6.5 h late.
- The dump and its manifest come from one snapshot, are age-encrypted to the
  owner's key and kept 30 days. A restore check in a disposable `kut_restore`
  stack must match the schema and row counts and sign a stand-in member in.
- Six PUBLIC-executable `kut` SECURITY DEFINER functions are reviewed
  exceptions in the audit. Revoking them is a later migration.
- 2026-10-11: after scheduled runs and the owner's drill passed, the old local
  backup and its DPAPI invariant are retired. Its decrypt script and credential
  store stay in `scripts/legacy/` for the old `.sql.enc` files until 2027-01-01.
- The agents' start-up check ignores `pull_request` successes: those runs test
  a fixture and could mask a missing nightly.

## ADR-142 — Archive-first tidy, deletion tiers and doc size limits

Date: 2026-10-10 (process reset S7, VibeTrunk/kut#212). Supersedes ADR-135 and
the 14-day package-age hook.

- Local Git state (branches, worktrees, stashes) is removed only by
  `node scripts/tidy.mjs`. Its dry run inventories from Git alone. `--apply`
  bundles every selected item, proves the bundle in an empty repository,
  rechecks each SHA and removes only unchanged items. Dirty worktrees are
  refused; untracked and ignored files are listed, never deleted.
- Agents run the dry run only: both hooks deny `tidy --apply`, and the owner
  runs the printed line (`--apply` first, with the dry run's SHAs) in their own
  terminal. Codex hooks can only allow or deny, so this is the one route that
  behaves the same in both agents (ADR-143). The ask and prompt rules stay as a
  fallback. Direct `git branch -D`, `worktree remove` and `push --delete` stay
  blocked. Accepted residual risk: an agent with a shell isn't fully
  containable; the archive makes mistakes recoverable.
- Tiers: tracked files are deleted freely in a PR; untracked or ignored files
  move to the archive with the owner's OK; remote branches need
  `tidy --remote` and approval; hosted data is owner-only.
- Dependabot version updates wait 5 days (`cooldown`); security updates are
  exempt and manual installs are reviewed in the PR diff.
- `npm run policy:check` enforces size limits: PRODUCT.md 25 KB, decisions.md
  30 KB with 25 lines per ADR, AGENTS.md + CLAUDE.md 11 KB.

## ADR-143 — One safety system for Claude and Codex

Date: 2026-10-10 (S7 live tests, VibeTrunk/kut#212).

- Both agents run the same hook script (`block-dangerous-commands.cjs`, one
  copy per agent, kept identical by a unit test). A command it denies is
  blocked in both; this is proven live in each agent.
- Codex setup on the owner's machine: the repo's hook trusted in Settings →
  Hooks (again after any change to `.codex/hooks.json`), `approval_policy =
  "on-request"` with `approvals_reviewer = "user"`, and Codex started at the
  repo root (the hook path is relative).
- Codex limits, from its docs: a hook can only allow or deny, never ask; a hook
  that crashes or times out lets the command through. Hooks are a guardrail,
  not a complete boundary. The Windows launcher is therefore a plain `node`
  command, and a unit test runs it exactly as written.
- Codex's `prompt` rules did not stop commands in the extension. In practice,
  Codex commits and pushes reach the owner because the sandbox can't write
  `.git` and has no network, so Codex must ask to run them outside it.
  Approving "always" removes that check.

## ADR-144 — Hosted migrations through a workflow in VibeTrunk/supabase

Date: 2026-10-10 (process reset S9, VibeTrunk/kut#212). Amends ADR-141's
credential rule.

- `apply-migrations.yml` in `VibeTrunk/supabase` applies hosted migrations. It
  is dispatched with a catalogue commit on main and the kut commit holding the
  same files. The plan job runs `migration list` and `db push --dry-run` and
  refuses any pending migration without a byte-identical copy in kut. The apply
  job plans the same commit again, needs the identical list and a kut backup
  under an hour old, pushes, and checks that nothing is left pending.
- Only `postgres` can apply kut migrations; a dedicated role cannot inherit it
  (no ADMIN option on `postgres` in Postgres 17). Its password is therefore a
  secret of that repo's `production` environment only: main only, with the
  owner as required reviewer of both jobs. It reaches the CLI through
  `PGPASSWORD`. The backup route still never holds it. Accepted: a compromised
  dependency of an approved job could read it, so actions are pinned by SHA
  and the CLI by version.
- Each approval of the apply job is the explicit yes for that push; a merge
  still authorizes none.
- kut CI's required `catalogue-parity` job checks every kut migration against
  the catalogue's main, replacing `test-catalogue-parity.ps1`. A migration PR
  stays red there until its catalogue PR merges (`docs/RELEASING.md`).
- A local `db push` from `VibeTrunk/supabase` stays a fallback, with the
  owner's OK.

## ADR-145 — Club names in the Midweek views

Date: 2026-10-11 (Midweek Madness 3.0 S2, VibeTrunk/kut#267, #262).

- The four Midweek views that name a member append the club: `side_0_club`
  and `side_1_club` on `midweek_matches_public` and `midweek_draw_public`,
  `club_name` on `midweek_entries_public`, and `champion_club` on
  `midweek_tournaments_public` (shown exactly when the champion is).
- The club is `coalesce(nullif(btrim(club_name), ''), display_name || '''s Club')`,
  as on the club value leaderboard; a bye has no second club. It is the
  current name, like the account name beside it, not a snapshot at the lock.
- The name columns stay: the account name is shown where the member acts
  (calls, the picker, `Your night`, trialist labels), the club where the team
  plays, wins or goes through (`design/mm3/HANDOFF.md`, Q7). The result message
  written in SQL is unchanged. `my_midweek_predictions` keeps only the account
  name of the called member.
- Pages read the columns from S7, falling back to the account name.

## ADR-146 — Hosted smoke query only for data-changing migrations

Date: 2026-10-11 (after Midweek Madness 3.0 S2). Amends `docs/OPERATIONS.md`.

- Agents have no hosted credential, so the smoke query after a hosted apply
  is a manual step for the owner. For an additive migration (new views,
  columns, functions) it adds little: CI tests the migration on a fresh stack,
  and the `apply-migrations` workflow (ADR-144) shows the approved plan, the
  push and that nothing is pending.
- So the owner runs a read-only smoke query only after a **data-changing**
  migration (`docs/OPERATIONS.md` tiers). An access change still gets a
  member smoke test of the page (AGENTS.md).
- Running a reviewed read-only smoke inside the apply job is filed as
  VibeTrunk/supabase#87, for when migrations get frequent or a second tool
  joins.

## ADR-147 — Every match live: feed, clock, readable shoot-out

Date: 2026-10-11 (Midweek Madness 3.0 S3, VibeTrunk/kut#267, #263). Amends
ADR-115; design `design/mm3/HANDOFF.md` DR4-1 to DR4-5.

- **Every match in play is watched live** on its page by ADR-115's route: only
  what is due by real time leaves the server. The "in play, result at full
  time" match page is retired (rows follow in S4).
- **The feed is newest on top** while live (kicks, `Penalties · 2–2 at 90′`,
  moments, kick-off); the full-time report stays oldest first.
- **The clock** ticks each second from the kick-off, the schedule version and
  the server's render time, which corrects the device clock
  (`src/lib/midweek/live-clock.ts`). It holds at 90′; penalties and full time
  come only from the server. The same clock drives the countdowns and the
  poller's wait for the next kick-off, whose refresh closes the calls card
  (simpler than a client-side disable; the trigger stays the authority).
- **Polling:** the match page every 10 s, 5 s in a shoot-out; the evening and
  bracket 20 s. A waiting page polls on from its kick-off until a refresh
  lands; a tab shown again refreshes at once.
- **A kick** shows `Pen 3`, the outcome with the tally, and taker v keeper
  (`ShootoutKick.keeper`). Its commentary and the decider show only at full
  time, under their own kick (`ShootoutReport.decider`). A level shoot-out
  stays live after its last kick until the draw's moment.

## ADR-148 — Every row in play live, with its score so far

Date: 2026-10-11 (Midweek Madness 3.0 S4, VibeTrunk/kut#267, #216). Amends
ADR-115 and ADR-147; design `design/mm3/HANDOFF.md` DR4-6 and DR4-10.

- **Every match in play is live on its row**, on the evening's `This round`
  and the bracket, list and `lg` tree: `Live`, each side's goals so far, the
  minute or `pens` with the kicks scored in brackets, and a link to watch it.
  The `In play · result at full time` row is retired.
- **The score is counted, not rendered:** one member read of
  `midweek_events_public` for the matches in play (`loadLiveRowEvents`),
  counting `kind = 'chance'` goals per side; penalty kicks count only in the
  brackets, and the settling `toss` never. The view shows each event from its
  own moment (ADR-106), so no report, service role or extra gate is needed. A
  failed read degrades to `Live` with no score. Played rows, and weeks from
  before ADR-104 (no stored end), keep their stored score.
- **The minute** ticks on the client from public timing, as the scoreboard's
  clock does (ADR-147), and holds at 90′; `pens` comes with the first kick a
  poll brings.
- **Tree groups are two equal grid rows** (`grid-rows-2`), not `flex-1`
  children: a two-line match beside a one-line bye no longer pulls the
  bracket line off its quarter point (#216). The focused-tooltip half was the
  test's pointer: focusing scrolled another factor under it, whose hover won.
- **Load:** 16 matches in play, local production build: the evening about
  100 ms, the bracket about 70 ms (medians; budget 500 ms). No cache.
