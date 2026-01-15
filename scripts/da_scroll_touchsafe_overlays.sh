#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=(client courier merchant)
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/touchsafe_overlays_$TS"
REPORT="$ROOT/.tonton_backups/_reports/touchsafe_overlays_$TS.txt"

log()  { printf "\n\033[1;32m[DA]\033[0m %s\n" "$*"; }
warn() { printf "\n\033[1;33m[DA WARN]\033[0m %s\n" "$*"; }

mkdir -p "$BK" "$(dirname "$REPORT")"
: > "$REPORT"

backup_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

kill_ports() {
  local ports=(8081 8082 8083 19000 19001 19002 19006 19007 4040 4049)
  for p in "${ports[@]}"; do
    if lsof -tiTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
      log "Kill port $p"
      lsof -tiTCP:"$p" -sTCP:LISTEN | xargs -r kill -9 || true
    fi
  done
  pkill -f "expo start" || true
  pkill -f "expo-dev-server" || true
  pkill -f "metro" || true
  pkill -f "ngrok" || true
  pkill -f "@expo/ngrok" || true
}

collect_tsx_files() {
  local base="$1"
  local dirs=("$base/app" "$base/components" "$base/ui" "$base/src")
  local files=()
  for d in "${dirs[@]}"; do
    [[ -d "$d" ]] || continue
    while IFS= read -r f; do files+=("$f"); done < <(find "$d" -type f -name "*.tsx" 2>/dev/null)
  done
  printf "%s\n" "${files[@]}"
}

patch_overlays_pointerevents() {
  local f="$1"

  # patch uniquement si un overlay "suspect" est présent
  if ! grep -qE "<(BlurView|LinearGradient|ImageBackground|Svg|SvgXml|LottieView|Canvas|Skia|SkiaView)\b" "$f" 2>/dev/null; then
    return 0
  fi

  backup_file "$f"

  perl -0777 -i -pe '
    my $T = qr/(BlurView|LinearGradient|ImageBackground|Svg|SvgXml|LottieView|Canvas|Skia|SkiaView)/;

    # 1) StyleSheet.absoluteFill* => pointerEvents="none" si absent
    s/<$T
      (?![^>]*\bpointerEvents=)
      ([^>]*\bStyleSheet\.(?:absoluteFill|absoluteFillObject)\b[^>]*?)
    >/<$1 pointerEvents="none"$2>/gxms;

    # 2) inline absolute fullscreen (order-agnostic via lookaheads)
    s/<$T
      (?![^>]*\bpointerEvents=)
      (?=[^>]*position:\s*["'\'']absolute["'\''])
      (?=[^>]*\btop:\s*0)
      (?=[^>]*\bleft:\s*0)
      (?=[^>]*\bright:\s*0)
      (?=[^>]*\bbottom:\s*0)
    /<$1 pointerEvents="none"/gxms;
  ' "$f"
}

log "ROOT: $ROOT"
log "BACKUP: $BK"
log "REPORT: $REPORT"

kill_ports

for app in "${APPS[@]}"; do
  base="$ROOT/apps/$app"
  [[ -d "$base" ]] || { warn "App absente: $app"; continue; }

  log "$app: scanning overlays (BlurView/LinearGradient/ImageBackground/Svg...)"
  patched=0

  while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    before="$(cksum "$f" | awk '{print $1}' || true)"
    patch_overlays_pointerevents "$f"
    after="$(cksum "$f" | awk '{print $1}' || true)"
    if [[ -n "$before" && -n "$after" && "$before" != "$after" ]]; then
      patched=$((patched+1))
      echo "patched: ${f#"$ROOT"/}" >> "$REPORT"
    fi
  done < <(collect_tsx_files "$base" || true)

  log "$app: patched_files=$patched"
done

log "✅ TouchSafe overlays applied."
cat <<EOF

👉 Relance Expo (IMPORTANT: --clear):

# CLIENT
cd $ROOT/apps/client   && pnpm exec expo start --dev-client --tunnel --clear --port 8081
# COURIER
cd $ROOT/apps/courier  && pnpm exec expo start --dev-client --tunnel --clear --port 8082
# MERCHANT
cd $ROOT/apps/merchant && pnpm exec expo start --dev-client --tunnel --clear --port 8083

Report:
$REPORT
Backups:
$BK
EOF
