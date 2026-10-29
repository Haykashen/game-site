#!/usr/bin/env bash
set -Eeuo pipefail
app_dir=$(realpath -e -- "${1:?Installation directory}")
[[ "$app_dir" != / && -f "$app_dir/docker-compose.prod.yml" && -f "$app_dir/.env" ]]
exec 9>"$app_dir/.deploy/deploy.lock"
flock -n 9 || { echo 'Deployment is running'; exit 1; }
base=(docker compose --project-name discvault --project-directory "$app_dir" --env-file "$app_dir/.env" -f "$app_dir/docker-compose.prod.yml")
keep=$(docker inspect -f '{{.Image}}' $(docker ps -aq))
# Rollback tags are written as a matched pair before every deployment.
stamp=$(docker image ls discvault-api --format '{{.Tag}}' | sed -n '/^rollback-/p' | sort -r | head -n 1)
[[ "$stamp" =~ ^rollback-[0-9]{8}T[0-9]{6}Z-[a-f0-9]{12}$ ]] || { echo 'No verified rollback pair'; exit 1; }
for repo in discvault-api discvault-web; do
  id=$(docker image inspect -f '{{.Id}}' "$repo:$stamp")
  keep+=$'\n'"$id"
done
for service in api web db; do
  container=$("${base[@]}" ps -q "$service")
  [[ -n "$container" && "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container")"  =~ ^(healthy|running)$ ]]
done
df -h "$app_dir"
docker system df
echo "Keeping all container images and rollback pair: $stamp"
# Limit removal to application repositories; no volumes, backups or cache pruning.
for repo in discvault-api discvault-web; do
  while IFS= read -r reference; do
    [[ -n "$reference" ]] || continue
    id=$(docker image inspect -f '{{.Id}}' "$reference")
    if ! grep -Fxq "$id" <<< "$keep"; then docker image rm "$reference"; fi
  done < <(docker image ls "$repo" --format '{{.Repository}}:{{.Tag}}' | grep -v ':<none>$' | sort -u)
done
docker system df
df -h "$app_dir"