import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageBackground,
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MerchantAquaticSignature } from "../components/aquatic/MerchantAquaticSignature";
import { WaterIntelRail } from "../ui/water/WaterIntelRail";

const MERCHANT_H2O_RASTER = require("../assets/h2o/merchant-h2o-premium-v1.png");
const MERCHANT_CONDENSATION_ATMOSPHERE = require("../assets/h2o/merchant-condensation-atmosphere-v3.png");
import { daOrdersFetch } from "../utils/daOrdersApi";

const RAW_API = process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me/api/v1";
const API = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

type Ownership = {
  ready: boolean;
  partner?: string;
  role?: string;
  error?: string;
};

type RouteCard = {
  eyebrow: string;
  title: string;
  body: string;
  path: string;
};

const ROUTES: RouteCard[] = [
  { eyebrow: "COMMANDES", title: "Décider", body: "Accepter, préparer, marquer prête et suivre le service.", path: "/orders" },
  { eyebrow: "CUISINE", title: "Kitchen Pulse", body: "Cadence, priorités et lecture opérationnelle du service.", path: "/kitchen-pulse" },
  { eyebrow: "ÉTABLISSEMENT", title: "Mon espace", body: "Présence, confiance, territoire et disponibilité.", path: "/partner-space" },
  { eyebrow: "PILOTAGE", title: "Ops Dashboard", body: "Vision synthétique des signaux utiles au restaurant.", path: "/ops-dashboard" },
];

function extractOrders(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.orders)) return payload.orders;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}


// S10N_CONDENSATION_BALANCE: keep certified S10K droplets, move fog behind content and localize it to the glass edges.

