import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import DelishCard from "../components/DelishCard";
import DelishButton from "../components/DelishButton";
import ShimmerLine from "../components/ShimmerLine";
import OrderTimeline from "../components/OrderTimeline";
import Onboarding from "./Onboarding";
import { useTheme } from "../hooks/useTheme";

let __sessionOnboarded = false;
const API = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";

export default function SignatureHomeCourier() {
  const T = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(!__sessionOnboarded);

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<"ok" | "down" | "…">("…");

  const steps = useMemo(
    () => [
      { key: "s1", title: "Mission", subtitle: "Livraison Thieyp (démo).", done: true },
      { key: "s2", title: "Pick-up", subtitle: "Récupérer la commande au restaurant.", done: false },
      { key: "s3", title: "Livré", subtitle: "Confirmer la livraison au client.", done: false },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
        if (!alive) return;
        setHealth(h?.status === "ok" ? "ok" : "down");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, []);

  if (showOnboarding) {
    return (
      <Onboarding
        onDone={() => {
          __sessionOnboarded = true;
          setShowOnboarding(false);
        }}
      />
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.colors.bg }} contentContainerStyle={{ padding: 18, gap: 14 }}>
      <View style={{ gap: 4, marginTop: 4 }}>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>DELISHAFRICA • COURIER</Text>
        <Text style={{ color: T.colors.text, fontSize: 30, fontWeight: "900", lineHeight: 34 }}>
          En mouvement.
        </Text>
        <Text style={{ color: T.colors.subtext, fontSize: 15, lineHeight: 20 }}>
          Ultra lisible, ultra rapide. On ne perd jamais une seconde.
        </Text>
      </View>

      <DelishCard>
        <Text style={{ color: T.colors.subtext, fontWeight: "800", letterSpacing: 1 }}>API</Text>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16, marginTop: 6 }}>{API}</Text>
        <Text style={{ color: health === "ok" ? T.colors.ok : T.colors.warn, marginTop: 6, fontWeight: "800" }}>
          Status: {health}
        </Text>
      </DelishCard>

      <DelishCard>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>MISSION DE DÉMO</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={16} />
            <ShimmerLine h={12} w="70%" />
            <ShimmerLine h={44} />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 20 }}>Livraison • Thieyp</Text>
            <Text style={{ color: T.colors.subtext }}>
              Mission claire, CTA visibles — UX orientée action.
            </Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <DelishButton title="Voir mission (démo)" onPress={() => {}} style={{ flex: 1 }} />
              <DelishButton title="Terminer (démo)" variant="ghost" onPress={() => {}} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </DelishCard>

      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18, marginBottom: 10 }}>
          Timeline Mission
        </Text>
        <OrderTimeline steps={steps} />
      </DelishCard>

      <View style={{ height: 18 }} />
    </ScrollView>
  );
}
