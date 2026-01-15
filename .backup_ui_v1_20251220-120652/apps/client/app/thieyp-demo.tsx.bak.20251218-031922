import React from "react";
import { View, Text, Pressable, ScrollView, Alert } from "react-native";
import { getApiBase, demoReset, demoCreate, demoList, demoGet, demoSetStatus, DemoOrderItem } from "./orders-demo";

function Btn(props: { title: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        opacity: props.disabled ? 0.5 : 1,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: "700" }}>{props.title}</Text>
    </Pressable>
  );
}

export default function ThieypDemoScreen() {
  const base = getApiBase();
  const role = "client";

  const [busy, setBusy] = React.useState(false);
  const [orderId, setOrderId] = React.useState<string | null>(null);
  const [json, setJson] = React.useState<any>(null);

  const menu: DemoOrderItem[] = [
    { id: "th1", name: "Yassa poulet", qty: 1, price: 14.9 },
    { id: "th2", name: "Mafé boeuf", qty: 1, price: 15.9 },
    { id: "th3", name: "Thieboudienne", qty: 1, price: 16.9 },
  ];

  async function run(fn: () => Promise<any>) {
    try {
      setBusy(true);
      const out = await fn();
      setJson(out);
      return out;
    } catch (e: any) {
      Alert.alert("Erreur", String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  // polling
  React.useEffect(() => {
    let t: any;
    if (orderId) {
      t = setInterval(() => {
        demoGet(base, { id: orderId }).then(setJson).catch(() => {});
      }, 2000);
    }
    return () => t && clearInterval(t);
  }, [orderId, base]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Thieyp Demo — {role}</Text>
      <Text style={{ opacity: 0.7 }}>API: {base}</Text>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Btn title="Reset demo" disabled={busy} onPress={() => run(() => demoReset(base))} />
        {role === "client" ? (
          <Btn
            title="Créer commande (Thieyp)"
            disabled={busy}
            onPress={() =>
              run(async () => {
                const out = await demoCreate(base, { partnerSlug: "thieyp", items: menu });
                setOrderId(out?.order?.id ?? null);
                return out;
              })
            }
          />
        ) : (
          <Btn
            title="Refresh list"
            disabled={busy}
            onPress={() => run(() => demoList(base, { role, partnerSlug: "thieyp" }))}
          />
        )}
      </View>

      {role === "merchant" && json?.orders?.length ? (
        <View style={{ gap: 12 }}>
          {json.orders.map((o: any) => (
            <View key={o.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
              <Text style={{ fontWeight: "800" }}>{o.id}</Text>
              <Text>Status: {o.status}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                <Btn title="Accept" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "accepted" }))} />
                <Btn title="Ready" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "ready" }))} />
                <Btn title="Cancel" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "cancelled" }))} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {role === "courier" && json?.orders?.length ? (
        <View style={{ gap: 12 }}>
          {json.orders.map((o: any) => (
            <View key={o.id} style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
              <Text style={{ fontWeight: "800" }}>{o.id}</Text>
              <Text>Status: {o.status}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                <Btn title="Pick up" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "picked_up" }))} />
                <Btn title="Deliver" disabled={busy} onPress={() => run(() => demoSetStatus(base, { id: o.id, status: "delivered" }))} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {role === "client" && orderId ? (
        <View style={{ padding: 12, borderRadius: 12, borderWidth: 1 }}>
          <Text style={{ fontWeight: "800" }}>Order ID</Text>
          <Text selectable>{orderId}</Text>
          <Text style={{ marginTop: 8, opacity: 0.7 }}>Polling status toutes les 2s…</Text>
        </View>
      ) : null}

      <Text style={{ fontSize: 12, opacity: 0.6 }}>
        Astuce: ouvre la route /thieyp-demo dans Expo Router (URL finissant par --/thieyp-demo).
      </Text>

      <Text style={{ fontSize: 12, opacity: 0.6 }}>
        Debug JSON:
      </Text>
      <Text selectable style={{ fontFamily: "Menlo", fontSize: 11 }}>
        {JSON.stringify(json, null, 2)}
      </Text>
    </ScrollView>
  );
}
