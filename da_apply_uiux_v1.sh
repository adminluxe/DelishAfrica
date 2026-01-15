#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

CLIENT_APP="$ROOT/apps/client"
COURIER_APP="$ROOT/apps/courier"
MERCHANT_APP="$ROOT/apps/merchant"

UI_PKG="$ROOT/packages/ui"

ts_now() { date +"%Y%m%d-%H%M%S"; }

die() { echo "❌ $*" >&2; exit 1; }

need_dir() {
  [ -d "$1" ] || die "Dossier introuvable: $1"
}

backup_file() {
  local f="$1"
  [ -f "$f" ] || return 0
  local b="${f}.bak.$(ts_now)"
  cp -a "$f" "$b"
  echo "🧷 Backup: $b"
}

write_file() {
  local path="$1"
  local tmp="${path}.tmp.$$"
  cat > "$tmp"
  mkdir -p "$(dirname "$path")"
  mv "$tmp" "$path"
  echo "✅ Wrote: $path"
}

ensure_workspace_dirs() {
  need_dir "$ROOT"
  need_dir "$CLIENT_APP"
  need_dir "$COURIER_APP"
  need_dir "$MERCHANT_APP"
  mkdir -p "$ROOT/packages"
}

echo "🧠 DelishAfrica UI/UX v1 — Apply shared UI + 3 themes"
ensure_workspace_dirs

echo "📦 1) Création package UI partagé: $UI_PKG"
mkdir -p "$UI_PKG/src"

write_file "$UI_PKG/package.json" <<'JSON'
{
  "name": "@delishafrica/ui",
  "version": "0.1.0",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts"
}
JSON

write_file "$UI_PKG/src/tokens.ts" <<'TS'
export type DATheme = {
  name: "client" | "courier" | "merchant";
  brand: string;        // primary
  brand2: string;       // accent
  bg: string;           // app background
  card: string;         // card background
  text: string;         // primary text
  muted: string;        // secondary text
  border: string;       // separators
  success: string;
  warning: string;
  danger: string;
};

export const base = {
  radius: { sm: 10, md: 16, lg: 22 },
  space: { xs: 6, sm: 10, md: 16, lg: 22, xl: 28 },
  font: { h1: 28, h2: 20, body: 16, small: 13, micro: 11 }
};

export const themes: Record<DATheme["name"], DATheme> = {
  client: {
    name: "client",
    brand: "#0B3C5D",
    brand2: "#1D9BF0",
    bg: "#070A0F",
    card: "#0C1220",
    text: "#EEF2FF",
    muted: "#A6B0C3",
    border: "rgba(255,255,255,0.08)",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444"
  },
  courier: {
    name: "courier",
    brand: "#2F855A",
    brand2: "#34D399",
    bg: "#06110C",
    card: "#071E14",
    text: "#ECFDF5",
    muted: "#9AB8AA",
    border: "rgba(255,255,255,0.08)",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444"
  },
  merchant: {
    name: "merchant",
    brand: "#C05621",
    brand2: "#FB923C",
    bg: "#120A06",
    card: "#1C0F09",
    text: "#FFF7ED",
    muted: "#C9B6AB",
    border: "rgba(255,255,255,0.08)",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444"
  }
};
TS

write_file "$UI_PKG/src/theme.tsx" <<'TSX'
import React, { createContext, useContext, useMemo } from "react";
import { DATheme, themes } from "./tokens";

type Ctx = { theme: DATheme };
const ThemeCtx = createContext<Ctx>({ theme: themes.client });

