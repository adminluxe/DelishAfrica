#!/usr/bin/env bash
set -euo pipefail

die(){ echo "❌ $*" >&2; exit 1; }
ok(){ echo "✅ $*"; }
warn(){ echo "⚠️ $*"; }

need(){ command -v "$1" >/dev/null 2>&1 || die "Commande manquante: $1"; }

need node
need pnpm
need npx

# --- find monorepo root robustly
find_root() {
  local d="$PWD"
  while [[ "$d" != "/" ]]; do
    if [[ -d "$d/apps" && -f "$d/package.json" ]]; then
      echo "$d"; return 0
    fi
    d="$(dirname "$d")"
  done
  return 1
}

ROOT="$(find_root || true)"
[[ -n "${ROOT:-}" ]] || die "Monorepo root introuvable (attendu: .../monorepo avec apps/ + package.json)"
cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
OUT="$ROOT/.tonton_reports/scroll_rescue_$TS"
mkdir -p "$OUT"

echo "🧾 Output: $OUT"

# --- basic env snapshot
{
  echo "## ENV"
  echo "date: $(date -Is)"
  echo "pwd: $PWD"
  echo "node: $(node -v)"
  echo "pnpm: $(pnpm -v)"
  echo "npx: $(npx --version 2>/dev/null || true)"
  echo
  echo "## GIT"
  git rev-parse --short HEAD 2>/dev/null || true
  git status --porcelain 2>/dev/null || true
} > "$OUT/env.txt" || true
ok "env.txt"

# --- versions that matter (gesture stack)
{
  echo "## WORKSPACE TOP DEPS (selected)"
  pnpm -w ls expo expo-router react-native react-native-gesture-handler react-native-reanimated react-native-screens @react-navigation/native @react-navigation/stack --depth 8 || true
  echo
  echo "## WHY (selected)"
  pnpm -w why react-native-gesture-handler || true
  pnpm -w why react-native-screens || true
  pnpm -w why react-native-reanimated || true
} > "$OUT/deps.txt" || true
ok "deps.txt"

# --- expo-doctor per app
APPS=(client merchant courier)
for a in "${APPS[@]}"; do
  APPDIR="$ROOT/apps/$a"
  [[ -d "$APPDIR" ]] || { warn "skip $a (missing $APPDIR)"; continue; }

  (
    cd "$APPDIR"
    echo "== $a =="

    # expo config (json) snapshot
    npx expo config --json > "$OUT/${a}_expo_config.json" 2> "$OUT/${a}_expo_config.err" || true

    # expo-doctor verbose snapshot (can be noisy)
    if npx expo-doctor --version >/dev/null 2>&1; then
      npx expo-doctor --verbose > "$OUT/${a}_expo_doctor.txt" 2>&1 || true
    else
      # fallback older CLI
      npx expo doctor --verbose > "$OUT/${a}_expo_doctor.txt" 2>&1 || true
    fi
  ) || true

  ok "${a}_expo_config.json / ${a}_expo_doctor.txt"
done

# --- scan for gesture killers / overlays
SCAN_PATTERNS=(
  "PanResponder\.create"
  "onStartShouldSetResponder\s*:\s*\(\)\s*=>\s*true"
  "onMoveShouldSetResponder\s*:\s*\(\)\s*=>\s*true"
  "onStartShouldSetPanResponder\s*:\s*\(\)\s*=>\s*true"
  "onMoveShouldSetPanResponder\s*:\s*\(\)\s*=>\s*true"
  "pointerEvents\s*=\s*['\"]auto['\"]"
  "pointerEvents\s*=\s*['\"]box-only['\"]"
  "position\s*:\s*['\"]absolute['\"]"
  "<Modal\b"
  "createPortal|Portal"
  "BottomSheet|Sheet|GestureDetector|GestureHandlerRootView"
)

if command -v rg >/dev/null 2>&1; then
  for a in "${APPS[@]}"; do
    APPDIR="$ROOT/apps/$a"
    [[ -d "$APPDIR" ]] || continue
    {
      echo "## SCAN $a"
      for p in "${SCAN_PATTERNS[@]}"; do
        echo
        echo "-- pattern: $p"
        rg -n --hidden --glob '!**/node_modules/**' --glob '!**/.expo/**' --glob '!**/dist/**' "$p" "$APPDIR" || true
      done
    } > "$OUT/${a}_scan.txt" || true
    ok "${a}_scan.txt"
  done
else
  warn "rg non trouvé -> skip scan (installe ripgrep si possible)"
fi

cat > "$OUT/README.txt" <<EOF
scroll_rescue report
- env.txt: versions + git
- deps.txt: tree + why
- *_expo_doctor.txt: expo doctor outputs
- *_scan.txt: suspects (PanResponder, overlays, pointerEvents, modals)
EOF
ok "README.txt"

echo
echo "✅ Rapport prêt: $OUT"
echo "➡️ Envoie-moi en priorité:"
echo "   - $OUT/deps.txt"
echo "   - $OUT/client_expo_doctor.txt"
echo "   - $OUT/merchant_expo_doctor.txt"
echo "   - $OUT/courier_expo_doctor.txt"
echo "   - et le scan du app où le scroll est le plus KO: $OUT/*_scan.txt"
