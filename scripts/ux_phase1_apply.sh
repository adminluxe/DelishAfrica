#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

# ---- Detect app folder names (english vs french) ----
APP_CLIENT="apps/client"

if [[ -d "apps/courier" ]]; then APP_COURIER="apps/courier"
elif [[ -d "apps/coursier" ]]; then APP_COURIER="apps/coursier"
else
  echo "❌ Courier app folder not found (apps/courier or apps/coursier)"; exit 1
fi

if [[ -d "apps/merchant" ]]; then APP_MERCHANT="apps/merchant"
elif [[ -d "apps/marchand" ]]; then APP_MERCHANT="apps/marchand"
else
  echo "❌ Merchant app folder not found (apps/merchant or apps/marchand)"; exit 1
fi

for A in "$APP_CLIENT" "$APP_COURIER" "$APP_MERCHANT"; do
  [[ -d "$A" ]] || { echo "❌ Missing folder: $A"; exit 1; }
  [[ -d "$A/app" ]] || { echo "❌ Missing expo-router folder: $A/app"; exit 1; }
done

STAMP="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_ux_phase1_$STAMP"
mkdir -p "$BK"

backup_file() {
  local src="$1"
  [[ -f "$src" ]] || return 0
  local rel="${src#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$src" "$BK/$rel"
}

# Try to find the "home" route file without guessing too much
find_home_route() {
  local app_dir="$1"
  local candidates=(
    "$app_dir/app/index.tsx"
    "$app_dir/app/(tabs)/index.tsx"
    "$app_dir/app/(home)/index.tsx"
    "$app_dir/app/(app)/index.tsx"
  )
  for f in "${candidates[@]}"; do
    if [[ -f "$f" ]]; then echo "$f"; return 0; fi
  done
  # Fallback: create app/index.tsx (expo-router will pick it if no other index exists)
  echo "$app_dir/app/index.tsx"
}

write_file() {
  local path="$1"
  local content="$2"
  mkdir -p "$(dirname "$path")"
  printf "%s" "$content" > "$path"
}

apply_app_ux() {
  local APP_DIR="$1"
  local APP_ID="$2"       # client|courier|merchant
  local ACCENT="$3"       # hex string like #1E40AF
  local TITLE="$4"
  local TAGLINE="$5"

  local LAYOUT="$APP_DIR/app/_layout.tsx"
  local HOME
  HOME="$(find_home_route "$APP_DIR")"

  # Backups
  backup_file "$LAYOUT"
  backup_file "$HOME"
  backup_file "$APP_DIR/app/_ui/theme.ts"
  backup_file "$APP_DIR/app/_ui/ui.tsx"
  backup_file "$APP_DIR/app/_ui/useApiHealth.ts"

  # _ui/theme.ts
  write_file "$APP_DIR/app/_ui/theme.ts" "$(cat <<'TS'
export type Theme = {
  accent: string;
  bg0: string;
  bg1: string;
  text: string;
  muted: string;
  card: string;
  border: string;
  ok: string;
  warn: string;
  bad: string;
};

export const makeTheme = (accent: string): Theme => ({
  accent,
  bg0: "#070A12",
  bg1: "#0B1020",
  text: "#F5F7FF",
  muted: "#AAB1C7",
  card: "rgba(255,255,255,0.06)",
  border: "rgba(255,255,255,0.10)",
  ok: "#22C55E",
  warn: "#F59E0B",
  bad: "#EF4444",
});
TS
)"

  # _ui/useApiHealth.ts (reads both env keys to stay compatible)
  write_file "$APP_DIR/app/_ui/useApiHealth.ts" "$(cat <<'TS'
import { useCallback, useEffect, useMemo, useState } from "react";
import Constants from "expo-constants";

type HealthState =
  | { status: "idle" | "loading" }
  | { status: "ok"; ms: number; apiBaseUrl: string }
  | { status: "error"; message: string; apiBaseUrl: string };

function getApiBaseUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  const fromExtra =
    (extra.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
    (extra.EXPO_PUBLIC_API_URL as string | undefined);

  const fromEnv =
    (process.env.EXPO_PUBLIC_API_BASE_URL as string | undefined) ||
    (process.env.EXPO_PUBLIC_API_URL as string | undefined);

  return (fromEnv || fromExtra || "https://api.delishafrica.me").replace(/\/+$/, "");
}

export function useApiHealth() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [state, setState] = useState<HealthState>({ status: "idle" });

  const ping = useCallback(async () => {
    setState({ status: "loading" });
    const url = `${apiBaseUrl}/api/health`;

    const started = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4500);

    try {
      const res = await fetch(url, { signal: ctrl.signal });
      const ms = Date.now() - started;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setState({ status: "ok", ms, apiBaseUrl });
    } catch (e: any) {
      const msg =
        e?.name === "AbortError"
          ? "Timeout (4.5s)"
          : (e?.message ?? "Erreur inconnue");
      setState({ status: "error", message: msg, apiBaseUrl });
    } finally {
      clearTimeout(t);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    ping();
  }, [ping]);

  return { state, ping };
}
TS
)"

  # _ui/ui.tsx
  write_file "$APP_DIR/app/_ui/ui.tsx" "$(cat <<'TS'
import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { makeTheme } from "./theme";

