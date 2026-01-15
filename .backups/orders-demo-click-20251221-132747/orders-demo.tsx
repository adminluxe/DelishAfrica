import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";

type HealthState = "loading" | "ok" | "down";

function pickApiBase(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "https://api.delishafrica.me"
  );
}

async function pingHealth(base: string): Promise<boolean> {
  const candidates = [`${base}/api/v1/health`, `${base}/api/health`, `${base}/health`];
  for (const url of candidates) {
    try {
      const res = await fetch(url, { method: "GET" });
      if (res.ok) return true;
    } catch {}
  }
  return false;
}

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warn" | "danger" }) {
  const bg =
    tone === "success"
      ? "rgba(46, 204, 113, 0.18)"
      : tone === "warn"
        ? "rgba(241, 196, 15, 0.18)"
        : tone === "danger"
          ? "rgba(231, 76, 60, 0.18)"
          : "rgba(255,255,255,0.10)";

  const border =
    tone === "success"
      ? "rgba(46, 204, 113, 0.35)"
      : tone === "warn"
        ? "rgba(241, 196, 15, 0.35)"
        : tone === "danger"
          ? "rgba(231, 76, 60, 0.35)"
          : "rgba(255,255,255,0.14)";

  const color =
    tone === "success"
      ? "#B8F5D0"
      : tone === "warn"
        ? "#FFE9A6"
        : tone === "danger"
          ? "#FFC1BA"
          : "rgba(255,255,255,0.86)";

  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: bg, borderWidth: 1, borderColor: border }}>
      <Text style={{ color, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function PrimaryButton({
  label,
  onPress,
  disabled,
  tone = "gold",
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: "gold" | "danger" | "ghost";
}) {
  const styles =
    tone === "danger"
      ? { bg: "rgba(231, 76, 60, 0.22)", border: "rgba(231, 76, 60, 0.38)", txt: "#FFD0CB" }
      : tone === "ghost"
        ? { bg: "rgba(255,255,255,0.08)", border: "rgba(255,255,255,0.14)", txt: "rgba(255,255,255,0.92)" }
        : { bg: "rgba(243, 190, 90, 0.22)", border: "rgba(243, 190, 90, 0.38)", txt: "#FFE7B8" };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          paddingVertical: 14,
          borderRadius: 16,
          backgroundColor: styles.bg,
          borderWidth: 1,
          borderColor: styles.border,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <Text style={{ color: styles.txt, fontWeight: "800", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

export default function OrdersDemoClient() {
  const API = useMemo(() => pickApiBase(), []);
  const [health, setHealth] = useState<HealthState>("loading");

  const [created, setCreated] = useState(true);
  const [preparing, setPreparing] = useState(true);
  const [enRoute, setEnRoute] = useState(false);
  const [delivered, setDelivered] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const ok = await pingHealth(API);
      if (!alive) return;
      setHealth(ok ? "ok" : "down");
    })();
    return () => {
      alive = false;
    };
  }, [API]);

  function resetDemo() {
    setCreated(true);
    setPreparing(true);
    setEnRoute(false);
    setDelivered(false);
  }

  function cancelDemo() {
    setPreparing(false);
    setEnRoute(false);
    setDelivered(false);
    setCreated(false);
  }

  function nextStep() {
    if (!created) {
      resetDemo();
      return;
    }
    if (preparing) {
      setPreparing(false);
      setEnRoute(true);
      return;
    }
    if (enRoute) {
      setEnRoute(false);
      setDelivered(true);
      return;
    }
    if (delivered) resetDemo();
  }

  const healthLabel = health === "loading" ? "API: ..." : health === "ok" ? "API: OK" : "API: DOWN";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#06060A" }}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
        <View style={{ gap: 10 }}>
          <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 24, fontWeight: "900" }}>
            Commande Thieyp (démo)
          </Text>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Pill label={healthLabel} tone={health === "ok" ? "success" : health === "down" ? "danger" : "neutral"} />
            <Pill label="Resto: Thieyp" />
            <Pill label="Démo V1" tone="warn" />
          </View>
        </View>

        <View
          style={{
            marginTop: 18,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.10)",
            backgroundColor: "rgba(255,255,255,0.06)",
            padding: 16,
            gap: 14,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 16, fontWeight: "800" }}>Statut</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {created ? <Pill label="✔ Créée" tone="success" /> : <Pill label="✖ Annulée" tone="danger" />}
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: "rgba(255,255,255,0.80)", fontWeight: "700" }}>⏳ En préparation</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontWeight: "800" }}>{preparing ? "ON" : "OFF"}</Text>
            </View>

            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: "rgba(255,255,255,0.80)", fontWeight: "700" }}>🚴 En route</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontWeight: "800" }}>{enRoute ? "ON" : "OFF"}</Text>
            </View>

            <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ color: "rgba(255,255,255,0.80)", fontWeight: "700" }}>✅ Livrée</Text>
              <Text style={{ color: "rgba(255,255,255,0.65)", fontWeight: "800" }}>{delivered ? "ON" : "OFF"}</Text>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" }}>OrderId: DA-DEMO-THIEYP-001</Text>
            <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 12, fontWeight: "700" }}>Paiement: “démo”</Text>
          </View>
        </View>

        <View style={{ marginTop: 16, gap: 10 }}>
          <PrimaryButton label="Suivre la livraison" onPress={nextStep} disabled={health === "loading"} tone="gold" />
          <PrimaryButton label="Annuler (démo)" onPress={cancelDemo} disabled={health === "loading"} tone="danger" />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <PrimaryButton label="Réinitialiser" onPress={resetDemo} tone="ghost" />
            </View>
            <View style={{ flex: 1 }}>
              <PrimaryButton
                label={health === "loading" ? "Ping API..." : "Re-ping API"}
                onPress={async () => {
                  setHealth("loading");
                  const ok = await pingHealth(API);
                  setHealth(ok ? "ok" : "down");
                }}
                tone="ghost"
              />
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={{ borderRadius: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(0,0,0,0.20)", padding: 12 }}>
          <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
            Démo “safe” : aucune dépendance au backend Orders. On simule un statut lisible côté Client, sans casser le reste.
          </Text>
        </View>
      </View>

      {health === "loading" ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
