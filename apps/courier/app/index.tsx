import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  ImageBackground,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CourierAquaticSignature } from "../components/aquatic/CourierAquaticSignature";
import { WaterIntelRail } from "../ui/water/WaterIntelRail";

const COURIER_H2O_RASTER = require("../assets/h2o/courier-h2o-premium-v1.png");
const COURIER_RAIN_TILE = require("../assets/h2o/courier-rain-streak-tile-v3.png");
const COURIER_GLASS_RIVULETS = require("../assets/h2o/courier-glass-rivulets-v3.png");
import { daOrdersFetch } from "../utils/daOrdersApi";

const RAW_API = process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me/api/v1";
const API = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

type RouteCard = { eyebrow: string; title: string; body: string; path: string };

const ROUTES: RouteCard[] = [
  { eyebrow: "OFFRES", title: "Missions", body: "Voir les propositions qui appartiennent à votre identité Courier.", path: "/orders" },
  { eyebrow: "INTELLIGENCE", title: "Route Oracle", body: "ETA, score terrain et acceptation authentifiée.", path: "/route-oracle" },
  { eyebrow: "NAVIGATION", title: "Carte Live", body: "Retrait, itinéraire et progression de la mission.", path: "/courier-real-map" },
  { eyebrow: "PRÉSENCE", title: "Mon espace", body: "Disponibilité, zone active, confiance et profil terrain.", path: "/courier-space" },
];

function extractOrders(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}


// S10N_RAIN_CONTINUITY: keep certified S10K droplets, use seamless moving rain tiles plus full-height glass rivulets.