export default function MerchantSurfaceHome() {
  const insets = useSafeAreaInsets();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ownership, setOwnership] = useState<Ownership>({ ready: false });
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const condensationPhase = useRef(new Animated.Value(0)).current;

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
    condensationPhase.stopAnimation();
    if (reduceMotion) {
      condensationPhase.setValue(0.52);
      return;
    }

    condensationPhase.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(condensationPhase, {
          toValue: 1,
          duration: 5200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(condensationPhase, {
          toValue: 0,
          duration: 6100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [condensationPhase, reduceMotion]);

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    let nextOwnership: Ownership = { ready: false };
    try {
      const response = await daOrdersFetch(`${API}/merchant/catalog/me`);
      const body = await response.json().catch(() => ({}));
      if (response.ok && body?.ok) {
        const catalog = body.catalog || {};
        nextOwnership = {
          ready: true,
          partner: String(catalog.name || catalog.slug || "Partenaire"),
          role: String(catalog.ownershipRole || "owner"),
        };
      } else {
        nextOwnership = { ready: false, error: String(body?.code || `HTTP ${response.status}`) };
      }
    } catch (error: any) {
      nextOwnership = { ready: false, error: String(error?.message || error) };
    }

    try {
      const response = await daOrdersFetch(`${API}/orders/demo/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const body = await response.json().catch(() => ({}));
      setOrders(response.ok ? extractOrders(body) : []);
    } catch {
      setOrders([]);
    }

    setOwnership(nextOwnership);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load(false);
    }, [load]),
  );

  const stats = useMemo(() => {
    const status = (value: any) => String(value?.status || "").toLowerCase();
    return {
      pending: orders.filter((item) => status(item) === "pending").length,
      kitchen: orders.filter((item) => status(item) === "accepted").length,
      ready: orders.filter((item) => status(item) === "ready").length,
    };
  }, [orders]);

  const go = (path: string) => router.push(path as any);
  const condensationOpacity = condensationPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.38, 0.50, 0.38],
  });
  const condensationTranslateY = condensationPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-2, 2, -2],
  });
  const condensationScale = condensationPhase.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1.002, 1.008, 1.002],
  });

  return (
    <MerchantAquaticSignature reduceMotion={reduceMotion}>
      <ImageBackground
        source={MERCHANT_H2O_RASTER}
        style={styles.h2oCompositor}
        imageStyle={styles.h2oBackgroundImage}
        resizeMode="cover"
        onLoad={() => { if (__DEV__) console.log("DA_S10K_BG_LOADED_MERCHANT"); }}
      >
        <View pointerEvents="none" style={styles.atmosphereUnderlay}>
          <Animated.Image
            source={MERCHANT_CONDENSATION_ATMOSPHERE}
            resizeMode="cover"
            blurRadius={1.8}
            style={[
              styles.atmosphereOverlayImage,
              {
                opacity: condensationOpacity,
                transform: [{ translateY: condensationTranslateY }, { scale: condensationScale }],
              },
            ]}
            onLoad={() => { if (__DEV__) console.log("DA_S10N_CONDENSATION_BALANCE_LOADED_MERCHANT"); }}
          />
        </View>
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
            <Text style={styles.role}>MERCHANT · KITCHEN TIDE · S10N</Text>
          </View>
          <Pressable
            onPress={() => go("/partner-space")}
            style={styles.avatarButton}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Ouvrir Mon espace Merchant"
          >
            <Text style={styles.avatarText}>PRO</Text>
          </Pressable>
        </View>

        <View style={[styles.authority, ownership.ready ? styles.authorityReady : styles.authorityPending]}>
          <View style={[styles.authorityDot, ownership.ready && styles.authorityDotReady]} />
          <View style={styles.authorityCopy}>
            <Text style={styles.authorityLabel}>BUSINESS AUTHORITY</Text>
            <Text style={styles.authorityText}>
              {loading
                ? "Vérification de votre établissement…"
                : ownership.ready
                  ? `${ownership.partner} · rôle ${ownership.role}`
                  : "Identité Merchant reconnue · rattachement établissement à finaliser"}
            </Text>
          </View>
          {loading ? <ActivityIndicator size="small" /> : <Text style={styles.authorityState}>{ownership.ready ? "LIÉ" : "GATE"}</Text>}
        </View>

        <WaterIntelRail
          tone="merchant"
          mode="pulse"
          label="PULSE · KITCHEN TIDE"
          title={stats.pending > 0 ? `${stats.pending} décision${stats.pending > 1 ? "s" : ""} remonte${stats.pending > 1 ? "nt" : ""} à la surface.` : "Le service respire."}
          body={`${stats.kitchen} en cuisine · ${stats.ready} prête${stats.ready > 1 ? "s" : ""} · la priorité reste lisible et la décision reste humaine.`}
          status={loading ? "SYNC" : "LIVE"}
          reduceMotion={reduceMotion}
          onPress={() => go("/operations-live")}
          accessibilityLabel="Ouvrir Kitchen Tide et la vue opérationnelle temps réel"
        />

        <Text style={styles.kicker}>CUISINE · SERVICE · REMISE · LIVE</Text>
        <Text style={styles.hero}>Une décision claire.{`\n`}Le service avance.</Text>
        <Text style={styles.subtitle}>
          Le cockpit rassemble commandes, cuisine, présence et pilotage dans une lecture immédiate,
          avec chaque priorité à portée de geste.
        </Text>

        <View style={styles.stats}>
          <View style={styles.stat}><Text style={styles.statValue}>{stats.pending}</Text><Text style={styles.statLabel}>à décider</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{stats.kitchen}</Text><Text style={styles.statLabel}>en cuisine</Text></View>
          <View style={styles.stat}><Text style={styles.statValue}>{stats.ready}</Text><Text style={styles.statLabel}>prêtes</Text></View>
        </View>

        <Pressable
          onPress={() => go(ownership.ready ? "/orders" : "/auth-session")}
          style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={styles.primaryCopy}>
            <Text style={styles.primaryEyebrow}>{ownership.ready ? "SERVICE ACTIF" : "IDENTITÉ D’ABORD"}</Text>
            <Text style={styles.primaryTitle}>{ownership.ready ? "Ouvrir les commandes" : "Sécuriser mon accès"}</Text>
            <Text style={styles.primaryBody}>
              {ownership.ready ? "Votre établissement est lié à cette identité Merchant." : "Reconnectez l’identité Merchant si nécessaire."}
            </Text>
          </View>
          <Text style={styles.primaryArrow}>→</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>POSTES DE TRAVAIL</Text>
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
          onPress={() => go("/operations-live")}
          style={({ pressed }) => [styles.legacy, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <View style={{ flex: 1 }}>
            <Text style={styles.legacyEyebrow}>SURFACE ÉTENDUE</Text>
            <Text style={styles.legacyTitle}>Ouvrir la vue Live étendue</Text>
          </View>
          <Text style={styles.legacyArrow}>→</Text>
        </Pressable>

        <Text style={styles.footer}>
          DelishAfrica® · chaque action sensible reste liée à votre identité Merchant et à votre établissement.
        </Text>
      </ScrollView>
      </ImageBackground>
    </MerchantAquaticSignature>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "transparent", position: "relative", zIndex: 1 },
  content: { paddingHorizontal: 22, gap: 22 },
  topline: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  toplineCopy: { flex: 1, minWidth: 0 },
  brand: { color: "#F0B651", fontSize: 16, fontWeight: "900", letterSpacing: 3.1 },
  role: { color: "rgba(239,224,207,0.55)", fontSize: 10, fontWeight: "800", letterSpacing: 1.4, marginTop: 7 },
  avatarButton: { width: 58, height: 58, borderRadius: 29, borderWidth: 1, borderColor: "rgba(235,174,91,0.26)", alignItems: "center", justifyContent: "center", backgroundColor: "rgba(42,24,12,0.60)" },
  avatarText: { color: "#F8E8D2", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  authority: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 24, padding: 16 },
  authorityReady: { borderColor: "rgba(90,220,180,0.30)", backgroundColor: "rgba(8,43,34,0.62)" },
  authorityPending: { borderColor: "rgba(236,172,83,0.30)", backgroundColor: "rgba(48,31,13,0.62)" },
  authorityDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#E5A44C" },
  authorityDotReady: { backgroundColor: "#67DDB3" },
  authorityCopy: { flex: 1 },
  authorityLabel: { color: "#E4A653", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  authorityText: { color: "rgba(247,236,220,0.76)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  authorityState: { color: "#F0C078", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  kicker: { color: "#CE8355", fontSize: 11, fontWeight: "900", letterSpacing: 2.6, marginTop: 8 },
  hero: { color: "#FFF2DF", fontSize: 43, lineHeight: 47, fontWeight: "900", letterSpacing: -1.8 },
  subtitle: { color: "rgba(238,222,205,0.68)", fontSize: 17, lineHeight: 27 },
  stats: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { flex: 1, minWidth: 88, minHeight: 88, borderRadius: 22, borderWidth: 1, borderColor: "rgba(232,165,83,0.16)", backgroundColor: "rgba(35,20,11,0.52)", padding: 14, justifyContent: "center" },
  statValue: { color: "#FFF0D8", fontSize: 27, fontWeight: "900" },
  statLabel: { color: "rgba(235,216,195,0.55)", fontSize: 10, fontWeight: "800", marginTop: 3 },
  primary: { minHeight: 168, borderRadius: 34, padding: 24, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", backgroundColor: "#F3D5A3" },
  primaryCopy: { flex: 1, minWidth: 0, paddingRight: 18 },
  primaryEyebrow: { color: "#9D5735", fontSize: 11, fontWeight: "900", letterSpacing: 2.4 },
  primaryTitle: { color: "#24140B", fontSize: 29, fontWeight: "900", marginTop: 12, letterSpacing: -0.8 },
  primaryBody: { color: "rgba(36,20,11,0.66)", fontSize: 13, lineHeight: 19, marginTop: 8 },
  primaryArrow: { color: "#24140B", fontSize: 38, fontWeight: "600" },
  sectionLabel: { color: "#CB8152", fontSize: 11, fontWeight: "900", letterSpacing: 2.7 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "stretch" },
  card: { flexBasis: "47%", flexGrow: 1, minWidth: 148, minHeight: 178, borderRadius: 26, borderWidth: 1, borderColor: "rgba(229,169,95,0.18)", backgroundColor: "rgba(33,19,11,0.64)", padding: 18 },
  cardEyebrow: { color: "#D7955C", fontSize: 9, fontWeight: "900", letterSpacing: 1.8 },
  cardTitle: { color: "#FFF1DE", fontSize: 20, fontWeight: "900", marginTop: 10 },
  cardBody: { color: "rgba(235,217,198,0.60)", fontSize: 12, lineHeight: 18, marginTop: 8 },
  cardArrow: { color: "#F0B65D", fontSize: 22, marginTop: "auto", alignSelf: "flex-end" },
  legacy: { borderRadius: 24, borderWidth: 1, borderColor: "rgba(215,148,81,0.20)", backgroundColor: "rgba(31,18,10,0.46)", padding: 18, flexDirection: "row", alignItems: "center", gap: 16 },
  legacyEyebrow: { color: "#C98B5A", fontSize: 9, fontWeight: "900", letterSpacing: 1.7 },
  legacyTitle: { flexShrink: 1, color: "#F7E8D5", fontSize: 15, fontWeight: "800", marginTop: 5 },
  legacyArrow: { color: "#EFB65E", fontSize: 24 },
  footer: { color: "rgba(206,183,162,0.38)", fontSize: 10, lineHeight: 16, textAlign: "center", paddingHorizontal: 18 },
  h2oCompositor: { flex: 1, position: "relative", overflow: "hidden" },
  h2oBackgroundImage: { opacity: 0.94 },
  atmosphereUnderlay: { position: "absolute", top: -14, right: -10, bottom: -14, left: -10, zIndex: 0 },
  atmosphereOverlayImage: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 },
  waterRealityLayer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 20 },
  merchantMistA: { position: "absolute", width: 330, height: 116, borderRadius: 999, right: -150, top: 116, backgroundColor: "rgba(255,236,209,0.082)", borderWidth: 1, borderColor: "rgba(255,220,179,0.11)", shadowColor: "#FFE4B7", shadowOpacity: 0.13, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
  merchantMistB: { position: "absolute", width: 286, height: 96, borderRadius: 999, left: -188, top: 394, backgroundColor: "rgba(228,174,112,0.058)", borderWidth: 1, borderColor: "rgba(255,221,178,0.08)" },
  merchantMistC: { position: "absolute", width: 230, height: 74, borderRadius: 999, right: 38, top: 612, backgroundColor: "rgba(255,230,198,0.040)", borderWidth: 1, borderColor: "rgba(255,227,194,0.065)" },
  merchantSteamArcA: { position: "absolute", width: 142, height: 48, borderRadius: 999, right: -32, top: 338, borderTopWidth: 1.2, borderColor: "rgba(255,229,198,0.12)" },
  merchantCondensationLarge: { position: "absolute", width: 38, height: 38, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderBottomLeftRadius: 22, borderBottomRightRadius: 5, borderWidth: 1.8, borderColor: "rgba(255,255,252,0.96)", backgroundColor: "rgba(246,239,226,0.27)", right: 20, top: 154, shadowColor: "#FFF6E7", shadowOpacity: 0.56, shadowRadius: 17, shadowOffset: { width: -2, height: 3 } },
  merchantDropHighlight: { position: "absolute", width: 7, height: 15, borderRadius: 999, left: 6, top: 5, backgroundColor: "rgba(255,255,255,0.98)", transform: [{ rotate: "-45deg" }] },
  merchantDropInnerRim: { position: "absolute", width: 25, height: 25, borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 4, right: 3, bottom: 3, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: "rgba(235,180,108,0.72)" },
  merchantCondensationSmallA: { position: "absolute", width: 22, height: 22, borderTopLeftRadius: 13, borderTopRightRadius: 13, borderBottomLeftRadius: 13, borderBottomRightRadius: 4, borderWidth: 1.3, borderColor: "rgba(255,255,252,0.90)", backgroundColor: "rgba(246,239,226,0.24)", right: 68, top: 126, shadowColor: "#FFF6E7", shadowOpacity: 0.38, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  merchantCondensationSmallB: { position: "absolute", width: 18, height: 18, borderTopLeftRadius: 11, borderTopRightRadius: 11, borderBottomLeftRadius: 11, borderBottomRightRadius: 3, borderWidth: 1.2, borderColor: "rgba(255,255,252,0.88)", backgroundColor: "rgba(246,239,226,0.22)", left: 20, top: 352, shadowColor: "#FFF6E7", shadowOpacity: 0.30, shadowRadius: 7, shadowOffset: { width: 0, height: 2 } },
  merchantCondensationSmallC: { position: "absolute", width: 14, height: 14, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderBottomLeftRadius: 9, borderBottomRightRadius: 3, borderWidth: 1.1, borderColor: "rgba(255,255,252,0.84)", backgroundColor: "rgba(246,239,226,0.20)", right: 42, top: 526 },
  merchantCondensationBead: { position: "absolute", width: 8, height: 8, borderRadius: 5, borderWidth: 1, borderColor: "rgba(255,255,252,0.78)", backgroundColor: "rgba(246,239,226,0.22)", right: 84, top: 552 },
  merchantDropHighlightSmall: { position: "absolute", width: 4.5, height: 9, borderRadius: 999, left: 4, top: 3, backgroundColor: "rgba(255,255,255,0.96)", transform: [{ rotate: "-45deg" }] },
  merchantDropHighlightMicro: { position: "absolute", width: 3, height: 6, borderRadius: 999, left: 2.5, top: 2, backgroundColor: "rgba(255,255,255,0.92)", transform: [{ rotate: "-45deg" }] },
  merchantHeatRefraction: { position: "absolute", width: 190, height: 1, borderRadius: 999, right: -42, top: 474, backgroundColor: "rgba(239,175,103,0.19)", transform: [{ rotate: "-18deg" }] },
  merchantHeatRefractionSoft: { position: "absolute", width: 126, height: 1, borderRadius: 999, left: -18, top: 262, backgroundColor: "rgba(255,221,180,0.10)", transform: [{ rotate: "22deg" }] },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
});
