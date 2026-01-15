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

export default function SignatureHomeMerchant() {
  const T = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(!__sessionOnboarded);

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<"ok" | "down" | "…">("…");

  const steps = useMemo(
    () => [
      { key: "s1", title: "Réception", subtitle: "Commandes entrantes (démo).", done: true },
      { key: "s2", title: "Préparation", subtitle: "Marquer “Prêt” dès que c’est chaud.", done: false },
      { key: "s3", title: "Passation", subtitle: "Le coursier prend la mission.", done: false },
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
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>DELISHAFRICA • MERCHANT</Text>
        <Text style={{ color: T.colors.text, fontSize: 30, fontWeight: "900", lineHeight: 34 }}>
          Poste cuisine.
        </Text>
        <Text style={{ color: T.colors.subtext, fontSize: 15, lineHeight: 20 }}>
          Actions rapides. Lisibilité maximale. Zéro stress.
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
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>RESTAURANT CONNECTÉ</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={16} />
            <ShimmerLine h={12} w="70%" />
            <ShimmerLine h={44} />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 20 }}>Thieyp</Text>
            <Text style={{ color: T.colors.subtext }}>
              Interface pro, claire, premium — la cuisine au contrôle.
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <DelishButton title="Accepter (démo)" onPress={() => {}} style={{ flex: 1 }} />
              <DelishButton title="Marquer prêt (démo)" variant="ghost" onPress={() => {}} style={{ flex: 1 }} />
            </View>
          </View>
        )}
      </DelishCard>

      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18, marginBottom: 10 }}>
          Timeline Opération
        </Text>
        <OrderTimeline steps={steps} />
      </DelishCard>

      <View style={{ height: 18 }} />
    </ScrollView>
  );
}