export const theme = makeTheme("__ACCENT__");

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg0, paddingHorizontal: 16, paddingTop: 18 }}>
      {/* watermark */}
      <Text
        style={{
          position: "absolute",
          right: 12,
          bottom: 18,
          fontSize: 44,
          fontWeight: "900",
          color: "rgba(255,255,255,0.03)",
          transform: [{ rotate: "-12deg" }],
        }}
      >
        Delish
      </Text>

      {children}
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: theme.text, fontSize: 26, fontWeight: "900", letterSpacing: 0.2 }}>{children}</Text>;
}

export function P({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: theme.muted, fontSize: 14, marginTop: 6, lineHeight: 20 }}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View
      style={[
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: 1,
          borderRadius: 18,
          padding: 14,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Badge({ label, kind }: { label: string; kind: "ok" | "warn" | "bad" | "neutral" }) {
  const bg =
    kind === "ok" ? "rgba(34,197,94,0.14)" :
    kind === "warn" ? "rgba(245,158,11,0.14)" :
    kind === "bad" ? "rgba(239,68,68,0.14)" :
    "rgba(255,255,255,0.10)";

  const fg =
    kind === "ok" ? theme.ok :
    kind === "warn" ? theme.warn :
    kind === "bad" ? theme.bad :
    theme.text;

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }}>
      <Text style={{ color: fg, fontSize: 12, fontWeight: "800" }}>{label}</Text>
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = "primary",
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "ghost";
}) {
  const base = {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  };
  const style =
    variant === "primary"
      ? { ...base, backgroundColor: theme.accent }
      : { ...base, backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border };

  const color = variant === "primary" ? "#FFFFFF" : theme.text;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }, style]}>
      <Text style={{ color, fontWeight: "900" }}>{title}</Text>
    </Pressable>
  );
}
TS
)" | sed "s/__ACCENT__/$ACCENT/g" > "$APP_DIR/app/_ui/ui.tsx"

  # _layout.tsx
  write_file "$LAYOUT" "$(cat <<'TS'
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";

LogBox.ignoreLogs([
  "useEffect must not return anything besides a function",
]);

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
TS
)"

  # Home route
  mkdir -p "$(dirname "$HOME")"
  write_file "$HOME" "$(cat <<'TS'
import React from "react";
import { ScrollView, View, Text } from "react-native";
import { Screen, H1, P, Card, Badge, Button, theme } from "./_ui/ui";
import { useApiHealth } from "./_ui/useApiHealth";

export default function Home() {
  const { state, ping } = useApiHealth();

  const statusBadge = (() => {
    if (state.status === "loading" || state.status === "idle") return <Badge kind="warn" label="API: vérification…" />;
    if (state.status === "ok") return <Badge kind="ok" label={`API: OK • ${state.ms}ms`} />;
    return <Badge kind="bad" label={`API: KO • ${state.message}`} />;
  })();

  const apiLine = (() => {
    if (state.status === "ok" || state.status === "error") return state.apiBaseUrl;
    return "…";
  })();

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
        <H1>__TITLE__</H1>
        <P>__TAGLINE__</P>

        <View style={{ marginTop: 14 }}>
          {statusBadge}
          <Text style={{ color: theme.muted, marginTop: 8, fontSize: 12 }}>API: {apiLine}</Text>
        </View>

        <Card style={{ marginTop: 16 }}>
          <Text style={{ color: theme.text, fontWeight: "900", fontSize: 16 }}>Phase UX 1</Text>
          <Text style={{ color: theme.muted, marginTop: 8, lineHeight: 20 }}>
            • UI unifiée (cards, boutons, marges){'\n'}
            • États loading/erreur lisibles{'\n'}
            • Base solide pour le flow commande
          </Text>

          <View style={{ height: 12 }} />
          <Button title="Re-tester l’API" onPress={ping} />

          <View style={{ height: 10 }} />
          <Button title="Action principale (démo)" variant="ghost" onPress={() => {}} />
        </Card>

        <Card style={{ marginTop: 12, borderColor: "rgba(255,255,255,0.14)" }}>
          <Text style={{ color: theme.text, fontWeight: "900", fontSize: 15 }}>Prochain écran (Phase 2)</Text>
          <Text style={{ color: theme.muted, marginTop: 8, lineHeight: 20 }}>
            Ici on branchera le scénario “commande Thieyp” (création → suivi → côté merchant → côté courier).
          </Text>
        </Card>
      </ScrollView>
    </Screen>
  );
}
TS
)" | sed "s/__TITLE__/$TITLE/g; s/__TAGLINE__/$TAGLINE/g" > "$HOME"

  echo "✅ UX Phase 1 applied to $APP_DIR"
  echo "   - layout: $LAYOUT"
  echo "   - home:   $HOME"
}

apply_app_ux "$APP_CLIENT"  "client"  "#1E40AF" "DelishAfrica • Client"  "Découvrir. Commander. Suivre."
apply_app_ux "$APP_COURIER" "courier" "#16A34A" "DelishAfrica • Courier" "Rapide. Clair. Mission."
apply_app_ux "$APP_MERCHANT" "merchant" "#C2410C" "DelishAfrica • Merchant" "Cuisine. Commandes. Production."

echo
echo "🎉 Terminé."
echo "📦 Backups: $BK"
echo
echo "▶️ Relance (au choix):"
echo "   - root:    pnpm dev"
echo "   - client:  pnpm --filter=$APP_CLIENT dev"
echo "   - courier: pnpm --filter=$APP_COURIER dev"
echo "   - merchant:pnpm --filter=$APP_MERCHANT dev"
