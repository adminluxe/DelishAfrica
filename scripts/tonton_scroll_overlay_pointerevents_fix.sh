#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BKP="$ROOT/.tonton_backups/scroll_overlay_pe_$NOW"
LOG="$BKP/run.log"
mkdir -p "$BKP"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$LOG"; }

cd "$ROOT"

log "1) Collecte candidats (Background/Overlay/Snow/TouchTrace + absoluteFill/absolute)"
if command -v rg >/dev/null 2>&1; then
  candidates="$(rg -l -S "(Background|Overlay|Snow|TouchTrace)" apps packages services 2>/dev/null || true)"
else
  candidates="$(grep -RIlE "(Background|Overlay|Snow|TouchTrace)" apps packages services 2>/dev/null || true)"
fi

if [[ -z "${candidates:-}" ]]; then
  log "Aucun candidat trouvé. STOP."
  exit 0
fi

# filtre ceux qui contiennent des marqueurs d'overlay (absoluteFill / position absolute)
overlay_files=""
while IFS= read -r f; do
  [[ -f "$f" ]] || continue
  if grep -Eq "absoluteFill|absoluteFillObject|position[[:space:]]*:[[:space:]]*[^,}]*absolute" "$f"; then
    overlay_files+="$f"$'\n'
  fi
done <<< "$candidates"

if [[ -z "${overlay_files:-}" ]]; then
  log "Candidats trouvés, mais aucun ne contient absoluteFill/position:absolute. STOP."
  exit 0
fi

log "2) Patch: inject pointerEvents=\"none\" sur tags overlay (View/Animated.View/LinearGradient/BlurView/ImageBackground/Svg)"
patched=0
while IFS= read -r f; do
  [[ -f "$f" ]] || continue

  mkdir -p "$BKP/$(dirname "$f")"
  cp -a "$f" "$BKP/$f"

  before_hash="$(sha1sum "$f" | awk '{print $1}')"

  # Injection uniquement si le tag (opening) contient absoluteFill/position:absolute dans ses attributs
  perl -0777 -i -pe '
s/<(View|Animated\.View|LinearGradient|BlurView|ImageBackground|Svg)\b
  (?![^>]*\bpointerEvents=)
  (?=[^>]*(?:absoluteFill|absoluteFillObject|position\s*:\s*[^,}\n]*absolute))
/<$1 pointerEvents="none"/gx;
' "$f"

  after_hash="$(sha1sum "$f" | awk '{print $1}')"
  if [[ "$before_hash" != "$after_hash" ]]; then
    patched=$((patched+1))
    log "patched: $f"
  else
    # restore backup if no change to avoid noisy backups
    cp -a "$BKP/$f" "$f"
    rm -f "$BKP/$f" || true
  fi
done <<< "$overlay_files"

log "DONE patched_files=$patched"
log "Backups: $BKP"
log "Log: $LOG"

if grep -RIn --exclude-dir node_modules -E "TouchTrace" apps packages services 2>/dev/null | head -n 1 | grep -q .; then
  log "WARN: TouchTrace détecté dans le code. Si scroll toujours KO, on le désactive/retire ensuite."
fi
