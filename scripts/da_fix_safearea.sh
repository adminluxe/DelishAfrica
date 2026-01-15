#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
cd "$ROOT"

APP_CLIENT="apps/client"

if [[ -d "apps/courier" ]]; then APP_COURIER="apps/courier"
elif [[ -d "apps/coursier" ]]; then APP_COURIER="apps/coursier"
else echo "❌ courier folder not found"; exit 1; fi

if [[ -d "apps/merchant" ]]; then APP_MERCHANT="apps/merchant"
elif [[ -d "apps/marchand" ]]; then APP_MERCHANT="apps/marchand"
else echo "❌ merchant folder not found"; exit 1; fi

stamp="$(date +%Y%m%d_%H%M%S)"
BK="$ROOT/.backup_safearea_$stamp"
mkdir -p "$BK"

backup_file() {
  local src="$1"
  [[ -f "$src" ]] || return 0
  local rel="${src#$ROOT/}"
  mkdir -p "$BK/$(dirname "$rel")"
  cp -a "$src" "$BK/$rel"
}

extract_accent() {
  local ui="$1"
  local a=""
  if [[ -f "$ui" ]]; then
    a="$(grep -Eo 'makeTheme\("([^"]+)"\)' "$ui" | head -n1 | sed -E 's/makeTheme\("([^"]+)"\)/\1/')"
  fi
  [[ -n "$a" ]] && echo "$a" || echo "#1E40AF"
}

write_layout() {
  local layout="$1"
  cat > "$layout" <<'TS'
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

LogBox.ignoreLogs([
  "useEffect must not return anything besides a function",
]);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
TS
}

write_ui() {
  local ui="$1"
  local ACCENT="$2"
  cat > "$ui" <<TS
import React from "react";
import { Pressable, Text, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeTheme } from "./theme";

export const theme = makeTheme("$ACCENT");

export function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg0,
        paddingHorizontal: 16,
        // ✅ évite l'encoche / Dynamic Island
        paddingTop: insets.top + 14,
        // ✅ évite la home-indicator
        paddingBottom: insets.bottom + 14,
      }}
    >
      {/* watermark */}
      <Text
        style={{
          position: "absolute",
          right: 12,
          bottom: 18 + insets.bottom,
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
  return (
    <Text style={{ color: theme.text, fontSize: 26, fontWeight: "900", letterSpacing: 0.2 }}>
      {children}
    </Text>
  );
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
    kind === "ok"
      ? "rgba(34,197,94,0.14)"
      : kind === "warn"
      ? "rgba(245,158,11,0.14)"
      : kind === "bad"
      ? "rgba(239,68,68,0.14)"
      : "rgba(255,255,255,0.10)";

  const fg =
    kind === "ok" ? theme.ok : kind === "warn" ? theme.warn : kind === "bad" ? theme.bad : theme.text;

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
}

apply_app() {
  local APP="$1"
  local LAYOUT="$ROOT/$APP/app/_layout.tsx"
  local UI="$ROOT/$APP/app/_ui/ui.tsx"

  echo "== Applying SafeArea to: $APP =="

  backup_file "$LAYOUT"
  backup_file "$UI"

  local ACCENT
  ACCENT="$(extract_accent "$UI")"

  mkdir -p "$(dirname "$LAYOUT")" "$(dirname "$UI")"

  write_layout "$LAYOUT"
  write_ui "$UI" "$ACCENT"

  echo "✅ Done: $APP (accent preserved: $ACCENT)"
}

apply_app "$APP_CLIENT"
apply_app "$APP_COURIER"
apply_app "$APP_MERCHANT"

echo
echo "🎒 Backups: $BK"
echo "👉 Reload apps: press 'r' in each Expo terminal (or restart pnpm dev)"
