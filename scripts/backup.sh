#!/usr/bin/env bash
# ESG Astraa HRMS — nightly backup: Postgres dump + storage buckets → Google Drive.
# All credentials come from environment variables (GitHub Secrets), never hardcoded.
set -euo pipefail

STAMP="$(date +%Y-%m-%d_%H%M)"
WORK="$(mktemp -d)"
BASE_DEST="${GDRIVE_DEST:-gdrive:HRMS-Backups}"
DEST="$BASE_DEST/$STAMP"
RETAIN_DAYS="${RETAIN_DAYS:-30}"

echo "== 1/3 Dumping database =="
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges \
  | gzip > "$WORK/database_$STAMP.sql.gz"
echo "   dump: $(du -h "$WORK/database_$STAMP.sql.gz" | cut -f1)"

echo "== 2/3 Uploading database dump to Drive ($DEST) =="
rclone copy "$WORK/database_$STAMP.sql.gz" "$DEST/"

if [ -n "${SUPABASE_S3_ENDPOINT:-}" ]; then
  echo "== 2b Backing up storage buckets =="
  export RCLONE_CONFIG_SB_TYPE=s3
  export RCLONE_CONFIG_SB_PROVIDER=Other
  export RCLONE_CONFIG_SB_ENDPOINT="$SUPABASE_S3_ENDPOINT"
  export RCLONE_CONFIG_SB_REGION="${SUPABASE_S3_REGION:-us-east-1}"
  export RCLONE_CONFIG_SB_ACCESS_KEY_ID="$SUPABASE_S3_KEY"
  export RCLONE_CONFIG_SB_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET"
  for bucket in employee-documents proof-of-work avatars task-attachments; do
    echo "   - $bucket"
    rclone copy "SB:$bucket" "$DEST/storage/$bucket/" --transfers 8 \
      || echo "     (skipped $bucket)"
  done
else
  echo "== 2b Storage backup skipped (SUPABASE_S3_* not set) =="
fi

echo "== 3/3 Pruning backups older than $RETAIN_DAYS days =="
rclone delete "$BASE_DEST" --min-age "${RETAIN_DAYS}d" --rmdirs || true

rm -rf "$WORK"
echo "Backup $STAMP complete."
