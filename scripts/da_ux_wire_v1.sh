#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/.backup_ux_wire_v1_$TS"

echo "== DelishAfrica UX Wire V1 =="
echo "Root:   $ROOT"
echo "Backup: $BACKUP"
mkdir -p "$BACKUP"

need(){ command -v "$1" >/dev/null 2>&1 || { echo "Missing: $1"; exit 1; }; }
need bash
need rsync
need find
need sed
need awk

# Detect app folder names (some repos use courier, others coursier)
APP_CLIENT="$ROOT/apps/client"
APP_MERCHANT="$ROOT/apps/merchant"
APP_COURIER="$ROOT/apps/courier"
if [ ! -d "$APP_COURIER" ] && [ -d "$ROOT/apps/coursier" ]; then
  APP_COURIER="$ROOT/apps/coursier"
fi

for d in "$APP_CLIENT" "$APP_MERCHANT" "$APP_COURIER"; do
  [ -d "$d" ] || { echo "ERROR: missing app folder: $d"; exit 1; }
done

echo "== 1) Locate demo screen files (by signature strings) =="

# Patterns based on your roadbook descriptions:
# Client: "Partenaire mis en avant"
# Merchant: "Restaurant connecté"
# Courier: "Mission de démo" or "mission" + "Thieyp"
find_screen() {
  local APP_DIR="$1"
  local PATTERN="$2"
  local FILE
  FILE="$(grep -Rsl --exclude-dir=node_modules --exclude-dir=.git --exclude=*.log "$PATTERN" "$APP_DIR" | head -n 1 || true)"
  echo "$FILE"
}

CLIENT_SCREEN="$(find_screen "$APP_CLIENT" "Partenaire mis en avant")"
MERCHANT_SCREEN="$(find_screen "$APP_MERCHANT" "Restaurant connecté")"
COURIER_SCREEN="$(find_screen "$APP_COURIER" "Mission de démo")"
if [ -z "$COURIER_SCREEN" ]; then
  COURIER_SCREEN="$(find_screen "$APP_COURIER" "Livraison")"
fi

echo "Client screen:   ${CLIENT_SCREEN:-NOT FOUND}"
echo "Merchant screen: ${MERCHANT_SCREEN:-NOT FOUND}"
echo "Courier screen:  ${COURIER_SCREEN:-NOT FOUND}"

# Fallback: if not found, try Thieyp / Thiepy
if [ -z "$CLIENT_SCREEN" ]; then
  CLIENT_SCREEN="$(find_screen "$APP_CLIENT" "Thieyp")"
fi
if [ -z "$MERCHANT_SCREEN" ]; then
  MERCHANT_SCREEN="$(find_screen "$APP_MERCHANT" "Thieyp")"
fi
if [ -z "$COURIER_SCREEN" ]; then
  COURIER_SCREEN="$(find_screen "$APP_COURIER" "Thieyp")"
fi

for f in "$CLIENT_SCREEN" "$MERCHANT_SCREEN" "$COURIER_SCREEN"; do
  [ -f "$f" ] || { echo "ERROR: Could not locate one of the demo screens automatically. Aborting to avoid wrong overwrite."; exit 1; }
done

echo "== 2) Backup found screens =="
mkdir -p "$BACKUP"
rsync -a "$CLIENT_SCREEN" "$BACKUP/CLIENT_$(basename "$CLIENT_SCREEN")"
rsync -a "$MERCHANT_SCREEN" "$BACKUP/MERCHANT_$(basename "$MERCHANT_SCREEN")"
rsync -a "$COURIER_SCREEN" "$BACKUP/COURIER_$(basename "$COURIER_SCREEN")"

echo "== 3) Ensure UX Foundation exists (ui/*) =="
for APP in "$APP_CLIENT" "$APP_MERCHANT" "$APP_COURIER"; do
  [ -d "$APP/ui/components" ] || { echo "ERROR: missing $APP/ui/components. Run da_ux_foundation_v1.sh first."; exit 1; }
done

echo "== 4) Create Signature Screens (ui/screens) =="

