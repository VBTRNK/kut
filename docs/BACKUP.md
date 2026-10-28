# KUT backup and restore

Game state lives in schema `kut` of the shared Supabase project. The free plan
has no managed backup, and migrations rebuild the schema, not the data, so a
nightly encrypted dump is the backup (ADR-141). It covers every `kut` object
and row; it does not cover `auth.users` (no read-only role can read it) or the
`player-photos` bucket (re-uploadable).

## Nightly GitHub backup

`.github/workflows/backup.yml` runs at 03:41 UTC and on dispatch
(`gh workflow run backup.yml -R VBTRNK/kut`), as the read-only `kut_backup`
role through the Session pooler, from the `backup` environment (main only).

- **Each run** audits the role's privileges, dumps `kut` (`pg_dump -Fc`) with a
  manifest (repo SHA, migration versions, row counts, SHA-256) from one
  snapshot, then restores it into a disposable stack and fails unless schema,
  row counts and a member sign-in check out. When hosted is ahead of `main`
  (a migration window), the schema check fails as expected until the merge.
- **Output:** artifact `kut-backup-<stamp>`, kept 30 days: the tar
  age-encrypted to `.github/backup-recipient.txt` plus the plaintext tar's
  SHA-256. Artifacts are public, so only ciphertext is uploaded. A failed run
  uploads its logs encrypted the same way. Download one about monthly and keep
  it outside GitHub.
- **Monitoring:** GitHub emails about failed runs. Runs that never start are
  caught by the start-up check in `AGENTS.md`, which ignores `pull_request`
  runs (those test the pipeline against a fixture, not production).
- **Setup:** run `scripts/ci/backup/kut-backup-role.sql`, set the role's
  password, then `audit-kut-backup.sql` (no `FINDING` rows) in the SQL editor.
  The `backup` environment holds `KUT_BACKUP_PGHOST`, `KUT_BACKUP_PGUSER` and
  `KUT_BACKUP_PGPASSWORD`.

## Drill: download, decrypt, restore (owner, about monthly)

```powershell
gh run download <run-id> -R VBTRNK/kut -n kut-backup-<stamp> -D $env:USERPROFILE\backups\kut-github
age -d -i $keyFile -o kut-backup.tar kut-backup-<stamp>.tar.age   # key from the password manager
(Get-FileHash kut-backup.tar -Algorithm SHA256).Hash               # must match the .sha256
New-Item -ItemType Directory plain | Out-Null; tar -xf kut-backup.tar -C plain
git -C $env:USERPROFILE\dev\kut worktree add .release-evidence\worktrees\kut-restore <repo_sha>
Set-Location $env:USERPROFILE\dev\kut\.release-evidence\worktrees\kut-restore; npm ci
& "C:\Program Files\Git\bin\bash.exe" scripts/ci/backup/restore-check.sh <plain> <new-work-folder>
```

It ends with `restore check passed`, in a `kut_restore` stack on ports 553xx
that never touches `supabase_db_kut`. Then stop it
(`npx supabase stop --workdir <work-folder>\stack --no-backup`) and delete the
plaintext and the key file. Last drill: 2026-10-11, passed.

A **real** restore needs the matching `auth.users` rows first. `user_cards` and
`trade_offers` reference each other, so load data with triggers disabled, then
check that no `held_by_offer_id` points at a missing offer.

## Legacy local backups (until 2027-01-01)

The old owner-run backup is retired. Its `.sql.enc` files in
`%USERPROFILE%\backups\kut` (last one 2026-10-09) still decrypt with
`scripts/legacy/`, using the passphrase from the DPAPI store. Review on
2027-01-01 whether they, the scripts and the store can go.

```powershell
Import-Module .\scripts\legacy\KutCredentialStore.psm1
.\scripts\legacy\protect-kut-backup.ps1 -Mode Decrypt -InputPath <file.sql.enc> -OutputPath <new-file.sql> `
  -Passphrase (Get-KutStoredCredential -Locator backup-encryption-v1)
```
