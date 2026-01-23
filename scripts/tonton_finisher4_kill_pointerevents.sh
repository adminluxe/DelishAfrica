
#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

ROOT="/opt/delishafrica/monorepo"
NOW="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$ROOT/.tonton_backups/kill_pointerevents_$NOW"
REPORT_DIR="$ROOT/.tonton_reports"
REPORT="$REPORT_DIR/kill_pointerevents_$NOW.log"

mkdir -p "$BACKUP_DIR" "$REPORT_DIR"

log(){ echo -e "\n[$(date '+%H:%M:%S')] $*" | tee -a "$REPORT"; }

backup_file(){
  local f="$1"
  [[ -f "$f" ]] || return 0
  local rel
  rel="$(python3 -c "import os; print(os.path.relpath('$f','$ROOT'))")"
  local dst="$BACKUP_DIR/$rel"
  mkdir -p "$(dirname "$dst")"
  cp -a "$f" "$dst"
}

log "🎯 FINISHER4: neutralise pointerEvents=auto (de SafeAreaView et _layouts)"
log "Backup=$BACKUP_DIR"
log "Report=$REPORT"

APPS=(client merchant courier)

# Chercher toutes les SafeAreaView avec pointerEvents="auto" ou pointerEvents='auto'
SAFE_FILES=()
for a in "${APPS[@]}"; do
  while IFS= read -r f; do SAFE_FILES+=("$f"); done < <(
    grep -RlE 'pointerEvents\s*=\s*["'\'']auto["'\'']' "$ROOT/apps/$a" || true
  )
done
mapfile -t SAFE_FILES < <(printf "%s\n" "${SAFE_FILES[@]}" | awk 'NF && !seen[$0]++')

log "Fichiers contenant pointerEvents=\"auto\" : ${#SAFE_FILES[@]}"
printf "%s\n" "${SAFE_FILES[@]}" | tee -a "$REPORT" || true

for f in "${SAFE_FILES[@]}"; do
  backup_file "$f"
  # Remplacer pointerEvents="auto" par pointerEvents="box-none" (les évènements passent au travers)
  perl -i -pe 's/pointerEvents\s*=\s*["'\''"]auto["'\''"]/pointerEvents="box-none"/g' "$f"
done

# Chercher aussi les scrollEnabled={false} dans ScrollView/FlatList
SCROLL_FILES=()
for a in "${APPS[@]}"; do
  while IFS= read -r f; do SCROLL_FILES+=("$f"); done < <(
    grep -RlE 'scrollEnabled\s*=\s*\{?\s*false\s*\}?' "$ROOT/apps/$a" || true
  )
done
mapfile -t SCROLL_FILES < <(printf "%s\n" "${SCROLL_FILES[@]}" | awk 'NF && !seen[$0]++')

log "Fichiers avec scrollEnabled={false} : ${#SCROLL_FILES[@]}"
printf "%s\n" "${SCROLL_FILES[@]}" | tee -a "$REPORT" || true

for f in "${SCROLL_FILES[@]}"; do
  backup_file "$f"
  perl -i -pe 's/scrollEnabled\s*=\s*\{?\s*false\s*\}?/scrollEnabled={true}/g' "$f"
done

log "✅ Done. Tous les pointerEvents='auto' sont passés à box-none + scrollEnabled forcé à true."
log "🧯 Rollback (un seul cmd) : rsync -a \"$BACKUP_DIR/\" \"$ROOT/\""

exit 0

