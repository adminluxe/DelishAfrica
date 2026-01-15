import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, SafeAreaView, Text, View } from "react-native";
import Constants from "expo-constants";

type Merchant = { id: string; name: string; city?: string };

const API_URL =
  (Constants.expoConfig?.extra as any)?.PUBLIC_API_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me";

export default function RestaurantsScreen() {
  const [data, setData] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        // Essaie /api/merchants (endpoint courant). Adapte si besoin.
        const r = await fetch(`${API_URL}/api/merchants?limit=50`);
        const json = await r.json();
        setData(json?.items ?? json ?? []);
      } catch (e) {
        console.warn("Fetch merchants failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "white" }}>
      <Stack.Screen options={{ title: "Restaurants" }} />
      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 12 }}>Chargement…</Text>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/restaurants/${item.id}`)}
              style={{
                padding: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#eee",
                marginBottom: 12,
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.name}</Text>
              <Text style={{ color: "#6b7280", marginTop: 4 }}>{item.city ?? "—"}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text>Aucun restaurant pour le moment.</Text>}
        />
      )}
    </SafeAreaView>
  );
}
