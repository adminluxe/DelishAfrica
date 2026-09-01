import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AquaticSignature } from "../components/aquatic/AquaticSignature";
import { WaterIntelRail } from "../ui/water/WaterIntelRail";

const CLIENT_H2O_RASTER = require("../assets/h2o/client-h2o-raster-premium-v1.png");

type RouteCard = {
  eyebrow: string;
  title: string;
  body: string;
  path: string;
  accent?: "gold" | "aqua";
};

const ROUTES: RouteCard[] = [
  {
    eyebrow: "TABLES",
    title: "Restaurants",
    body: "Choisir une table, ouvrir sa carte et commencer une commande.",
    path: "/restaurants",
    accent: "gold",
  },
  {
    eyebrow: "COMMANDES",
    title: "Mes parcours",
    body: "Retrouver les commandes liées à votre identité Client.",
    path: "/orders",
  },
  {
    eyebrow: "TEMPS RÉEL",
    title: "Suivi vivant",
    body: "ETA, progression et terrain sans perdre le contexte.",
    path: "/live-tracking",
    accent: "aqua",
  },
  {
    eyebrow: "IDENTITÉ",
    title: "Mon espace",
    body: "Profil, confiance, territoire et préférences du compte.",
    path: "/client-space",
  },
];


// S10D_PHYSICAL_H2O_TEARDROP_V1
function ClientWaterRealityLayer({ reduceMotion }: { reduceMotion: boolean }) {
  const current = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    current.stopAnimation();

    if (reduceMotion) {
      current.setValue(0.42);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(current, {
          toValue: 1,
          duration: 12400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(current, {
          toValue: 0,
          duration: 12400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [current, reduceMotion]);

  const x = current.interpolate({ inputRange: [0, 1], outputRange: [-18, 28] });
  const reverseX = current.interpolate({ inputRange: [0, 1], outputRange: [22, -18] });
  const opacity = current.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.20] });

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.waterRealityLayer}
    >
      <Animated.View
        style={[
          styles.clientCausticA,
          { opacity, transform: [{ translateX: x }, { rotate: "-14deg" }] },
        ]}
      />
      <Animated.View
        style={[
          styles.clientCausticB,
          { opacity, transform: [{ translateX: reverseX }, { rotate: "18deg" }] },
        ]}
      />
      <View style={styles.clientRefractionLine} />
      <View style={styles.clientRefractionLineSoft} />
    </View>
  );
}

