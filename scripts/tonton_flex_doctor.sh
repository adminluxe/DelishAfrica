#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/flex_doctor_${TS}"
RP="$ROOT/.tonton_reports/flex_doctor_${TS}.log"

mkdir -p "$BK" "$(dirname "$RP")"
exec > >(tee "$RP") 2>&1

echo "🩺 TONTON FLEX DOCTOR (bounded height / flex chain)"
echo "Root:   $ROOT"
echo "Backup: $BK"
echo "Report: $RP"
echo

cd "$ROOT"

if ! command -v rg >/dev/null 2>&1; then
  echo "⚠️ ripgrep (rg) manquant. Installation..."
  apt-get update -y
  apt-get install -y ripgrep
fi

echo "============================================================"
echo "A) CIBLE — Layouts & screens"
echo "============================================================"

# Layouts expo-router (app/**/_layout.tsx, +layout.tsx)
mapfile -t LAYOUTS < <(
  find "$ROOT/apps" -type f \( -name "_layout.tsx" -o -name "_layout.ts" -o -name "+layout.tsx" -o -name "+layout.ts" \) 2>/dev/null | sort -u
)

# Screens (fichiers dans app/ qui contiennent ScrollView/FlatList/SectionList)
mapfile -t SCREENS < <(
  rg -l --glob='**/app/**/*.{ts,tsx,js,jsx}' "<(ScrollView|FlatList|SectionList)\\b" "$ROOT/apps" 2>/dev/null | sort -u
)

echo "Layouts: ${#LAYOUTS[@]}"
echo "Screens with lists: ${#SCREENS[@]}"
echo

echo "============================================================"
echo "B) BACKUP — Layouts + screens"
echo "============================================================"
for f in "${LAYOUTS[@]}" "${SCREENS[@]}"; do
  [[ -f "$f" ]] || continue
  mkdir -p "$BK$(dirname "${f#$ROOT}")"
  cp -a "$f" "$BK${f#$ROOT}"
done

echo "Backup OK ✅"
echo

echo "============================================================"
echo "C) PATCH #1 — Expo Router layouts: Stack/Tabs contentStyle/sceneContainerStyle flex:1"
echo "============================================================"

for f in "${LAYOUTS[@]}"; do
  [[ -f "$f" ]] || continue
  echo "➡️ Layout patch: $f"

  # 1) Si <Stack ...> n'a PAS screenOptions=, on l'ajoute (contentStyle flex:1)
  perl -0777 -pi -e '
    s/<Stack(?![^>]*\bscreenOptions=)([^>]*?)(\s*\/?>)/
      "<Stack$1 screenOptions={{ contentStyle: { flex: 1 }, sceneContainerStyle: { flex: 1 } }}$2"
    /gmsx;
  ' "$f" || true

  # 2) Si screenOptions={{ ... }} existe mais pas contentStyle/sceneContainerStyle, on les injecte
  perl -0777 -pi -e '
    s/screenOptions=\{\{(?![^}]*\bcontentStyle\b)/
      "screenOptions={{ contentStyle: { flex: 1 }, "
    /gmsx;

    s/screenOptions=\{\{(?![^}]*\bsceneContainerStyle\b)/
      "screenOptions={{ sceneContainerStyle: { flex: 1 }, "
    /gmsx;
  ' "$f" || true

  # 3) Tabs : si pas screenOptions, on ajoute; si existe, on force sceneContainerStyle
  perl -0777 -pi -e '
    s/<Tabs(?![^>]*\bscreenOptions=)([^>]*?)(\s*\/?>)/
      "<Tabs$1 screenOptions={{ sceneContainerStyle: { flex: 1 } }}$2"
    /gmsx;

    s/screenOptions=\{\{(?![^}]*\bsceneContainerStyle\b)/
      "screenOptions={{ sceneContainerStyle: { flex: 1 }, "
    /gmsx;
  ' "$f" || true
done

echo
echo "============================================================"
echo "D) PATCH #2 — Wrappers qui cassent souvent le bounded height: SafeAreaView / KeyboardAvoidingView"
echo "============================================================"
TARGET_WRAPPERS=("${SCREENS[@]}" "${LAYOUTS[@]}")

for f in "${TARGET_WRAPPERS[@]}"; do
  [[ -f "$f" ]] || continue

  # Ajoute style={{flex:1}} si SafeAreaView n'a pas de style=
  perl -0777 -pi -e '
    s/<SafeAreaView(?![^>]*\bstyle=)([^>]*?)(\s*\/?>)/
      "<SafeAreaView$1 style={{ flex: 1 }}$2"
    /gmsx;
  ' "$f" || true

  # Ajoute style={{flex:1}} si KeyboardAvoidingView n'a pas de style=
  perl -0777 -pi -e '
    s/<KeyboardAvoidingView(?![^>]*\bstyle=)([^>]*?)(\s*\/?>)/
      "<KeyboardAvoidingView$1 style={{ flex: 1 }}$2"
    /gmsx;
  ' "$f" || true

  # Si style={styles.container|styles.root} -> style={[styles.container,{flex:1}]}
  perl -0777 -pi -e '
    s/style=\{styles\.(container|root)\}/style={[styles.$1, { flex: 1 }]}/gms;
  ' "$f" || true
done

echo
echo "============================================================"
echo "E) PATCH #3 — Stylesheet container/root: inject flex:1 si absent (heuristique safe)"
echo "============================================================"

for f in "${TARGET_WRAPPERS[@]}"; do
  [[ -f "$f" ]] || continue

  # container: { ... }  (si pas de flex: déjà)
  perl -0777 -pi -e '
    s/(container\s*:\s*\{)(?![^}]*\bflex\s*:)([^}]*)(\})/$1 flex: 1, $2$3/gms;
    s/(root\s*:\s*\{)(?![^}]*\bflex\s*:)([^}]*)(\})/$1 flex: 1, $2$3/gms;
  ' "$f" || true
