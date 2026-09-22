#!/usr/bin/env bash
# Nuvora — daily encrypted PostgreSQL backup
# Required env vars: DATABASE_URL, BACKUP_BUCKET, BACKUP_ENCRYPTION_KEY
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${BACKUP_ENCRYPTION_KEY:?BACKUP_ENCRYPTION_KEY is required}"

DATE=$(date +%Y-%m-%d)
TMPFILE=$(mktemp /tmp/nuvora_backup_XXXXXX.pgdump)
ENCFILE="${TMPFILE}.enc"
REMOTE_KEY="backups/${DATE}/nuvora_${DATE}.pgdump.enc"

cleanup() { rm -f "$TMPFILE" "$ENCFILE"; }
trap cleanup EXIT

echo "[backup] dumping database..."
pg_dump --format=custom "$DATABASE_URL" -f "$TMPFILE"

SIZE=$(wc -c < "$TMPFILE")
if [ "$SIZE" -eq 0 ]; then
  echo "[backup] ERROR: dump file is empty" >&2
  exit 1
fi

echo "[backup] encrypting (${SIZE} bytes)..."
openssl enc -aes-256-cbc -pbkdf2 \
  -pass "pass:${BACKUP_ENCRYPTION_KEY}" \
  -in "$TMPFILE" -out "$ENCFILE"

echo "[backup] uploading to ${BACKUP_BUCKET}/${REMOTE_KEY}..."
# Supports s3:// via AWS CLI or minio alias
if command -v aws &>/dev/null; then
  aws s3 cp "$ENCFILE" "${BACKUP_BUCKET}/${REMOTE_KEY}"
elif command -v mc &>/dev/null; then
  mc cp "$ENCFILE" "${BACKUP_BUCKET}/${REMOTE_KEY}"
else
  echo "[backup] ERROR: no upload client found (aws or mc)" >&2
  exit 1
fi

echo "[backup] done: ${REMOTE_KEY}"
