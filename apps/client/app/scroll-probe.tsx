import React, { useMemo } from "react";
import { View, Text, ScrollView, FlatList, Pressable } from "react-native";
import { useRouter } from "expo-router";

export default function ScrollProbe() {
  const router = useRouter();
  const items = useMemo(() => Array.from({ length: 80 }).map((_, i) => `Item #${i + 1}`), []);

  return (
    <View style={{ flex: 1, backgroundColor: "#070A12" }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 12 }}>
        <Text style={{ color: "#F4F7FF", fontSize: 28, fontWeight: "800" }}>Scroll Probe</Text>
        <Text style={{ color: "#AAB6D6", marginTop: 6 }}>
          Si ça ne scroll pas ici, on est sur un blocage gestures/overlay.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={{ marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "#1E2A4D" }}
        >
          <Text style={{ color: "#F4F7FF", fontWeight: "700" }}>← Retour</Text>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
        showsVerticalScrollIndicator
        scrollEventThrottle={16}
        onScrollBeginDrag={() => console.log("[SCROLLPROBE] ScrollView begin drag ✅")}
        onScroll={() => console.log("[SCROLLPROBE] onScroll …")}
      >
        <View style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#1E2A4D", marginBottom: 16 }}>
          <Text style={{ color: "#F4F7FF", fontWeight: "800", marginBottom: 6 }}>A) ScrollView section</Text>
          {items.slice(0, 30).map((t) => (
            <Text key={t} style={{ color: "#AAB6D6", paddingVertical: 6 }}>
              {t}
            </Text>
          ))}
        </View>

        <View style={{ padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#1E2A4D" }}>
          <Text style={{ color: "#F4F7FF", fontWeight: "800", marginBottom: 10 }}>B) FlatList section</Text>
          <FlatList
            data={items}
            keyExtractor={(x) => x}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <Text style={{ color: "#AAB6D6", paddingVertical: 8 }}>{item}</Text>
            )}
          />
          <Text style={{ color: "#AAB6D6", marginTop: 10 }}>
            (FlatList intégrée avec scroll désactivé, le ScrollView porte tout)
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
