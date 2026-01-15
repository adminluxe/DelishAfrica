#!/usr/bin/env bash
set -euo pipefail
ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.tonton_backups/parallax_safe_$TS"
mkdir -p "$BK"

APPS=(client courier merchant)

backup() {
  local f="$1"
  local rel="${f#"$ROOT"/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$f" "$BK/$rel"
}

for app in "${APPS[@]}"; do
  f="$ROOT/apps/$app/components/parallax-scroll-view.tsx"
  [[ -f "$f" ]] || continue
  echo "🔧 SAFE patch: $f"
  backup "$f"

  # 1) Nettoie toute injection accidentelle dans les génériques TypeScript
  #    ex: useAnimatedRef<Animated.ScrollView scrollEnabled={true} ...>
  perl -0777 -i -pe 's/useAnimatedRef<Animated\.ScrollView[^>]*>/useAnimatedRef<Animated.ScrollView>/g' "$f"

  # 2) Force scrollEnabled=true si quelqu’un a mis false (dans le JSX)
  perl -0777 -i -pe 's/\bscrollEnabled\s*=\s*\{\s*false\s*\}/scrollEnabled={true}/g' "$f"

  # 3) Injecte props SAFE DANS LE JSX uniquement, juste après ref={scrollRef}
  #    (si elles n’existent pas déjà)
  perl -0777 -i -pe '
    if ($_ =~ /<Animated\.ScrollView[\s\S]*?\bref=\{scrollRef\}/) {
      # ajoute scrollEnabled si absent dans le tag
      if ($_ !~ /<Animated\.ScrollView[\s\S]*?\bscrollEnabled\s*=/) {
        s/(<Animated\.ScrollView[\s\S]*?\bref=\{scrollRef\}\s*)/$1\n      scrollEnabled={true}/;
      }
      # ajoute keyboardShouldPersistTaps si absent
      if ($_ !~ /<Animated\.ScrollView[\s\S]*?\bkeyboardShouldPersistTaps\s*=/) {
        s/(<Animated\.ScrollView[\s\S]*?\bref=\{scrollRef\}[\s\S]*?\n)/$1      keyboardShouldPersistTaps="handled"\n/;
      }
      # ajoute contentInsetAdjustmentBehavior si absent
      if ($_ !~ /<Animated\.ScrollView[\s\S]*?\bcontentInsetAdjustmentBehavior\s*=/) {
        s/(<Animated\.ScrollView[\s\S]*?\bref=\{scrollRef\}[\s\S]*?\n)/$1      contentInsetAdjustmentBehavior="automatic"\n/;
      }
    }
  ' "$f"

  # 4) Le header animé ne doit JAMAIS capter les touches (si tag trouvé)
  perl -0777 -i -pe '
    s/<Animated\.View(?![^>]*\bpointerEvents\s*=)([^>]*\bstyles\.header[^>]*>)/<Animated.View pointerEvents="none"$1/g
  ' "$f"
done

echo "✅ Backups: $BK"
