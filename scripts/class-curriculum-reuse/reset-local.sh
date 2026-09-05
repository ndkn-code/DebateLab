#!/bin/sh
# Explicitly destructive ONLY to this task's disposable local fixture database.
set -eu
PG_BIN="${REUSE_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
REPO_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
cd "$REPO_ROOT"
"$PG_BIN/dropdb" -h /tmp -p 5432 --if-exists thinkfy_reuse_571d
"$PG_BIN/createdb" -h /tmp -p 5432 thinkfy_reuse_571d
"$PG_BIN/psql" -h /tmp -p 5432 -X -q -v ON_ERROR_STOP=1 -d thinkfy_reuse_571d \
  -f scripts/class-curriculum-reuse/schema.sql \
  -f supabase/migrations/20260905200000_class_curriculum_reuse.sql \
  -f scripts/class-curriculum-reuse/fixture.sql
node --test scripts/class-curriculum-reuse/behavior.test.mjs
