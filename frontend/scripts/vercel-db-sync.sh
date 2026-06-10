#!/usr/bin/env bash
# Sync Prisma schema on Vercel build when sharing Postgres with Django.
# Django owns django_* tables in public; Prisma migrate deploy fails with P3005
# on a non-empty DB. We baseline the init migration once, then deploy normally.
set -o errexit

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set — skipping Prisma DB sync"
  exit 0
fi

MIGRATION_NAME="20260507000000_init_edge"
MIGRATION_SQL="prisma/migrations/${MIGRATION_NAME}/migration.sql"
ERR_FILE="$(mktemp)"
trap 'rm -f "$ERR_FILE"' EXIT

if npx prisma migrate deploy 2>"$ERR_FILE"; then
  echo "Prisma migrations applied"
  exit 0
fi

if ! grep -q "P3005" "$ERR_FILE"; then
  cat "$ERR_FILE" >&2
  exit 1
fi

echo "Shared Postgres detected (Django tables present) — baselining Prisma…"

# Tables may already exist (e.g. prior db push); only run SQL when missing.
TABLE_EXISTS="$(
  npx prisma db execute --stdin --schema prisma/schema.prisma <<'SQL' 2>/dev/null || true
SELECT 1 FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'OHLCVCandle'
LIMIT 1;
SQL
)"

if [ -z "$TABLE_EXISTS" ]; then
  if [ ! -f "$MIGRATION_SQL" ]; then
    echo "Missing $MIGRATION_SQL" >&2
    exit 1
  fi
  npx prisma db execute --file "$MIGRATION_SQL" --schema prisma/schema.prisma
else
  echo "Prisma tables already present — marking migration as applied"
fi

npx prisma migrate resolve --applied "$MIGRATION_NAME"
npx prisma migrate deploy

echo "Prisma baseline complete"
