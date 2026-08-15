import React, { useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { AquaticSignature } from "../components/aquatic/AquaticSignature";

type MoodKey = "comfort" | "discovery" | "energy" | "family" | "character" | "light";

type Mood = {
  key: MoodKey;
  label: string;
  current: string;
  title: string;
  subtitle: string;
  dish: string;
  drink: string;
  price: string;
  eta: string;
  story: string;
  ritual: string;
  intensity: string;
  freshness: string;
  journey: string;
  tags: string[];
};

const MOODS: Mood[] = [
  {
    key: "comfort",
    label: "Réconfort",
    current: "Courant velours",
    title: "Foutu banane sauce graine",
    subtitle: "Une assiette profonde, douce et généreuse.",
    dish: "Foutu banane sauce graine",
    drink: "Bissap maison",
    price: "27,80 €",
    eta: "Préparation 20 min · livraison estimée 32 min",
    story: "Texture douce, sauce intense, chaleur de maison. Un choix fait pour ralentir le temps.",
    ritual: "À savourer quand la journée réclame un vrai refuge culinaire.",
    intensity: "Enveloppante",
    freshness: "Douce",
    journey: "Maison",
    tags: ["Doux", "Profond", "Généreux"],
  },
  {
    key: "discovery",
    label: "Découverte",
    current: "Courant signature",
    title: "Rice and Peace",
    subtitle: "La signature qui ouvre le voyage.",
    dish: "Rice and Peace",
    drink: "Gingembre",
    price: "26,80 €",
    eta: "Préparation 20 min · livraison estimée 31 min",
    story: "Riz coco, haricots, pilons de poulet et sauce chien : un pont entre énergie, mémoire et élégance.",
    ritual: "Une porte d’entrée lumineuse vers l’univers Thieyp.",
    intensity: "Vibrante",
    freshness: "Solaire",
    journey: "Signature",
    tags: ["Iconique", "Vivant", "Premium"],
  },
  {
    key: "energy",
    label: "Énergie",
    current: "Courant citron",
    title: "Yassa de poulet",
    subtitle: "Citron, oignons, tension vive et fraîche.",
    dish: "Yassa de poulet",
    drink: "Gingembre",
    price: "26,80 €",
    eta: "Préparation 20 min · livraison estimée 30 min",
    story: "Une assiette lumineuse, acide et directe. Le genre de plat qui remet le corps et l’esprit en mouvement.",
    ritual: "Idéal avant une longue soirée ou après une journée trop lourde.",
    intensity: "Tonique",
    freshness: "Citronnée",
    journey: "Élan",
    tags: ["Frais", "Tonique", "Citronné"],
  },
  {
    key: "family",
    label: "Famille",
    current: "Courant mémoire",
    title: "Thiéboudieune rouge",
    subtitle: "Le grand classique qui rassemble.",
    dish: "Thiéboudieune rouge",
    drink: "Baobab",
    price: "26,80 €",
    eta: "Préparation 20 min · livraison estimée 34 min",
    story: "Riz cassé tomaté, poisson et légumes : une assiette de transmission, de table pleine et de souvenirs partagés.",
    ritual: "À choisir quand le repas doit porter une histoire collective.",
    intensity: "Généreuse",
    freshness: "Ronde",
    journey: "Sénégal",
    tags: ["Classique", "Partage", "Transmission"],
  },
  {
    key: "character",
    label: "Caractère",
    current: "Courant profond",
    title: "Mafé à la viande",
    subtitle: "Une sauce ronde, dense et assumée.",
    dish: "Mafé à la viande",
    drink: "Bissap maison",
    price: "34,80 €",
    eta: "Préparation 20 min · livraison estimée 33 min",
    story: "La profondeur de l’arachide, la force de la viande et la chaleur du riz blanc. Un plat qui prend sa place.",
    ritual: "Pour les faims sérieuses et les envies franches.",
    intensity: "Puissante",
    freshness: "Ronde",
    journey: "Profondeur",
    tags: ["Dense", "Généreux", "Puissant"],
  },
  {
    key: "light",
    label: "Légèreté",
    current: "Courant clair",
    title: "Attiéké au poisson",
    subtitle: "Fraîcheur, poisson mariné et équilibre.",
    dish: "Attiéké au poisson",
    drink: "Baobab",
    price: "26,80 €",
    eta: "Préparation 20 min · livraison estimée 29 min",
    story: "Semoule de manioc, poisson mariné et salade fraîche. Une option claire, solaire et facile à aimer.",
    ritual: "Quand on veut voyager sans s’alourdir.",
    intensity: "Légère",
    freshness: "Marine",
    journey: "Équilibre",
    tags: ["Frais", "Poisson", "Équilibre"],
  },
];

export default function TasteOracleScreen() {
  const [selectedKey, setSelectedKey] = useState<MoodKey>("discovery");
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const selected = useMemo(
    () => MOODS.find((mood) => mood.key === selectedKey) || MOODS[0],
    [selectedKey],
  );

  return (
    <AquaticSignature reduceMotion={reduceMotion}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View pointerEvents="none" style={styles.currentOne} />
        <View pointerEvents="none" style={styles.currentTwo} />
        <View pointerEvents="none" style={styles.orb} />

        <View style={styles.hero}>
          <View pointerEvents="none" style={styles.heroRefraction} />
          <Text style={styles.brand}>DELISHAFRICA®</Text>
          <Text style={styles.kicker}>TASTE ORACLE · AQUATIC</Text>
          <Text style={styles.title}>Quelle émotion votre palais veut-il suivre ?</Text>
          <Text style={styles.subtitle}>
            Choisissez une intention. L’Oracle la transforme en courant de goût, en histoire et en assiette.
          </Text>
          <View style={styles.liveLine}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>SÉLECTION ÉDITORIALE DELISHAFRICA</Text>
          </View>
        </View>

        <View style={styles.moodSection}>
          <Text style={styles.sectionKicker}>CHOISIR LE COURANT</Text>
          <View style={styles.moodGrid}>
            {MOODS.map((mood) => {
              const active = mood.key === selected.key;
              return (
                <Pressable
                  key={mood.key}
                  onPress={() => setSelectedKey(mood.key)}
                  style={({ pressed }) => [
                    styles.moodChip,
                    active && styles.moodChipActive,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`Intention ${mood.label}`}
                >
                  <Text style={[styles.moodText, active && styles.moodTextActive]}>{mood.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.oracleCard}>
          <View pointerEvents="none" style={styles.oracleSheen} />
          <View style={styles.oracleTop}>
            <View>
              <Text style={styles.oracleBadge}>ORACLE ACTIF</Text>
              <Text style={styles.oracleCurrent}>{selected.current}</Text>
            </View>
            <Text style={styles.oracleEta}>{selected.eta}</Text>
          </View>

          <Text style={styles.dish}>{selected.title}</Text>
          <Text style={styles.dishSubtitle}>{selected.subtitle}</Text>

          <View style={styles.compass}>
            <View style={styles.compassCell}>
              <Text style={styles.compassLabel}>INTENSITÉ</Text>
              <Text style={styles.compassValue}>{selected.intensity}</Text>
            </View>
            <View style={styles.compassCell}>
              <Text style={styles.compassLabel}>FRAÎCHEUR</Text>
              <Text style={styles.compassValue}>{selected.freshness}</Text>
            </View>
            <View style={styles.compassCell}>
              <Text style={styles.compassLabel}>VOYAGE</Text>
              <Text style={styles.compassValue}>{selected.journey}</Text>
            </View>
          </View>

          <View style={styles.comboBox}>
            <View style={styles.comboLine}>
              <Text style={styles.comboLabel}>Plat</Text>
              <Text style={styles.comboValue}>{selected.dish}</Text>
            </View>
            <View style={styles.comboLine}>
              <Text style={styles.comboLabel}>Accord</Text>
              <Text style={styles.comboValue}>{selected.drink}</Text>
            </View>
            <View style={styles.comboLine}>
              <Text style={styles.comboLabel}>Estimation</Text>
              <Text style={styles.comboValue}>{selected.price}</Text>
            </View>
          </View>

          <Text style={styles.story}>{selected.story}</Text>
          <View style={styles.ritualCard}>
            <Text style={styles.ritualLabel}>RITUEL DE DÉGUSTATION</Text>
            <Text style={styles.ritual}>{selected.ritual}</Text>
          </View>

          <View style={styles.tags}>
            {selected.tags.map((tag) => (
              <Text key={tag} style={styles.tag}>{tag}</Text>
            ))}
          </View>
        </View>

        <View style={styles.promiseCard}>
          <Text style={styles.promiseKicker}>LE GOÛT COMME BOUSSOLE</Text>
          <Text style={styles.promiseTitle}>Une recommandation qui commence par vous.</Text>
          <Text style={styles.promiseText}>
            L’Oracle ne remplace pas votre envie : il lui donne une direction, une émotion et une porte d’entrée vers le menu.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
          onPress={() => router.push("/menu" as never)}
          accessibilityRole="button"
          accessibilityLabel={`Composer mon panier avec ${selected.dish}`}
        >
          <Text style={styles.primaryButtonKicker}>COURANT CHOISI · {selected.label.toUpperCase()}</Text>
          <Text style={styles.primaryButtonText}>Composer mon panier</Text>
          <Text style={styles.primaryButtonHint}>Ouvrir le menu Thieyp →</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => router.push("/" as never)}
          accessibilityRole="button"
          accessibilityLabel="Retourner à l’accueil Client"
        >
          <Text style={styles.secondaryButtonText}>Retour à la marketplace</Text>
        </Pressable>

        <Text style={styles.footer}>Taste Oracle Aquatic · DelishAfrica®</Text>
      </ScrollView>
    </AquaticSignature>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingTop: 62, paddingHorizontal: 18, paddingBottom: 42, gap: 18 },
  currentOne: {
    position: "absolute",
    top: 242,
    right: -76,
    width: 310,
    height: 44,
    borderRadius: 999,
    backgroundColor: "rgba(171,255,241,0.06)",
    borderWidth: 1,
    borderColor: "rgba(201,255,246,0.10)",
    transform: [{ rotate: "-11deg" }],
  },
  currentTwo: {
    position: "absolute",
    top: 690,
    left: -96,
    width: 330,
    height: 52,
    borderRadius: 999,
    backgroundColor: "rgba(245,190,103,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,229,184,0.09)",
    transform: [{ rotate: "9deg" }],
  },
  orb: {
    position: "absolute",
    top: 430,
    left: -118,
    width: 240,
    height: 240,
    borderRadius: 999,
    backgroundColor: "rgba(30,111,119,0.15)",
    borderWidth: 1,
    borderColor: "rgba(165,248,236,0.08)",
  },
  hero: {
    borderRadius: 32,
    padding: 24,
    backgroundColor: "rgba(4,31,28,0.88)",
    borderWidth: 1,
    borderColor: "rgba(156,241,222,0.26)",
    overflow: "hidden",
    shadowColor: "#8CF7EA",
    shadowOpacity: 0.12,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
  },
  heroRefraction: {
    position: "absolute",
    width: 320,
    height: 106,
    borderRadius: 999,
    top: -58,
    right: -94,
    backgroundColor: "rgba(205,255,246,0.11)",
    borderWidth: 1,
    borderColor: "rgba(205,255,246,0.13)",
    transform: [{ rotate: "-11deg" }],
  },
  brand: { color: "#F5BE67", fontSize: 13, fontWeight: "900", letterSpacing: 4.2 },
  kicker: { color: "#9BEFE1", fontSize: 11, fontWeight: "900", letterSpacing: 2.8, marginTop: 14 },
  title: { color: "#FFF9EC", fontSize: 38, lineHeight: 41, fontWeight: "900", letterSpacing: -1.4, marginTop: 12 },
  subtitle: { color: "rgba(255,249,236,0.72)", fontSize: 16, lineHeight: 24, fontWeight: "600", marginTop: 14 },
  liveLine: { flexDirection: "row", alignItems: "center", gap: 9, marginTop: 20 },
  liveDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: "#9BEFE1", shadowColor: "#9BEFE1", shadowOpacity: 0.8, shadowRadius: 8 },
  liveText: { color: "rgba(255,249,236,0.58)", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  moodSection: { borderRadius: 28, padding: 18, backgroundColor: "rgba(210,255,247,0.045)", borderWidth: 1, borderColor: "rgba(195,255,244,0.10)" },
  sectionKicker: { color: "rgba(255,249,236,0.62)", fontSize: 11, fontWeight: "900", letterSpacing: 2.5 },
  moodGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  moodChip: { borderRadius: 999, paddingHorizontal: 15, paddingVertical: 11, backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  moodChipActive: { backgroundColor: "#9BEFE1", borderColor: "#D8FFF8" },
  moodText: { color: "#E3F6F2", fontSize: 13, fontWeight: "900" },
  moodTextActive: { color: "#082A27" },
  pressed: { opacity: 0.76, transform: [{ scale: 0.985 }] },
  oracleCard: { borderRadius: 34, padding: 24, backgroundColor: "rgba(250,216,154,0.97)", borderWidth: 1, borderColor: "rgba(255,243,211,0.62)", overflow: "hidden", shadowColor: "#F5BE67", shadowOpacity: 0.15, shadowRadius: 24, shadowOffset: { width: 0, height: 10 } },
  oracleSheen: { position: "absolute", top: -48, left: -36, right: -36, height: 92, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.22)", transform: [{ rotate: "4deg" }] },
  oracleTop: { gap: 12, marginBottom: 18 },
  oracleBadge: { color: "#5B3B00", fontSize: 11, fontWeight: "900", letterSpacing: 2.3 },
  oracleCurrent: { color: "#8B5C11", fontSize: 14, fontWeight: "900", marginTop: 5 },
  oracleEta: { color: "#6E511D", fontSize: 13, lineHeight: 19, fontWeight: "800" },
  dish: { color: "#111A19", fontSize: 32, lineHeight: 36, fontWeight: "900", letterSpacing: -0.9 },
  dishSubtitle: { color: "#5B4630", fontSize: 16, lineHeight: 23, fontWeight: "800", marginTop: 8 },
  compass: { flexDirection: "row", gap: 8, marginTop: 20 },
  compassCell: { flex: 1, borderRadius: 18, paddingVertical: 13, paddingHorizontal: 10, backgroundColor: "rgba(17,26,25,0.08)" },
  compassLabel: { color: "#7B5B22", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  compassValue: { color: "#111A19", fontSize: 13, lineHeight: 17, fontWeight: "900", marginTop: 6 },
  comboBox: { marginTop: 18, borderRadius: 24, padding: 16, backgroundColor: "rgba(17,26,25,0.08)", gap: 12 },
  comboLine: { flexDirection: "row", justifyContent: "space-between", gap: 14 },
  comboLabel: { color: "#76591F", fontSize: 11, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1.2 },
  comboValue: { color: "#111A19", fontSize: 14, fontWeight: "900", flex: 1, textAlign: "right" },
  story: { color: "#21180C", fontSize: 17, lineHeight: 25, fontWeight: "800", marginTop: 20 },
  ritualCard: { marginTop: 16, borderRadius: 20, padding: 15, backgroundColor: "rgba(255,255,255,0.31)", borderWidth: 1, borderColor: "rgba(255,255,255,0.36)" },
  ritualLabel: { color: "#7B5B22", fontSize: 10, fontWeight: "900", letterSpacing: 1.6 },
  ritual: { color: "#5E4214", fontSize: 14, lineHeight: 21, fontWeight: "800", marginTop: 7 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 18 },
  tag: { color: "#FFF8E7", backgroundColor: "#102A27", borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8, fontSize: 11, fontWeight: "900" },
  promiseCard: { borderRadius: 28, padding: 20, backgroundColor: "rgba(7,38,34,0.86)", borderWidth: 1, borderColor: "rgba(150,240,222,0.18)" },
  promiseKicker: { color: "#9BEFE1", fontSize: 10, fontWeight: "900", letterSpacing: 2.3 },
  promiseTitle: { color: "#FFF9EC", fontSize: 22, lineHeight: 27, fontWeight: "900", marginTop: 10 },
  promiseText: { color: "rgba(255,249,236,0.67)", fontSize: 14, lineHeight: 22, fontWeight: "600", marginTop: 9 },
  primaryButton: { borderRadius: 26, paddingVertical: 18, paddingHorizontal: 20, alignItems: "center", backgroundColor: "#9BEFE1", borderWidth: 1, borderColor: "#D8FFF8" },
  primaryButtonKicker: { color: "#326E65", fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  primaryButtonText: { color: "#082A27", fontSize: 18, fontWeight: "900", marginTop: 5 },
  primaryButtonHint: { color: "#39756C", fontSize: 12, fontWeight: "800", marginTop: 5 },
  secondaryButton: { borderRadius: 24, paddingVertical: 16, alignItems: "center", backgroundColor: "rgba(255,255,255,0.07)", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)" },
  secondaryButtonText: { color: "#FFF9EC", fontSize: 14, fontWeight: "900" },
  footer: { color: "rgba(255,249,236,0.42)", fontSize: 11, fontWeight: "800", letterSpacing: 1.4, textAlign: "center", marginTop: 2 },
});
