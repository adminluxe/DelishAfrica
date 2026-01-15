#!/usr/bin/env bash
set -euo pipefail

ROOT="/opt/delishafrica/monorepo"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$ROOT/backup_phase2b_demo_screens_$TS"
mkdir -p "$BACKUP"

echo "== DelishAfrica | Phase 2B | Create Demo Screens (safe) =="
echo "Backup: $BACKUP"

backup_file() {
  local f="$1"
  if [ -f "$f" ]; then
    local d
    d="$(dirname "$f")"
    mkdir -p "$BACKUP${d#$ROOT}"
    cp -a "$f" "$BACKUP${f#$ROOT}"
    echo "Backup: $f -> $BACKUP${f#$ROOT}"
  fi
}

write_client_orders_demo() {
  local f="$ROOT/apps/client/app/orders-demo.tsx"
  mkdir -p "$(dirname "$f")"
  backup_file "$f"

  cat > "$f" <<'TSX'
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

function Step({
  title,
  subtitle,
  state,
}: {
  title: string;
  subtitle: string;
  state: "done" | "active" | "todo";
}) {
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

export default function OrdersDemoClient() {
  const [stage, setStage] = useState<"created" | "preparing" | "courier" | "delivered">("created");

  const status = useMemo(() => {
    if (stage === "created") return { label: "Commande créée", ms: 78 };
    if (stage === "preparing") return { label: "En préparation", ms: 92 };
    if (stage === "courier") return { label: "Coursier en route", ms: 110 };
    return { label: "Livrée", ms: 63 };
  }, [stage]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Commande (démo)" }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>DELISHAFRICA • CLIENT</Text>
        <Text style={styles.h1}>Commande Thieyp.</Text>
        <Text style={styles.sub}>
          Suivi temps réel (démo). Simple, fluide, premium — sans écrans vides.
        </Text>

        <Card title="STATUT">
          <Text style={styles.big}>{status.label}</Text>
          <Text style={styles.muted}>Simulation • {status.ms}ms</Text>

          <View style={{ height: 14 }} />

          <View style={styles.row}>
            <Btn label="Annuler (démo)" variant="secondary" onPress={() => router.back()} />
            <Btn
              label="Suivre livraison"
              onPress={() => setStage((s) => (s === "created" ? "preparing" : s === "preparing" ? "courier" : "delivered"))}
            />
          </View>
        </Card>

        <Card title="TIMELINE COMMANDE">
          <Step title="Commande" subtitle="Thieyp (démo) confirmé." state={stage !== "created" ? "done" : "active"} />
          <Step title="Préparation" subtitle="Le restaurant prépare." state={stage === "created" ? "todo" : stage === "preparing" ? "active" : "done"} />
          <Step title="Pick-up" subtitle="Le coursier récupère." state={stage === "courier" ? "active" : stage === "delivered" ? "done" : "todo"} />
          <Step title="Livré" subtitle="Confirmation côté client." state={stage === "delivered" ? "done" : "todo"} />
        </Card>

        <View style={styles.pills}>
          <Text style={styles.pill}>UI premium</Text>
          <Text style={styles.pill}>Flow démo</Text>
          <Text style={styles.pill}>No blank</Text>
        </View>

        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F1A" },
  container: { padding: 18, paddingBottom: 26 },
  kicker: { color: "#2F6BFF", letterSpacing: 4, fontWeight: "800", fontSize: 12, opacity: 0.95 },
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
  btnPrimary: { backgroundColor: "#2F6BFF" },
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
  stepActive: { borderColor: "rgba(47,107,255,0.35)", backgroundColor: "rgba(47,107,255,0.08)" },
  dot: { width: 12, height: 12, borderRadius: 999, marginTop: 4 },
  dotDone: { backgroundColor: "#2F6BFF" },
  dotActive: { backgroundColor: "#8DB1FF" },
  dotTodo: { backgroundColor: "rgba(255,255,255,0.10)" },
  stepTitle: { color: "#F2F6FF", fontSize: 16, fontWeight: "900" },
  stepSub: { color: "rgba(220,230,255,0.60)", marginTop: 4 },

  pills: { marginTop: 14, flexDirection: "row", gap: 10, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: "rgba(255,255,255,0.70)",
    fontWeight: "800",
  },
});
TSX

  echo "[client] wrote: $f"
}

write_merchant_orders_demo() {
  local f="$ROOT/apps/merchant/app/orders-demo.tsx"
  mkdir -p "$(dirname "$f")"
  backup_file "$f"

  cat > "$f" <<'TSX'
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

export default function OrdersDemoMerchant() {
  const [stage, setStage] = useState<"incoming" | "preparing" | "ready" | "handed">("incoming");

  const headline = useMemo(() => {
    if (stage === "incoming") return "Commande entrante";
    if (stage === "preparing") return "En préparation";
    if (stage === "ready") return "Prête à récupérer";
    return "Remise au coursier";
  }, [stage]);

  return (
    <SafeAreaView style={styles.safe}>
      <Stack.Screen options={{ title: "Opération (démo)" }} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <Text style={styles.kicker}>DELISHAFRICA • MERCHANT</Text>
        <Text style={styles.h1}>Opération.</Text>
        <Text style={styles.sub}>Actions rapides. Lisibilité maximale. Zéro stress.</Text>

        <Card title="COMMANDE">
          <Text style={styles.big}>{headline}</Text>
          <Text style={styles.muted}>Thieyp • 1x • Client: “Demo User”</Text>

          <View style={{ height: 14 }} />

          <View style={styles.row}>
            <Btn
              label="Refuser (démo)"
              variant="secondary"
              onPress={() => {
                setStage("incoming");
                router.back();
              }}
            />
            <Btn
              label={stage === "incoming" ? "Accepter (démo)" : stage === "preparing" ? "Marquer prêt" : stage === "ready" ? "Remis coursier" : "OK"}
              onPress={() =>
                setStage((s) => (s === "incoming" ? "preparing" : s === "preparing" ? "ready" : s === "ready" ? "handed" : "incoming"))
              }
            />
          </View>
        </Card>

        <Card title="TIMELINE OPÉRATION">
          <Step title="Réception" subtitle="Commande entrante (démo)." state={stage === "incoming" ? "active" : "done"} />
          <Step title="Préparation" subtitle="Marquer “Prêt” dès que c’est chaud." state={stage === "incoming" ? "todo" : stage === "preparing" ? "active" : "done"} />
          <Step title="Passation" subtitle="Le coursier prend la mission." state={stage === "ready" ? "active" : stage === "handed" ? "done" : "todo"} />
        </Card>

        <View style={{ height: 18 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0B0F1A" },
  container: { padding: 18, paddingBottom: 26 },
  kicker: { color: "#FF8A2A", letterSpacing: 4, fontWeight: "800", fontSize: 12, opacity: 0.95 },
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
  btnPrimary: { backgroundColor: "#FF8A2A" },
  btnSecondary: { backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  btnDisabled: { opacity: 0.45 },
  btnText: { fontSize: 16, fontWeight: "900" },
  btnTextPrimary: { color: "#0B0F1A" },
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
  stepActive: { borderColor: "rgba(255,138,42,0.35)", backgroundColor: "rgba(255,138,42,0.08)" },
  dot: { width: 12, height: 12, borderRadius: 999, marginTop: 4 },
  dotDone: { backgroundColor: "#FF8A2A" },
  dotActive: { backgroundColor: "#FFC08A" },
  dotTodo: { backgroundColor: "rgba(255,255,255,0.10)" },
  stepTitle: { color: "#F2F6FF", fontSize: 16, fontWeight: "900" },
  stepSub: { color: "rgba(220,230,255,0.60)", marginTop: 4 },
});
TSX

  echo "[merchant] wrote: $f"
}

write_courier_mission_demo() {
  local f="$ROOT/apps/courier/app/mission-demo.tsx"
  mkdir -p "$(dirname "$f")"
  backup_file "$f"

  cat > "$f" <<'TSX'
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
TSX

  echo "[courier] wrote: $f"
}

write_client_orders_demo
write_merchant_orders_demo
write_courier_mission_demo

echo "== DONE =="
echo "Created demo screens:"
echo " - apps/client/app/orders-demo.tsx"
echo " - apps/merchant/app/orders-demo.tsx"
echo " - apps/courier/app/mission-demo.tsx"
echo ""
echo "Next: press 'r' in the 3 Metro windows (client/merchant/courier)."
