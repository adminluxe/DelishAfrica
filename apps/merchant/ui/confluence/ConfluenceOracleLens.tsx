import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export type OracleEvidenceKind = "fact" | "estimate" | "context";
export type OracleUncertainty = "facts_only" | "contains_estimates" | "insufficient_evidence";
export type OracleTrustMode = "embedded" | "server_local" | "ai";

export type OracleEvidence = {
  label: string;
  value: string;
  kind?: OracleEvidenceKind;
};

type Props = {
  engineLabel: string;
  title: string;
  suggestion: string;
  evidence: OracleEvidence[];
  humanBoundary: string;
  accent?: string;
  footnote?: string;
  mode?: OracleTrustMode;
  uncertainty?: OracleUncertainty;
  evidenceIndexes?: number[];
  generatedAt?: string;
};

const KIND_LABEL: Record<OracleEvidenceKind, string> = {
  fact: "CONFIRMÉ",
  estimate: "ESTIMÉ",
  context: "CONTEXTE",
};

export function ConfluenceOracleLens({
  engineLabel,
  title,
  suggestion,
  evidence,
  humanBoundary,
  accent = "#9BEFE1",
  footnote,
  mode = "embedded",
  uncertainty = "facts_only",
  evidenceIndexes,
  generatedAt,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const readableIndexes = Array.from(
    new Set(
      (evidenceIndexes?.length ? evidenceIndexes : evidence.map((_, index) => index))
        .filter((index) => Number.isInteger(index) && index >= 0 && index < evidence.length),
    ),
  );
  const proofCount = readableIndexes.length;
  const proofLabel = evidence.length ? `${proofCount}/${evidence.length}` : "0/0";
  const modeLabel = mode === "ai" ? "IA BORNÉE" : mode === "server_local" ? "SERVEUR LOCAL" : "EMBARQUÉ";
  const uncertaintyLabel =
    uncertainty === "contains_estimates"
      ? "ESTIMATIONS"
      : uncertainty === "insufficient_evidence"
        ? "PREUVES FAIBLES"
        : "FAITS";
  const changeSignals = evidence
    .filter((item, index) => readableIndexes.includes(index) && (item.kind === "estimate" || item.kind === "context"))
    .slice(0, 2)
    .map((item) => `${item.label} évolue`);
  const freshness = generatedAt
    ? (() => {
        const date = new Date(generatedAt);
        return Number.isFinite(date.getTime())
          ? date.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" })
          : "session active";
      })()
    : "session active";

  return (
    <View style={styles.shell}>
      <View pointerEvents="none" style={styles.currentTop} />
      <View pointerEvents="none" style={styles.currentBottom} />

      <View style={styles.header}>
        <View style={[styles.drop, { borderColor: accent }]}>
          <View style={[styles.dropCore, { backgroundColor: accent }]} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.kicker, { color: accent }]}>CONFLUENCE · IA × WATER</Text>
          <Text style={styles.engine}>{engineLabel}</Text>
        </View>
        <View style={[styles.badge, { borderColor: `${accent}55` }]}>
          <Text style={[styles.badgeText, { color: accent }]}>SUGGESTION ONLY</Text>
        </View>
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.suggestion}>{suggestion}</Text>

      <View style={styles.trustStrip}>
        <View style={styles.trustCell}>
          <Text style={styles.trustLabel}>MOTEUR</Text>
          <Text style={[styles.trustValue, { color: accent }]}>{modeLabel}</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustCell}>
          <Text style={styles.trustLabel}>PREUVES UTILISÉES</Text>
          <Text style={styles.trustValue}>{proofLabel}</Text>
        </View>
        <View style={styles.trustDivider} />
        <View style={styles.trustCell}>
          <Text style={styles.trustLabel}>INCERTITUDE</Text>
          <Text style={styles.trustValue}>{uncertaintyLabel}</Text>
        </View>
      </View>

      <View style={styles.flow}>
        <View style={styles.flowCell}>
          <Text style={styles.flowLabel}>FAITS</Text>
          <Text style={styles.flowValue}>{evidence.length} signaux lisibles</Text>
        </View>
        <View style={styles.flowBridge}>
          <View style={[styles.flowLine, { backgroundColor: `${accent}33` }]} />
          <View style={[styles.flowDrop, { borderColor: accent, backgroundColor: `${accent}22` }]} />
          <View style={[styles.flowLine, { backgroundColor: `${accent}33` }]} />
        </View>
        <View style={styles.flowCell}>
          <Text style={styles.flowLabel}>LECTURE</Text>
          <Text style={styles.flowValue}>Proposition réversible</Text>
        </View>
        <View style={styles.flowBridge}>
          <View style={[styles.flowLine, { backgroundColor: `${accent}33` }]} />
          <View style={[styles.flowDrop, { borderColor: accent, backgroundColor: `${accent}22` }]} />
          <View style={[styles.flowLine, { backgroundColor: `${accent}33` }]} />
        </View>
        <View style={styles.flowCell}>
          <Text style={styles.flowLabel}>HUMAIN</Text>
          <Text style={styles.flowValue}>Décision finale</Text>
        </View>
      </View>

      <Pressable
        onPress={() => setExpanded((value) => !value)}
        style={({ pressed }) => [styles.explainButton, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? "Masquer les preuves de cette proposition" : "Comprendre les preuves de cette proposition"}
      >
        <Text style={[styles.explainText, { color: accent }]}>
          {expanded ? "Masquer les preuves" : "Comprendre cette proposition"}
        </Text>
        <Text style={[styles.explainArrow, { color: accent }]}>{expanded ? "↑" : "↓"}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.proofStack}>
          {evidence.map((item, index) => {
            const kind = item.kind ?? "context";
            const used = readableIndexes.includes(index);
            return (
              <View key={`${item.label}-${index}`} style={[styles.proofRow, !used && styles.proofRowSecondary]}>
                <View style={styles.proofIndex}>
                  <Text style={styles.proofIndexText}>{String(index + 1).padStart(2, "0")}</Text>
                </View>
                <View style={styles.proofCopy}>
                  <View style={styles.proofTop}>
                    <Text style={styles.proofLabel}>{item.label}</Text>
                    <Text style={[styles.proofKind, { color: used ? accent : "rgba(255,249,236,0.34)" }]}>
                      {used ? `UTILISÉE · ${KIND_LABEL[kind]}` : `VISIBLE · ${KIND_LABEL[kind]}`}
                    </Text>
                  </View>
                  <Text style={styles.proofValue}>{item.value}</Text>
                </View>
              </View>
            );
          })}

          <View style={[styles.boundary, { borderColor: `${accent}44` }]}>
            <Text style={[styles.boundaryKicker, { color: accent }]}>FRONTIÈRE HUMAINE</Text>
            <Text style={styles.boundaryText}>{humanBoundary}</Text>
          </View>

          <View style={styles.truthLoop}>
            <View style={styles.truthLoopTop}>
              <Text style={[styles.truthLoopKicker, { color: accent }]}>BOUCLE DE VÉRITÉ</Text>
              <Text style={styles.truthLoopFreshness}>lecture · {freshness}</Text>
            </View>
            <Text style={styles.truthLoopTitle}>Ce qui pourrait faire changer l’IA d’avis</Text>
            {changeSignals.length ? (
              changeSignals.map((signal) => (
                <View key={signal} style={styles.changeRow}>
                  <View style={[styles.changeDot, { backgroundColor: accent }]} />
                  <Text style={styles.changeText}>{signal}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.changeText}>Aucun signal estimé ou contextuel parmi les preuves actuellement utilisées.</Text>
            )}
            <Text style={styles.truthLoopNote}>La recommandation n’est jamais figée : si les preuves bougent, la lecture doit pouvoir bouger aussi.</Text>
          </View>

          {footnote ? <Text style={styles.footnote}>{footnote}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: "rgba(5, 24, 24, 0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    overflow: "hidden",
    gap: 14,
  },
  currentTop: {
    position: "absolute",
    top: -58,
    right: -92,
    width: 250,
    height: 112,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.035)",
    transform: [{ rotate: "-13deg" }],
  },
  currentBottom: {
    position: "absolute",
    bottom: -54,
    left: -120,
    width: 290,
    height: 106,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.025)",
    transform: [{ rotate: "8deg" }],
  },
  header: { flexDirection: "row", alignItems: "center", gap: 11 },
  drop: {
    width: 34,
    height: 34,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  dropCore: { width: 11, height: 11, borderRadius: 999, opacity: 0.8 },
  headerCopy: { flex: 1 },
  kicker: { fontSize: 9.5, fontWeight: "900", letterSpacing: 1.8 },
  engine: { color: "rgba(255,249,236,0.55)", fontSize: 10.5, lineHeight: 15, fontWeight: "800", marginTop: 3 },
  badge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.03)" },
  badgeText: { fontSize: 7.5, fontWeight: "900", letterSpacing: 0.9 },
  title: { color: "#FFF9EC", fontSize: 20, lineHeight: 25, fontWeight: "900", letterSpacing: -0.25 },
  suggestion: { color: "rgba(255,249,236,0.75)", fontSize: 14, lineHeight: 21, fontWeight: "700" },
  trustStrip: { flexDirection: "row", alignItems: "stretch", borderRadius: 16, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: "rgba(255,255,255,0.028)", borderWidth: 1, borderColor: "rgba(255,255,255,0.055)" },
  trustCell: { flex: 1, paddingHorizontal: 8, justifyContent: "center" },
  trustDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.07)" },
  trustLabel: { color: "rgba(255,249,236,0.36)", fontSize: 7.5, fontWeight: "900", letterSpacing: 1.05 },
  trustValue: { color: "#FFF9EC", fontSize: 9.5, lineHeight: 13, fontWeight: "900", marginTop: 5 },
  flow: { flexDirection: "row", alignItems: "stretch", minHeight: 74 },
  flowCell: { flex: 1, borderRadius: 17, padding: 10, backgroundColor: "rgba(255,255,255,0.035)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  flowLabel: { color: "rgba(255,249,236,0.42)", fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  flowValue: { color: "#FFF9EC", fontSize: 11, lineHeight: 15, fontWeight: "800", marginTop: 7 },
  flowBridge: { width: 20, alignItems: "center", justifyContent: "center" },
  flowLine: { width: 1, flex: 1 },
  flowDrop: { width: 8, height: 8, borderRadius: 3, borderWidth: 1, transform: [{ rotate: "45deg" }] },
  explainButton: { minHeight: 44, borderRadius: 16, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.035)" },
  pressed: { opacity: 0.75 },
  explainText: { fontSize: 11.5, fontWeight: "900", letterSpacing: 0.4 },
  explainArrow: { fontSize: 15, fontWeight: "900" },
  proofStack: { gap: 10 },
  proofRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderRadius: 16, padding: 11, backgroundColor: "rgba(255,255,255,0.025)" },
  proofRowSecondary: { opacity: 0.58 },
  proofIndex: { width: 29, height: 29, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center" },
  proofIndexText: { color: "rgba(255,249,236,0.54)", fontSize: 9, fontWeight: "900" },
  proofCopy: { flex: 1 },
  proofTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  proofLabel: { color: "#FFF9EC", fontSize: 11, fontWeight: "900" },
  proofKind: { fontSize: 7.5, fontWeight: "900", letterSpacing: 1 },
  proofValue: { color: "rgba(255,249,236,0.63)", fontSize: 11.5, lineHeight: 17, fontWeight: "700", marginTop: 5 },
  boundary: { borderRadius: 17, padding: 13, borderWidth: 1, backgroundColor: "rgba(255,255,255,0.025)" },
  boundaryKicker: { fontSize: 8.5, fontWeight: "900", letterSpacing: 1.4 },
  boundaryText: { color: "rgba(255,249,236,0.74)", fontSize: 11.5, lineHeight: 17, fontWeight: "700", marginTop: 6 },
  truthLoop: { borderRadius: 17, padding: 13, backgroundColor: "rgba(255,255,255,0.022)", borderWidth: 1, borderColor: "rgba(255,255,255,0.05)", gap: 8 },
  truthLoopTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  truthLoopKicker: { fontSize: 8.5, fontWeight: "900", letterSpacing: 1.35 },
  truthLoopFreshness: { color: "rgba(255,249,236,0.34)", fontSize: 8.5, fontWeight: "800" },
  truthLoopTitle: { color: "#FFF9EC", fontSize: 12.5, lineHeight: 17, fontWeight: "900" },
  changeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  changeDot: { width: 6, height: 6, borderRadius: 999, opacity: 0.8 },
  changeText: { flex: 1, color: "rgba(255,249,236,0.67)", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  truthLoopNote: { color: "rgba(255,249,236,0.40)", fontSize: 9.5, lineHeight: 14, fontWeight: "700", marginTop: 2 },
  footnote: { color: "rgba(255,249,236,0.38)", fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
});
