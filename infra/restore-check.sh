#!/bin/sh
set -eu
: "${1:?Pass a backup dump path inside the postgres container}"
test_db="popin_restore_test"
createdb -U "$POSTGRES_USER" "$test_db"
trap 'dropdb -U "$POSTGRES_USER" "$test_db"' EXIT
pg_restore --exit-on-error -U "$POSTGRES_USER" -d "$test_db" "$1"
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$test_db" -c 'SELECT count(*) FROM "User"; SELECT count(*) FROM "Setting";'
