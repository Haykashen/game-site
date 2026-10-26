#!/usr/bin/env bash
# Fake Docker executable for deployment recovery tests. Never calls a daemon.
set -eu
printf '%s\n' "$*" >> "$MOCK_LOG"
for argument; do last="$argument"; done
if [[ "$*" == *check-migrations.mjs* ]]; then
  if [[ "$MOCK_SCENARIO" == pending || "$MOCK_SCENARIO" == migration-failure ]]; then exit 2; fi
  exit 0
fi
if [[ "$*" == *'npx prisma migrate deploy'* ]]; then exit 1; fi
if [[ "$*" == *' ps -q '* ]]; then echo "$last-id"; exit 0; fi
if [[ "$1" == inspect ]]; then
  if [[ "$*" == *Health.Status* ]]; then echo healthy; else echo "$last-image"; fi
  exit 0
fi
if [[ "$1 $2" == 'image inspect' ]]; then echo "$MOCK_REVISION"; exit 0; fi
if [[ "$1 $2" == 'image load' ]]; then cat >/dev/null; exit 0; fi
if [[ "$1" == info ]]; then echo /tmp; exit 0; fi
if [[ "$*" == *pg_database_size* ]]; then echo 100; exit 0; fi
if [[ "$*" == *'--entrypoint du'* ]]; then echo '1 /data/uploads'; exit 0; fi
if [[ "$*" == *pg_dump* ]]; then
  if [[ "$MOCK_SCENARIO" == backup-failure ]]; then exit 1; fi
  echo 'fake dump'; exit 0
fi
if [[ "$*" == *pg_restore* ]]; then cat >/dev/null; exit 0; fi
if [[ "$*" == *'--entrypoint tar'* ]]; then printf 'fake photos' | gzip; exit 0; fi
if [[ "$*" == *process.env.PUBLIC_API_URL* ]]; then echo https://example.test; exit 0; fi
if [[ "$1" == exec && "$*" == *'node -e'* ]]; then cat >/dev/null; exit 0; fi
exit 0
