import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import DelishCard from "../components/DelishCard";
import DelishButton from "../components/DelishButton";
import ShimmerLine from "../components/ShimmerLine";
import OrderTimeline from "../components/OrderTimeline";
import Onboarding from "./Onboarding";
import { useTheme } from "../hooks/useTheme";

type Partner = {
  id?: string;
  slug?: string;
  name?: string;
  city?: string;
  tagline?: string;
};

let __sessionOnboarded = false;

const API = process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.delishafrica.me";

export default function SignatureHomeClient() {
  const T = useTheme();
  const [showOnboarding, setShowOnboarding] = useState(!__sessionOnboarded);

  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<"ok" | "down" | "…">("…");
  const [partners, setPartners] = useState<Partner[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const steps = useMemo(
    () => [
      { key: "s1", title: "Découverte", subtitle: "Explore Thieyp et les partenaires.", done: true },
      { key: "s2", title: "Commande", subtitle: "Action principale (démo) → bientôt full flow.", done: false },
      { key: "s3", title: "Suivi", subtitle: "Timeline & tracking (V1 UI prête).", done: false },
    ],
    []
  );

  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        setLoading(true);
        setErr(null);

        const h = await fetch(`${API}/api/health`).then((r) => r.json()).catch(() => null);
        if (!alive) return;
        setHealth(h?.status === "ok" ? "ok" : "down");

        const p = await fetch(`${API}/api/partners`).then((r) => r.json()).catch(() => []);
        if (!alive) return;
        setPartners(Array.isArray(p) ? p : []);
      } catch (e: any) {
        if (!alive) return;
        setErr("Impossible de charger les données. Vérifie l’API.");
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

  const thieyp = partners.find((x) => (x?.slug || "").toLowerCase().includes("thieyp")) || partners.find((x) => (x?.name || "").toLowerCase().includes("thieyp"));
  const rest = partners.filter((x) => x !== thieyp);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: T.colors.bg }} contentContainerStyle={{ padding: 18, gap: 14 }}>
      {/* Header */}
      <View style={{ gap: 4, marginTop: 4 }}>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>DELISHAFRICA • CLIENT</Text>
        <Text style={{ color: T.colors.text, fontSize: 30, fontWeight: "900", lineHeight: 34 }}>
          L’Afrique à table.
        </Text>
        <Text style={{ color: T.colors.subtext, fontSize: 15, lineHeight: 20 }}>
          Explore, ressens, commande. Une expérience qui respecte notre grandeur.
        </Text>
      </View>

      {/* Health */}
      <DelishCard>
        <Text style={{ color: T.colors.subtext, fontWeight: "800", letterSpacing: 1 }}>API</Text>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 16, marginTop: 6 }}>
          {API}
        </Text>
        <Text style={{ color: health === "ok" ? T.colors.ok : T.colors.warn, marginTop: 6, fontWeight: "800" }}>
          Status: {health}
        </Text>
      </DelishCard>

      {/* Timeline */}
      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18, marginBottom: 10 }}>
          Parcours V1
        </Text>
        <OrderTimeline steps={steps} />
      </DelishCard>

      {/* Featured partner */}
      <DelishCard>
        <Text style={{ color: T.colors.brand2, fontWeight: "900", letterSpacing: 2, fontSize: 12 }}>PARTENAIRE MIS EN AVANT</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={16} />
            <ShimmerLine h={12} w="70%" />
            <ShimmerLine h={44} />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 20 }}>
              {thieyp?.name || "Thieyp"}
            </Text>
            <Text style={{ color: T.colors.subtext }}>
              {thieyp?.tagline || "La vitrine V1 — une première expérience mémorable."}
            </Text>

            <DelishButton
              title="Action principale (démo)"
              onPress={() => {
                // Démo : action placeholder, branchable vers /orders ensuite
                // Ici on garde l’UI stable sans casser le flow.
              }}
            />
          </View>
        )}

        {!!err && <Text style={{ color: T.colors.warn, marginTop: 10 }}>{err}</Text>}
      </DelishCard>

      {/* Others */}
      <DelishCard>
        <Text style={{ color: T.colors.text, fontWeight: "900", fontSize: 18 }}>Autres partenaires</Text>

        {loading ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            <ShimmerLine h={14} />
            <ShimmerLine h={14} />
            <ShimmerLine h={14} w="80%" />
          </View>
        ) : (
          <View style={{ marginTop: 12, gap: 10 }}>
            {rest.length === 0 ? (
              <Text style={{ color: T.colors.subtext }}>Aucun partenaire pour l’instant.</Text>
            ) : (
              rest.slice(0, 8).map((p, i) => (
                <View
                  key={`${p?.id || p?.slug || p?.name || i}`}
                  style={{
                    padding: 12,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: T.colors.border,
                    backgroundColor: "rgba(255,255,255,0.02)",
                  }}
                >
                  <Text style={{ color: T.colors.text, fontWeight: "800" }}>{p?.name || "Partenaire"}</Text>
                  <Text style={{ color: T.colors.subtext, marginTop: 3 }}>{p?.city || "—"}</Text>
                </View>
              ))
            )}
          </View>
        )}
      </DelishCard>

      {/* Footer spacing */}
      <View style={{ height: 18 }} />
    </ScrollView>
  );
}
