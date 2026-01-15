#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
APPS=("client" "courier" "merchant")

write_file() {
  local path="$1"
  mkdir -p "$(dirname "$path")"
  cat > "$path"
}

echo "=== DA UI Kit v2 ==="

for app in "${APPS[@]}"; do
  BASE="$ROOT/apps/$app"
  [[ -d "$BASE" ]] || continue
  DA_DIR="$BASE/components/da"
  mkdir -p "$DA_DIR"

  # StatusPill (badge néon)
  write_file "$DA_DIR/StatusPill.tsx" <<'EOF'
import React from "react";
import { View, Text } from "react-native";
import { DA } from "./theme";

type Props = { status?: string };

function getTone(status?: string) {
  const s = (status || "").toUpperCase();
  if (s === "READY") return { bg: "rgba(46,229,157,0.16)", border: "rgba(46,229,157,0.45)", text: "#2EE59D", label: "READY" };
  if (s === "DELIVERED") return { bg: "rgba(124,92,255,0.16)", border: "rgba(124,92,255,0.45)", text: "#7C5CFF", label: "DELIVERED" };
  if (s === "PENDING") return { bg: "rgba(255,138,61,0.16)", border: "rgba(255,138,61,0.45)", text: "#FF8A3D", label: "PENDING" };
  return { bg: "rgba(255,255,255,0.08)", border: DA.stroke, text: DA.sub, label: status || "UNKNOWN" };
}

export function StatusPill({ status }: Props) {
  const tone = getTone(status);
  return (
    <View style={{
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: tone.bg,
      borderWidth: 1,
      borderColor: tone.border,
    }}>
      <Text style={{ color: tone.text, fontWeight: "900", letterSpacing: 0.6 }}>
        {tone.label}
      </Text>
    </View>
  );
}
EOF

  # NeonButton (CTA)
  write_file "$DA_DIR/NeonButton.tsx" <<'EOF'
import React from "react";
import { Pressable, Text, ActivityIndicator, ViewStyle } from "react-native";
import { DA } from "./theme";

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tone?: "accent" | "ghost";
  style?: ViewStyle;
};

export function NeonButton({ label, onPress, loading, disabled, tone = "accent", style }: Props) {
  const isDisabled = !!disabled || !!loading;

  const bg =
    tone === "ghost"
      ? "rgba(255,255,255,0.10)"
      : DA.accent;

  const border =
    tone === "ghost"
      ? DA.stroke
      : "rgba(255,255,255,0.10)";

  const textColor =
    tone === "ghost"
      ? DA.text
      : "#07101B";

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => ([
        {
          height: tone === "ghost" ? 46 : 54,
          borderRadius: tone === "ghost" ? 16 : 18,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          borderWidth: 1,
          borderColor: border,
          opacity: isDisabled ? 0.55 : (pressed ? 0.85 : 1),
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        style,
      ])}
    >
      {loading ? (
        <ActivityIndicator />
      ) : (
        <Text style={{ color: textColor, fontSize: 16, fontWeight: "900", letterSpacing: 0.3 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
EOF

  echo "✔ $app: StatusPill + NeonButton"
done

echo "=== OK ==="
