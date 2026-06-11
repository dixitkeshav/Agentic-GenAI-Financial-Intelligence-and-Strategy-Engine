#!/usr/bin/env bash
# Sync Prisma schema on Vercel build when sharing Postgres with Django.
# Django owns django_* tables in public; Prisma migrate deploy fails with P3005
# on a non-empty DB. We baseline the init migration once, then deploy normally.
set -o errexit

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL not set — skipping Prisma DB sync"
  exit 0
fi

# Render Internal URLs (no domain) only work from Render services, not Vercel builds.
if [[ "${DATABASE_URL}" =~ @dpg-[^@/]+/ ]] && [[ ! "${DATABASE_URL}" =~ render\.com ]]; then
  echo "WARNING: DATABASE_URL looks like Render Internal URL (not reachable from Vercel)." >&2
  echo "Use Render Postgres → Connections → External Database URL + ?sslmode=require" >&2
  if [ "${PRISMA_REQUIRE_DB_SYNC:-}" = "true" ]; then
    exit 1
  fi
  echo "Skipping Prisma DB sync (set PRISMA_REQUIRE_DB_SYNC=true to fail builds instead)"
  exit 0
fi

if [[ ! "${DATABASE_URL}" =~ sslmode= ]]; then
  echo "WARNING: DATABASE_URL missing sslmode=require (required for Render external Postgres)" >&2
fi

MIGRATION_NAME="20260507000000_init_edge"
MIGRATION_SQL="prisma/migrations/${MIGRATION_NAME}/migration.sql"
ERR_FILE="$(mktemp)"
trap 'rm -f "$ERR_FILE"' EXIT

MAX_ATTEMPTS="${PRISMA_CONNECT_RETRIES:-5}"
RETRY_DELAY="${PRISMA_CONNECT_RETRY_DELAY:-15}"

run_migrate_deploy() {
  : >"$ERR_FILE"
  if npx prisma migrate deploy 2>"$ERR_FILE"; then
    return 0
  fi
  return 1
}

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  if run_migrate_deploy; then
    echo "Prisma migrations applied"
    exit 0
  fi

  if grep -q "P1001" "$ERR_FILE"; then
    echo "Prisma P1001 (database unreachable), attempt ${attempt}/${MAX_ATTEMPTS}…" >&2
    if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
      sleep "$RETRY_DELAY"
      attempt=$((attempt + 1))
      continue
    fi

    cat "$ERR_FILE" >&2
    echo "" >&2
    echo "Render Postgres unreachable from Vercel after ${MAX_ATTEMPTS} attempts." >&2
    echo "Check: Postgres is active (free tier expires after 90d idle), External URL, sslmode=require." >&2

    if [ "${PRISMA_REQUIRE_DB_SYNC:-}" = "true" ]; then
      exit 1
    fi

    echo "Skipping Prisma DB sync so the frontend build can continue (tables should already exist)."
    exit 0
  fi

  break
done

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
