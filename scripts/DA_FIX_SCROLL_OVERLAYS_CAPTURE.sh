#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

TS="$(date +%Y%m%d_%H%M%S)"
BACKUP="$ROOT/backup/scroll_overlays_$TS"
mkdir -p "$BACKUP"

echo "==> Backup dir: $BACKUP"
echo

# 1) Trouver les fichiers suspects (full screen absolute)
echo "==> Scanning suspects (fullscreen absolute Views)..."
rg -n --hidden --glob '!.git' \
  "(position\\s*:\\s*'absolute'|position\\s*:\\s*\"absolute\")" apps \
| rg -n "(top\\s*:\\s*0|top\\s*:\\s*0,)" \
| rg -n "(left\\s*:\\s*0|left\\s*:\\s*0,)" \
| rg -n "(right\\s*:\\s*0|right\\s*:\\s*0,)" \
| rg -n "(bottom\\s*:\\s*0|bottom\\s*:\\s*0,)" \
| rg -n "\\.tsx" \
| cut -d: -f1 \
| sort -u > /tmp/da_scroll_overlay_files.txt || true

COUNT="$(wc -l < /tmp/da_scroll_overlay_files.txt | tr -d ' ')"
echo "==> Found $COUNT candidate file(s)."
echo

if [ "$COUNT" -eq 0 ]; then
  echo "No candidates found. Nothing to patch."
  exit 0
fi

echo "==> Candidate files:"
sed 's/^/ - /' /tmp/da_scroll_overlay_files.txt
echo

# 2) Patch : sur tout <View ...> qui contient un style fullscreen absolute,
# ajouter pointerEvents="none" si absent.
patch_one() {
  local f="$1"
  [ -f "$f" ] || return 0

  local rel="${f#"$ROOT"/}"
  mkdir -p "$BACKUP/$(dirname "$rel")"
  cp -a "$f" "$BACKUP/$rel"

  # Perl multi-ligne (-0777) :
  # - repère des tags <View ...> dont les attributs contiennent un "fullscreen absolute" (top/left/right/bottom=0 + position absolute)
  # - si pointerEvents n'est pas déjà présent, on injecte pointerEvents="none"
  perl -0777 -pe '
    sub is_fullscreen_abs {
      my ($s)=@_;
      return 0 unless $s =~ /<View\b/;
      return 0 unless $s =~ /(position\s*:\s*['\''"]absolute['\''"])/;
      return 0 unless $s =~ /(top\s*:\s*0)/;
      return 0 unless $s =~ /(left\s*:\s*0)/;
      return 0 unless $s =~ /(right\s*:\s*0)/;
      return 0 unless $s =~ /(bottom\s*:\s*0)/;
      return 1;
    }

    # remplace chaque ouverture <View ...> (jusqu’au >)
    s{
      <View\b(.*?)>
    }{
      my $attrs=$1;
      my $tag="<View$attrs>";
      if (is_fullscreen_abs($tag) && $tag !~ /\bpointerEvents\s*=/) {
        $tag =~ s/^<View\b/<View pointerEvents="none"/;
      }
      $tag
    }gsex;
  ' -i "$f"
}

while read -r FILE; do
  patch_one "$FILE"
done < /tmp/da_scroll_overlay_files.txt

echo "==> Patch complete."
echo "==> Backups saved in: $BACKUP"
echo
echo "NEXT:"
echo "1) Restart metros (client/courier/merchant) + force close iPhone apps"
echo "2) Re-scan QR"
echo "3) Test scroll"
