#!/bin/sh
set -eu
# Run from the checkout root on the deployment host. Use an immutable image tag.
: "${APP_IMAGE:?Set APP_IMAGE to the release image}"
compose() { docker compose -p popin-lms-prod --env-file .env -f infra/docker-compose.prod.yml "$@"; }
previous=$(cat .previous-release 2>/dev/null || true)
previous_format=$(cat .previous-storage-format 2>/dev/null || true)
compose pull web worker migrate
compose up -d postgres
stamp=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p infra/backups
compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "infra/backups/pre-release-$stamp.dump"
compose run --rm migrate
if compose up -d --wait web worker proxy backup monitor; then
  printf '%s\n' "$APP_IMAGE" > .previous-release
  printf '%s\n' 'records-v1' > .previous-storage-format
else
  if [ -n "$previous" ] && [ "$previous_format" = 'records-v1' ]; then APP_IMAGE="$previous" compose up -d --wait web worker; fi
  echo 'Release failed. Review logs; database migrations were retained.' >&2
  exit 1
fi
