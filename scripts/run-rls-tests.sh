#!/usr/bin/env bash
# Run RLS SQL tests against local Supabase (after `supabase db reset`).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v supabase >/dev/null 2>&1; then
  echo "supabase CLI not found"
  exit 1
fi

echo "Starting Supabase (if not running)..."
supabase start >/dev/null 2>&1 || true

PGURL="$(supabase status -o env 2>/dev/null | grep '^DB_URL=' | cut -d= -f2- | tr -d '"')"
if [[ -z "${PGURL}" ]]; then
  echo "Could not resolve DB_URL from supabase status"
  exit 1
fi

echo "Applying migrations..."
supabase db reset --local

echo "Running RLS tests..."
for f in supabase/tests/rls/*.sql; do
  echo "▶ $f"
  psql "$PGURL" -v ON_ERROR_STOP=1 -f "$f"
done

echo "RLS tests passed."
