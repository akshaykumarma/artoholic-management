# Restore runbook (010 US5)

A restore to an older backup is a manual operation done outside the app. The console records it.
**Test this every quarter.** If no test is recorded for 100 days, the Super Admin is reminded.

## 1. Pick the backup
- In Admin console → Backups, note the backup's time, location and size.
- Dumps are at `backup:<BACKUP_BUCKET>/db/artoholic-YYYY-MM-DD.dump`.
- Files are under `backup:<BACKUP_BUCKET>/files/current`, with earlier versions in dated folders.

## 2. Restore into a scratch database (the quarterly test)
```bash
rclone copyto backup:$BACKUP_BUCKET/db/artoholic-YYYY-MM-DD.dump ./restore.dump
createdb -h $PGHOST -U $PGUSER artoholic_restore_test
pg_restore --no-owner --dbname=postgres://$PGUSER@$PGHOST/artoholic_restore_test ./restore.dump
rclone sync backup:$BACKUP_BUCKET/files/current scratch:artoholic-restore-test
```

## 3. Check it
1. Point a scratch copy of the web app at the restored database and bucket (`DATABASE_URL`, `S3_BUCKET`).
2. Run the stock check, which must report zero mismatches:
   `npx tsx -e "import('./apps/web/server/jobs/stock-rebuild-check').then(m => m.runStockRebuildCheck()).then(n => { console.log(n); process.exit(n ? 1 : 0) })"`
3. Smoke test:
   - Sign in.
   - Open an event, an item with photos, and the message log.
   - Run report R1.
4. Note the observed data loss (RPO: backup time vs incident time) and the time it took (RTO).

## 4. Record it
Go to Admin console → Backups → "Record a restore test", and enter the date, RPO, RTO, the result and notes.

## 5. Real restore (production incident)
1. Put the app in maintenance (stop the web container).
2. Restore the dump into a new database.
3. Sync files back to the primary bucket.
4. Switch `DATABASE_URL`, start the app, and run the stock check.
5. Record what was done in the restore test log with notes.
