import React from "react";
import { View, Text, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";

export default function OrdersDemo() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: "#070A12", padding: 20, paddingTop: 28 }}>
      <Stack.Screen options={{ title: "Order (démo)" }} />

      <Text style={{ color: "white", fontSize: 28, fontWeight: "800", marginBottom: 10 }}>
        Commande Thieyp (démo)
      </Text>

      <View style={{ backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 18, padding: 16, marginTop: 12 }}>
        <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 16, fontWeight: "700" }}>✔ Commande créée</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 6 }}>⏳ En préparation</Text>
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <Pressable
          onPress={() => router.back()}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: "rgba(255,255,255,0.08)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Retour</Text>
        </Pressable>

        <Pressable
          onPress={() => {}}
          style={{
            flex: 1,
            paddingVertical: 14,
            borderRadius: 16,
            backgroundColor: "#2EE889",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#06110B", fontWeight: "900" }}>Suivre (démo)</Text>
        </Pressable>
      </View>
    </View>
  );
}
