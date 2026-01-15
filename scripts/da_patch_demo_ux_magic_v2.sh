#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
FILES=(
  "$ROOT/apps/client/app/orders-demo.tsx:client"
  "$ROOT/apps/merchant/app/orders-demo.tsx:merchant"
  "$ROOT/apps/courier/app/orders-demo.tsx:courier"
)

node -v >/dev/null 2>&1 || { echo "❌ Node introuvable. Installe nodejs sur le VPS."; exit 1; }

ts="$(date +%Y%m%d_%H%M%S)"
patcher="/tmp/da_patch_demo_ux_magic_v2_${ts}.mjs"

cat > "$patcher" <<'JS'
import fs from "fs";

const MAGIC = "DA_MAGIC_V2_START";

function ensurePressableImport(src) {
  const re = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']react-native["'];/m;
  const m = src.match(re);
  if (!m) return src;
  const items = m[1].split(",").map(s => s.trim()).filter(Boolean);
  if (!items.includes("Pressable")) items.push("Pressable");
  const repl = `import { ${items.join(", ")} } from "react-native";`;
  return src.replace(m[0], repl);
}

function insertAfterLastImport(src, block) {
  if (src.includes(MAGIC)) return src;
  let last = 0;
  const re = /^import .*;[ \t]*\r?\n/gm;
  for (const m of src.matchAll(re)) last = (m.index ?? 0) + m[0].length;
  return src.slice(0, last) + "\n" + block + "\n" + src.slice(last);
}

function helperBlock() {
  return `
// ${MAGIC}
type DemoRole = "client" | "merchant" | "courier";

function normalizeStatus(s: any): string {
  const v = String(s ?? "").trim().toUpperCase();
  if (!v) return "UNKNOWN";
  // normalisations courantes
  if (v === "LIVREE" || v === "LIVRÉE") return "DELIVERED";
  if (v === "PRET" || v === "PRÊT") return "READY";
  return v;
}
function isReady(s: string) {
  return ["READY", "READY_FOR_PICKUP"].includes(s);
}
function isDelivered(s: string) {
  return ["DELIVERED", "COMPLETED"].includes(s);
}
function statusLabelFr(sAny: any): string {
  const s = normalizeStatus(sAny);
  if (isDelivered(s)) return "LIVRÉE";
  if (s === "OUT_FOR_DELIVERY" || s === "PICKED_UP") return "EN LIVRAISON";
  if (isReady(s)) return "PRÊT";
  if (s === "PREPARING" || s === "ACCEPTED") return "EN PRÉPARATION";
  if (s === "PENDING" || s === "NEW" || s === "CREATED") return "EN ATTENTE";
  if (s === "CANCELLED" || s === "FAILED") return "PROBLÈME";
  return s.replace(/_/g, " ");
}
function statusTone(sAny: any): "pending" | "ready" | "delivered" | "error" | "neutral" {
  const s = normalizeStatus(sAny);
  if (s === "CANCELLED" || s === "FAILED") return "error";
  if (isDelivered(s)) return "delivered";
  if (isReady(s)) return "ready";
  if (["PENDING","NEW","CREATED","PREPARING","ACCEPTED","OUT_FOR_DELIVERY","PICKED_UP"].includes(s)) return "pending";
  return "neutral";
}

function getPrimaryLabel(role: DemoRole, statusAny: any, orderIdAny: any): string {
  const s = normalizeStatus(statusAny);
  const hasId = !!orderIdAny;

  if (!hasId) return role === "client" ? "Créer commande (démo)" : "Aucune commande";

  if (role === "merchant") {
    if (isDelivered(s)) return "Commande livrée";
    if (isReady(s)) return "Déjà PRÊT";
    return "Marquer PRÊT";
  }
  if (role === "courier") {
    if (isDelivered(s)) return "Déjà LIVRÉE";
    if (isReady(s)) return "Marquer LIVRÉE";
    return "En attente (PRÊT requis)";
  }

  // client
  if (isDelivered(s)) return "Commande livrée ✓";
  return "Rafraîchir";
}

function getPrimaryDisabled(role: DemoRole, statusAny: any, orderIdAny: any): boolean {
  const s = normalizeStatus(statusAny);
  const hasId = !!orderIdAny;

  if (role === "client") return false;
  if (!hasId) return true;

  if (role === "merchant") return isReady(s) || isDelivered(s);
  if (role === "courier") return !isReady(s) || isDelivered(s);

  return true;
}

function StatusPill({ status }: { status: any }) {
  const tone = statusTone(status);
  const label = statusLabelFr(status);
  const toneStyle =
    tone === "ready"
      ? styles.statusPill_ready
      : tone === "delivered"
      ? styles.statusPill_delivered
      : tone === "error"
      ? styles.statusPill_error
      : tone === "pending"
      ? styles.statusPill_pending
      : styles.statusPill_neutral;

  return (
    <View style={[styles.statusPill, toneStyle]}>
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

function SmartNeonButton(props: {
  onPress?: any;
  disabled?: boolean;
  children?: any;
  style?: any;
}) {
  const { onPress, disabled, children, style } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={!!disabled}
      style={[styles.smartBtn, !!disabled && styles.smartBtnDisabled, style]}
    >
      <Text style={styles.smartBtnText}>{children}</Text>
    </Pressable>
  );
}
// ${MAGIC}_END
`;
}

function replaceNeonButtonWithSmart(src) {
  // remplace les balises uniquement (on garde onPress etc.)
  return src
    .replaceAll("<NeonButton", "<SmartNeonButton")
    .replaceAll("</NeonButton>", "</SmartNeonButton>");
}

