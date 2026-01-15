#!/bin/bash
# delishafrica_import.sh - Script d'importation automatisée des menus CSV

IMPORT_DIR="/opt/delishafrica/imports"
LOG_SUM="/opt/delishafrica/logs/imports_summary.log"
LOG_OK="/opt/delishafrica/logs/imports_ok.csv"
API_URL="http://127.0.0.1:3010"  # URL de base de l'API (adapter si besoin)
DRY_RUN=false

# Parse argument --dry-run
if [[ "$1" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "== MODE SIMULATION (dry-run) =="
fi

# Fonction pour logguer dans le summary
log_summary() {
  echo "$1" | tee -a "$LOG_SUM"
}

# Fonction pour ajouter un succès dans imports_ok.csv
log_success_csv() {
  # Ajouter en évitant les doublons
  if ! grep -q "^$1," "$LOG_OK" 2>/dev/null; then
    echo "$1,$2" >> "$LOG_OK"
  fi
}

# 1. Vérification de l'API
log_summary "=== Début de l'import: $(date) ==="
if $DRY_RUN; then
  echo "[DRY-RUN] Vérification du port 4001 (API) - simulation"
else
  echo -n "Vérification de l'API (port 4001)... "
fi

# Test du port 4001
API_UP=false
if (echo > /dev/tcp/localhost/4001) &>/dev/null; then
  API_UP=true
fi

if $API_UP; then
  $DRY_RUN || echo "API en ligne."
else
  if $DRY_RUN; then
    echo "[DRY-RUN] API semble hors ligne - on aurait tenté un redémarrage"
  else
    echo "API hors ligne, tentative de redémarrage..."
    # Tentative de redémarrage (Docker puis PM2)
    if command -v docker &>/dev/null && docker ps | grep -q ":4001->"; then
      CONTAINER_ID=$(docker ps -q -f "publish=4001")
      if [ -n "$CONTAINER_ID" ]; then
        docker restart "$CONTAINER_ID" &>> "$LOG_SUM"
        echo "Docker container $CONTAINER_ID redémarré (logs dans api.log)."
      fi
    elif command -v pm2 &>/dev/null; then
      pm2 restart all &>> "$LOG_SUM"   # (Ou pm2 restart NomDuProcessus)
      echo "Processus API redémarré via PM2 (voir api.log)."
    else
      echo "Aucune méthode de redémarrage (Docker/PM2) n'est disponible !" | tee -a "$LOG_SUM"
    fi
    # Vérifier à nouveau après quelques secondes
    sleep 3
    if (echo > /dev/tcp/localhost/4001) &>/dev/null; then
      echo "API relancée avec succès."
      API_UP=true
    else
      log_summary "ERREUR: API indisponible après tentative de redémarrage. Import annulé."
      echo "== Fin du script (API KO) ==" 
      exit 1
    fi
  fi
fi

# 2. Traitement des fichiers CSV
shopt -s nullglob
files=("$IMPORT_DIR"/*.csv)
if [ ${#files[@]} -eq 0 ]; then
  log_summary "ERREUR: Aucun fichier .csv trouvé dans $IMPORT_DIR"
  echo "Aucun fichier CSV à importer. Fin."
  exit 0
fi

SUCCESS_COUNT=0
FAIL_COUNT=0

for file in "${files[@]}"; do
  fname=$(basename "$file")
  # Si déjà importé auparavant, on skip
  if grep -q "^${fname}," "$LOG_OK" 2>/dev/null; then
    echo "SKIP: $fname déjà importé (succès précédent)."
    continue
  fi

  echo "Traitement du fichier $fname..."
  # 2.a Déterminer merchant_id pour ce fichier
  MERCHANT_ID=""
  header=$(head -n1 "$file" | tr -d '\r')
  # Le nom du restaurant pourrait être dérivé du nom de fichier (sans extension):
  restoname="${fname%.csv}"
  # Si l'en-tête contient 'merchant_id', regarder la première valeur de données
  placeholder=""
  if echo "$header" | grep -qi '^merchant_id'; then
    # On lit la première valeur de la 2ème ligne (après l'entête)
    first_val=$(sed -n '2p' "$file" | cut -d',' -f1)
    if [[ "$first_val" =~ MERCH ]]; then
      placeholder="$first_val"
    else
      # Si pas de placeholder, on suppose que c'est un ID réel déjà présent
      MERCHANT_ID="$first_val"
    fi
  fi

  # Si on n'a pas encore d'ID et qu'on n'a pas de placeholder, on doit créer ou récupérer un ID
  if [ -z "$MERCHANT_ID" ]; then
    if $DRY_RUN; then
      MERCHANT_ID="FAKEID_${restoname}"  # générer un faux ID simulé
      echo "[DRY-RUN] Création du marchand '$restoname' -> ID simulé $MERCHANT_ID"
    else
      # Appel du script create-merchant.ts
      echo "Création du marchand pour $restoname..."
      MERCHANT_OUT=$(node /opt/delishafrica/scripts/create-merchant.ts "$restoname" 2>&1)
      RETCODE=$?
      if [ $RETCODE -ne 0 ]; then
        log_summary "$fname - ÉCHEC création marchand: $MERCHANT_OUT"
        ((FAIL_COUNT++))
        continue  # passer au fichier suivant
      fi
      # Supposons que l'output contient directement l'ID, sinon on parse :
      MERCHANT_ID=$(echo "$MERCHANT_OUT" | tail -1)
      echo "→ Merchant '$restoname' ID=$MERCHANT_ID"
    fi
  fi

  # 2.b Préparer le CSV (ajout de colonne ou remplacement placeholder)
  TMP="/tmp/import_${fname}"
  SEP=','
  if echo "$header" | grep -q ';'; then SEP=';'; fi
  if echo "$header" | grep -qi '^merchant_id'; then
    # Colonne merchant_id existe déjà
    if [ -n "$placeholder" ]; then
      # Remplacer le placeholder par l'ID
      $DRY_RUN && echo "[DRY-RUN] Remplacement de $placeholder par $MERCHANT_ID dans $fname"
      if ! $DRY_RUN; then
        awk -F"$SEP" -v OFS="$SEP" -v ID="$MERCHANT_ID" -v PH="$placeholder" \
          'NR==1{print; next} { if($1 == PH) $1=ID; print }' "$file" > "$TMP"
      fi
    else
      # Pas de placeholder, on peut utiliser le fichier tel quel
      cp "$file" "$TMP"
    end
  else
    # Colonne merchant_id absente -> on la préfixe
    $DRY_RUN && echo "[DRY-RUN] Ajout de la colonne merchant_id dans $fname"
    if ! $DRY_RUN; then
      awk -v ID="$MERCHANT_ID" -v SEP="$SEP" \
        'NR==1{print "merchant_id" SEP $0; next} {print ID SEP $0}' \
        "$file" > "$TMP"
    fi
  fi

  # 2.c Envoi du fichier à l'API (sauf en simulation)
  if $DRY_RUN; then
    echo "[DRY-RUN] Import de $fname via API (non effectué)"
    # On simule un succès pour la démonstration
    STATUS="SUCCÈS"
    ERR_MSG=""
  else
    echo "→ Envoi du menu $fname à l'API..."
    HTTP_CODE=$(curl -s -o "/tmp/resp_${fname%.csv}.json" -w "%{http_code}" \
               -F "file=@$TMP;type=text/csv" "$API_URL/api/merchants/import-menu")
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
      STATUS="SUCCÈS"
      # Vérifier présence d'erreurs partielles:
      if grep -q "errors" "/tmp/resp_${fname%.csv}.json"; then
        ERR_MSG=$(grep -o "\"errors\":[^}]*" "/tmp/resp_${fname%.csv}.json")
      else
        ERR_MSG=""
      fi
    else
      STATUS="ÉCHEC"
      ERR_MSG=$(cat "/tmp/resp_${fname%.csv}.json")
    fi
  fi

  # 2.d Logging des résultats pour ce fichier
  if [ "$STATUS" = "SUCCÈS" ]; then
    log_summary "$fname - SUCCÈS ${ERR_MSG:+(avec avertissements: $ERR_MSG)}"
    log_success_csv "$fname" "$MERCHANT_ID"
    ((SUCCESS_COUNT++))
  else
    log_summary "$fname - ÉCHEC - $ERR_MSG"
    ((FAIL_COUNT++))
  fi

  # Nettoyage du fichier temporaire
  $DRY_RUN || rm -f "$TMP"
done

# 3. Affichage du résumé final
TOTAL=$((SUCCESS_COUNT + FAIL_COUNT))
echo "===== RÉSUMÉ ====="
echo "Fichiers traités : $TOTAL"
echo "Importés avec succès : $SUCCESS_COUNT"
echo "Échecs : $FAIL_COUNT"
echo "Voir détails dans $LOG_SUM et $LOG_OK"
if $DRY_RUN; then
  echo "(Aucune donnée n'a été modifiée - mode simulation)"
fi

# 4. (Bonus) QR code ASCII de l'URL API
if command -v qrencode &>/dev/null; then
  echo -e "\nScan du QR code pour $API_URL :"
  qrencode -t ansiutf8 "$API_URL"
  echo "(URL: $API_URL)"
fi

log_summary "=== Fin de l'import: $(date) ==="
