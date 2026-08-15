import React from "react";
import { Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

const metrics = [
  { label: "ETA", value: "31 min", hint: "Remise incluse" },
  { label: "Confiance", value: "92%", hint: "Fenêtre stable" },
  { label: "Pression", value: "Active", hint: "Priorité visible" },
  { label: "Risque", value: "Faible", hint: "Promesse tenue" },
];

const steps = [
  { number: "1", title: "Recevoir", active: false },
  { number: "2", title: "Préparer", active: true },
  { number: "3", title: "Signaler", active: false },
  { number: "4", title: "Servir", active: false },
];

export default function KitchenOracleScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View pointerEvents="none" style={styles.glowTop} />
      <View pointerEvents="none" style={styles.glowSide} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.cockpit}>
          <View style={styles.topline}>
            <View>
              <Text style={styles.brand}>DELISHAFRICA® MERCHANT</Text>
              <Text style={styles.kicker}>KITCHEN ORACLE</Text>
            </View>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>SERVICE ACTIF</Text>
            </View>
          </View>

          <View style={styles.heroRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.title}>Piloter.{"\n"}Préparer.{"\n"}Servir.</Text>
              <Text style={styles.subtitle}>Une seule lecture pour la prochaine décision.</Text>
            </View>

            <Pressable style={styles.nextAction} onPress={() => router.push("/orders" as any)}>
              <Text style={styles.nextLabel}>ACTION</Text>
              <Text style={styles.nextTitle}>Lire</Text>
              <Text style={styles.nextMeta}>Commande à valider</Text>
              <Text style={styles.nextArrow}>↗</Text>
            </Pressable>
          </View>

          <View style={styles.commandBar}>
            <View style={styles.commandMain}>
              <Text style={styles.commandEyebrow}>DA-F8Q5J8 · NOUVELLE</Text>
              <Text style={styles.commandTitle}>Thieyp</Text>
              <Text style={styles.commandMeta}>Rice and Peace · 83,50 €</Text>
            </View>
            <View style={styles.commandEta}>
              <Text style={styles.commandEtaLabel}>ETA</Text>
              <Text style={styles.commandEtaValue}>31</Text>
              <Text style={styles.commandEtaUnit}>MIN</Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            {metrics.map((metric) => (
              <View key={metric.label} style={styles.metricCard}>
                <Text style={styles.metricLabel}>{metric.label}</Text>
                <Text style={styles.metricValue}>{metric.value}</Text>
                <Text style={styles.metricHint}>{metric.hint}</Text>
              </View>
            ))}
          </View>

          <View style={styles.oracleBand}>
            <View>
              <Text style={styles.oracleLabel}>ORACLE</Text>
              <Text style={styles.oracleTitle}>Cuisine sous contrôle.</Text>
            </View>
            <View style={styles.oracleScore}>
              <Text style={styles.oracleScoreValue}>86</Text>
              <Text style={styles.oracleScoreUnit}>%</Text>
            </View>
          </View>

          <View style={styles.motionCard}>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>SERVICE MOTION</Text>
              <Text style={styles.sectionMeta}>2 / 4</Text>
            </View>
            <View style={styles.stepsRow}>
              {steps.map((step, index) => (
                <React.Fragment key={step.number}>
                  <View style={styles.stepItem}>
                    <View style={[styles.stepNode, step.active && styles.stepNodeActive]}>
                      <Text style={[styles.stepNumber, step.active && styles.stepNumberActive]}>{step.number}</Text>
                    </View>
                    <Text style={[styles.stepTitle, step.active && styles.stepTitleActive]}>{step.title}</Text>
                  </View>
                  {index < steps.length - 1 ? <View style={[styles.stepLine, index === 0 && styles.stepLineActive]} /> : null}
                </React.Fragment>
              ))}
            </View>
          </View>

          <View style={styles.quickGrid}>
            <Pressable style={[styles.quickCard, styles.quickCardLight]} onPress={() => router.push("/orders" as any)}>
              <Text style={styles.quickEyebrowDark}>PILOTAGE</Text>
              <Text style={styles.quickTitleDark}>Commandes</Text>
              <Text style={styles.quickTextDark}>Lire et agir.</Text>
            </Pressable>

            <Pressable style={styles.quickCard} onPress={() => router.push("/ops-dashboard" as any)}>
              <Text style={styles.quickEyebrow}>QUALITÉ</Text>
              <Text style={styles.quickTitle}>Ops & suivi</Text>
              <Text style={styles.quickText}>Garder le rythme.</Text>
            </Pressable>

            <Pressable style={[styles.quickCard, styles.quickCardWide]} onPress={() => router.back()}>
              <View>
                <Text style={styles.quickEyebrow}>ESPACE PARTENAIRE</Text>
                <Text style={styles.quickTitle}>Retour Signature</Text>
              </View>
              <Text style={styles.quickArrow}>→</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.footer}>DelishAfrica® Service Oracle · cuisine sous contrôle.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#00170F" },
  content: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 28 },
  glowTop: { position: "absolute", top: -100, right: -90, width: 210, height: 210, borderRadius: 999, backgroundColor: "rgba(247,178,103,0.07)" },
  glowSide: { position: "absolute", top: 330, left: -70, width: 150, height: 150, borderRadius: 999, backgroundColor: "rgba(120,245,255,0.025)" },

  cockpit: { borderRadius: 30, padding: 16, backgroundColor: "#00271B", borderWidth: 1, borderColor: "rgba(247,178,103,0.28)" },
  topline: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  brand: { color: "#F7B267", fontSize: 9, fontWeight: "900", letterSpacing: 2.1 },
  kicker: { color: "rgba(255,248,239,0.42)", fontSize: 8, fontWeight: "900", letterSpacing: 2.0, marginTop: 4 },
  livePill: { flexDirection: "row", alignItems: "center", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(255,248,239,0.06)" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#F7B267", marginRight: 6 },
  liveText: { color: "rgba(255,248,239,0.64)", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },

  heroRow: { flexDirection: "row", alignItems: "stretch", marginTop: 18 },
  heroCopy: { flex: 1, paddingRight: 12 },
  title: { color: "#FFF8EF", fontSize: 36, lineHeight: 38, fontWeight: "900" },
  subtitle: { color: "rgba(255,248,239,0.58)", fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 8, maxWidth: 210 },
  nextAction: { width: 118, minHeight: 152, borderRadius: 22, padding: 14, justifyContent: "flex-end", backgroundColor: "#F7B267" },
  nextLabel: { position: "absolute", top: 13, left: 14, color: "rgba(36,18,11,0.52)", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  nextTitle: { color: "#24120B", fontSize: 30, lineHeight: 33, fontWeight: "900" },
  nextMeta: { color: "rgba(36,18,11,0.56)", fontSize: 10, lineHeight: 13, fontWeight: "800", marginTop: 4 },
  nextArrow: { position: "absolute", top: 10, right: 12, color: "#24120B", fontSize: 20, fontWeight: "900" },

  commandBar: { flexDirection: "row", alignItems: "center", marginTop: 14, borderRadius: 22, padding: 14, backgroundColor: "#FFF8EF" },
  commandMain: { flex: 1, paddingRight: 10 },
  commandEyebrow: { color: "#A5573E", fontSize: 8, fontWeight: "900", letterSpacing: 1.6 },
  commandTitle: { color: "#24120B", fontSize: 28, lineHeight: 31, fontWeight: "900", marginTop: 4 },
  commandMeta: { color: "rgba(36,18,11,0.52)", fontSize: 11, lineHeight: 15, fontWeight: "800", marginTop: 3 },
  commandEta: { width: 72, minHeight: 78, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(36,18,11,0.06)" },
  commandEtaLabel: { color: "rgba(36,18,11,0.42)", fontSize: 7, fontWeight: "900", letterSpacing: 1.4 },
  commandEtaValue: { color: "#24120B", fontSize: 28, lineHeight: 30, fontWeight: "900", marginTop: 2 },
  commandEtaUnit: { color: "rgba(36,18,11,0.45)", fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },

  metricsGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginTop: 10 },
  metricCard: { width: "50%", paddingHorizontal: 4, marginBottom: 8 },
  metricLabel: { color: "#F7B267", fontSize: 8, fontWeight: "900", letterSpacing: 1.7, marginBottom: 4 },
  metricValue: { color: "#FFF8EF", fontSize: 19, lineHeight: 22, fontWeight: "900" },
  metricHint: { color: "rgba(255,248,239,0.42)", fontSize: 9, lineHeight: 12, fontWeight: "700", marginTop: 2 },

  oracleBand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: "rgba(255,248,239,0.055)", borderWidth: 1, borderColor: "rgba(255,248,239,0.10)", marginTop: 2 },
  oracleLabel: { color: "#F7B267", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  oracleTitle: { color: "#FFF8EF", fontSize: 16, lineHeight: 19, fontWeight: "900", marginTop: 3 },
  oracleScore: { flexDirection: "row", alignItems: "flex-end" },
  oracleScoreValue: { color: "#FFF8EF", fontSize: 27, lineHeight: 29, fontWeight: "900" },
  oracleScoreUnit: { color: "rgba(255,248,239,0.48)", fontSize: 10, fontWeight: "900", marginBottom: 3, marginLeft: 1 },

  motionCard: { borderRadius: 22, padding: 13, backgroundColor: "rgba(255,248,239,0.045)", borderWidth: 1, borderColor: "rgba(255,248,239,0.08)", marginTop: 10 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  sectionLabel: { color: "#F7B267", fontSize: 8, fontWeight: "900", letterSpacing: 1.8 },
  sectionMeta: { color: "rgba(255,248,239,0.38)", fontSize: 9, fontWeight: "800" },
  stepsRow: { flexDirection: "row", alignItems: "center" },
  stepItem: { alignItems: "center", width: 58 },
  stepNode: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,248,239,0.06)", borderWidth: 1, borderColor: "rgba(255,248,239,0.12)" },
  stepNodeActive: { backgroundColor: "#F7B267", borderColor: "#F7B267" },
  stepNumber: { color: "rgba(255,248,239,0.48)", fontSize: 8, fontWeight: "900" },
  stepNumberActive: { color: "#24120B" },
  stepTitle: { color: "rgba(255,248,239,0.46)", fontSize: 8, fontWeight: "800", marginTop: 5 },
  stepTitleActive: { color: "#FFF8EF" },
  stepLine: { flex: 1, height: 1, backgroundColor: "rgba(255,248,239,0.10)", marginHorizontal: -5, marginBottom: 15 },
  stepLineActive: { backgroundColor: "rgba(247,178,103,0.55)" },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4, marginTop: 10 },
  quickCard: { width: "50%", minHeight: 104, padding: 14, marginHorizontal: 4, marginBottom: 8, borderRadius: 20, backgroundColor: "rgba(255,248,239,0.05)", borderWidth: 1, borderColor: "rgba(255,248,239,0.09)" },
  quickCardLight: { backgroundColor: "#FFF8EF", borderColor: "#FFF8EF" },
  quickCardWide: { width: "100%", minHeight: 70, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  quickEyebrow: { color: "#F7B267", fontSize: 7, fontWeight: "900", letterSpacing: 1.5 },
  quickEyebrowDark: { color: "#A5573E", fontSize: 7, fontWeight: "900", letterSpacing: 1.5 },
  quickTitle: { color: "#FFF8EF", fontSize: 18, lineHeight: 21, fontWeight: "900", marginTop: 6 },
  quickTitleDark: { color: "#24120B", fontSize: 18, lineHeight: 21, fontWeight: "900", marginTop: 6 },
  quickText: { color: "rgba(255,248,239,0.44)", fontSize: 9, lineHeight: 12, fontWeight: "700", marginTop: 4 },
  quickTextDark: { color: "rgba(36,18,11,0.48)", fontSize: 9, lineHeight: 12, fontWeight: "700", marginTop: 4 },
  quickArrow: { color: "#F7B267", fontSize: 22, fontWeight: "900" },

  footer: { color: "rgba(255,248,239,0.28)", fontSize: 9, lineHeight: 13, fontWeight: "800", textAlign: "center", marginTop: 10 },
});
