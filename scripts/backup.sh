#!/usr/bin/env bash
# ESG Astraa HRMS — backup: Postgres dump + storage buckets.
# Always produces files under ./backup (uploaded as a GitHub artifact by the
# workflow). Also pushes to Google Drive IF a 'gdrive' rclone remote is set up.
# All credentials come from environment variables (GitHub Secrets).
set -euo pipefail

STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="${BACKUP_DIR:-backup}/$STAMP"
mkdir -p "$OUT"

echo "== 1/3 Dumping database =="
pg_dump "$SUPABASE_DB_URL" --no-owner --no-privileges \
  | gzip > "$OUT/database.sql.gz"
echo "   dump: $(du -h "$OUT/database.sql.gz" | cut -f1)"

if [ -n "${SUPABASE_S3_ENDPOINT:-}" ]; then
  echo "== 2/3 Backing up storage buckets =="
  export RCLONE_CONFIG_SB_TYPE=s3
  export RCLONE_CONFIG_SB_PROVIDER=Other
  export RCLONE_CONFIG_SB_ENDPOINT="$SUPABASE_S3_ENDPOINT"
  export RCLONE_CONFIG_SB_REGION="${SUPABASE_S3_REGION:-us-east-1}"
  export RCLONE_CONFIG_SB_ACCESS_KEY_ID="$SUPABASE_S3_KEY"
  export RCLONE_CONFIG_SB_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET"
  for b in employee-documents proof-of-work avatars task-attachments; do
    echo "   - $b"
    rclone copy "SB:$b" "$OUT/storage/$b/" --transfers 8 || echo "     (skipped $b)"
  done
else
  echo "== 2/3 Storage backup skipped (SUPABASE_S3_* not set) =="
fi

echo "== 3/3 Google Drive =="
if rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
  DEST="${GDRIVE_DEST:-gdrive:HRMS-Backups}"
  echo "   uploading to $DEST/$STAMP"
  rclone copy "$OUT" "$DEST/$STAMP/"
  rclone delete "$DEST" --min-age "${RETAIN_DAYS:-30}d" --rmdirs || true
else
  echo "   gdrive remote not configured — backup kept as GitHub artifact only."
fi

echo "Backup $STAMP complete → $OUT"
