import React from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, usePathname } from "expo-router";

export function DemoFab() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // évite d'afficher un bouton "DEMO" sur la page demo elle-même (optionnel)
  const hidden = pathname === "/orders-demo";
  if (hidden) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: (insets.top || 0) + 8,
        right: 12,
        zIndex: 9999,
      }}
    >
      <Pressable
        onPress={() => router.push("/orders-demo")}
        style={{
          paddingVertical: 10,
          paddingHorizontal: 14,
          borderRadius: 999,
          backgroundColor: "rgba(255,255,255,0.16)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.22)",
        }}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>DEMO</Text>
      </Pressable>
    </View>
  );
}

/**
 * Added automatically to silence Expo Router warnings for non-route modules kept under app/.
 * Safe: returns null, so even if navigated accidentally, it renders nothing.
 */
export default function __expo_router_noop_route__() { return null; }