export default function ClientSurfaceHome() {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => mounted && setReduceMotion(value))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const go = (path: string) => router.push(path as any);

  return (
    <AquaticSignature reduceMotion={reduceMotion}>
      <ImageBackground
        source={CLIENT_H2O_RASTER}
        style={styles.h2oCompositor}
        imageStyle={styles.h2oBackgroundImage}
        resizeMode="cover"
        onLoad={() => { if (__DEV__) console.log("DA_S10J_BG_LOADED_CLIENT"); }}
      >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 18, 32), paddingBottom: insets.bottom + 44 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topline}>
          <View style={styles.toplineCopy}>
            <Text style={styles.brand}>DELISHAFRICA®</Text>
            <Text style={styles.role}>CLIENT · DISCOVERY OCEAN · S10J</Text>
          </View>
          <Pressable
            onPress={() => go("/client-space")}
            style={styles.avatarButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir Mon espace Client"
          >
            <Text style={styles.avatarText}>MOI</Text>
          </Pressable>
        </View>

        <WaterIntelRail
          tone="client"
          mode="radar"
          label="RADAR · DISCOVERY OCEAN"
          title="Le marché vient à vous."
          body="Cuisines ouvertes, signaux culturels et parcours en cours remontent dans un même courant, sans noyer votre choix."
          status="LIVE"
          reduceMotion={reduceMotion}
          onPress={() => go("/live-market")}
          accessibilityLabel="Ouvrir DelishAfrica Radar et le marché vivant"
        />

        <Text style={styles.kicker}>AFRICA · LIVE · À PORTÉE DE GESTE</Text>
        <Text style={styles.hero}>Choisissez une table.{`\n`}Le reste se met en mouvement.</Text>
        <Text style={styles.subtitle}>
          Découvrez, commandez et suivez chaque étape depuis un parcours continu, pensé pour rester simple
          même quand tout s’accélère.
        </Text>

        <Pressable
          onPress={() => go("/restaurants")}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.primaryCopy}>
            <Text style={styles.primaryEyebrow}>POUR VOUS · MAINTENANT</Text>
            <Text style={styles.primaryTitle}>Commander maintenant</Text>
            <Text style={styles.primaryBody}>Tables actives, menus, panier et paiement.</Text>
          </View>
          <Text style={styles.primaryArrow}>→</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>VOTRE PARCOURS</Text>
        <View style={styles.grid}>
          {ROUTES.map((item) => (
            <Pressable
              key={item.path}
              onPress={() => go(item.path)}
              style={({ pressed }) => [
                styles.card,
                item.accent === "gold" && styles.cardGold,
                item.accent === "aqua" && styles.cardAqua,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.body}`}
            >
              <Text style={styles.cardEyebrow}>{item.eyebrow}</Text>
              <Text style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardBody}>{item.body}</Text>
              <Text style={styles.cardArrow}>↗</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={() => go("/live-market")}
          style={({ pressed }) => [styles.legacy, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View>
            <Text style={styles.legacyEyebrow}>LIVE MARKET · SURFACE ÉTENDUE</Text>
            <Text style={styles.legacyTitle}>Ouvrir l’expérience marketplace complète</Text>
          </View>
          <Text style={styles.legacyArrow}>→</Text>
        </Pressable>

        <Text style={styles.footer}>
          DelishAfrica® · la découverte reste publique, les actions sensibles suivent votre identité.
        </Text>
      </ScrollView>
      <ClientWaterRealityLayer reduceMotion={reduceMotion} />
</ImageBackground>
    </AquaticSignature>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent" },
  content: { paddingHorizontal: 22, gap: 22 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  toplineCopy: { flex: 1, minWidth: 0 },
  brand: { color: "#F5BE57", fontSize: 16, fontWeight: "900", letterSpacing: 3.1 },
  role: { color: "rgba(224,238,233,0.58)", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 7 },
  avatarButton: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: "rgba(176,237,226,0.28)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(7,28,25,0.62)" },
  avatarText: { color: "#E9F5F0", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  signal: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "rgba(76,211,194,0.24)", borderRadius: 24, padding: 16, backgroundColor: "rgba(4,29,26,0.58)" },
  signalDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#F0B857" },
  signalCopy: { flex: 1 },
  signalLabel: { color: "#74E1C8", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  signalText: { color: "rgba(231,242,237,0.72)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  signalState: { color: "#F1C064", fontSize: 12, fontWeight: "900", letterSpacing: 1.3 },
  kicker: { color: "#D28B58", fontSize: 11, fontWeight: "900", letterSpacing: 2.6, marginTop: 8 },
  hero: { color: "#FFF6E7", fontSize: 43, lineHeight: 47, fontWeight: "900", letterSpacing: -1.8 },
  subtitle: { color: "rgba(219,231,226,0.70)", fontSize: 17, lineHeight: 27, maxWidth: 620 },
  primary: { minHeight: 174, borderRadius: 34, padding: 24, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: "#F4E6C7", overflow: "hidden" },
  primaryCopy: { flex: 1, minWidth: 0, paddingRight: 18 },
  primaryEyebrow: { color: "#A45C36", fontSize: 11, fontWeight: "900", letterSpacing: 2.5 },
  primaryTitle: { color: "#12271F", fontSize: 30, fontWeight: "900", marginTop: 12, letterSpacing: -0.8 },
  primaryBody: { color: "rgba(18,39,31,0.68)", fontSize: 14, lineHeight: 20, marginTop: 8 },
  primaryArrow: { color: "#12271F", fontSize: 38, fontWeight: "600" },
  sectionLabel: { color: "#CE8C60", fontSize: 11, fontWeight: "900", letterSpacing: 2.8, marginTop: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  card: { flexBasis: "47%", flexGrow: 1, minWidth: 148, minHeight: 174, borderRadius: 26, borderWidth: 1, borderColor: "rgba(202,232,223,0.15)", backgroundColor: "rgba(3,22,20,0.68)", padding: 18 },
  cardGold: { borderColor: "rgba(241,190,87,0.34)", backgroundColor: "rgba(45,32,13,0.52)" },
  cardAqua: { borderColor: "rgba(83,225,205,0.34)", backgroundColor: "rgba(4,37,33,0.68)" },
  cardEyebrow: { color: "#74E1C8", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  cardTitle: { color: "#FFF6E7", fontSize: 20, fontWeight: "900", marginTop: 10 },
  cardBody: { color: "rgba(226,238,233,0.64)", fontSize: 12, lineHeight: 18, marginTop: 8, paddingRight: 8 },
  cardArrow: { color: "#F3C067", fontSize: 22, marginTop: "auto", alignSelf: "flex-end" },
  legacy: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(117,190,177,0.22)", backgroundColor: "rgba(4,24,22,0.48)", padding: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 16 },
  legacyEyebrow: { color: "#78C8B6", fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  legacyTitle: { color: "#EAF4F0", fontSize: 15, fontWeight: "800", marginTop: 5, flexShrink: 1 },
  legacyArrow: { color: "#E9BC68", fontSize: 24 },
  footer: { color: "rgba(198,216,209,0.42)", fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 18 },
  h2oCompositor: { flex: 1, position: "relative", overflow: "hidden" },
  h2oBackgroundImage: { opacity: 0.96 },
  waterRealityLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  clientCausticA: { position: "absolute", width: 390, height: 156, borderRadius: 999, borderWidth: 1.4, borderColor: "rgba(106,231,211,0.11)", left: -218, top: 68, backgroundColor: "rgba(72,205,188,0.018)" },
  clientCausticB: { position: "absolute", width: 300, height: 112, borderRadius: 999, borderWidth: 1, borderColor: "rgba(245,205,117,0.08)", right: -186, top: 286, backgroundColor: "rgba(106,231,211,0.016)" },
  clientCausticC: { position: "absolute", width: 250, height: 84, borderRadius: 999, borderWidth: 1, borderColor: "rgba(132,244,225,0.07)", left: 18, top: 542, backgroundColor: "rgba(106,231,211,0.012)" },
  clientLensHalo: { position: "absolute", width: 70, height: 70, borderRadius: 40, borderWidth: 1.2, borderColor: "rgba(225,255,250,0.38)", backgroundColor: "rgba(91,228,205,0.07)", right: 4, top: 118 },
  clientDropLarge: { position: "absolute", width: 38, height: 38, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 5, borderWidth: 1.8, borderColor: "rgba(240,255,252,0.96)", backgroundColor: "rgba(150,239,223,0.30)", right: 22, top: 138, shadowColor: "#E9FFF9", shadowOpacity: 0.58, shadowRadius: 17, shadowOffset: { width: -2, height: 3 } },
  clientDropSmall: { position: "absolute", width: 24, height: 24, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 14, borderBottomRightRadius: 4, borderWidth: 1.4, borderColor: "rgba(236,255,251,0.90)", backgroundColor: "rgba(150,239,223,0.26)", left: 18, top: 424, shadowColor: "#E9FFF9", shadowOpacity: 0.42, shadowRadius: 10, shadowOffset: { width: 1, height: 2 } },
  clientBeadA: { position: "absolute", width: 16, height: 16, borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 10, borderBottomRightRadius: 3, borderWidth: 1.2, borderColor: "rgba(235,255,250,0.84)", backgroundColor: "rgba(150,239,223,0.24)", right: 38, top: 520, shadowColor: "#E9FFF9", shadowOpacity: 0.30, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  clientBeadB: { position: "absolute", width: 10, height: 12, borderRadius: 7, borderWidth: 1, borderColor: "rgba(232,255,250,0.80)", backgroundColor: "rgba(176,247,233,0.24)", right: 66, top: 548 },
  waterDropHighlight: { position: "absolute", width: 7, height: 15, borderRadius: 999, left: 6, top: 5, backgroundColor: "rgba(255,255,255,0.98)", transform: [{ rotate: "-45deg" }] },
  waterDropInnerRim: { position: "absolute", width: 25, height: 25, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 4, right: 3, bottom: 3, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: "rgba(118,244,223,0.72)" },
  waterDropHighlightSmall: { position: "absolute", width: 5, height: 10, borderRadius: 999, left: 4, top: 3, backgroundColor: "rgba(255,255,255,0.96)", transform: [{ rotate: "-45deg" }] },
  waterDropHighlightMicro: { position: "absolute", width: 3.5, height: 7, borderRadius: 999, left: 3, top: 2, backgroundColor: "rgba(255,255,255,0.92)", transform: [{ rotate: "-45deg" }] },
  waterDropHighlightNano: { position: "absolute", width: 2.5, height: 5, borderRadius: 999, left: 2, top: 2, backgroundColor: "rgba(255,255,255,0.72)", transform: [{ rotate: "18deg" }] },
  clientRefractionLine: { position: "absolute", width: 176, height: 1, borderRadius: 999, right: -38, top: 430, backgroundColor: "rgba(121,237,218,0.10)", transform: [{ rotate: "24deg" }] },
  clientRefractionLineSoft: { position: "absolute", width: 118, height: 1, borderRadius: 999, left: -12, top: 612, backgroundColor: "rgba(245,205,117,0.06)", transform: [{ rotate: "-28deg" }] },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
