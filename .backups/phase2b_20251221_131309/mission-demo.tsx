import React, { useMemo, useState } from "react";
import { Stack, router } from "expo-router";
import { SafeAreaView, ScrollView, Text, View, Pressable, StyleSheet } from "react-native";

type Variant = "primary" | "secondary";

function Btn({
  label,
  onPress,
  variant = "primary",
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" ? styles.btnPrimary : styles.btnSecondary,
        disabled ? styles.btnDisabled : null,
        pressed ? { transform: [{ scale: 0.985 }], opacity: 0.95 } : null,
      ]}
    >
      <Text style={[styles.btnText, variant === "primary" ? styles.btnTextPrimary : styles.btnTextSecondary]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Step({ title, subtitle, state }: { title: string; subtitle: string; state: "done" | "active" | "todo" }) {
  return (
    <View style={[styles.step, state === "active" ? styles.stepActive : null]}>
      <View style={[styles.dot, state === "done" ? styles.dotDone : state === "active" ? styles.dotActive : styles.dotTodo]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepSub}>{subtitle}</Text>
      </View>
    </View>
  );
}

export default function MissionDemoCourier() {
  const [stage, setStage] = useState<"mission" | "pickup" | "enroute" | "delivered">("mission");

  const headline = useMemo(() => {
    if (stage === "mission") return "Mission confirmée";
    if (stage === "pickup") return "Pick-up en cours";
    if (stage === "enroute") return "En route";
    return "Livré";
  }, [stage]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Mission (démo)" }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>DELISHAFRICA • COURIER</Text>
        <Text style={styles.h1}>En mouvement.</Text>
        <Text style={styles.sub}>Ultra lisible, ultra rapide. On ne perd jamais une seconde.</Text>

        <Card title="MISSION">
          <Text style={styles.big}>Livraison • Thieyp</Text>
          <Text style={styles.muted}>{headline} • Simulation</Text>

          <View style={{ height: 14 }} />

          <View style={styles.row}>
            <Btn label="Terminer (démo)" variant="secondary" onPress={() => router.back()} />
            <Btn
              label={stage === "mission" ? "Voir mission" : stage === "pickup" ? "Confirmer pickup" : stage === "enroute" ? "Confirmer livraison" : "Rejouer"}
              onPress={() => setStage((s) => (s === "mission" ? "pickup" : s === "pickup" ? "enroute" : s === "enroute" ? "delivered" : "mission"))}
            />
          </View>
        </Card>

        <Card title="TIMELINE MISSION">
          <Step title="Mission" subtitle="Livraison Thieyp (démo)." state={stage === "mission" ? "active" : "done"} />
          <Step title="Pick-up" subtitle="Récupérer la commande au restaurant." state={stage === "mission" ? "todo" : stage === "pickup" ? "active" : "done"} />
          <Step title="Livré" subtitle="Confirmer la livraison au client." state={stage === "delivered" ? "done" : stage === "enroute" ? "active" : "todo"} />
        </Card>

        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F1A" },
  container: { padding: 18, paddingBottom: 26 },
  kicker: { color: "#3EE27A", letterSpacing: 4, fontWeight: "800", fontSize: 12, opacity: 0.95 },
  h1: { marginTop: 10, color: "#F2F6FF", fontSize: 50, fontWeight: "900", letterSpacing: -1.2, lineHeight: 52 },
  sub: { marginTop: 10, color: "rgba(220,230,255,0.70)", fontSize: 18, lineHeight: 26 },

  card: {
    marginTop: 16,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 16,
  },
  cardTitle: { color: "rgba(255,255,255,0.35)", letterSpacing: 4, fontWeight: "800", fontSize: 12, marginBottom: 10 },

  big: { color: "#F2F6FF", fontSize: 24, fontWeight: "900" },
  muted: { color: "rgba(220,230,255,0.55)", marginTop: 6 },

  row: { flexDirection: "row", gap: 12 },

  btn: {
    flex: 1,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimary: { backgroundColor: "#3EE27A" },
  btnSecondary: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 16, fontWeight: "900" },
  btnTextPrimary: { color: "#07101F" },
  btnTextSecondary: { color: "#F2F6FF" },

  step: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.18)",
    marginBottom: 12,
  },
  stepActive: { borderColor: "rgba(62,226,122,0.35)", backgroundColor: "rgba(62,226,122,0.08)" },
  dot: { width: 12, height: 12, borderRadius: 999, marginTop: 4 },
  dotDone: { backgroundColor: "#3EE27A" },
  dotActive: { backgroundColor: "#9AF4BC" },
  dotTodo: { backgroundColor: "rgba(255,255,255,0.10)" },
  stepTitle: { color: "#F2F6FF", fontSize: 16, fontWeight: "900" },
  stepSub: { color: "rgba(220,230,255,0.60)", marginTop: 4 },
});
