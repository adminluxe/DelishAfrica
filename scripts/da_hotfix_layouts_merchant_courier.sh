#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/.tonton_backups/layout_hotfix_$TS"
mkdir -p "$BK"

log(){ echo -e "\n🧡 $*\n"; }

need(){
  command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }
}

need find
need grep
need sed

cd "$ROOT"

log "Backup dir: $BK"

# Cibles : layouts sous app/**/_layout.tsx pour merchant + courier
TARGETS=()
while IFS= read -r f; do TARGETS+=("$f"); done < <(find "$ROOT/apps/merchant" "$ROOT/apps/courier" -path "*/app/*" -name "_layout.tsx" -type f 2>/dev/null || true)

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "❌ Aucun _layout.tsx trouvé sous apps/merchant ou apps/courier."
  echo "   Vérifie que tes apps sont bien dans /opt/delishafrica/monorepo/apps/{merchant,courier}/app"
  exit 1
fi

log "Layouts trouvés:"
printf '%s\n' "${TARGETS[@]}"

# Patch : layout minimal sûr
patch_layout(){
  local f="$1"
  local rel="${f#$ROOT/}"
  local dest="$BK/${rel//\//__}"
  cp -a "$f" "$dest"

  # Génère un layout safe (Stack + fond)
  cat > "$f" <<'TSX'
import { Stack } from "expo-router";
import { View } from "react-native";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#070A10" },
        }}
      />
    </View>
  );
}
TSX
}

# Détection “mauvais patterns” (Stack.Screen index, Tabs imbriqués, etc.)
bad_patterns_report(){
  local f="$1"
  echo "---- $f ----"
  grep -nE 'Stack\.Screen|Tabs\.Screen|name=["'\'']index["'\'']|headerShown|GestureHandlerRootView|SafeAreaProvider' "$f" || true
}

log "Audit rapide (avant patch) — patterns suspects:"
for f in "${TARGETS[@]}"; do bad_patterns_report "$f"; done

log "Applying HOTFIX layouts (backup automatique)..."
for f in "${TARGETS[@]}"; do patch_layout "$f"; done

log "✅ HOTFIX appliqué."
log "Backups stockés dans: $BK"

cat <<EOF

✅ Étape suivante (important) :
1) STOP Metro sur merchant + courier (CTRL+C dans tmux)
2) RELANCE AVEC CLEAR CACHE (ex):
   cd $ROOT/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear
   cd $ROOT/apps/courier  && pnpm dev -- --tunnel --port 8082 --clear

🔁 Rollback (si besoin) :
   ls -1 "$BK"
   (tu copies le backup correspondant vers le fichier original)

EOF
