import { Stack, usePathname, useRouter } from "expo-router";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";

function DemoPill() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();

  const top = insets.top + 8; // ✅ descend sous Dynamic Island / notch
  const onDemo = pathname === "/orders-demo";

  return (
    <View pointerEvents="box-none" style={{ position: "absolute", top, right: 12, zIndex: 99999 }}>
      <Pressable
        hitSlop={12}
        onPress={() => router.push(onDemo ? "/" : "/orders-demo")}
        style={({ pressed }) => ({
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 16,
          backgroundColor: "rgba(255,255,255,0.12)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.20)",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ color: "white", fontWeight: "800", letterSpacing: 0.6 }}>DEMO</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1 }}>
        <Stack screenOptions={{ headerShown: false }} />
        <DemoPill />
      </View>
    </SafeAreaProvider>
  );
}
