#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
app_dir=$(realpath -e -- "${1:?Installation directory}")
[[ "$app_dir" != / && -f "$app_dir/.env" && -f "$app_dir/docker-compose.prod.yml" ]]
IFS= read -r key
[[ -n "$key" && "$key" =~ ^[A-Za-z0-9_-]+$ ]] || exit 1
temporary=$(mktemp "$app_dir/.env.recognition.XXXXXX")
trap 'rm -f -- "$temporary"' EXIT
awk '!/^GEMINI_API_KEY=/' "$app_dir/.env" > "$temporary"
printf '\nGEMINI_API_KEY=%s\n' "$key" >> "$temporary"
chmod 600 "$temporary"
mv -- "$temporary" "$app_dir/.env"
unset key
echo 'Recognition API key configured.'