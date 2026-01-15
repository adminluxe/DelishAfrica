#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"

backup_if_exists() {
  local f="$1"
  if [[ -f "$f" ]]; then
    cp -a "$f" "${f}.bak.${TS}"
  fi
}

write_file() {
  local path="$1"
  local dir
  dir="$(dirname "$path")"
  mkdir -p "$dir"
  backup_if_exists "$path"
  cat > "$path"
}

echo "=== DA SafeTop + Futuriste v1 ==="
echo "TS: $TS"
echo

for APP in client courier merchant; do
  BASE="$ROOT/apps/$APP"
  [[ -d "$BASE" ]] || { echo "!! Skip $APP (dossier introuvable: $BASE)"; continue; }

  echo "---- APP: $APP"

  # 1) components/da
  mkdir -p "$BASE/components/da"

  # theme.ts (accent différent selon app)
  ACCENT="#7C5CFF"
  if [[ "$APP" == "courier" ]]; then ACCENT="#2EE59D"; fi
  if [[ "$APP" == "merchant" ]]; then ACCENT="#FF8A3D"; fi

  write_file "$BASE/components/da/theme.ts" <<EOF
export const DA = {
  radius: { xl: 22, lg: 18, md: 14 },
  space: { xs: 8, sm: 12, md: 16, lg: 22, xl: 28 },

  bg: "#070A12",
  card: "rgba(255,255,255,0.06)",
  stroke: "rgba(255,255,255,0.10)",

  text: "#EAF0FF",
  sub: "rgba(234,240,255,0.72)",

  accent: "${ACCENT}",
  danger: "#FF4D6D",
  ok: "#2EE59D",
};
EOF

  # Screen.tsx (safe top + padding cohérent)
  write_file "$BASE/components/da/Screen.tsx" <<'EOF'
import React from "react";
import { View, ViewProps, Platform, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = ViewProps & {
  children: React.ReactNode;
  padded?: boolean;
  headerSafe?: boolean;
  topOffset?: number;
};

export function Screen({
  children,
  style,
  padded = true,
  headerSafe = true,
  topOffset = 10,
  ...rest
}: Props) {
  const insets = useSafeAreaInsets();

  const topSafe =
    headerSafe
      ? (insets.top || 0) +
        (Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0) +
        topOffset
      : 0;

  return (
    <View
      {...rest}
      style={[
        {
          flex: 1,
          paddingTop: topSafe,
          paddingLeft: padded ? 18 : 0,
          paddingRight: padded ? 18 : 0,
          paddingBottom: padded ? Math.max(insets.bottom, 16) : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
EOF

  # GlassCard.tsx
  write_file "$BASE/components/da/GlassCard.tsx" <<'EOF'
import React from "react";
import { View, ViewProps } from "react-native";
import { DA } from "./theme";

export function GlassCard({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: DA.card,
          borderColor: DA.stroke,
          borderWidth: 1,
          borderRadius: DA.radius.xl,
          padding: DA.space.md,
        },
        style,
      ]}
    />
  );
}
EOF

  # 2) Patch layout (global = plus rien tronqué en haut)
  LAYOUT="$BASE/app/_layout.tsx"
  if [[ -f "$LAYOUT" ]]; then
    backup_if_exists "$LAYOUT"
    write_file "$LAYOUT" <<'EOF'
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Screen } from "../components/da/Screen";
import { DA } from "../components/da/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Screen padded={false} topOffset={10} style={{ backgroundColor: DA.bg }}>
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerTintColor: DA.text,
            headerTitleStyle: { fontWeight: "800" },
            contentStyle: { backgroundColor: DA.bg },
          }}
        />
      </Screen>
    </SafeAreaProvider>
  );
}
EOF
    echo "   ✔ patched: $LAYOUT"
  else
    echo "   !! layout absent: $LAYOUT (skip layout patch)"
  fi

  echo
done

echo "=== OK ==="
echo "Backups: *.bak.${TS}"
