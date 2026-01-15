#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
PORT="8083"
TS="$(date +%Y%m%d-%H%M%S)"
LOGDIR="$ROOT/tonton_logs"
BKDIR="$ROOT/tonton_backups/merchant_orders_patch_$TS"
mkdir -p "$LOGDIR" "$BKDIR"

# 1) récup du fichier réel
BEST_FILE="$(cat /tmp/da_orders_best_merchant.txt 2>/dev/null || true)"
if [[ -z "${BEST_FILE:-}" ]]; then
  echo "❌ /tmp/da_orders_best_merchant.txt introuvable. Lance d'abord:"
  echo "   bash /opt/delishafrica/monorepo/scripts/da_detect_orders_screen_merchant.sh"
  exit 1
fi

FILE="$APP/$BEST_FILE"
if [[ ! -f "$FILE" ]]; then
  echo "❌ Fichier introuvable: $FILE"
  echo "   (BEST_GUESS=$BEST_FILE)"
  exit 1
fi

echo "== PATCH Merchant Orders list =="
echo "FILE=$FILE"
cp -a "$FILE" "$BKDIR/$(basename "$FILE").bak"
echo "Backup -> $BKDIR/$(basename "$FILE").bak"

# 2) Patch minimal “chirurgical” :
#    - ajoute un bouton "Lister commandes (DEBUG)" qui POST /api/v1/orders/demo/list avec partnerSlug=thieyp
#    - affiche status HTTP + bodyLen + et une preview JSON (orders length + 1ère commande)
# IMPORTANT: on injecte sans dépendre d'un layout particulier.
python3 - <<'PY'
import re, pathlib, sys

path = pathlib.Path(sys.argv[1])
src = path.read_text(encoding="utf-8")

# Si on a déjà injecté, on stop
if "DA_MERCHANT_DEBUG_LIST" in src:
    print("✅ Patch déjà présent (DA_MERCHANT_DEBUG_LIST). Stop.")
    raise SystemExit(0)

# On essaie de repérer le composant default export
# On insère du code juste après les imports.
m = re.search(r'^(import[\s\S]+?\n)\s*(export default|export function|const\s+\w+\s*=\s*\()', src, flags=re.M)
if not m:
    print("❌ Impossible de trouver la zone d'injection (imports).")
    raise SystemExit(1)

imports_end = m.end(1)
inject = r'''
// DA_MERCHANT_DEBUG_LIST (auto-injected)
const DA_MERCHANT_DEBUG_LIST = async (API_BASE: string, partnerSlug: string) => {
  const started = Date.now();
  const url = `${API_BASE}/api/v1/orders/demo/list`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerSlug }),
    });
    const text = await res.text();
    const ms = Date.now() - started;
    let json: any = null;
    try { json = JSON.parse(text); } catch {}
    const orders = json?.orders ?? [];
    const preview = orders?.[0] ? `${orders[0].id} | ${orders[0].partnerSlug} | ${orders[0].status}` : "none";
    const msg = `[DA] ${res.status} ${res.ok ? "OK" : "ERR"} | ${ms}ms | bodyLen=${text.length} | orders=${orders.length} | first=${preview}`;
    return { ok: res.ok, status: res.status, text, json, orders, msg };
  } catch (e: any) {
    return { ok: False, status: 0, text: String(e), json: null, orders: [], msg: `[DA] ERR ${String(e)}` };
  }
};
'''

out = src[:imports_end] + inject + src[imports_end:]

# Inject UI: on cherche un return (...) et on ajoute un bloc de debug visible
# On fait une insertion "best-effort" : juste avant le dernier '</ScrollView>' ou '</View>' si trouvé.
# Si pas trouvé: on injecte avant la dernière parenthèse du return.
def add_ui(s: str) -> str:
    ui = r'''
      {/* DA: Debug list */}
      <View style={{ marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" }}>
        <Text style={{ fontSize: 16, fontWeight: "700", marginBottom: 6 }}>DA Debug Merchant</Text>
        <Text style={{ opacity: 0.8, marginBottom: 8 }}>But: prouver que Merchant appelle bien demo/list avec partnerSlug="thieyp".</Text>
        <Pressable
          onPress={async () => {
            try {
              const API_BASE = (globalThis as any)?.process?.env?.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";
              const r = await DA_MERCHANT_DEBUG_LIST(API_BASE, "thieyp");
              // @ts-ignore
              alert(r.msg);
              // @ts-ignore
              console.log(r.msg);
              // @ts-ignore
              console.log("[DA] raw:", r.text?.slice(0, 800));
            } catch (e) {
              // @ts-ignore
              alert("[DA] exception: " + String(e));
            }
          }}
          style={{ padding: 12, borderRadius: 12, backgroundColor: "rgba(50,130,236,0.25)", borderWidth: 1, borderColor: "rgba(50,130,236,0.35)" }}
        >
          <Text style={{ color: "white", fontWeight: "700", textAlign: "center" }}>Lister commandes (DEBUG)</Text>
        </Pressable>
      </View>
'''
    # Insert before closing ScrollView/View
    for tag in ["</ScrollView>", "</View>"]:
        idx = s.rfind(tag)
        if idx != -1:
            return s[:idx] + ui + "\n" + s[idx:]
    # fallback: before last ');' of return
    idx = s.rfind(");")
    if idx != -1:
        return s[:idx] + ui + "\n" + s[idx:]
    return s

out2 = add_ui(out)
path.write_text(out2, encoding="utf-8")
print("✅ Patch injecté.")
PY "$FILE"

# 3) HARD restart Merchant (tunnel + clear)
echo
echo "== HARD RESTART Merchant (tunnel + clear) =="
cd "$APP"

# éviter les runs non interactifs qui “mangent” le QR
unset CI || true
export EXPO_NO_INTERACTIVE=0

# kill metro/expo sur merchant (best effort)
pkill -f "expo start.*merchant" 2>/dev/null || true
pkill -f "metro.*merchant" 2>/dev/null || true
pkill -f "react-native start" 2>/dev/null || true

# free port
PIDS="$(lsof -tiTCP:$PORT -sTCP:LISTEN 2>/dev/null || true)"
if [[ -n "${PIDS:-}" ]]; then
  echo "Killing port $PORT -> $PIDS"
  for pid in $PIDS; do kill -TERM "$pid" 2>/dev/null || true; done
  sleep 0.8
  for pid in $PIDS; do kill -KILL "$pid" 2>/dev/null || true; done
fi

# clear caches (merchant + root)
rm -rf "$APP/.expo" "$APP/.expo-shared" 2>/dev/null || true
rm -rf "$APP/node_modules/.cache" 2>/dev/null || true
rm -rf "$ROOT/node_modules/.cache" 2>/dev/null || true

echo "Starting: pnpm dev -- --tunnel --port $PORT --clear"
pnpm dev -- --tunnel --port "$PORT" --clear 2>&1 | tee -a "$LOGDIR/merchant_orders_patch_restart_$TS.log"
