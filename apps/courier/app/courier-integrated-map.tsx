import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import MapView, { Circle, Marker, Polyline } from "react-native-maps";
import * as Location from "expo-location";
import { daOrdersFetch } from "../utils/daOrdersApi";
import { useCourierJourney } from "../components/CourierJourneyProvider";
import { useJourneyRoute } from "../utils/useJourneyRoute";
import { firstJourneyPoint, isJourneyActive, isJourneyTravelling, journeyAddress, journeyDestinationPoint, journeyOrderId, journeyPhase, journeyPickupPoint, selectJourneyMission, type JourneyMode, type JourneyPoint } from "../../../packages/contracts/src/missionJourney";

const raw = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me/api/v1";
const API = raw.replace(/\/$/, "").endsWith("/api/v1") ? raw.replace(/\/$/, "") : `${raw.replace(/\/$/, "")}/api/v1`;
const MODES: { value: JourneyMode; label: string; symbol: string }[] = [
  { value: "BICYCLE", label: "Vélo", symbol: "◇" }, { value: "TWO_WHEELER", label: "Moto", symbol: "↗" },
  { value: "DRIVE", label: "Voiture", symbol: "▱" }, { value: "WALK", label: "À pied", symbol: "↟" },
];
const list = (body: any): any[] => Array.isArray(body) ? body : [body?.orders, body?.data?.orders, body?.items, body?.data].find(Array.isArray) || [];
const name = (value: unknown, fallback: string) => typeof value === "string" && value.trim() ? value.trim() : fallback;
const key = (value: unknown) => String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const addressFor = (order: any, delivery: boolean) => delivery
  ? journeyAddress(order?.delivery?.address || order?.deliveryAddress || order?.customerAddress || order?.customer?.address || order?.dropoffAddress)
  : journeyAddress(order?.restaurantAddress || order?.restaurant?.address || order?.pickupAddress);

async function resolvePoints(order: any, signal: AbortSignal) {
  let pickup = journeyPickupPoint(order);
  let destination = journeyDestinationPoint(order);
  let pickupAddress = addressFor(order, false);
  if (!pickup) {
    try {
      const response = await fetch(`${API}/partners`, { signal, headers: { Accept: "application/json" } });
      const body = response.ok ? await response.json() : null;
      const partners: any[] = Array.isArray(body) ? body : body?.partners || body?.data || [];
      const ids = [order.restaurantId, order.restaurant?.id, order.restaurant?.slug].filter(Boolean).map(key);
      const restaurantName = key(order.restaurantName || order.merchantName || order.restaurant?.name || order.restaurant);
      const matches = Array.isArray(partners) ? partners.filter((entry) => ids.length
        ? [entry.id, entry.slug].map(key).some((id) => ids.includes(id)) : restaurantName && key(entry.name) === restaurantName) : [];
      const partner = matches.length === 1 ? matches[0] : null;
      pickup = firstJourneyPoint([partner?.location, partner]);
      pickupAddress ||= journeyAddress(partner?.address);
    } catch { /* Addresses remain available when the directory is offline. */ }
  }
  // Android geocoding requires permission. Never ask for it just to read a mission.
  try {
    const allowed = (await Location.getForegroundPermissionsAsync()).granted;
    if (allowed && !signal.aborted) {
      const geocode = async (address: string) => {
        if (!address) return null;
        try { return firstJourneyPoint(await Location.geocodeAsync(address)); } catch { return null; }
      };
      const [a, b] = await Promise.all([pickup ? null : geocode(pickupAddress), destination ? null : geocode(addressFor(order, true))]);
      pickup ||= a; destination ||= b;
    }
  } catch { /* No device permission is needed for coordinates supplied by the order. */ }
  return { pickup, destination, pickupAddress };
}

