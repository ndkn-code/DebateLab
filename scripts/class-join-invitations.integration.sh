#!/usr/bin/env bash
set -euo pipefail

class_id=${CLASS_JOIN_CLASS_ID:-20000000-0000-0000-0000-000000000001}
manager_id=${CLASS_JOIN_MANAGER_ID:-00000000-0000-0000-0000-000000000001}
student_id=${CLASS_JOIN_STUDENT_ID:-00000000-0000-0000-0000-000000000002}

postgres_bin=${POSTGRES_BIN:-/opt/homebrew/opt/postgresql@15/bin/postgres}
if [[ "$postgres_bin" == */* ]]; then
  postgres_dir=${postgres_bin%/*}
else
  postgres_dir=$(dirname "$(command -v "$postgres_bin")")
fi
initdb=${INITDB_BIN:-$postgres_dir/initdb}
pg_ctl=${PG_CTL_BIN:-$postgres_dir/pg_ctl}
psql_bin=${PSQL_BIN:-$postgres_dir/psql}
for required_bin in "$initdb" "$pg_ctl" "$psql_bin"; do
  if [[ ! -x "$required_bin" ]]; then
    echo "ERROR: required PostgreSQL binary is missing: $required_bin" >&2
    exit 2
  fi
done

export PGOPTIONS="${PGOPTIONS:-} -c app.class_join_harness=1"
cluster_dir=$(mktemp -d "${TMPDIR:-/tmp}/thinkfy-class-join.XXXXXX")
cleanup() { "$pg_ctl" -D "$cluster_dir" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$cluster_dir"; }
trap cleanup EXIT
"$initdb" -D "$cluster_dir" -A trust >/dev/null
"$pg_ctl" -D "$cluster_dir" -o "-p 55481 -k /tmp" -w start >/dev/null
local_url="postgresql://localhost:55481/postgres"
"$psql_bin" "$local_url" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/class-join-bootstrap.sql" >/dev/null
python3 "$(dirname "$0")/class-join-source-fixture.py" > "$cluster_dir/authorization.sql"
"$psql_bin" "$local_url" -v ON_ERROR_STOP=1 -f "$cluster_dir/authorization.sql" >/dev/null
"$psql_bin" "$local_url" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/../supabase/migrations/20260905150000_class_join_invitations.sql" >/dev/null
"$psql_bin" "$local_url" \
  -v class_id="$class_id" \
  -v manager_id="$manager_id" \
  -v student_id="$student_id" \
  -f "$(dirname "$0")/class-join-invitations.integration.sql"

"$psql_bin" "$local_url" -v ON_ERROR_STOP=1 -f "$(dirname "$0")/class-join-security.integration.sql"
node "$(dirname "$0")/class-join-races.mjs" "$psql_bin" "$local_url"