function patchPrimarySmartButton(src, role, statusExpr, orderIdExpr) {
  const blockRe = /<SmartNeonButton([^>]*)>([\s\S]*?)<\/SmartNeonButton>/gm;
  let out = src;
  let replaced = false;

  out = out.replace(blockRe, (full, attrs, inner) => {
    if (replaced) return full;

    const innerTxt = String(inner);
    const isPrimary =
      innerTxt.includes("Marquer") ||
      innerTxt.includes("Action principale") ||
      innerTxt.includes("LIVRÉE") ||
      innerTxt.includes("PRÊT");

    if (!isPrimary) return full;

    const cleanedAttrs = String(attrs).replace(/\sdisabled=\{[^}]*\}/g, "");
    const disabledProp = ` disabled={getPrimaryDisabled("${role}", ${statusExpr}, ${orderIdExpr})}`;
    replaced = true;

    return `<SmartNeonButton${cleanedAttrs}${disabledProp}>{getPrimaryLabel("${role}", ${statusExpr}, ${orderIdExpr})}</SmartNeonButton>`;
  });

  return out;
}

function patchStatusToPill(src) {
  // Remplace le rendu "status: <Text>{...}</Text>" par "status: <StatusPill .../>"
  const re = /(<Text[^>]*>\s*status:\s*<\/Text>\s*)<Text[^>]*>\s*\{([^}]*)\}\s*<\/Text>/m;
  const m = src.match(re);
  if (!m) return src;
  const expr = m[2].trim();
  return src.replace(re, `$1<StatusPill status={${expr}} />`);
}

function ensureStyles(src) {
  if (src.includes("smartBtn:") && src.includes("statusPill:") && src.includes("statusPillText:")) return src;

  const insert = `
  // --- DA Magic V2
  statusPill: {
    alignSelf: "flex-start",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  statusPillText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },

  statusPill_pending: {
    borderColor: "rgba(255, 184, 0, 0.9)",
    shadowColor: "rgba(255, 184, 0, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 4,
  },
  statusPill_ready: {
    borderColor: "rgba(34, 211, 238, 0.95)",
    shadowColor: "rgba(34, 211, 238, 1)",
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 5,
  },
  statusPill_delivered: {
    borderColor: "rgba(34, 197, 94, 0.95)",
    shadowColor: "rgba(34, 197, 94, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 5,
  },
  statusPill_error: {
    borderColor: "rgba(239, 68, 68, 0.95)",
    shadowColor: "rgba(239, 68, 68, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 16,
    elevation: 5,
  },
  statusPill_neutral: {
    borderColor: "rgba(148, 163, 184, 0.7)",
    shadowColor: "rgba(148, 163, 184, 1)",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 2,
  },

  smartBtn: {
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(34, 211, 238, 0.75)",
    backgroundColor: "rgba(34, 211, 238, 0.10)",
    shadowColor: "rgba(34, 211, 238, 1)",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 4,
    alignItems: "center",
  },
  smartBtnDisabled: { opacity: 0.45 },
  smartBtnText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.6 },
`;

  const idx = src.lastIndexOf("});");
  if (idx === -1) return src;
  return src.slice(0, idx) + insert + "\n" + src.slice(idx);
}

function detectStatusExpr(src) {
  // le plus probable dans vos écrans démo
  if (src.includes("const [status") || src.includes("[status,")) return "status";
  if (src.includes("order?.status")) return "order?.status";
  if (src.includes("order.status")) return "order.status";
  return "status";
}
function detectOrderIdExpr(src) {
  if (src.includes("const [orderId") || src.includes("[orderId,")) return "orderId";
  if (src.includes("order?.id")) return "order?.id";
  if (src.includes("order.id")) return "order.id";
  return "orderId";
}

function patchFile(filePath, role) {
  const original = fs.readFileSync(filePath, "utf8");

  const statusExpr = detectStatusExpr(original);
  const orderIdExpr = detectOrderIdExpr(original);

  let src = original;
  src = ensurePressableImport(src);
  src = insertAfterLastImport(src, helperBlock());
  src = replaceNeonButtonWithSmart(src);
  src = patchPrimarySmartButton(src, role, statusExpr, orderIdExpr);
  src = patchStatusToPill(src);
  src = ensureStyles(src);

  if (src === original) return { changed: false, reason: "no-op" };
  fs.writeFileSync(filePath, src, "utf8");
  return { changed: true };
}

// ---- CLI ----
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Usage: node patcher.mjs <filePath> <role>");
  process.exit(2);
}
const filePath = args[0];
const role = args[1];
const res = patchFile(filePath, role);
console.log(JSON.stringify({ filePath, role, ...res }));
JS

echo "🧠 Patch Magie V2 — fichiers ciblés :"
for entry in "${FILES[@]}"; do
  f="${entry%%:*}"
  role="${entry##*:}"
  if [ ! -f "$f" ]; then
    echo "❌ Missing: $f"
    exit 1
  fi
  cp -f "$f" "$f.bak_magic_v2_${ts}"
  echo "  ✅ backup -> $f.bak_magic_v2_${ts}"
done

echo "⚙️  Application patch..."
for entry in "${FILES[@]}"; do
  f="${entry%%:*}"
  role="${entry##*:}"
  node "$patcher" "$f" "$role" | tee -a "$ROOT/serve_ota.log" >/dev/null || true
  echo "  ✅ patched: $f"
done

echo "✅ Terminé."
echo "➡️  Action : reload Metro (touche 'r' dans chaque fenêtre tmux) ou redémarre les bundlers si besoin."
