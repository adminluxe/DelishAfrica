import React, { createContext, useContext, useEffect, useRef, useSyncExternalStore } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as Crypto from "expo-crypto";
import { daOrdersFetch } from "../utils/daOrdersApi";
import { MissionLocationSession, type MissionFix } from "../utils/missionLocationSession";
import { journeyOrderId } from "../../../packages/contracts/src/missionJourney";

const Context = createContext<MissionLocationSession | null>(null);
const raw = process.env.EXPO_PUBLIC_API_BASE_URL || process.env.EXPO_PUBLIC_API_URL || "https://api.delishafrica.me/api/v1";
const API = raw.replace(/\/$/, "").endsWith("/api/v1") ? raw.replace(/\/$/, "") : `${raw.replace(/\/$/, "")}/api/v1`;

function fixFrom(value: Location.LocationObject): MissionFix {
  return { latitude: value.coords.latitude, longitude: value.coords.longitude, accuracyMeters: value.coords.accuracy,
    headingDegrees: value.coords.heading, speedMetersPerSecond: value.coords.speed, capturedAt: value.timestamp };
}

async function post(path: string, body: Record<string, unknown>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await daOrdersFetch(`${API}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok === false && path !== "/orders/demo/list") {
      const error = new Error("mission_signal_unavailable") as Error & { status: number };
      error.status = response.ok ? 409 : response.status; throw error;
    }
    return payload;
  } finally { clearTimeout(timeout); }
}

function createSession() {
  return new MissionLocationSession({
    permission: async () => (await Location.requestForegroundPermissionsAsync()).status === "granted",
    current: async () => fixFrom(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })),
    watch: async (onFix, onError) => Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 12 }, (position) => onFix(fixFrom(position)), onError),
    validate: async (id) => {
      const payload = await post("/orders/demo/list", {});
      const orders = Array.isArray(payload) ? payload : payload?.orders || payload?.data?.orders || payload?.items || payload?.data || [];
      const order = Array.isArray(orders) ? orders.find((entry) => journeyOrderId(entry) === id) : null;
      return Boolean(order && ["ready", "picked_up"].includes(String(order.status)) && order.assignmentProposal?.status === "accepted");
    },
    publish: async (orderId, fix, travelMode, sharingSessionId) => { await post("/orders/demo/location/publish", {
      orderId, ...fix, capturedAt: new Date(fix.capturedAt).toISOString(), travelMode, sharingSessionId,
    }); },
    stop: async (orderId, sharingSessionId) => { await post("/orders/demo/location/stop", { orderId, sharingSessionId, reason: "mission_sharing_paused_or_stopped" }); },
    id: () => Crypto.randomUUID(),
  });
}

export function CourierJourneyProvider({ children }: { children: React.ReactNode }) {
  const sessionRef = useRef<MissionLocationSession | null>(null);
  if (!sessionRef.current) sessionRef.current = createSession();
  const session = sessionRef.current;
  useEffect(() => {
    session.setActive(AppState.currentState === "active" || !AppState.currentState);
    const change = AppState.addEventListener("change", (state) => session.setActive(state === "active"));
    const timer = setInterval(() => void session.revalidate(), 15_000);
    return () => { clearInterval(timer); change.remove(); session.stop(); };
  }, [session]);
  return <Context.Provider value={session}><View style={{ flex: 1 }}>{children}<SharingPresence session={session} /></View></Context.Provider>;
}

function SharingPresence({ session }: { session: MissionLocationSession }) {
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  if (!state.sharingRequested) return null;
  return <View style={{ backgroundColor: "#173D30", paddingHorizontal: 14, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 8, borderTopColor: "#4D7159", borderTopWidth: 1 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Revenir à la mission dont la position est partagée" style={{ flex: 1, minHeight: 44, justifyContent: "center" }} onPress={() => router.push({ pathname: "/courier-integrated-map" as any, params: { orderId: state.orderId || "" } })}>
      <Text style={{ color: "#E9F1E2", fontSize: 12, fontWeight: "700" }}>{state.paused ? "Position en pause" : state.sharing ? "● Position partagée" : "Position à vérifier"}</Text>
      <Text style={{ color: "#BFD6C4", fontSize: 10, marginTop: 2 }}>{state.orderId} · Carte et confidentialité</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel="Arrêter le partage de ma position" style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10, borderRadius: 12, backgroundColor: "#E6BD72" }} onPress={() => session.stop()}><Text style={{ color: "#143726", fontSize: 12, fontWeight: "800" }}>Arrêter</Text></Pressable>
  </View>;
}

export function useCourierJourney() {
  const session = useContext(Context);
  if (!session) throw new Error("CourierJourneyProvider is required");
  const state = useSyncExternalStore(session.subscribe, session.snapshot, session.snapshot);
  return { ...state, session };
}
