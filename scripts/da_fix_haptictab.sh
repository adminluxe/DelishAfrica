#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"

patch_file () {
  local FILE="$1"

  if [ -f "$FILE" ]; then
    echo "[DA][haptic] Patch de $FILE"
    cat > "$FILE" << 'TSX'
import React from "react";
import { TouchableOpacity } from "react-native";
import * as Haptics from "expo-haptics";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";

export function HapticTab(props: BottomTabBarButtonProps) {
  const { onPress, children, ...rest } = props;

  const handlePress = async () => {
    try {
      await Haptics.impactAsync(
        Haptics.ImpactFeedbackStyle.Medium
      );
    } catch (e) {
      console.warn("[HapticTab] Erreur haptics", e);
    }

    if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      {...rest}
      activeOpacity={0.9}
      onPress={handlePress}
    >
      {children}
    </TouchableOpacity>
  );
}

export default HapticTab;
TSX
  else
    echo "[DA][haptic] Fichier absent, on saute : $FILE"
  fi
}

patch_file "$ROOT/apps/client/components/haptic-tab.tsx"
patch_file "$ROOT/apps/courier/components/haptic-tab.tsx"
patch_file "$ROOT/apps/merchant/components/haptic-tab.tsx"

echo "[DA][haptic] Patch terminé."