export default function CourierSurfaceHome() {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [offers, setOffers] = useState<any[]>([]);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const rainPhase = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    rainPhase.stopAnimation();
    if (reduceMotion) {
      rainPhase.setValue(0.42);
      return;
    }

    rainPhase.setValue(0);
    const loop = Animated.loop(
      Animated.timing(rainPhase, {
        toValue: 1,
        duration: 6200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [rainPhase, reduceMotion]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    try {
      const response = await daOrdersFetch(`${API}/orders/demo/courier/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(body?.code || `HTTP ${response.status}`));
      setOffers(extractOrders(body));
      setAuthReady(true);
    } catch {
      setOffers([]);
      setAuthReady(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const stats = useMemo(() => {
    const proposed = offers.filter((item) => String(item?.assignmentProposal?.status || "").toLowerCase() === "proposed").length;
    const accepted = offers.filter((item) => String(item?.assignmentProposal?.status || "").toLowerCase() === "accepted").length;
    const route = offers.filter((item) => ["picked_up", "delivered"].includes(String(item?.status || "").toLowerCase())).length;
    return { proposed, accepted, route };
  }, [offers]);

  const go = (path: string) => router.push(path as any);
  const rainTileHeight = Math.max(760, viewportHeight + 240);
  const rainFlowY = rainPhase.interpolate({
    inputRange: [0, 1],
    outputRange: [0, rainTileHeight],
  });
  const rainTileOpacity = rainPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.30, 0.38, 0.30],
  });
  const rivuletOpacity = rainPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.14, 0.21, 0.14],
  });
  const rivuletDriftY = rainPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-2, 2, -2],
  });

  return (
    <CourierAquaticSignature reduceMotion={reduceMotion}>
      <ImageBackground
        source={COURIER_H2O_RASTER}
        style={styles.h2oCompositor}
        imageStyle={styles.h2oBackgroundImage}
        resizeMode="cover"
        onLoad={() => { if (__DEV__) console.log("DA_S10K_BG_LOADED_COURIER"); }}
      >
        <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 18, 32), paddingBottom: insets.bottom + 44 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topline}>
          <View style={styles.toplineCopy}>
            <Text style={styles.brand}>DELISHAFRICA®</Text>
            <Text style={styles.role}>COURIER · ROUTE CURRENT · S10N</Text>
          </View>
          <Pressable
            onPress={() => go("/courier-space")}
            style={styles.avatarButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir Mon espace Courier"
          >
            <Text style={styles.avatarText}>GO</Text>
          </Pressable>
        </View>

        <View style={[styles.identity, authReady ? styles.identityReady : styles.identityPending]}>
          <View style={[styles.identityDot, authReady && styles.identityDotReady]} />
          <View style={styles.identityCopy}>
            <Text style={styles.identityLabel}>COURIER AUTHORITY</Text>
            <Text style={styles.identityText}>
              {loading
                ? "Synchronisation de votre identité terrain…"
                : authReady
                  ? "Identité Courier active · offres isolées par assignment"
                  : "Connexion Courier requise pour charger les missions"}
            </Text>
          </View>
          {loading ? <ActivityIndicator size="small" /> : <Text style={styles.identityState}>{authReady ? "LIVE" : "GATE"}</Text>}
        </View>

        <WaterIntelRail
          tone="courier"
          mode="oracle"
          label="ORACLE · ROUTE CURRENT"
          title={authReady ? `${stats.proposed + stats.accepted} signal${stats.proposed + stats.accepted > 1 ? "s" : ""} terrain en lecture.` : "Le terrain attend votre identité."}
          body="ETA, offres, présence et progression se lisent dans un même courant. Oracle recommande ; vous décidez."
          status={loading ? "SYNC" : authReady ? "LIVE" : "GATE"}
          reduceMotion={reduceMotion}
          onPress={() => go(authReady ? "/terrain-live" : "/auth-session")}
          accessibilityLabel="Ouvrir Route Current et la lecture terrain"
        />

        <Text style={styles.kicker}>MISSION · ETA · RETRAIT · LIVRAISON</Text>
        <Text style={styles.hero}>Le terrain décide.{`\n`}Vous gardez le contrôle.</Text>
        <Text style={styles.subtitle}>
          Les offres serveur, Route Oracle, la carte et votre présence avancent ensemble, sans confondre
          recommandation et décision.
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{stats.proposed}</Text><Text style={styles.statLabel}>offres</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{stats.accepted}</Text><Text style={styles.statLabel}>acceptées</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{stats.route}</Text><Text style={styles.statLabel}>terrain</Text></View>
        </View>

        <Pressable
          onPress={() => go(authReady ? "/orders" : "/auth-session")}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.primaryCopy}>
            <Text style={styles.primaryEyebrow}>{authReady ? "SERVER DISPATCH" : "IDENTITÉ D’ABORD"}</Text>
            <Text style={styles.primaryTitle}>{authReady ? "Voir mes missions" : "Ouvrir la connexion Courier"}</Text>
            <Text style={styles.primaryBody}>
              {authReady ? "Seules les offres rattachées à votre sujet Courier sont visibles." : "Une session OIDC Courier est nécessaire."}
            </Text>
          </View>
          <Text style={styles.primaryArrow}>→</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>OUTILS TERRAIN</Text>
        <View style={styles.grid}>
          {ROUTES.map((item) => (
            <Pressable
              key={item.path}
              onPress={() => go(item.path)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
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
          onPress={() => go("/terrain-os")}
          style={({ pressed }) => [styles.legacy, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.legacyEyebrow}>SURFACE ÉTENDUE</Text>
            <Text style={styles.legacyTitle}>Ouvrir la vue Terrain étendue</Text>
          </View>
          <Text style={styles.legacyArrow}>→</Text>
        </Pressable>

        <Text style={styles.footer}>
          DelishAfrica® · le serveur recommande, votre identité décide, chaque étape terrain reste explicite.
        </Text>
      </ScrollView>
      <View pointerEvents="none" style={styles.rainViewport}>
        <Animated.View
          style={[
            styles.rainTrack,
            {
              height: rainTileHeight * 2,
              opacity: rainTileOpacity,
              transform: [{ translateY: rainFlowY }],
            },
          ]}
        >
          <Image
            source={COURIER_RAIN_TILE}
            resizeMode="stretch"
            style={[styles.rainTile, { top: -rainTileHeight, height: rainTileHeight }]}
            onLoad={() => { if (__DEV__) console.log("DA_S10N_RAIN_TILE_LOADED_COURIER"); }}
          />
          <Image
            source={COURIER_RAIN_TILE}
            resizeMode="stretch"
            style={[styles.rainTile, { top: 0, height: rainTileHeight }]}
          />
        </Animated.View>
        <Animated.Image
          source={COURIER_GLASS_RIVULETS}
          resizeMode="stretch"
          blurRadius={0.35}
          style={[
            styles.rivuletOverlay,
            {
              opacity: rivuletOpacity,
              transform: [{ translateY: rivuletDriftY }],
            },
          ]}
          onLoad={() => { if (__DEV__) console.log("DA_S10N_RIVULETS_LOADED_COURIER"); }}
        />
      </View>
      </ImageBackground>
    </CourierAquaticSignature>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent", position: "relative", zIndex: 1 },
  content: { paddingHorizontal: 22, gap: 22 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  toplineCopy: { flex: 1, minWidth: 0 },
  brand: { color: "#F0B95C", fontSize: 16, fontWeight: "900", letterSpacing: 3.1 },
  role: { color: "rgba(208,233,227,0.56)", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 7 },
  avatarButton: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: "rgba(92,224,185,0.25)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,35,29,0.62)" },
  avatarText: { color: "#DDF7EF", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  identity: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 24, padding: 16 },
  identityReady: { borderColor: "rgba(84,223,179,0.30)", backgroundColor: "rgba(5,43,34,0.62)" },
  identityPending: { borderColor: "rgba(232,177,84,0.30)", backgroundColor: "rgba(45,31,13,0.58)" },
  identityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E4AA53" },
  identityDotReady: { backgroundColor: "#5BE0B1" },
  identityCopy: { flex: 1 },
  identityLabel: { color: "#69DDB7", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  identityText: { color: "rgba(226,242,236,0.74)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  identityState: { color: "#F0BF68", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  kicker: { color: "#D18A59", fontSize: 11, fontWeight: "900", letterSpacing: 2.6, marginTop: 8 },
  hero: { color: "#FFF4E3", fontSize: 43, lineHeight: 47, fontWeight: "900", letterSpacing: -1.8 },
  subtitle: { color: "rgba(215,232,226,0.68)", fontSize: 17, lineHeight: 27 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flex: 1, minWidth: 88, minHeight: 88, borderRadius: 22, borderWidth: 1, borderColor: "rgba(91,220,181,0.16)", backgroundColor: "rgba(5,31,26,0.54)", padding: 14, justifyContent: "center" },
  statValue: { color: "#E8FFF6", fontSize: 27, fontWeight: "900" },
  statLabel: { color: "rgba(207,230,221,0.55)", fontSize: 10, fontWeight: "800", marginTop: 3 },
  primary: { minHeight: 168, borderRadius: 34, padding: 24, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: "#DDF1D9" },
  primaryCopy: { flex: 1, minWidth: 0, paddingRight: 18 },
  primaryEyebrow: { color: "#477A64", fontSize: 11, fontWeight: "900", letterSpacing: 2.4 },
  primaryTitle: { color: "#102A20", fontSize: 29, fontWeight: "900", marginTop: 12, letterSpacing: -0.8 },
  primaryBody: { color: "rgba(16,42,32,0.66)", fontSize: 13, lineHeight: 19, marginTop: 8 },
  primaryArrow: { color: "#102A20", fontSize: 38, fontWeight: "600" },
  sectionLabel: { color: "#D08B5B", fontSize: 11, fontWeight: "900", letterSpacing: 2.7 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  card: { flexBasis: "47%", flexGrow: 1, minWidth: 148, minHeight: 178, borderRadius: 26, borderWidth: 1, borderColor: "rgba(91,220,181,0.17)", backgroundColor: "rgba(4,29,24,0.66)", padding: 18 },
  cardEyebrow: { color: "#64D7B2", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  cardTitle: { color: "#F0FFF9", fontSize: 20, fontWeight: "900", marginTop: 10 },
  cardBody: { color: "rgba(211,232,224,0.60)", fontSize: 12, lineHeight: 18, marginTop: 8 },
  cardArrow: { color: "#EAB25D", fontSize: 22, marginTop: "auto", alignSelf: "flex-end" },
  legacy: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(87,193,160,0.20)", backgroundColor: "rgba(4,26,22,0.46)", padding: 18, flexDirection: "row", alignItems: "center", gap: 16 },
  legacyEyebrow: { color: "#68C8AA", fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  legacyTitle: { flexShrink: 1, color: "#E8F6F0", fontSize: 15, fontWeight: "800", marginTop: 5 },
  legacyArrow: { color: "#E9B25F", fontSize: 24 },
  footer: { color: "rgba(190,218,208,0.38)", fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 18 },
  h2oCompositor: { flex: 1, position: "relative", overflow: "hidden" },
  h2oBackgroundImage: { opacity: 0.96 },
  rainViewport: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 3, overflow: "hidden" },
  rainTrack: { position: "absolute", top: 0, right: -10, left: -10 },
  rainTile: { position: "absolute", right: 0, left: 0, width: "100%" },
  rivuletOverlay: { position: "absolute", top: -18, right: -8, bottom: -18, left: -8 },
  waterRealityLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  courierWakeA: { position: "absolute", width: 360, height: 128, borderRadius: 999, borderWidth: 1.2, borderColor: "rgba(88,230,184,0.18)", backgroundColor: "rgba(59,194,155,0.016)", left: -226, top: 86 },
  courierWakeB: { position: "absolute", width: 310, height: 104, borderRadius: 999, borderWidth: 1, borderColor: "rgba(224,188,111,0.13)", backgroundColor: "rgba(68,213,170,0.015)", right: -198, top: 416 },
  courierRainA: { position: "absolute", width: 1.2, height: 62, borderRadius: 999, right: 17, top: 112, backgroundColor: "rgba(202,255,240,0.62)" },
  courierRainB: { position: "absolute", width: 1, height: 40, borderRadius: 999, right: 39, top: 318, backgroundColor: "rgba(190,250,232,0.46)" },
  courierRainC: { position: "absolute", width: 1, height: 46, borderRadius: 999, left: 13, top: 556, backgroundColor: "rgba(190,251,232,0.40)" },
  courierRainD: { position: "absolute", width: 1, height: 29, borderRadius: 999, right: 72, top: 204, backgroundColor: "rgba(184,248,228,0.34)" },
  courierRainE: { position: "absolute", width: 1, height: 34, borderRadius: 999, left: 31, top: 356, backgroundColor: "rgba(184,248,228,0.30)" },
  courierRainF: { position: "absolute", width: 1, height: 25, borderRadius: 999, right: 96, top: 602, backgroundColor: "rgba(184,248,228,0.28)" },
  courierRoadSheen: { position: "absolute", width: 228, height: 28, borderRadius: 999, left: -88, top: 470, backgroundColor: "rgba(108,234,194,0.08)", borderTopWidth: 1, borderColor: "rgba(172,255,229,0.12)" },
  courierRoadDrop: { position: "absolute", width: 38, height: 38, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 5, borderWidth: 1.8, borderColor: "rgba(240,255,249,0.96)", backgroundColor: "rgba(139,235,203,0.28)", right: 20, top: 142, shadowColor: "#E8FFF5", shadowOpacity: 0.56, shadowRadius: 17, shadowOffset: { width: -2, height: 3 } },
  courierRoadDropSmall: { position: "absolute", width: 23, height: 23, borderTopLeftRadius: 14, borderTopRightRadius: 14, borderBottomLeftRadius: 14, borderBottomRightRadius: 4, borderWidth: 1.3, borderColor: "rgba(236,255,248,0.90)", backgroundColor: "rgba(139,235,203,0.24)", left: 18, top: 376, shadowColor: "#E8FFF5", shadowOpacity: 0.36, shadowRadius: 8, shadowOffset: { width: 1, height: 2 } },
  courierRoadDropMicro: { position: "absolute", width: 15, height: 15, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 9, borderBottomRightRadius: 3, borderWidth: 1.1, borderColor: "rgba(232,255,247,0.84)", backgroundColor: "rgba(139,235,203,0.21)", right: 42, top: 548 },
  courierDropHighlight: { position: "absolute", width: 7, height: 15, borderRadius: 999, left: 6, top: 5, backgroundColor: "rgba(255,255,255,0.98)", transform: [{ rotate: "-45deg" }] },
  courierDropInnerRim: { position: "absolute", width: 25, height: 25, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 4, right: 3, bottom: 3, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: "rgba(100,238,193,0.72)" },
  courierDropHighlightSmall: { position: "absolute", width: 4.5, height: 9, borderRadius: 999, left: 4, top: 3, backgroundColor: "rgba(255,255,255,0.96)", transform: [{ rotate: "-45deg" }] },
  courierDropHighlightMicro: { position: "absolute", width: 3, height: 6, borderRadius: 999, left: 2.5, top: 2, backgroundColor: "rgba(255,255,255,0.92)", transform: [{ rotate: "-45deg" }] },
  courierSprayA: { position: "absolute", width: 72, height: 1, borderRadius: 999, left: -18, top: 646, backgroundColor: "rgba(177,250,227,0.20)", transform: [{ rotate: "-9deg" }] },
  courierSprayB: { position: "absolute", width: 54, height: 1, borderRadius: 999, right: -12, top: 522, backgroundColor: "rgba(232,198,125,0.12)", transform: [{ rotate: "12deg" }] },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
