#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APP="$ROOT/apps/merchant"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/.tonton_backups/merchant_ready_inert_$TS"
mkdir -p "$BK"

log(){ echo -e "\n🧡 $*\n"; }

cd "$ROOT"

log "Recherche du fichier merchant qui contient 'Marquer PRÊT'..."
FILE="$(grep -RIl --include='*.ts' --include='*.tsx' -E "Marquer PRÊT|Marquer PRET" "$APP" 2>/dev/null | head -n 1 || true)"

if [ -z "${FILE:-}" ]; then
  echo "❌ Aucun fichier trouvé avec 'Marquer PRÊT' dans $APP"
  exit 1
fi

log "Fichier cible: $FILE"
cp -a "$FILE" "$BK/$(basename "$FILE").bak"

log "Affiche contexte (autour du bouton) AVANT patch:"
grep -nE "Marquer PRÊT|Marquer PRET|onPress|disabled" "$FILE" | head -n 120 || true

log "Patch: injection d'un handler pressReady() + remplacement onPress du bouton PRÊT (safe)."

perl -0777 -i -pe '
  my $src = $_;

  # 1) Assure import Alert
  if ($src !~ /from\s+[\"\x27]react-native[\"\x27].*Alert/s) {
    # si import react-native existe, on ajoute Alert dedans
    if ($src =~ /import\s+\{\s*([^\}]+)\}\s+from\s+[\"\x27]react-native[\"\x27]\s*;/s) {
      my $inside = $1;
      if ($inside !~ /\bAlert\b/) {
        $inside =~ s/\s+$//;
        $inside .= ", Alert";
        $src =~ s/import\s+\{\s*[^\}]+\}\s+from\s+[\"\x27]react-native[\"\x27]\s*;/import { $inside } from \"react-native\";/s;
      }
    }
  }

  # 2) Injecte helper pressReady() si absent
  if ($src !~ /function\s+pressReady\s*\(/s && $src !~ /const\s+pressReady\s*=\s*async/s) {
    my $inject = <<'INJECT';

async function pressReady(orderId: any, apiBase: string) {
  try {
    const id = String(orderId ?? "");
    if (!id || id === "undefined" || id === "null") {
      console.log("[MERCHANT] pressReady: orderId invalid:", orderId);
      Alert.alert("Erreur", "orderId invalide (debug)");
      return;
    }

    console.log("[MERCHANT] PRESS_READY ->", id);
    Alert.alert("Debug", "PRESS_READY: " + id);

    const endpoints: Array<{ method: string; url: string; body?: any }> = [
      { method: "POST",  url: `${apiBase}/api/v1/orders/${id}/ready` },
      { method: "PATCH", url: `${apiBase}/api/v1/orders/${id}/ready` },
      { method: "POST",  url: `${apiBase}/api/v1/orders/${id}/status`, body: { status: "ready" } },
      { method: "PATCH", url: `${apiBase}/api/v1/orders/${id}/status`, body: { status: "ready" } },

      // fallbacks “demo”
      { method: "POST",  url: `${apiBase}/api/v1/orders/demo/${id}/ready` },
      { method: "PATCH", url: `${apiBase}/api/v1/orders/demo/${id}/ready` },
      { method: "POST",  url: `${apiBase}/api/v1/orders/demo/ready`, body: { orderId: id } },
      { method: "PATCH", url: `${apiBase}/api/v1/orders/demo/ready`, body: { orderId: id } },
    ];

    let lastErr: any = null;

    for (const e of endpoints) {
      try {
        console.log("[MERCHANT] try", e.method, e.url);
        const res = await fetch(e.url, {
          method: e.method,
          headers: { "content-type": "application/json" },
          body: e.body ? JSON.stringify(e.body) : undefined,
        });

        const text = await res.text().catch(() => "");
        console.log("[MERCHANT] res", res.status, text);

        if (res.status >= 200 && res.status < 300) {
          Alert.alert("OK", "Commande marquée PRÊT ✅");
          return;
        }
        lastErr = { status: res.status, text };
      } catch (err) {
        lastErr = err;
      }
    }

    console.log("[MERCHANT] pressReady FAILED:", lastErr);
    Alert.alert("Échec", "Impossible de marquer PRÊT (voir logs).");
  } catch (e) {
    console.log("[MERCHANT] pressReady crash:", e);
    Alert.alert("Crash", "pressReady a crash (voir logs).");
  }
}

INJECT

    # injecte juste avant export default (ou à la fin sinon)
    if ($src =~ /export\s+default\s+function/s) {
      $src =~ s/(export\s+default\s+function)/$inject\n$1/s;
    } else {
      $src .= "\n$inject\n";
    }
  }

  # 3) Remplace onPress du bouton PRÊT uniquement dans un bloc qui contient "Marquer PRÊT"
  #    + supprime disabled si présent dans le même bloc.
  $src =~ s{
    (                         # capture le chunk du bouton
      <[^>]*                  # ouverture tag
      (?:Pressable|TouchableOpacity|Button)[^>]*?
      (?:\n|\r|.)*?
      Marquer\s+(?:PRÊT|PRET) # label
      (?:\n|\r|.)*?
      >
    )
  }{
    my $chunk = $1;

    # force disabled off si présent
    $chunk =~ s/\sdisabled=\{[^\}]+\}//g;

    # remplace onPress
    if ($chunk =~ /onPress=\{[^\}]*\}/s) {
      $chunk =~ s/onPress=\{[^\}]*\}/onPress={() => pressReady((order as any)?.id ?? (order as any)?.orderId ?? (order as any)?._id ?? (order as any)?.uuid, (globalThis as any)?.API_BASE ?? \"https:\\/\\/api.delishafrica.me\")}/s;
    } else {
      # ajoute onPress si absent
      $chunk =~ s/(<(?:Pressable|TouchableOpacity|Button)\b)/$1 onPress={() => pressReady((order as any)?.id ?? (order as any)?.orderId ?? (order as any)?._id ?? (order as any)?.uuid, (globalThis as any)?.API_BASE ?? \"https:\\/\\/api.delishafrica.me\")}/s;
    }

    $chunk;
  }gexs;

  $_ = $src;
' "$FILE"

log "✅ Patch appliqué."
log "Backup: $BK/$(basename "$FILE").bak"

log "Affiche contexte APRÈS patch:"
grep -nE "pressReady|PRESS_READY|Marquer PRÊT|Marquer PRET|onPress|disabled" "$FILE" | head -n 160 || true

cat <<EOF

✅ Prochaine étape:
1) STOP merchant metro (CTRL+C)
2) RELANCE avec cache clear:
   cd /opt/delishafrica/monorepo/apps/merchant && pnpm dev -- --tunnel --port 8083 --clear

🎯 Test:
- Tu cliques "Marquer PRÊT"
- Tu dois voir un Alert "Debug PRESS_READY: <id>"
- Puis un Alert OK, ou un Alert Échec + logs dans la console Metro

EOF