write_signature_client() {
  local APP="$1"
  cat > "$APP/ui/screens/SignatureHomeClient.tsx" <<'TSX'
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import DelishCard from "../components/DelishCard";
import DelishButton from "../components/DelishButton";
import ShimmerLine from "../components/ShimmerLine";
import OrderTimeline from "../components/OrderTimeline";
import Onboarding from "./Onboarding";
import { useTheme } from "../hooks/useTheme";

type Partner = {
  id?: string;
  slug?: string;
  name?: string;
  city?: string;
  tagline?: string;
};

let __sessionOnboarded = false;

const API = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";

export default function SignatureHomeClient() {
  const T = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(!__sessionOnboarded);

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<"ok" | "down" | "…">("…");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const steps = useMemo(
    () => [
      { key: "s1", title: "Découverte", subtitle: "Explore Thieyp et les partenaires.", done: true },
      { key: "s2", title: "Commande", subtitle: "Action principale (démo) → bientôt full flow.", done: false },
      { key: "s3", title: "Suivi", subtitle: "Timeline & tracking (V1 UI prête).", done: false },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
        if (!alive) return;
        setHealth(h?.status === "ok" ? "ok" : "down");

        const p = await fetch(`${API}/api/partners`).then((r) => r.json()).catch(() => []);
        if (!alive) return;
        setPartners(Array.isArray(p) ? p : []);
      } catch (e: any) {
        if (!alive) return;
        setErr("Impossible de charger les données. Vérifie l’API.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  if (showOnboarding) {
    return (
      <Onboarding
        onDone={() => {
          __sessionOnboarded = true;
          setShowOnboarding(false);
        }}
      />
    );
  }

  const thieyp = partners.find((x) => (x?.slug || "").toLowerCase().includes("thieyp")) || partners.find((x) => (x?.name || "").toLowerCase().includes("thieyp"));
  const rest = partners.filter((x) => x !== thieyp);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.colors.bg }} contentContainerStyle={{ padding: 18, gap: 14 }}>
      {/* Header */}
      <View style={{ gap: 4, marginTop: 4 }}>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>DELISHAFRICA • CLIENT</Text>
        <Text style={{ color: T.colors.text, fontSize: 30, fontWeight: "900", lineHeight: 34 }}>
          L’Afrique à table.
        </Text>
        <Text style={{ color: T.colors.subtext, fontSize: 15, lineHeight: 20 }}>
          Explore, ressens, commande. Une expérience qui respecte notre grandeur.
        </Text>
      </View>

      {/* Health */}
      <DelishCard>
        <Text style={{ color: T.colors.subtext, fontWeight: "800", letterSpacing: 1 }}>API</Text>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16, marginTop: 6 }}>
          {API}
        </Text>
        <Text style={{ color: health === "ok" ? T.colors.ok : T.colors.warn, marginTop: 6, fontWeight: "800" }}>
          Status: {health}
        </Text>
      </DelishCard>

      {/* Timeline */}
      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18, marginBottom: 10 }}>
          Parcours V1
        </Text>
        <OrderTimeline steps={steps} />
      </DelishCard>

      {/* Featured partner */}
      <DelishCard>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PARTENAIRE MIS EN AVANT</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={16} />
            <ShimmerLine h={12} w="70%" />
            <ShimmerLine h={44} />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 20 }}>
              {thieyp?.name || "Thieyp"}
            </Text>
            <Text style={{ color: T.colors.subtext }}>
              {thieyp?.tagline || "La vitrine V1 — une première expérience mémorable."}
            </Text>

            <DelishButton
              title="Action principale (démo)"
              onPress={() => {
                // Démo : action placeholder, branchable vers /orders ensuite
                // Ici on garde l’UI stable sans casser le flow.
              }}
            />
          </View>
        )}

        {!!err && <Text style={{ color: T.colors.warn, marginTop: 10 }}>{err}</Text>}
      </DelishCard>

      {/* Others */}
      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18 }}>Autres partenaires</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={14} />
            <ShimmerLine h={14} />
            <ShimmerLine h={14} w="80%" />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            {rest.length === 0 ? (
              <Text style={{ color: T.colors.subtext }}>Aucun partenaire pour l’instant.</Text>
            ) : (
              rest.slice(0, 8).map((p, i) => (
                <View
                  key={`${p?.id || p?.slug || p?.name || i}`}
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: T.colors.border,
                    backgroundColor: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Text style={{ color: T.colors.text, fontWeight: "800" }}>{p?.name || "Partenaire"}</Text>
                  <Text style={{ color: T.colors.subtext, marginTop: 3 }}>{p?.city || "—"}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </DelishCard>

      {/* Footer spacing */}
      <View style={{ height: 18 }} />
    </ScrollView>
  );
}
TSX
}

write_signature_merchant() {
  local APP="$1"
  cat > "$APP/ui/screens/SignatureHomeMerchant.tsx" <<'TSX'
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import DelishCard from "../components/DelishCard";
import DelishButton from "../components/DelishButton";
import ShimmerLine from "../components/ShimmerLine";
import OrderTimeline from "../components/OrderTimeline";
import Onboarding from "./Onboarding";
import { useTheme } from "../hooks/useTheme";

let __sessionOnboarded = false;
const API = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";

export default function SignatureHomeMerchant() {
  const T = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(!__sessionOnboarded);

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<"ok" | "down" | "…">("…");

  const steps = useMemo(
    () => [
      { key: "s1", title: "Réception", subtitle: "Commandes entrantes (démo).", done: true },
      { key: "s2", title: "Préparation", subtitle: "Marquer “Prêt” dès que c’est chaud.", done: false },
      { key: "s3", title: "Passation", subtitle: "Le coursier prend la mission.", done: false },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
        if (!alive) return;
        setHealth(h?.status === "ok" ? "ok" : "down");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  if (showOnboarding) {
    return (
      <Onboarding
        onDone={() => {
          __sessionOnboarded = true;
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.colors.bg }} contentContainerStyle={{ padding: 18, gap: 14 }}>
      <View style={{ gap: 4, marginTop: 4 }}>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>DELISHAFRICA • MERCHANT</Text>
        <Text style={{ color: T.colors.text, fontSize: 30, fontWeight: "900", lineHeight: 34 }}>
          Poste cuisine.
        </Text>
        <Text style={{ color: T.colors.subtext, fontSize: 15, lineHeight: 20 }}>
          Actions rapides. Lisibilité maximale. Zéro stress.
        </Text>
      </View>

      <DelishCard>
        <Text style={{ color: T.colors.subtext, fontWeight: "800", letterSpacing: 1 }}>API</Text>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16, marginTop: 6 }}>{API}</Text>
        <Text style={{ color: health === "ok" ? T.colors.ok : T.colors.warn, marginTop: 6, fontWeight: "800" }}>
          Status: {health}
        </Text>
      </DelishCard>

      <DelishCard>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>RESTAURANT CONNECTÉ</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={16} />
            <ShimmerLine h={12} w="70%" />
            <ShimmerLine h={44} />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 20 }}>Thieyp</Text>
            <Text style={{ color: T.colors.subtext }}>
              Interface pro, claire, premium — la cuisine au contrôle.
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <DelishButton title="Accepter (démo)" onPress={() => {}} style={{ flex: 1 }} />
              <DelishButton title="Marquer prêt (démo)" variant="ghost" onPress={() => {}} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </DelishCard>

      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18, marginBottom: 10 }}>
          Timeline Opération
        </Text>
        <OrderTimeline steps={steps} />
      </DelishCard>

      <View style={{ height: 18 }} />
    </ScrollView>
  );
}
TSX
}

