import React from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useLocalSearchParams, router } from "expo-router";

export default function PartnerSlugScreen() {
  const params = useLocalSearchParams();
  const slug = typeof params?.slug === "string" ? params.slug : "partner";

  return (
    <View style={{ flex: 1, backgroundColor: "#070A10" }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 54 }}>
        <Text style={{ color: "#E9EDF7", fontSize: 26, fontWeight: "800" }}>
          Partenaire
        </Text>

        <View
          style={{
            marginTop: 12,
            padding: 16,
            borderRadius: 18,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: "rgba(255,255,255,0.04)",
          }}
        >
          <Text style={{ color: "#9AA6C0", fontSize: 13, marginBottom: 6 }}>
            Identifiant
          </Text>
          <Text style={{ color: "#E9EDF7", fontSize: 18, fontWeight: "700" }}>
            {slug}
          </Text>

          <Text style={{ color: "#9AA6C0", fontSize: 13, marginTop: 12 }}>
            Statut
          </Text>
          <Text
            style={{
              color: "#39D98A",
              fontSize: 16,
              fontWeight: "700",
              marginTop: 4,
            }}
          >
            En ligne
          </Text>
        </View>

        <View style={{ height: 16 }} />

        <Pressable
          onPress={() => router.back()}
          style={{
            paddingVertical: 14,
            paddingHorizontal: 16,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.12)",
            backgroundColor: "rgba(255,255,255,0.06)",
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#E9EDF7", fontSize: 16, fontWeight: "800" }}>
            Retour
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
