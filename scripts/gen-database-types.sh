#!/usr/bin/env bash
# Regenerate src/types/database.ts from local Supabase schema.
# Requires: supabase CLI, Docker, `supabase start` / `supabase db reset --local`
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

supabase db reset --local
supabase gen types typescript --local > src/types/database.generated.ts

echo "Generated src/types/database.generated.ts"
echo "Merge into database.ts or replace after review."
