#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

# Only transport archives are disposable. Never prune backups, images or volumes.
app_dir=$(realpath -e -- "${1:?Installation directory is required}")
clean=${2:-false}
[[ "$clean" == true || "$clean" == false ]] || exit 1
[[ "$app_dir" != / && -f "$app_dir/.env" && -f "$app_dir/docker-compose.prod.yml" ]] || {
  echo 'Expected an existing DiscVault installation.' >&2; exit 1;
}
incoming=$(realpath -e -- "$app_dir/.deploy/incoming")
[[ "$incoming" == "$app_dir/.deploy/incoming" ]] || { echo 'Unexpected incoming directory.' >&2; exit 1; }
if [[ "$clean" == true ]]; then
  exec 9>"$app_dir/.deploy/deploy.lock"
  flock -n 9 || { echo 'Another deployment is running.' >&2; exit 1; }
fi

df -h -- "$app_dir"
du -sh -- "$incoming" "$app_dir/.deploy/backups"
docker system df
current=$(cat "$app_dir/.deploy/current-revision")
[[ "$current" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid live revision.' >&2; exit 1; }
latest=$(find "$incoming" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %f\n' | sort -nr | sed -n '1s/^[^ ]* //p')
bytes=0
files=0
while IFS= read -r -d '' directory; do
  name=$(basename -- "$directory")
  [[ "$name" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ ]] || continue
  [[ "$name" != "$latest" && "$name" != "$current"-* ]] || continue
  [[ ! -L "$directory" && "$(realpath -e -- "$directory")" == "$incoming/$name" ]] || continue
  for filename in release.tar.gz release.tar.gz.sha256 images.tar.gz; do
    archive="$directory/$filename"
    [[ -f "$archive" && ! -L "$archive" ]] || continue
    [[ "$(realpath -e -- "$archive")" == "$incoming/$name/$filename" ]] || exit 1
    size=$(stat -c %s -- "$archive")
    [[ "$size" =~ ^[0-9]+$ ]] || exit 1
    bytes=$((bytes + size))
    files=$((files + 1))
    if [[ "$clean" == true ]]; then rm -- "$archive"; fi
  done
done < <(find "$incoming" -mindepth 1 -maxdepth 1 -type d -print0)
printf 'Transport archives: files=%s bytes=%s cleaned=%s\n' "$files" "$bytes" "$clean"
df -h -- "$app_dir"
