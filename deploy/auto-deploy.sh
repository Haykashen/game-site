#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Updates an EXISTING discvault Compose installation. Never initializes or seeds it.
app_dir=$(realpath -e -- "${1:?Usage: auto-deploy.sh APP_DIR COMMIT_SHA [true|false]}")
revision=${2:?Commit SHA is required}
allow_migrations=${3:-false}
[[ "$revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit SHA.' >&2; exit 1; }
[[ "$allow_migrations" == true || "$allow_migrations" == false ]] || exit 1
[[ "$app_dir" != / && -f "$app_dir/.env" && -f "$app_dir/docker-compose.prod.yml" ]] || {
  echo 'Expected an existing installation with .env and docker-compose.prod.yml.' >&2; exit 1;
}
release_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
[[ "$(cat "$release_dir/revision")" == "$revision" ]] || { echo 'Release mismatch.' >&2; exit 1; }
for command in docker flock gzip tar curl df stat awk; do command -v "$command" >/dev/null; done
mkdir -p "$app_dir/.deploy/backups"
chmod 700 "$app_dir/.deploy" "$app_dir/.deploy/backups"
exec 9>"$app_dir/.deploy/deploy.lock"
flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }

base=(docker compose --project-name discvault --project-directory "$app_dir" --env-file "$app_dir/.env" -f "$app_dir/docker-compose.prod.yml")
"${base[@]}" config --quiet
db_id=$("${base[@]}" ps -q db)
api_id=$("${base[@]}" ps -q api)
web_id=$("${base[@]}" ps -q web)
[[ -n "$db_id" && -n "$api_id" && -n "$web_id" ]] || {
  echo 'All three existing services (db/api/web) must be running.' >&2; exit 1;
}
[[ "$(docker inspect -f '{{.State.Health.Status}}' "$db_id")" == healthy ]] || exit 1
old_api=$(docker inspect -f '{{.Image}}' "$api_id")
old_web=$(docker inspect -f '{{.Image}}' "$web_id")

# Keep space for images, uncompressed DB/files backups and operating headroom.
db_bytes=$(docker exec "$db_id" sh -ec 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc "SELECT pg_database_size(current_database())"')
uploads_kb=$(docker run --rm --network none --volumes-from "$api_id:ro" --entrypoint du "$old_api" -sk /data/uploads | awk '{print $1}')
archive_bytes=$(stat -c %s "$release_dir/images.tar.gz")
[[ "$db_bytes" =~ ^[0-9]+$ && "$uploads_kb" =~ ^[0-9]+$ ]] || exit 1
required_bytes=$((db_bytes * 2 + uploads_kb * 2048 + archive_bytes * 4 + 1073741824))
docker_root=$(docker info -f '{{.DockerRootDir}}')
for directory in "$app_dir" "$docker_root"; do
  free_bytes=$(df -PB1 -- "$directory" | awk 'NR==2 { print $4 }')
  [[ "$free_bytes" =~ ^[0-9]+$ ]] && (( free_bytes > required_bytes )) || {
    echo 'Insufficient free space for release images, backups and safety headroom.' >&2; exit 1;
  }
done
stamp=$(date -u +%Y%m%dT%H%M%SZ)-${revision:0:12}
backup="$app_dir/.deploy/backups/$stamp"
mkdir "$backup"

# Tag the actual running images, not a possibly moved latest tag.
docker image tag "$old_api" "discvault-api:rollback-$stamp"
docker image tag "$old_web" "discvault-web:rollback-$stamp"
cat >"$backup/rollback.yml" <<EOF
services:
  api:
    image: discvault-api:rollback-$stamp
    command: ["node", "dist/server.js"]
  web:
    image: discvault-web:rollback-$stamp
EOF
rollback=("${base[@]}" -f "$backup/rollback.yml")
cat >"$release_dir/images.yml" <<EOF
services:
  api:
    image: discvault-api:$revision
    command: ["node", "dist/server.js"]
  web:
    image: discvault-web:$revision
EOF
next=("${base[@]}" -f "$release_dir/images.yml")
"${next[@]}" config --quiet
gzip -t "$release_dir/images.tar.gz"
gzip -dc "$release_dir/images.tar.gz" | docker image load >/dev/null
for image in "discvault-api:$revision" "discvault-web:$revision"; do
  [[ "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")" == "$revision" ]] || {
    echo 'Image revision mismatch.' >&2; exit 1;
  }
done

check_migrations() {
  "${next[@]}" run --rm --no-deps -T --pull never -v "$release_dir:/deployment:ro" api node /deployment/check-migrations.mjs
}
migration_status=0
check_migrations || migration_status=$?
case "$migration_status" in
  0) ;;
  2) [[ "$allow_migrations" == true ]] || {
    echo 'New migrations require a reviewed manual workflow run with apply_migrations=true. Live services were not stopped.' >&2
    exit 1
  } ;;
  *) echo 'Migration verification failed. Live services were not stopped.' >&2; exit 1 ;;
