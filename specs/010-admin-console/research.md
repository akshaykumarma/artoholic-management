# Research: 010-admin-console

## R1. Audit search
- **Decision**: B-tree indexes on (`occurred_at`), (`actor_user_id`, `occurred_at`),
  (`entity_type`, `entity_id`); `action` prefix filter; keyset pagination. Exports > 100k rows
  run as a background job and email a signed link.

## R2. Backups
- **Decision**: Nightly 02:00 IST: `pg_dump -Fc` streamed to the backup bucket (encrypted at rest,
  separate credentials), and `rclone sync` of photo/report buckets to the backup bucket with
  `--backup-dir` dated folders; lifecycle rule deletes > 30 days. Result row in
  `backup_records`; failure → in-app + email to Super Admin within 15 min.

## R3. Restore tests
- **Decision**: Documented runbook (restore into a scratch database + bucket, run the balance
  rebuild check from 003 and a smoke test); the console records date, operator, RPO/RTO observed,
  result. Reminder if none in 100 days.

## R4. Retention
- **Decision**: Nightly 03:00 IST jobs: (a) damage photos with `delete_after < now()` whose event
  is Closed → delete objects, set `photos_deleted_at`; (b) ledger roll-up for movements older than
  3 years where every referenced event is Closed: insert `opening` movements (type `rollup`) per
  balance key at the cutoff, move older rows to `stock_movements_archive` in the same transaction,
  verify balances equal before commit; (c) audit entries older than 3 years moved to
  `audit_entries_archive` (kept compressed for legal hold, not shown in UI). Message log and damage
  records never purged.

## R5. Master lists
- **Decision**: One `master_list_values` table keyed by list name; modules read through a cached
  accessor; archive instead of delete when referenced.
