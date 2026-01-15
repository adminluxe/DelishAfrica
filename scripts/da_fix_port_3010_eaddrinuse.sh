#!/usr/bin/env bash
set -euo pipefail

PORT="3010"
LOG="/opt/delishafrica/monorepo/.tonton_fix_port_${PORT}_$(date +%Y%m%d-%H%M%S).log"
log(){ echo -e "\n🧡 $*\n" | tee -a "$LOG"; }

need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }
need lsof
need ps
need awk
need sed

log "Diagnostic port :$PORT"
HITS="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P || true)"
if [ -z "$HITS" ]; then
  log "✅ Aucun process n'écoute sur :$PORT — pas de conflit."
  echo "Log: $LOG"
  exit 0
fi

echo "$HITS" | tee -a "$LOG"

log "Extraction PID(s)…"
PIDS="$(echo "$HITS" | awk 'NR>1 {print $2}' | sort -u | tr '\n' ' ')"
log "PID(s): $PIDS"

log "Détails commandes:"
for p in $PIDS; do
  ps -p "$p" -o pid=,user=,etime=,command= | tee -a "$LOG" || true
done

log "Kill SAFE: on tue uniquement si commande contient node/nest/next/delish (pour éviter de tuer un truc système)."
KILLED=0
for p in $PIDS; do
  CMD="$(ps -p "$p" -o command= 2>/dev/null || true)"
  if echo "$CMD" | grep -Eqi '(node|nest|next|delish|ops)'; then
    log "→ kill -TERM $p  ($CMD)"
    kill -TERM "$p" 2>/dev/null || true
    KILLED=1
  else
    log "⚠️ Je ne tue pas $p (commande non reconnue comme node/delish): $CMD"
  fi
done

sleep 1

log "Re-check port :$PORT"
HITS2="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P || true)"
if [ -n "$HITS2" ]; then
  log "⚠️ Il reste encore un listener. Tentative kill -KILL (SAFE) sur les mêmes PID node/delish."
  for p in $PIDS; do
    CMD="$(ps -p "$p" -o command= 2>/dev/null || true)"
    if echo "$CMD" | grep -Eqi '(node|nest|next|delish|ops)'; then
      log "→ kill -KILL $p"
      kill -KILL "$p" 2>/dev/null || true
    fi
  done
  sleep 1
fi

HITS3="$(lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P || true)"
if [ -n "$HITS3" ]; then
  log "❌ Toujours bloqué. Copie/colle ce log, on identifiera le process exact:"
  echo "$HITS3" | tee -a "$LOG"
  echo "Log: $LOG"
  exit 1
fi

log "✅ Port :$PORT libéré."
echo "Log: $LOG"
