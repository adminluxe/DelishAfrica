/**
 * DA_SAFEAREA_WRAPPER
 * - Fix iPhone 16 / Dynamic Island (safe-area top)
 * - Ajoute un bouton DEV pour ouvrir /orders-demo
 */
import React from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import InnerLayout from "../da/InnerLayout";

function DevOrdersButton() {
  const router = useRouter();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        top: 8,
        right: 10,
        zIndex: 9999,
      }}
    >
      <Pressable
        onPress={() => router.push("/orders-demo")}
        style={{
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 14,
          backgroundColor: "rgba(255,255,255,0.14)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
        }}
      >
        <Text style={{ fontWeight: "800" }}>DEMO</Text>
      </Pressable>
    </View>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, paddingTop: 6 }} edges={["top", "left", "right"]}>
        <InnerLayout />
        <DevOrdersButton />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
