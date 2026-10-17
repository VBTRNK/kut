# Pack tiers: owner launch and review checklist

S3 of [#223](https://github.com/VibeTrunk/kut/issues/223) (closed). Open
reviews: [#340](https://github.com/VibeTrunk/kut/issues/340). No hosted action
is performed by this checklist or its PR. Keep aggregate evidence private under
`.release-evidence/issue-223/`; never attach member metrics to the public issue.

## Before launch (owner/admin)

- [ ] Review/merge S3; check the deployment using `docs/RELEASING.md`.
- [ ] Confirm the catalogue migration `20261023000000_pack_tiers.sql` is live
  (S1 was applied); open `/admin/economy` as an admin and Refresh.
- [ ] Record measurement time, revision and configured prices/availability.
  Review every pack, including off packs: eligible/qualifying pool, current
  discard return/net removal, Silver+/Gold+/Holo+/Elite chances and copies per
  1,000 coins. Suggestions target 75% return and a 10% premium efficiency
  margin, round up to 25 and compare with the draft Regular price.
- [ ] Review 7/28-day paid-price uptake/spend, median wallet, affordability,
  rewards/grants, discards, pack/tax sinks and admin adjustments. Same cohort:
  enabled non-superadmins; no test-account exclusion marker exists. Escrow
  and member transfers are not sinks; period discards are not pack ROI.
- [ ] Record baseline duplicate supply, Live/tier collection coverage and market
  activity from owner-approved aggregate evidence. These are separate from the
  economy RPC; its page does not claim to measure them. Do not infer a new-card
  probability from aggregate coverage or current tiers from historical sales.
- [ ] Owner decides launch settings: accepted starting prices 250/500/750,
  Regular on, Silver on, Gold off. Verify current settings first: S1 seeded
  both premiums off and a later owner may already have enabled Silver.
- [ ] Before Apply or a paid smoke test, confirm a fresh production backup
  using [the backup runbook](../../docs/BACKUP.md). Start it with
  `gh workflow run backup.yml -R VibeTrunk/kut --ref main`; wait for that
  non-PR run to succeed, including its independent restore check, and record
  the run URL privately. The owner also confirms the decryption key remains
  durably retrievable; never share the key in launch evidence.
- [ ] Use suggested prices only fills drafts. Review warnings and Apply changes
  only when the owner/admin chooses to launch. Confirm the saved revision,
  shop identity/price/promise and inactive Gold. Manual overrides remain valid;
  no automatic pause, repricing, purchase ROI gate or extra confirmation.
- [ ] If a paid smoke test is wanted, the owner explicitly authorizes and runs
  it. Verify the receipt and reload/replay without another debit. A stale quote
  must require the new price; an empty floor must fail without charging.
- [ ] Record actual launch date privately and schedule owner reviews at +14 and
  +28 days. No automated alerts or scheduler are introduced.

## Launch +2 weeks and +4 weeks (owner/admin)

- [ ] Refresh and retain the same measurements, cohort and price-paid segments
  as launch. The 28-day view at +2 weeks includes pre-launch days; annotate it.
- [ ] Compare uptake/spend by pack and paid price, wallet affordability, reward/
  discard credits, pack/tax sinks, duplicates, collection coverage and market
  activity. Use comparable cohorts/windows; do not call period discard/spend
  realized pack ROI. Ratings/roster changes can invalidate launch balance.
- [ ] Review 75/80/95% bands, 100% return, Regular value lead/10% margin and
  90%+ floor maturity. Explain unavailable/unsupported pools before decisions.
- [ ] Choose and record any manual price/availability change and its revision,
  or record why current settings stay. Gold enablement is a separate owner
  choice. Repeat the backup prerequisite before Apply for any authorized
  change; no deployment is needed.

S3 pause: verified admin PR and this checklist; merge, launch settings, paid
production smoke tests and review scheduling remain owner actions.
