#!/usr/bin/env bash
# ESG Astraa HRMS — backup: Postgres dump + storage buckets.
# Always produces files under ./backup (uploaded as a GitHub artifact by the
# workflow). Also pushes to Google Drive IF a 'gdrive' rclone remote is set up.
# All credentials come from environment variables (GitHub Secrets).
set -euo pipefail

STAMP="$(date +%Y-%m-%d_%H%M)"
OUT="${BACKUP_DIR:-backup}/$STAMP"
mkdir -p "$OUT"

# Strip any stray CR/LF a pasted secret may carry (trailing newline etc.).
SUPABASE_DB_URL="$(printf '%s' "${SUPABASE_DB_URL:-}" | tr -d '\r\n')"

# Use the newest pg_dump/psql explicitly (server is PG17; the PATH shim may be older).
PG_DUMP="pg_dump"
PSQL="psql"
for v in 17 16; do
  if [ -x "/usr/lib/postgresql/$v/bin/pg_dump" ]; then
    PG_DUMP="/usr/lib/postgresql/$v/bin/pg_dump"
    PSQL="/usr/lib/postgresql/$v/bin/psql"
    break
  fi
done
echo "== 1/4 Dumping full database ($("$PG_DUMP" --version)) =="
# Full logical backup — includes EVERY table (attendance, tasks, documents
# metadata, chat, profiles, …). This single file can restore the whole DB.
"$PG_DUMP" "$SUPABASE_DB_URL" --no-owner --no-privileges \
  | gzip > "$OUT/database.sql.gz"
echo "   dump: $(du -h "$OUT/database.sql.gz" | cut -f1)"

echo "== 2/4 Exporting key tables as CSV (human-readable) =="
# Readable spreadsheets so each dataset is visible without restoring the dump.
mkdir -p "$OUT/csv"
for t in \
  profiles employee_details attendance office_locations \
  task_plans thirty_day_plans daily_task_logs assigned_tasks \
  admin_comments messages notifications \
  evaluations evaluation_events meetings meeting_attendees; do
  if "$PSQL" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
      -c "\copy (select * from public.$t) to '$OUT/csv/$t.csv' with csv header" 2>/dev/null; then
    rows=$(($(wc -l < "$OUT/csv/$t.csv") - 1))
    echo "   - $t.csv ($rows rows)"
  else
    echo "     (skipped $t — table missing?)"
  fi
done

if [ -n "${SUPABASE_S3_ENDPOINT:-}" ]; then
  echo "== 3/4 Backing up storage buckets (files) =="
  export RCLONE_CONFIG_SB_TYPE=s3
  export RCLONE_CONFIG_SB_PROVIDER=Other
  export RCLONE_CONFIG_SB_ENDPOINT="$SUPABASE_S3_ENDPOINT"
  export RCLONE_CONFIG_SB_REGION="${SUPABASE_S3_REGION:-us-east-1}"
  export RCLONE_CONFIG_SB_ACCESS_KEY_ID="$SUPABASE_S3_KEY"
  export RCLONE_CONFIG_SB_SECRET_ACCESS_KEY="$SUPABASE_S3_SECRET"
  for b in employee-documents proof-of-work avatars task-attachments chat-files; do
    echo "   - $b"
    rclone copy "SB:$b" "$OUT/storage/$b/" --transfers 8 || echo "     (skipped $b)"
  done
else
  echo "== 3/4 Storage backup skipped (SUPABASE_S3_* not set) =="
fi

echo "== 4/4 Google Drive =="
if rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
  DEST="${GDRIVE_DEST:-gdrive:HRMS-Backups}"
  echo "   uploading to $DEST/$STAMP"
  rclone copy "$OUT" "$DEST/$STAMP/"
  rclone delete "$DEST" --min-age "${RETAIN_DAYS:-30}d" --rmdirs || true
else
  echo "   gdrive remote not configured — backup kept as GitHub artifact only."
fi

echo "Backup $STAMP complete → $OUT"
