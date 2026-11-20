#!/usr/bin/env bash
# Nightly backup (010 US5): database dump and stored files to the off-server backup bucket.
# The bucket keeps 30 days (lifecycle rule on the bucket). Prints one JSON line for the app to record.
# Needs: DATABASE_URL, RCLONE_CONFIG (with remotes "primary" and "backup"), S3_BUCKET, BACKUP_BUCKET.
set -euo pipefail
day=$(date -u +%Y-%m-%d)
dump=$(mktemp -d)/artoholic-$day.dump
pg_dump --format=custom --no-owner --file="$dump" "$DATABASE_URL"
bytes=$(stat -c %s "$dump")
rclone copyto "$dump" "backup:$BACKUP_BUCKET/db/artoholic-$day.dump"
files=$(rclone sync "primary:$S3_BUCKET" "backup:$BACKUP_BUCKET/files/current" --backup-dir "backup:$BACKUP_BUCKET/files/$day" --stats-one-line -v 2>&1 | grep -oE 'Transferred: +[0-9]+ / [0-9]+' | tail -1 | grep -oE '[0-9]+$' || echo 0)
rm -f "$dump"
printf '{"databaseBytes": %s, "filesSynced": %s, "location": "%s"}\n' "$bytes" "${files:-0}" "backup:$BACKUP_BUCKET/db/artoholic-$day.dump"
