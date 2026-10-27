import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { daOrdersFetch } from "../utils/daOrdersApi";

const FAIR_PAY_LAB_UI_ENABLED =
  String(process.env.EXPO_PUBLIC_COURIER_FAIR_PAY_LAB_ENABLED || "").toLowerCase() === "true";

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

type Statement = {
  statementId: string;
  statementVersion: string;
  courierId: string;
  weekKey: string;
  countryCode: string;
  currency: string;
  policyId: string;
  policyHash: string;
  factsHash: string;
  factCount: number;
  effectiveFactCount: number;
  supersededFactIds: string[];
  contestable: true;
  warnings: string[];
  explanation: {
    paidSeconds: number;
    activeMissionSeconds: number;
    activityGuaranteeSeconds: number | null;
    waitingSeconds: number;
    repositionSeconds: number;
    otherPaidSeconds: number;
    excludedSeconds: number;
    eligibleIncomeCents: number;
    governingFloorCents: number;
    differentialDueCents: number;
    tipsCents: number;
    expenseReimbursementsCents: number;
    totalCashDueCents: number;
  };
  computation: {
    productionEligible: boolean;
  };
};

function money(minor: number, currency: string) {
  try {
    return new Intl.NumberFormat("fr-BE", {
      style: "currency",
      currency,
    }).format(Number(minor || 0) / 100);
  } catch {
    return `${(Number(minor || 0) / 100).toFixed(2)} ${currency}`;
  }
}

function duration(seconds: number) {
  const totalMinutes = Math.round(Number(seconds || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")}` : `${minutes} min`;
}

async function loadStatements(): Promise<Statement[]> {
  const response = await daOrdersFetch(
    `${API_BASE_URL}/courier-payroll/lab/courier/statements`,
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      String(payload?.message || payload?.error || payload?.code || `HTTP ${response.status}`),
    );
  }
  return Array.isArray(payload?.statements) ? payload.statements : [];
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, strong && styles.rowValueStrong]}>{value}</Text>
    </View>
  );
}