export default function CourierIntegratedMapScreen() {
  const params = useLocalSearchParams<{ orderId?: string | string[]; publicId?: string | string[] }>();
  const param = params.orderId || params.publicId;
  const requestedId = String(Array.isArray(param) ? param[0] : param || "");
  const [chosenId, setChosenId] = useState("");
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [networkError, setNetworkError] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [following, setFollowing] = useState(true);
  const [ready, setReady] = useState(false);
  const [resolved, setResolved] = useState<{ id: string; pickup: JourneyPoint | null; destination: JourneyPoint | null; pickupAddress: string }>({ id: "", pickup: null, destination: null, pickupAddress: "" });
  const map = useRef<MapView | null>(null);
  const inFlight = useRef(false);
  const journey = useCourierJourney();
  const selection = selectJourneyMission(orders, requestedId || chosenId || journey.orderId || "");
  const mission = selection.order;
  const id = journeyOrderId(mission);
  const phase = journeyPhase(mission);
  const delivery = isJourneyTravelling(mission);
  const pickup = resolved.id === id ? resolved.pickup : journeyPickupPoint(mission);
  const destination = resolved.id === id ? resolved.destination : journeyDestinationPoint(mission);
  const target = delivery ? destination : pickup;
  const targetAddress = delivery ? addressFor(mission, true) : resolved.id === id ? resolved.pickupAddress : addressFor(mission, false);
  const restaurant = name(mission?.restaurantName || mission?.merchantName || mission?.restaurant?.name || mission?.restaurant, "Restaurant partenaire");
  const targetName = delivery ? name(mission?.customer?.name || mission?.customerName, "Votre client") : restaurant;
  const fixAge = journey.fix ? Math.max(0, (now - journey.fix.capturedAt) / 1000) : null;
  const usableFix = journey.fix && fixAge !== null && fixAge <= 90 && (journey.fix.accuracyMeters === null || journey.fix.accuracyMeters <= 100) ? journey.fix : null;
  const route = useJourneyRoute({ apiBaseUrl: API, orderId: id, origin: usableFix, destination: target, mode: journey.mode, phase: phase.key, enabled: Boolean(id && isJourneyActive(mission) && !networkError) });
  const canShare = Boolean(mission && ["ready", "picked_up"].includes(String(mission.status)) && mission.assignmentProposal?.status === "accepted" && !networkError);
  const matchingShare = journey.orderId === id;

  const load = useCallback(async () => {
    if (inFlight.current || AppState.currentState && AppState.currentState !== "active") return;
    inFlight.current = true;
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await daOrdersFetch(`${API}/orders/demo/list`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", signal: controller.signal });
      if (!response.ok) throw new Error("mission_unavailable");
      const body = await response.json();
      if (body?.ok === false) throw new Error("mission_unavailable");
      setOrders(list(body)); setNetworkError(false);
    } catch { setNetworkError(true); }
    finally { clearTimeout(timer); inFlight.current = false; setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => {
    void load(); const timer = setInterval(() => void load(), 15_000);
    const resume = AppState.addEventListener("change", (state) => { if (state === "active") void load(); });
    return () => { clearInterval(timer); resume.remove(); };
  }, [load]));
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => listener.remove();
  }, []);
  useEffect(() => { setFollowing(true); }, [id, phase.key]);
  useEffect(() => {
    if (journey.orderId && !networkError && !loading) {
      const current = orders.find((entry) => journeyOrderId(entry) === journey.orderId);
      if (!current || !isJourneyActive(current)) journey.session.stop("La mission est clôturée. Le partage est arrêté.");
    }
  }, [orders, loading, networkError, journey.orderId, journey.session]);
  useEffect(() => {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 8000);
    if (mission) void resolvePoints(mission, controller.signal).then((points) => { if (!controller.signal.aborted) setResolved({ id, ...points }); });
    return () => { controller.abort(); clearTimeout(timer); };
  }, [id, mission?.restaurantId, JSON.stringify(mission?.deliveryLocation), JSON.stringify(mission?.delivery?.address), Boolean(journey.fix)]);
  const fit = useCallback(() => {
    const points = [usableFix, target, pickup, destination].filter((point): point is JourneyPoint => Boolean(point));
    if (!ready || !points.length) return;
    if (points.length === 1) map.current?.animateToRegion({ ...points[0], latitudeDelta: 0.01, longitudeDelta: 0.01 }, reduceMotion ? 0 : 400);
    else map.current?.fitToCoordinates(points, { edgePadding: { top: 64, right: 42, bottom: 60, left: 42 }, animated: !reduceMotion });
  }, [ready, pickup?.latitude, pickup?.longitude, destination?.latitude, destination?.longitude, usableFix?.latitude, usableFix?.longitude, target?.latitude, target?.longitude, reduceMotion]);
  useEffect(() => { if (following) fit(); }, [following, fit]);

  function share() {
    if (!id || !canShare || !journey.mode) return;
    const start = () => void journey.session.share(id, journey.mode);
    if (journey.orderId && journey.orderId !== id) Alert.alert("Changer de mission suivie ?", "Le partage de la mission précédente s’arrêtera.", [{ text: "Garder la mission", style: "cancel" }, { text: "Changer", onPress: start }]);
    else start();
  }
  function openGuidance() {
    if (!target && !targetAddress) return;
    const finalDestination = target ? `${target.latitude},${target.longitude}` : targetAddress;
    const mode = journey.mode === "BICYCLE" ? "bicycling" : journey.mode === "WALK" ? "walking" : journey.mode === "DRIVE" ? "driving" : "";
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(finalDestination)}${mode ? `&travelmode=${mode}` : ""}`;
    Alert.alert("Ouvrir le guidage", "Le partage de position se met en pause lorsque DelishAfrica passe en arrière-plan. Vérifiez votre mode de déplacement dans l’application de guidage.", [{ text: "Rester ici", style: "cancel" }, { text: "Ouvrir", onPress: () => { void Linking.openURL(url).catch(() => Alert.alert("Guidage indisponible", "Consultez l’adresse affichée sur votre mission.")); } }]);
  }
  const mapPoints = [pickup, destination, journey.fix].filter(Boolean);
  return <SafeAreaView style={s.safe}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={() => router.back()} style={s.back}><Text style={s.backText}>‹</Text></Pressable><View style={s.headerCopy}><Text style={s.brand}>DELISHAFRICA®</Text><Text style={s.headerTitle}>Le cap, en toute sérénité.</Text></View><View style={s.seal}><Text style={s.sealText}>COURIER</Text></View></View>
    <ScrollView contentContainerStyle={s.content}>
      {loading ? <ActivityIndicator color="#8EDDB6" accessibilityLabel="Chargement de la mission" /> : null}
      {networkError ? <View style={s.notice}><Text style={s.noticeText}>Connexion interrompue. Les dernières informations restent visibles ; le trajet attend une actualisation.</Text><Pressable accessibilityRole="button" onPress={() => void load()} style={s.smallButton}><Text style={s.link}>Réessayer</Text></Pressable></View> : null}
      {!mission ? <View style={s.card}><Text style={s.eyebrow}>VOTRE PROCHAIN CAP</Text><Text style={s.title}>{selection.reason === "not_found" ? "Cette mission n’est pas disponible." : selection.reason === "choose" ? "Quelle mission souhaitez-vous suivre ?" : "Votre carte attend la prochaine mission."}</Text><Text style={s.body}>{selection.reason === "not_found" ? "Actualisez vos missions pour vérifier votre accès." : "Les repères apparaîtront dès qu’une mission sera sélectionnée."}</Text>{selection.choices.map((entry) => <Pressable key={journeyOrderId(entry)} style={s.choice} accessibilityRole="button" onPress={() => setChosenId(journeyOrderId(entry))}><Text style={s.choiceTitle}>{name(entry.restaurantName || entry.restaurant?.name, "Restaurant partenaire")}</Text><Text style={s.body}>{journeyOrderId(entry)}  →</Text></Pressable>)}<Pressable style={s.secondary} accessibilityRole="button" onPress={() => router.push("/orders")}><Text style={s.link}>Voir mes missions</Text></Pressable></View> : <>
        <View style={s.phaseRow}><View style={[s.phaseDot, { backgroundColor: phase.accent }]} /><Text style={[s.eyebrow, { color: phase.accent }]}>{phase.label}</Text><Text style={s.missionId}>{id}</Text></View>
        <View style={s.mapFrame}>{mapPoints.length ? <MapView ref={map} style={StyleSheet.absoluteFill} onMapReady={() => setReady(true)} onPanDrag={() => setFollowing(false)} showsCompass showsScale accessibilityLabel={`Carte de votre mission ${id}`}>
          {pickup ? <Marker coordinate={pickup} title={restaurant} description="Retrait au restaurant" pinColor="#198663" /> : null}
          {destination ? <Marker coordinate={destination} title="Adresse de livraison" description={addressFor(mission, true)} pinColor="#BC8540" /> : null}
          {journey.fix ? <Marker coordinate={journey.fix} title={usableFix ? "Votre position" : "Votre dernière position connue"} opacity={usableFix ? 1 : 0.5} pinColor="#2D6CA2" /> : null}
          {usableFix?.accuracyMeters && usableFix.accuracyMeters > 0 ? <Circle center={usableFix} radius={usableFix.accuracyMeters} fillColor="rgba(45,108,162,0.10)" strokeColor="rgba(45,108,162,0.35)" /> : null}
          {route.route ? <Polyline coordinates={route.route.points} strokeWidth={5} strokeColor={phase.accent} /> : null}
        </MapView> : <View style={s.emptyMap}><Text style={s.mapSymbol}>⌖</Text><Text style={s.emptyTitle}>Vos repères, dès qu’ils sont connus.</Text><Text style={s.emptyCopy}>Aucun point n’est ajouté à la place d’une adresse manquante.</Text></View>}
          {mapPoints.length ? <Pressable style={s.recenter} accessibilityRole="button" accessibilityLabel="Recentrer sur la mission" onPress={() => { setFollowing(true); fit(); }}><Text style={s.recenterText}>{following ? "⌖ Vue mission" : "⌖ Recentrer"}</Text></Pressable> : null}
        </View>
        <View style={s.card}><Text style={s.eyebrow}>{delivery ? "PROCHAIN REPÈRE · LIVRAISON" : "PROCHAIN REPÈRE · RETRAIT"}</Text><View style={s.destinationRow}><View style={s.targetCopy}><Text style={s.title}>{targetName}</Text><Text style={s.body}>{targetAddress || "L’adresse détaillée n’est pas encore disponible."}</Text></View><View style={s.etaBlock}><Text style={s.eta}>{route.eta?.label || "—"}</Text><Text style={s.etaCaption}>{route.loading ? "Actualisation" : route.eta ? "Trajet estimé" : "Horaire à confirmer"}</Text></View></View><Text style={s.phaseTitle}>{phase.title}</Text>{!target ? <Text style={s.helper}>Le point exact manque encore. L’adresse reste votre repère.</Text> : !journey.mode ? <Text style={s.helper}>Choisissez votre mode de déplacement pour calculer un itinéraire adapté.</Text> : !usableFix ? <Text style={s.helper}>Une position récente est nécessaire pour calculer le trajet.</Text> : route.unavailable ? <Text style={s.helper}>Le calcul d’itinéraire est indisponible. Aucun temps approximatif ne remplace le trajet.</Text> : null}
          {isJourneyActive(mission) ? <Pressable style={s.secondary} accessibilityRole="button" onPress={openGuidance} disabled={!target && !targetAddress}><Text style={s.link}>Ouvrir le guidage ↗</Text></Pressable> : null}
        </View>
        <View style={s.card}><Text style={s.eyebrow}>VOTRE FAÇON D’AVANCER</Text><View style={s.modes}>{MODES.map((mode) => <Pressable key={mode.value} accessibilityRole="radio" accessibilityState={{ checked: journey.mode === mode.value }} accessibilityLabel={mode.label} onPress={() => journey.session.setMode(mode.value)} style={[s.mode, journey.mode === mode.value && s.modeSelected]}><Text style={[s.modeSymbol, journey.mode === mode.value && s.modeSelectedText]}>{mode.symbol}</Text><Text style={[s.modeLabel, journey.mode === mode.value && s.modeSelectedText]}>{mode.label}</Text></Pressable>)}</View>
          <Text style={s.sharingTitle}>{matchingShare && journey.sharing ? "Vous restez reliés." : journey.paused ? "Le partage est en pause." : "Votre position vous appartient."}</Text><Text style={s.body}>{journey.message}</Text><Text style={s.helper}>Le partage est réservé au client et au restaurant de cette mission. Il fonctionne tant que DelishAfrica reste au premier plan et s’arrête à la fin de la mission.</Text>
          {journey.fix ? <Text style={s.signal}>Dernier point : {fixAge !== null && fixAge < 60 ? `${Math.floor(fixAge)} s` : `${Math.floor((fixAge || 0) / 60)} min`}{journey.fix.accuracyMeters !== null ? ` · précision ±${Math.round(journey.fix.accuracyMeters)} m` : ""}</Text> : null}
          {matchingShare && journey.sharingRequested ? <Pressable style={s.primary} accessibilityRole="button" onPress={() => journey.session.stop()}><Text style={s.primaryText}>Arrêter le partage</Text></Pressable> : <Pressable style={[s.primary, (!canShare || !journey.mode || journey.locating) && s.disabled]} accessibilityRole="button" accessibilityState={{ disabled: !canShare || !journey.mode || journey.locating }} disabled={!canShare || !journey.mode || journey.locating} onPress={share}><Text style={s.primaryText}>{journey.locating ? "Localisation…" : "Partager ma position pour cette mission"}</Text></Pressable>}
          {!canShare && isJourneyActive(mission) ? <Text style={s.helper}>Le partage sera disponible après acceptation de la mission, lorsque la commande sera prête.</Text> : null}
          {!journey.orderId && journey.tracking ? <Pressable style={s.secondary} accessibilityRole="button" onPress={() => journey.session.stop("Localisation arrêtée. Votre position reste privée.")}><Text style={s.link}>Arrêter la localisation</Text></Pressable> : null}
          {!journey.orderId ? <Pressable style={s.secondary} accessibilityRole="button" onPress={() => void journey.session.locate()} disabled={journey.locating}><Text style={s.link}>Me localiser sans partager</Text></Pressable> : null}
        </View>
      </>}
      <Text style={s.footer}>Un cap clair. Une présence choisie. À votre rythme.</Text>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#061E1A" }, header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 14, gap: 12 }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, backgroundColor: "#163D33" }, backText: { color: "#F5F6EE", fontSize: 32 }, headerCopy: { flex: 1 }, brand: { fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#A8C6B6" }, headerTitle: { fontSize: 17, fontWeight: "700", color: "#F4F2E7", marginTop: 5 }, seal: { padding: 8, borderWidth: 1, borderColor: "#456454", borderRadius: 12 }, sealText: { fontSize: 9, fontWeight: "800", color: "#E6BD72", letterSpacing: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 32, gap: 16, maxWidth: 800, width: "100%", alignSelf: "center" }, phaseRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", paddingTop: 8 }, phaseDot: { width: 7, height: 7, borderRadius: 4 }, eyebrow: { fontSize: 10, lineHeight: 16, fontWeight: "800", letterSpacing: 1.4, color: "#A7C4B5" }, missionId: { color: "#B0C6BA", fontSize: 11, marginLeft: "auto" }, mapFrame: { height: 340, borderRadius: 28, overflow: "hidden", backgroundColor: "#123E33", borderWidth: 1, borderColor: "#395E4F" }, emptyMap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 }, mapSymbol: { fontSize: 48, color: "#E6BD72", marginBottom: 12 }, emptyTitle: { color: "#F0F2E9", fontSize: 20, lineHeight: 27, textAlign: "center", fontWeight: "700" }, emptyCopy: { color: "#BCD1C5", fontSize: 13, lineHeight: 20, textAlign: "center", marginTop: 10 }, recenter: { position: "absolute", bottom: 16, alignSelf: "center", paddingVertical: 12, paddingHorizontal: 20, backgroundColor: "#F7F3E8", borderRadius: 24 }, recenterText: { color: "#163F30", fontSize: 12, fontWeight: "800" },
  card: { padding: 22, borderRadius: 26, backgroundColor: "#12362C", borderWidth: 1, borderColor: "#305447", gap: 12 }, title: { fontSize: 25, lineHeight: 31, color: "#FCF7E9", fontWeight: "800" }, body: { fontSize: 14, lineHeight: 22, color: "#D3DFD5" }, helper: { fontSize: 12, lineHeight: 19, color: "#B8CDBF" }, destinationRow: { flexDirection: "row", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }, targetCopy: { flexGrow: 1, flexBasis: 170, gap: 8 }, etaBlock: { alignItems: "flex-end", gap: 4 }, eta: { color: "#E6BD72", fontSize: 26, fontWeight: "800" }, etaCaption: { color: "#C2CDBF", fontSize: 10 }, phaseTitle: { color: "#A8D9BB", fontSize: 13, fontWeight: "600" }, modes: { flexDirection: "row", gap: 8, flexWrap: "wrap" }, mode: { flexGrow: 1, flexBasis: 60, minHeight: 66, borderRadius: 17, padding: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#1F4337", borderWidth: 1, borderColor: "#486352", gap: 4 }, modeSelected: { backgroundColor: "#E6BD72", borderColor: "#E6BD72" }, modeSymbol: { color: "#DDE6D9", fontSize: 20 }, modeLabel: { color: "#DDE6D9", fontSize: 11, fontWeight: "700" }, modeSelectedText: { color: "#173F2D" }, sharingTitle: { marginTop: 10, color: "#F1F2E5", fontWeight: "700", fontSize: 20 }, signal: { color: "#B4D7C2", fontSize: 11, lineHeight: 18 }, primary: { minHeight: 52, borderRadius: 18, padding: 16, backgroundColor: "#E6BD72", alignItems: "center", justifyContent: "center", marginTop: 5 }, primaryText: { color: "#173F2D", fontSize: 14, fontWeight: "800", textAlign: "center" }, secondary: { minHeight: 44, justifyContent: "center", alignItems: "center", padding: 10 }, link: { color: "#D9EAD7", fontSize: 13, fontWeight: "700" }, disabled: { opacity: 0.45 }, notice: { borderRadius: 18, backgroundColor: "#473E27", padding: 16, gap: 6 }, noticeText: { color: "#F8E2B6", fontSize: 13, lineHeight: 20 }, smallButton: { paddingVertical: 8 }, choice: { padding: 16, backgroundColor: "#214A3A", borderRadius: 18, minHeight: 58 }, choiceTitle: { fontSize: 16, color: "#F7F5E6", fontWeight: "700" }, footer: { color: "#ADC4B4", fontSize: 11, lineHeight: 18, textAlign: "center", paddingVertical: 10 },
});