esac

stopped=false
schema_touched=false
switched=false
recover() {
  local code=${1:-$?}
  trap - ERR HUP INT TERM
  set +e
  echo "Deployment failed. Recovery files: $backup" >&2
  if [[ "$schema_touched" == true ]]; then
    # Never restore a DB automatically: it could erase accepted writes or conceal
    # a partially applied migration. A human must inspect the migration journal.
    "${next[@]}" stop api
    echo 'Schema change was attempted. API is stopped; inspect migrations before recovery. DB and uploads backups are retained.' >&2
  elif [[ "$switched" == true ]]; then
    "${rollback[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 api web
    echo 'Attempted rollback to the previous images; verify public health.' >&2
  elif [[ "$stopped" == true ]]; then
    docker start "$api_id" >/dev/null
    echo 'Previous API restarted.' >&2
  fi
  exit "$code"
}
trap recover ERR
trap 'recover 130' INT
trap 'recover 143' HUP TERM

# Freeze application writes and the auction worker for a consistent DB/files pair.
# Database and Caddy remain running. Expect a short API maintenance window.
stopped=true
"${base[@]}" stop -t 30 api
docker exec "$db_id" sh -ec 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$backup/database.dump.tmp"
test -s "$backup/database.dump.tmp"
docker exec -i "$db_id" pg_restore --list <"$backup/database.dump.tmp" >/dev/null
mv "$backup/database.dump.tmp" "$backup/database.dump"
docker run --rm --network none --volumes-from "$api_id:ro" --entrypoint tar "$old_api" -czf - -C /data/uploads . >"$backup/uploads.tar.gz.tmp"
gzip -t "$backup/uploads.tar.gz.tmp"
mv "$backup/uploads.tar.gz.tmp" "$backup/uploads.tar.gz"
printf '%s\n' "$revision" >"$backup/target-revision"

# Recheck after writes stopped; external/manual migrations must not race deploys.
migration_status=0
check_migrations || migration_status=$?
if [[ "$migration_status" == 2 && "$allow_migrations" == true ]]; then
  schema_touched=true
  "${next[@]}" run --rm --no-deps -T --pull never api npx prisma migrate deploy
  check_migrations
elif [[ "$migration_status" != 0 ]]; then
  echo 'Migration state changed during backup. Update aborted.' >&2
  false
fi

switched=true
"${next[@]}" up -d --no-deps --no-build --pull never --wait --wait-timeout 180 api web
next_api=$("${next[@]}" ps -q api)
public_url=$(docker exec "$next_api" node -p 'process.env.PUBLIC_API_URL')
[[ "$public_url" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?/?$ ]] || { echo 'Expected a public HTTPS origin.' >&2; false; }
curl --fail --silent --show-error --max-time 20 --retry 4 --retry-delay 3 "${public_url%/}/api/health" >"$backup/health.json"
docker exec -i "$next_api" node -e '
let data=""; process.stdin.on("data", c => data += c); process.stdin.on("end", () => {
  try { const h=JSON.parse(data); process.exit(h.status === "ok" && h.database === "up" ? 0 : 1); }
  catch { process.exit(1); }
});' <"$backup/health.json"
curl --fail --silent --show-error --max-time 20 "${public_url%/}/" >/dev/null
printf '%s\n' "$revision" >"$app_dir/.deploy/current-revision.tmp"
mv "$app_dir/.deploy/current-revision.tmp" "$app_dir/.deploy/current-revision"
trap - ERR HUP INT TERM
echo "Deployed $revision. Backups: $backup"
# No volume deletion, seed, automatic database restore, or image/backup pruning.
