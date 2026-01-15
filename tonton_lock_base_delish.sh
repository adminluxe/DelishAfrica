#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
COMPOSE="/opt/delishafrica/compose"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="/opt/delishafrica/_BASELINE_LOCK_${STAMP}.md"

say(){ echo -e "\n\033[1;36m==> $*\033[0m"; }
ok(){  echo -e "\033[1;32m✔\033[0m $*"; }
warn(){ echo -e "\033[1;33m⚠\033[0m $*"; }
need(){ command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing: $1"; exit 1; }; }

need curl
need systemctl
need ps
need rg
need sed

[ -d "$ROOT" ] || { echo "❌ ROOT introuvable: $ROOT"; exit 1; }

API_PUBLIC="https://api.delishafrica.me"
HEALTHS=("$API_PUBLIC/health" "$API_PUBLIC/api/health" "$API_PUBLIC/api/v1/health")
PARTNERS=("$API_PUBLIC/partners" "$API_PUBLIC/api/partners" "$API_PUBLIC/api/v1/partners")

say "0) Baseline file: $OUT"
cat > "$OUT" <<MD
# 📌 DelishAfrica — Baseline verrouillée (LOCK) — $STAMP

## ✅ Référence (ne pas modifier sans procédure)
- API publique: $API_PUBLIC
- Health: /health, /api/health, /api/v1/health
- Partners: /partners, /api/partners, /api/v1/partners
- API local: http://127.0.0.1:3010
- Tunnel Cloudflare: service systemd **cloudflared** (config: /root/.cloudflared/config.yml)
MD

say "1) Vérif cloudflared: service unique + bon ExecStart"
systemctl is-active cloudflared >/dev/null && ok "cloudflared actif" || { echo "❌ cloudflared n'est pas actif"; exit 1; }

# Affiche ExecStart effectif
EXE="$(systemctl show -p ExecStart cloudflared | sed 's/^ExecStart=//')"
echo -e "\n### cloudflared ExecStart\n\`\`\`\n$EXE\n\`\`\`\n" >> "$OUT"

# Vérifie qu'on utilise bien le config.yml
echo "$EXE" | grep -q "/root/.cloudflared/config.yml" && ok "cloudflared utilise config.yml" || warn "cloudflared n'utilise PAS config.yml (à vérifier)"

say "2) Vérif: pas de cloudflared manuel (token/--url/quick tunnel)"
# On tolère 1 process (systemd). On refuse les run token / --url
MANUAL="$(ps aux | grep cloudflared | grep -v grep | egrep 'tunnel run --token|--url http://127\.0\.0\.1:|quick|trycloudflare' || true)"
if [ -n "$MANUAL" ]; then
  echo "$MANUAL"
  echo -e "\n### ❌ cloudflared manuels détectés\n\`\`\`\n$MANUAL\n\`\`\`\n" >> "$OUT"
  echo "❌ STOP: cloudflared manuels détectés. Tue-les puis relance le service."
  echo "   pkill -f \"cloudflared tunnel run --token\" || true"
  echo "   pkill -f \"cloudflared --no-autoupdate\" || true"
  echo "   systemctl restart cloudflared"
  exit 1
fi
ok "aucun cloudflared manuel"

say "3) Vérif API publique: health OK (200 + JSON)"
echo -e "\n## ✅ Checks HTTP\n" >> "$OUT"

for url in "${HEALTHS[@]}"; do
  code="$(curl -sS -o /tmp/_delish_body.txt -w "%{http_code}" --max-time 8 "$url" || true)"
  body="$(cat /tmp/_delish_body.txt 2>/dev/null || true)"
  echo "- $url → HTTP $code" >> "$OUT"
  echo -e "  \n\`\`\`json\n$body\n\`\`\`\n" >> "$OUT"
  [ "$code" = "200" ] && ok "health OK: $url" || { echo "❌ health KO: $url (HTTP $code)"; exit 1; }
done

say "4) Vérif partners: OK (200)"
for url in "${PARTNERS[@]}"; do
  code="$(curl -sS -o /tmp/_delish_body.txt -w "%{http_code}" --max-time 8 "$url" || true)"
  body="$(cat /tmp/_delish_body.txt 2>/dev/null || true)"
  echo "- $url → HTTP $code" >> "$OUT"
  echo -e "  \n\`\`\`json\n$body\n\`\`\`\n" >> "$OUT"
  [ "$code" = "200" ] && ok "partners OK: $url" || { echo "❌ partners KO: $url (HTTP $code)"; exit 1; }
done

say "5) Anti-régression: plus aucune trace 4001/4010 et 127.0.0.1:4001/4010"
HITS="$(rg -n --hidden --no-ignore-vcs -S \
  '127\.0\.0\.1:(4001|4010)|localhost:(4001|4010)|\b4001\b|\b4010\b' \
  "$ROOT" "$COMPOSE" \
  -g '!**/node_modules/**' -g '!**/.git/**' -g '!**/dist/**' -g '!**/.expo/**' -g '!**/build/**' -g '!**/.next/**' \
  || true)"

if [ -n "$HITS" ]; then
  echo -e "\n### ❌ Traces 4001/4010 trouvées\n\`\`\`\n$HITS\n\`\`\`\n" >> "$OUT"
  echo "$HITS" | head -n 40
  echo "❌ STOP: traces 4001/4010 trouvées (voir baseline $OUT)."
  exit 1
fi
ok "aucune trace 4001/4010"

say "6) Vérif env apps: EXPO_PUBLIC_API_BASE_URL=https://api.delishafrica.me"
echo -e "\n## ✅ Env apps\n" >> "$OUT"
for app in courier client merchant; do
  envf="$ROOT/apps/$app/.env"
  envl="$ROOT/apps/$app/.env.local"
  val=""
  if [ -f "$envl" ] && grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$envl"; then
    val="$(grep '^EXPO_PUBLIC_API_BASE_URL=' "$envl" | tail -n 1)"
  elif [ -f "$envf" ] && grep -q '^EXPO_PUBLIC_API_BASE_URL=' "$envf"; then
    val="$(grep '^EXPO_PUBLIC_API_BASE_URL=' "$envf" | tail -n 1)"
  fi
  echo "- $app: ${val:-"(non trouvé)"}" >> "$OUT"
  echo "${val:-}" | grep -q "https://api.delishafrica.me" && ok "env OK: $app" || warn "env à vérifier: $app (mets EXPO_PUBLIC_API_BASE_URL=https://api.delishafrica.me)"
done

say "7) Résumé"
echo -e "\n## ✅ Résultat\n- Baseline OK ✅\n- Infra verrouillée ✅\n- Anti-régression ports OK ✅\n" >> "$OUT"
ok "LOCK OK ✅  Baseline: $OUT"

echo
echo "➡️ Baseline créée: $OUT"
echo "➡️ À épingler: copier/coller ce fichier dans le Roadbook"
