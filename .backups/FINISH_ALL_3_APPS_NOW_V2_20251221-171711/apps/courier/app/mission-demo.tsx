import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, Text, View } from "react-native";

type HealthState = "loading" | "ok" | "down";
type MissionState = "pickup" | "en_route" | "delivered";

function pickApiBase(): string {
  return (
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    "https://api.delishafrica.me"
  );
}

async function pingHealth(base: string): Promise<boolean> {
  const urls = [`${base}/api/v1/health`, `${base}/api/health`, `${base}/health`];
  for (const url of urls) {
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
      <Text style={{ color, fontSize: 12, fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

function CTAButton({
  label,
  onPress,
  tone = "green",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "green" | "gold" | "ghost";
  disabled?: boolean;
}) {
  const styles =
    tone === "green"
      ? { bg: "rgba(46, 204, 113, 0.18)", br: "rgba(46, 204, 113, 0.35)", tx: "#B8F5D0" }
      : tone === "gold"
        ? { bg: "rgba(243, 190, 90, 0.22)", br: "rgba(243, 190, 90, 0.38)", tx: "#FFE7B8" }
        : { bg: "rgba(255,255,255,0.08)", br: "rgba(255,255,255,0.14)", tx: "rgba(255,255,255,0.92)" };

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
          borderColor: styles.br,
          opacity: disabled ? 0.55 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <Text style={{ color: styles.tx, fontWeight: "900", textAlign: "center" }}>{label}</Text>
    </Pressable>
  );
}

function Step({ label, active }: { label: string; active: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 10, height: 10, borderRadius: 99, backgroundColor: active ? "rgba(46,204,113,0.9)" : "rgba(255,255,255,0.16)" }} />
      <Text style={{ color: active ? "rgba(255,255,255,0.90)" : "rgba(255,255,255,0.55)", fontWeight: "900" }}>{label}</Text>
    </View>
  );
}

export default function MissionDemoCourier() {
  const API = useMemo(() => pickApiBase(), []);
  const [health, setHealth] = useState<HealthState>("loading");
  const [state, setState] = useState<MissionState>("pickup");

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

  const healthLabel = health === "loading" ? "API: ..." : health === "ok" ? "API: OK" : "API: DOWN";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#06060A" }}>
      <View style={{ flex: 1, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18 }}>
        <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 24, fontWeight: "900" }}>
          Mission en cours
        </Text>

        <View style={{ marginTop: 10, flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <Pill label={healthLabel} tone={health === "ok" ? "success" : health === "down" ? "danger" : "neutral"} />
          <Pill label="Pickup: Thieyp" tone="warn" />
          <Pill label="Client: Tonton (démo)" />
        </View>

        <View style={{ marginTop: 18, borderRadius: 20, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.06)", padding: 16, gap: 14 }}>
          <Text style={{ color: "rgba(255,255,255,0.90)", fontSize: 16, fontWeight: "900" }}>
            Étapes
          </Text>

          <View style={{ gap: 10 }}>
            <Step label="Pickup" active={state === "pickup"} />
            <Step label="En route" active={state === "en_route"} />
            <Step label="Livré" active={state === "delivered"} />
          </View>

          <View style={{ marginTop: 6, padding: 10, borderRadius: 14, backgroundColor: "rgba(0,0,0,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.70)", fontSize: 12, fontWeight: "800", lineHeight: 16 }}>
              Démo “safe” : timeline locale (pickup → en route → livré). Aucun impact sur le routing existant.
            </Text>
          </View>
        </View>

        <View style={{ marginTop: 16, gap: 10 }}>
          <CTAButton label="Confirmer pickup" tone="gold" disabled={health === "loading" || state !== "pickup"} onPress={() => setState("en_route")} />
          <CTAButton label="Confirmer livraison" tone="green" disabled={health === "loading" || state !== "en_route"} onPress={() => setState("delivered")} />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <CTAButton label="Reset" tone="ghost" onPress={() => setState("pickup")} />
            </View>
            <View style={{ flex: 1 }}>
              <CTAButton
                label={health === "loading" ? "Ping..." : "Re-ping API"}
                tone="ghost"
                onPress={async () => {
                  setHealth("loading");
                  const ok = await pingHealth(API);
                  setHealth(ok ? "ok" : "down");
                }}
              />
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} />
      </View>

      {health === "loading" ? (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