write_signature_courier() {
  local APP="$1"
  cat > "$APP/ui/screens/SignatureHomeCourier.tsx" <<'TSX'
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import DelishCard from "../components/DelishCard";
import DelishButton from "../components/DelishButton";
import ShimmerLine from "../components/ShimmerLine";
import OrderTimeline from "../components/OrderTimeline";
import Onboarding from "./Onboarding";
import { useTheme } from "../hooks/useTheme";

let __sessionOnboarded = false;
const API = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";

export default function SignatureHomeCourier() {
  const T = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(!__sessionOnboarded);

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<"ok" | "down" | "…">("…");

  const steps = useMemo(
    () => [
      { key: "s1", title: "Mission", subtitle: "Livraison Thieyp (démo).", done: true },
      { key: "s2", title: "Pick-up", subtitle: "Récupérer la commande au restaurant.", done: false },
      { key: "s3", title: "Livré", subtitle: "Confirmer la livraison au client.", done: false },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
        if (!alive) return;
        setHealth(h?.status === "ok" ? "ok" : "down");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  if (showOnboarding) {
    return (
      <Onboarding
        onDone={() => {
          __sessionOnboarded = true;
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.colors.bg }} contentContainerStyle={{ padding: 18, gap: 14 }}>
      <View style={{ gap: 4, marginTop: 4 }}>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>DELISHAFRICA • COURIER</Text>
        <Text style={{ color: T.colors.text, fontSize: 30, fontWeight: "900", lineHeight: 34 }}>
          En mouvement.
        </Text>
        <Text style={{ color: T.colors.subtext, fontSize: 15, lineHeight: 20 }}>
          Ultra lisible, ultra rapide. On ne perd jamais une seconde.
        </Text>
      </View>

      <DelishCard>
        <Text style={{ color: T.colors.subtext, fontWeight: "800", letterSpacing: 1 }}>API</Text>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16, marginTop: 6 }}>{API}</Text>
        <Text style={{ color: health === "ok" ? T.colors.ok : T.colors.warn, marginTop: 6, fontWeight: "800" }}>
          Status: {health}
        </Text>
      </DelishCard>

      <DelishCard>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>MISSION DE DÉMO</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={16} />
            <ShimmerLine h={12} w="70%" />
            <ShimmerLine h={44} />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 20 }}>Livraison • Thieyp</Text>
            <Text style={{ color: T.colors.subtext }}>
              Mission claire, CTA visibles — UX orientée action.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <DelishButton title="Voir mission (démo)" onPress={() => {}} style={{ flex: 1 }} />
              <DelishButton title="Terminer (démo)" variant="ghost" onPress={() => {}} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </DelishCard>

      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18, marginBottom: 10 }}>
          Timeline Mission
        </Text>
        <OrderTimeline steps={steps} />
      </DelishCard>

      <View style={{ height: 18 }} />
    </ScrollView>
  );
}
TSX
}

