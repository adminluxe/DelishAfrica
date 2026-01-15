#!/usr/bin/env bash
set -euo pipefail

echo "== Containers exposing 3010 =="
mapfile -t rows < <(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' | grep -E '(:|->)3010' || true)

if [[ ${#rows[@]} -eq 0 ]]; then
  echo "No running container publishes 3010."
  echo
  echo "Fallback search in /opt/delishafrica for compose files containing 3010 mapping..."
  find /opt/delishafrica -maxdepth 6 -type f \( -name 'docker-compose*.yml' -o -name 'compose*.yml' \) 2>/dev/null \
    -print0 | xargs -0 -r grep -nH -E '(^|[[:space:]]|")3010:3010|127\.0\.0\.1:3010:3010' || true
  exit 0
fi

printf '%s\n' "${rows[@]}"
echo

for line in "${rows[@]}"; do
  CID="$(awk '{print $1}' <<<"$line")"
  NAME="$(awk '{print $2}' <<<"$line")"
  echo "== Inspect: $NAME ($CID) =="

  PROJECT="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$CID" 2>/dev/null || true)"
  WDIR="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.working_dir" }}' "$CID" 2>/dev/null || true)"
  CFGS="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.project.config_files" }}' "$CID" 2>/dev/null || true)"
  SVC="$(docker inspect -f '{{ index .Config.Labels "com.docker.compose.service" }}' "$CID" 2>/dev/null || true)"

  echo "project     : ${PROJECT:-<none>}"
  echo "service     : ${SVC:-<none>}"
  echo "working_dir : ${WDIR:-<none>}"
  echo "config_files: ${CFGS:-<none>}"
  echo

  if [[ -n "${CFGS:-}" ]]; then
    IFS=',' read -r -a files <<<"$CFGS"
    for f in "${files[@]}"; do
      f="$(echo "$f" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
      if [[ -f "$f" ]]; then
        echo "-- hits in $f"
        grep -nH -E '(^|[[:space:]]|")3010:3010|127\.0\.0\.1:3010:3010' "$f" || true
        echo
      else
        echo "-- config file not found on disk: $f"
        echo
      fi
    done
  fi
done

echo "== Extra fallback grep in /opt/delishafrica (compose files) =="
find /opt/delishafrica -maxdepth 6 -type f \( -name 'docker-compose*.yml' -o -name 'compose*.yml' \) 2>/dev/null \
  -print0 | xargs -0 -r grep -nH -E '(^|[[:space:]]|")3010:3010|127\.0\.0\.1:3010:3010' || true
