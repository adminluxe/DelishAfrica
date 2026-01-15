#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

APPS=(client merchant courier)

echo "== DA FIX | Commander (démo) -> /orders-demo (route restore + absolute nav) =="

# 1) Create the route file in each app (safe chooser screen)
for a in "${APPS[@]}"; do
  dir="apps/$a/app"
  mkdir -p "$dir"

  cat > "$dir/orders-demo.tsx" <<'TSX'
import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { Link } from "expo-router";

export default function OrdersDemo() {
  return (
    <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 22 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 10 }}>
        Démo — Commander
      </Text>

      <Text style={{ opacity: 0.7, marginBottom: 18, lineHeight: 20 }}>
        Choisis une destination. Si une route n’existe pas encore dans l’app, tu le verras
        immédiatement, mais au moins le bouton “Commander (démo)” ouvrira toujours cet écran.
      </Text>

      <Link href="/" asChild>
        <Pressable
          style={{
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            backgroundColor: "rgba(255,255,255,0.06)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Accueil</Text>
          <Text style={{ opacity: 0.7, marginTop: 4 }}>Retour à l’accueil (route “/”).</Text>
        </Pressable>
      </Link>

      <Link href="/thieyp" asChild>
        <Pressable
          style={{
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            backgroundColor: "rgba(255,215,0,0.10)",
            borderWidth: 1,
            borderColor: "rgba(255,215,0,0.22)",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Menu Thieyp</Text>
          <Text style={{ opacity: 0.75, marginTop: 4 }}>
            Si la route /thieyp existe, c’est la démo parfaite.
          </Text>
        </Pressable>
      </Link>

      <Link href="/orders" asChild>
        <Pressable
          style={{
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            backgroundColor: "rgba(147,51,234,0.10)",
            borderWidth: 1,
            borderColor: "rgba(147,51,234,0.22)",
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Orders</Text>
          <Text style={{ opacity: 0.75, marginTop: 4 }}>
            Si la route /orders existe, tu arrives sur la liste/flux de commandes.
          </Text>
        </Pressable>
      </Link>

      <View style={{ height: 20 }} />
      <Text style={{ opacity: 0.55, fontSize: 12 }}>
        Tip: si /thieyp ou /orders n’existent pas, on recâble ensuite vers la vraie route (1 min).
      </Text>
    </ScrollView>
  );
}
TSX

  echo "OK route created: apps/$a/app/orders-demo.tsx"
done

# 2) Rewire all common patterns to absolute "/orders-demo"
python3 - <<'PY'
import re
from pathlib import Path

ROOT = Path("/opt/delishafrica/monorepo")
targets = []
for p in ROOT.glob("apps/*/**/*.*"):
    if p.suffix.lower() not in [".ts", ".tsx", ".js", ".jsx"]:
        continue
    if "node_modules" in p.parts or ".expo" in p.parts or "dist" in p.parts:
        continue
    targets.append(p)

patterns = [
    # router.push("orders-demo") or router.push('orders-demo')
    (re.compile(r"""router\.push\(\s*['"]orders-demo['"]\s*\)"""), "router.push('/orders-demo')"),
    # router.replace("orders-demo")
    (re.compile(r"""router\.replace\(\s*['"]orders-demo['"]\s*\)"""), "router.replace('/orders-demo')"),
    # href="orders-demo" or href={'orders-demo'}
    (re.compile(r"""href\s*=\s*['"]orders-demo['"]"""), "href=\"/orders-demo\""),
    (re.compile(r"""href\s*=\s*\{\s*['"]orders-demo['"]\s*\}"""), "href={'/orders-demo'}"),
    # "/orders-demo" already ok, do nothing
]

changed = 0
for f in targets:
    txt = f.read_text(encoding="utf-8", errors="ignore")
    orig = txt
    for rgx, rep in patterns:
        txt = rgx.sub(rep, txt)
    if txt != orig:
        f.write_text(txt, encoding="utf-8")
        changed += 1

print(f"Rewired files: {changed}")
PY

echo
echo "✅ DONE. Now reload Metro in the 3 apps: press 'r'."