export default function FairPayStatementScreen() {
  const [statements, setStatements] = useState<Statement[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("Chargement du relevé Fair Pay…");

  const load = useCallback(async () => {
    if (!FAIR_PAY_LAB_UI_ENABLED) {
      setStatements([]);
      setMessage("Fair Pay Lab est désactivé sur cette version.");
      return;
    }
    setRefreshing(true);
    try {
      const next = await loadStatements();
      setStatements(next);
      setMessage(
        next.length
          ? `${next.length} relevé${next.length > 1 ? "s" : ""} vérifiable${next.length > 1 ? "s" : ""}.`
          : "Aucun relevé hebdomadaire finalisé pour le moment.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Relevé indisponible.");
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load()}
            tintColor="#8EF0B3"
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.brand}>DELISHAFRICA® · FAIR PAY LAB</Text>
            <Text style={styles.title}>Mon relevé Courier</Text>
            <Text style={styles.subtitle}>
              Temps, plancher, différentiel, pourboires et frais séparés.
            </Text>
          </View>
          <Pressable onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
        </View>

        <View style={styles.truthCard}>
          <Text style={styles.truthKicker}>PRINCIPE</Text>
          <Text style={styles.truthTitle}>Ce relevé vous appartient.</Text>
          <Text style={styles.truthBody}>
            Il ne peut pas être réduit parce qu’une zone est moins rentable. Les pourboires
            et remboursements de frais restent séparés du plancher de rémunération.
          </Text>
        </View>

        <Text style={styles.message}>{message}</Text>

        {refreshing && statements.length === 0 ? (
          <ActivityIndicator color="#8EF0B3" size="large" />
        ) : null}

        {statements.map((statement) => {
          const x = statement.explanation;
          return (
            <View key={statement.statementId} style={styles.statement}>
              <View style={styles.statementHeader}>
                <View>
                  <Text style={styles.week}>{statement.weekKey}</Text>
                  <Text style={styles.policy}>{statement.policyId}</Text>
                </View>
                <View style={styles.labPill}>
                  <Text style={styles.labPillText}>
                    {statement.computation?.productionEligible ? "GREEN" : "LAB"}
                  </Text>
                </View>
              </View>

              <View style={styles.heroAmount}>
                <Text style={styles.heroLabel}>TOTAL À VERSER SELON CE RELEVÉ</Text>
                <Text style={styles.heroValue}>
                  {money(x.totalCashDueCents, statement.currency)}
                </Text>
              </View>

              <Text style={styles.sectionTitle}>Temps rémunéré</Text>
              <Row label="Temps payé" value={duration(x.paidSeconds)} strong />
              <Row label="Mission active" value={duration(x.activeMissionSeconds)} />
              <Row label="Attente contrôlée" value={duration(x.waitingSeconds)} />
              <Row label="Reposition requis" value={duration(x.repositionSeconds)} />
              <Row label="Autre temps payé" value={duration(x.otherPaidSeconds)} />

              <Text style={styles.sectionTitle}>Rémunération</Text>
              <Row
                label="Revenu éligible"
                value={money(x.eligibleIncomeCents, statement.currency)}
              />
              <Row
                label="Plancher applicable"
                value={money(x.governingFloorCents, statement.currency)}
                strong
              />
              <Row
                label="Complément Fair Pay"
                value={money(x.differentialDueCents, statement.currency)}
                strong
              />
              <Row
                label="Pourboires"
                value={money(x.tipsCents, statement.currency)}
              />
              <Row
                label="Frais remboursés"
                value={money(x.expenseReimbursementsCents, statement.currency)}
              />

              <View style={styles.audit}>
                <Text style={styles.auditTitle}>TRAÇABILITÉ</Text>
                <Text style={styles.auditText}>
                  Statement · {statement.statementId.slice(0, 12)}…
                </Text>
                <Text style={styles.auditText}>Policy · {statement.policyHash.slice(0, 12)}…</Text>
                <Text style={styles.auditText}>Facts · {statement.factsHash.slice(0, 12)}…</Text>
                <Text style={styles.auditText}>
                  {statement.effectiveFactCount}/{statement.factCount} faits effectifs ·{" "}
                  {statement.supersededFactIds.length} correction(s) historisée(s)
                </Text>
              </View>

              <View style={styles.contest}>
                <Text style={styles.contestTitle}>Contestable par conception</Text>
                <Text style={styles.contestBody}>
                  Le canal de contestation humain est encore en construction dans ce LAB.
                  Aucune correction ne pourra effacer le relevé précédent : elle créera une
                  nouvelle version traçable.
                </Text>
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => void load()}
          style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
        >
          <Text style={styles.refreshText}>Actualiser le relevé</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#031A12" },
  page: { padding: 18, paddingBottom: 50, gap: 14 },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 8 },
  brand: { color: "#8EF0B3", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  title: { color: "#F7FFF9", fontSize: 30, lineHeight: 34, fontWeight: "900", marginTop: 7 },
  subtitle: { color: "rgba(231,255,239,0.62)", fontSize: 13, lineHeight: 19, marginTop: 6 },
  back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(142,240,179,0.10)", borderWidth: 1, borderColor: "rgba(142,240,179,0.24)" },
  backText: { color: "#8EF0B3", fontSize: 21, fontWeight: "900" },
  truthCard: { borderRadius: 24, padding: 18, backgroundColor: "#082719", borderWidth: 1, borderColor: "rgba(142,240,179,0.28)" },
  truthKicker: { color: "#8EF0B3", fontSize: 9, fontWeight: "900", letterSpacing: 1.5 },
  truthTitle: { color: "#F7FFF9", fontSize: 20, fontWeight: "900", marginTop: 7 },
  truthBody: { color: "rgba(231,255,239,0.68)", fontSize: 13, lineHeight: 20, marginTop: 7 },
  message: { color: "rgba(231,255,239,0.62)", fontSize: 12.5, lineHeight: 18 },
  statement: { borderRadius: 26, padding: 18, backgroundColor: "#071F16", borderWidth: 1, borderColor: "rgba(142,240,179,0.22)", gap: 8 },
  statementHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  week: { color: "#F7FFF9", fontSize: 19, fontWeight: "900" },
  policy: { color: "rgba(183,212,193,0.52)", fontSize: 9, fontWeight: "800", marginTop: 4 },
  labPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(217,169,40,0.42)", backgroundColor: "rgba(217,169,40,0.08)" },
  labPillText: { color: "#E7C35E", fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  heroAmount: { marginTop: 10, borderRadius: 20, padding: 16, backgroundColor: "rgba(142,240,179,0.08)" },
  heroLabel: { color: "rgba(183,212,193,0.62)", fontSize: 9, fontWeight: "900", letterSpacing: 1.2 },
  heroValue: { color: "#8EF0B3", fontSize: 31, lineHeight: 36, fontWeight: "900", marginTop: 5 },
  sectionTitle: { color: "#F7FFF9", fontSize: 13, fontWeight: "900", marginTop: 13, marginBottom: 3 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, paddingVertical: 5, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "rgba(255,255,255,0.06)" },
  rowLabel: { flex: 1, color: "rgba(231,255,239,0.62)", fontSize: 12.5 },
  rowValue: { color: "#EAF8EF", fontSize: 12.5, fontWeight: "700" },
  rowValueStrong: { color: "#8EF0B3", fontWeight: "900" },
  audit: { marginTop: 12, borderRadius: 18, padding: 13, backgroundColor: "rgba(3,26,18,0.76)" },
  auditTitle: { color: "#8EF0B3", fontSize: 9, fontWeight: "900", letterSpacing: 1.2, marginBottom: 5 },
  auditText: { color: "rgba(231,255,239,0.56)", fontSize: 10.5, lineHeight: 16 },
  contest: { marginTop: 5, borderRadius: 18, padding: 13, backgroundColor: "rgba(217,169,40,0.07)", borderWidth: 1, borderColor: "rgba(217,169,40,0.18)" },
  contestTitle: { color: "#E7C35E", fontSize: 12, fontWeight: "900" },
  contestBody: { color: "rgba(240,229,194,0.68)", fontSize: 11.5, lineHeight: 17, marginTop: 5 },
  refresh: { minHeight: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#8EF0B3" },
  refreshText: { color: "#052013", fontSize: 13, fontWeight: "900" },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