write_signature_client "$APP_CLIENT"
write_signature_merchant "$APP_MERCHANT"
write_signature_courier "$APP_COURIER"

echo "== 5) Overwrite the located demo screens with safe wrappers (keeps Expo Router happy) =="

wrap_file() {
  local TARGET="$1"
  local IMPORT_PATH="$2"
  cat > "$TARGET" <<TSX
import React from "react";
import Signature from "$IMPORT_PATH";

export default function Screen() {
  return <Signature />;
}
TSX
}

# Compute relative imports from app route file to ui/screens/*
rel_import() {
  local FILE="$1"   # route file
  local APPDIR="$2" # apps/<name>
  local SCREEN="$3" # file under ui/screens
  # Usually route files are under app/** ; ui is at root of app package.
  # We'll just use a safe relative: "../ui/screens/..."
  # But the depth varies. We compute it.
  local rel
  rel="$(python3 - <<PY
import os
file="$FILE"
app="$APPDIR"
screen="$SCREEN"
# screen like "ui/screens/SignatureHomeClient"
screen_path=os.path.join(app, screen)
# compute relative import (without extension)
r=os.path.relpath(screen_path, os.path.dirname(file))
r=r.replace(os.sep,'/')
if r.endswith('.tsx'): r=r[:-4]
if r.endswith('.ts'): r=r[:-3]
print(r if r.startswith('.') else './'+r)
PY
)"
  echo "$rel"
}

CLIENT_IMPORT="$(rel_import "$CLIENT_SCREEN" "$APP_CLIENT" "ui/screens/SignatureHomeClient.tsx")"
MERCHANT_IMPORT="$(rel_import "$MERCHANT_SCREEN" "$APP_MERCHANT" "ui/screens/SignatureHomeMerchant.tsx")"
COURIER_IMPORT="$(rel_import "$COURIER_SCREEN" "$APP_COURIER" "ui/screens/SignatureHomeCourier.tsx")"

wrap_file "$CLIENT_SCREEN" "$CLIENT_IMPORT"
wrap_file "$MERCHANT_SCREEN" "$MERCHANT_IMPORT"
wrap_file "$COURIER_SCREEN" "$COURIER_IMPORT"

echo "== DONE =="
echo "Backups: $BACKUP"
echo "Patched:"
echo " - $CLIENT_SCREEN"
echo " - $MERCHANT_SCREEN"
echo " - $COURIER_SCREEN"