export function DAThemeProvider({ app, children }: { app: DATheme["name"]; children: React.ReactNode }) {
  const value = useMemo(() => ({ theme: themes[app] }), [app]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useDATheme() {
  return useContext(ThemeCtx).theme;
}
TSX

write_file "$UI_PKG/src/components.tsx" <<'TSX'
import React from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from "react-native";
import { base } from "./tokens";
import { useDATheme } from "./theme";

export function DAScreen({ children }: { children: React.ReactNode }) {
  const t = useDATheme();
  return <View style={{ flex: 1, backgroundColor: t.bg, padding: base.space.md }}>{children}</View>;
}

export function DAHeader({
  title,
  subtitle,
  right
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const t = useDATheme();
  return (
    <View style={{ marginBottom: base.space.lg, flexDirection: "row", alignItems: "flex-start" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text, fontSize: base.font.h1, fontWeight: "800", letterSpacing: -0.5 }}>
          {title}
        </Text>
        {!!subtitle && (
          <Text style={{ color: t.muted, fontSize: base.font.body, marginTop: 6 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!right && <View style={{ marginLeft: base.space.md }}>{right}</View>}
    </View>
  );
}

export function DACard({
  children,
  style
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const t = useDATheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: base.radius.lg,
          padding: base.space.md,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: t.border
        },
        style
      ]}
    >
      {children}
    </View>
  );
}

export function DAPill({ label, tone }: { label: string; tone: "ok" | "warn" | "bad" | "neutral" }) {
  const t = useDATheme();
  const bg =
    tone === "ok" ? "rgba(34,197,94,0.14)"
    : tone === "warn" ? "rgba(245,158,11,0.14)"
    : tone === "bad" ? "rgba(239,68,68,0.14)"
    : "rgba(255,255,255,0.08)";

  const color =
    tone === "ok" ? t.success
    : tone === "warn" ? t.warning
    : tone === "bad" ? t.danger
    : t.muted;

  return (
    <View style={{ backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 }}>
      <Text style={{ color, fontSize: base.font.micro, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function DAButton({
  label,
  onPress,
  loading,
  variant = "primary",
  style
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  variant?: "primary" | "ghost";
  style?: ViewStyle;
}) {
  const t = useDATheme();

  const btnBg = variant === "primary" ? t.brand : "transparent";
  const border = variant === "primary" ? "transparent" : t.border;
  const txt = variant === "primary" ? "#FFFFFF" : t.text;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: btnBg,
          borderColor: border,
          borderWidth: StyleSheet.hairlineWidth,
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: base.radius.lg,
          opacity: pressed ? 0.86 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }]
        },
        style
      ]}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
        {loading ? <ActivityIndicator /> : null}
        <Text style={{ color: txt, fontSize: base.font.body, fontWeight: "800", marginLeft: loading ? 10 : 0 }}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

export function DAText({ children, muted, style }: { children: React.ReactNode; muted?: boolean; style?: TextStyle }) {
  const t = useDATheme();
  return <Text style={[{ color: muted ? t.muted : t.text, fontSize: base.font.body }, style]}>{children}</Text>;
}
TSX

write_file "$UI_PKG/src/index.ts" <<'TS'
export * from "./tokens";
export * from "./theme";
export * from "./components";
TS

echo "🧩 2) Ajout des wrappers thème dans les 3 apps (_layout.tsx)"
patch_layout() {
  local app_dir="$1"
  local theme_name="$2"
  local layout="$app_dir/app/_layout.tsx"

  backup_file "$layout"

  write_file "$layout" <<TSX
import React from "react";
import { Stack } from "expo-router";
import { DAThemeProvider } from "@delishafrica/ui";

export default function RootLayout() {
  return (
    <DAThemeProvider app="${theme_name}">
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade"
        }}
      />
    </DAThemeProvider>
  );
}
TSX
}

patch_layout "$CLIENT_APP" "client"
patch_layout "$COURIER_APP" "courier"
patch_layout "$MERCHANT_APP" "merchant"

echo "🏠 3) Refonte des 3 Home (app/index.tsx) — premium & lisible"
patch_home_client() {
  local f="$CLIENT_APP/app/index.tsx"
  backup_file "$f"
  write_file "$f" <<'TSX'
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { DAHeader, DACard, DAButton, DAPill, DAScreen, DAText } from "@delishafrica/ui";

const API = process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me";

export default function Home() {
  const [health, setHealth] = useState<"loading" | "ok" | "nok">("loading");

  useEffect(() => {
    let mounted = true;
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then(() => mounted && setHealth("ok"))
      .catch(() => mounted && setHealth("nok"));
    return () => { mounted = false; };
  }, []);

  const pill = useMemo(() => {
    if (health === "loading") return <DAPill tone="neutral" label="API: vérification..." />;
    if (health === "ok") return <DAPill tone="ok" label="API: OK" />;
    return <DAPill tone="bad" label="API: KO (fallback)" />;
  }, [health]);

  return (
    <DAScreen>
      <DAHeader
        title="DelishAfrica"
        subtitle="Commandez afro premium • Démo Thieyp"
        right={pill}
      />

      <DACard style={{ marginBottom: 16 }}>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Partenaire mis en avant</DAText>
        <View style={{ height: 10 }} />
        <DAText muted>Thieyp • Cuisine sénégalaise • Bruxelles</DAText>
        <View style={{ height: 14 }} />
        <DAButton label="Découvrir Thieyp" onPress={() => { /* TODO: router push */ }} />
        <View style={{ height: 10 }} />
        <DAButton variant="ghost" label="Voir les autres partenaires" onPress={() => {}} />
      </DACard>

      <DACard>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Actions rapides</DAText>
        <View style={{ height: 12 }} />
        <DAButton label="Commander (démo)" onPress={() => {}} />
        <View style={{ height: 10 }} />
        <DAButton variant="ghost" label="Suivre une commande" onPress={() => {}} />
      </DACard>
    </DAScreen>
  );
}
TSX
}

patch_home_courier() {
  local f="$COURIER_APP/app/index.tsx"
  backup_file "$f"
  write_file "$f" <<'TSX'
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { DAHeader, DACard, DAButton, DAPill, DAScreen, DAText } from "@delishafrica/ui";

const API = process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me";

export default function Home() {
  const [health, setHealth] = useState<"loading" | "ok" | "nok">("loading");

  useEffect(() => {
    let mounted = true;
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then(() => mounted && setHealth("ok"))
      .catch(() => mounted && setHealth("nok"));
    return () => { mounted = false; };
  }, []);

  const pill = useMemo(() => {
    if (health === "loading") return <DAPill tone="neutral" label="API: ping..." />;
    if (health === "ok") return <DAPill tone="ok" label="API: OK" />;
    return <DAPill tone="bad" label="API: KO" />;
  }, [health]);

  return (
    <DAScreen>
      <DAHeader
        title="Courier"
        subtitle="Missions • vitesse • précision"
        right={pill}
      />

      <DACard style={{ marginBottom: 16 }}>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Mission du moment (démo)</DAText>
        <View style={{ height: 10 }} />
        <DAText muted>📍 Thieyp → Client • Bruxelles</DAText>
        <View style={{ height: 14 }} />
        <DAButton label="Démarrer la mission" onPress={() => {}} />
        <View style={{ height: 10 }} />
        <DAButton variant="ghost" label="Voir toutes les missions" onPress={() => {}} />
      </DACard>

      <DACard>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>États</DAText>
        <View style={{ height: 10 }} />
        <DAText muted>À venir : preuve de livraison + feedback “Mission accomplie”.</DAText>
      </DACard>
    </DAScreen>
  );
}
TSX
}

patch_home_merchant() {
  local f="$MERCHANT_APP/app/index.tsx"
  backup_file "$f"
  write_file "$f" <<'TSX'
import React, { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { DAHeader, DACard, DAButton, DAPill, DAScreen, DAText } from "@delishafrica/ui";

const API = process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me";

export default function Home() {
  const [health, setHealth] = useState<"loading" | "ok" | "nok">("loading");

  useEffect(() => {
    let mounted = true;
    fetch(`${API}/api/health`)
      .then((r) => r.json())
      .then(() => mounted && setHealth("ok"))
      .catch(() => mounted && setHealth("nok"));
    return () => { mounted = false; };
  }, []);

  const pill = useMemo(() => {
    if (health === "loading") return <DAPill tone="neutral" label="API: check..." />;
    if (health === "ok") return <DAPill tone="ok" label="API: OK" />;
    return <DAPill tone="bad" label="API: KO" />;
  }, [health]);

  return (
    <DAScreen>
      <DAHeader
        title="Merchant"
        subtitle="Cuisine • commandes • exécution"
        right={pill}
      />

      <DACard style={{ marginBottom: 16 }}>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Restaurant connecté</DAText>
        <View style={{ height: 10 }} />
        <DAText muted>Thieyp • Poste cuisine</DAText>
        <View style={{ height: 14 }} />
        <DAButton label="Voir commandes (démo)" onPress={() => {}} />
      </DACard>

      <DACard>
        <DAText style={{ fontWeight: "900", fontSize: 18 }}>Actions rapides</DAText>
        <View style={{ height: 12 }} />
        <DAButton label="Accepter" onPress={() => {}} />
        <View style={{ height: 10 }} />
        <DAButton variant="ghost" label="Marquer “Prêt”" onPress={() => {}} />
      </DACard>
    </DAScreen>
  );
}
TSX
}

patch_home_client
patch_home_courier
patch_home_merchant

echo "🧷 4) Notes"
echo " - Si vous utilisez pnpm workspaces, assurez-vous que packages/ui est bien détecté."
echo " - Ensuite: pnpm -w install (ou npm/yarn selon votre setup) dans $ROOT."
echo "✅ UI/UX v1 appliqué."