done

echo
echo "============================================================"
echo "F) PATCH #4 — Screens: ScrollView/FlatList/SectionList -> style flex:1 + contentContainerStyle flexGrow:1 (si absent)"
echo "============================================================"

for f in "${SCREENS[@]}"; do
  [[ -f "$f" ]] || continue

  # ScrollView : ajoute style si absent
  perl -0777 -pi -e '
    s/<ScrollView(?![^>]*\bstyle=)([^>]*?)(\s*\/?>)/
      "<ScrollView$1 style={{ flex: 1 }}$2"
    /gmsx;
  ' "$f" || true

  # ScrollView : ajoute contentContainerStyle si absent
  perl -0777 -pi -e '
    s/<ScrollView(?![^>]*\bcontentContainerStyle=)([^>]*?)(\s*\/?>)/
      "<ScrollView$1 contentContainerStyle={{ flexGrow: 1 }}$2"
    /gmsx;
  ' "$f" || true

  # FlatList / SectionList : ajoute contentContainerStyle si absent
  perl -0777 -pi -e '
    s/<FlatList(?![^>]*\bcontentContainerStyle=)([^>]*?)(\s*\/?>)/
      "<FlatList$1 contentContainerStyle={{ flexGrow: 1 }}$2"
    /gmsx;
    s/<SectionList(?![^>]*\bcontentContainerStyle=)([^>]*?)(\s*\/?>)/
      "<SectionList$1 contentContainerStyle={{ flexGrow: 1 }}$2"
    /gmsx;
  ' "$f" || true
done

echo
echo "✅ FLEX DOCTOR DONE"
echo "Backup: $BK"
echo "Report: $RP"
echo
echo "Rollback (1-liner):"
echo "  rsync -a \"$BK/\" \"$ROOT/\""
echo
echo "Next: restart metros (clear) + swipe-close iPhone + rescan QR"
