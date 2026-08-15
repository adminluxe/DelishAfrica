import { daOrdersFetch } from "../utils/daOrdersApi";
// DA_A5A3A7S16R8_COURIER_MISSION_DETAIL_REPAIR_V1
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { router, useLocalSearchParams } from "expo-router";

type OrderItem = {
  id?: string;
  name?: string;
  title?: string;
  quantity?: number;
  qty?: number;
  options?: unknown[];
  extras?: unknown[];
};

type TimelineEvent = {
  status?: string;
  label?: string;
  note?: string;
  at?: string;
  changedAt?: string;
};

type CourierOrder = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: string;
  restaurantName?: string;
  merchantName?: string;
  restaurant?: string | {
    name?: string;
    address?: string | { label?: string; line1?: string; postalCode?: string; city?: string };
  };
  restaurantAddress?: string | { label?: string; line1?: string; postalCode?: string; city?: string };
  customerName?: string;
  customerPhone?: string;
  customer?: {
    name?: string;
    phone?: string;
    address?: string;
    instructions?: string;
  };
  deliveryAddress?: string;
  deliveryInstructions?: string;
  items?: OrderItem[];
  payment?: { status?: string };
  timeline?: TimelineEvent[];
  assignmentProposal?: {
    status?: string;
    courierId?: string;
    courierName?: string;
  };
  allergenFlags?: unknown[];
  dietaryTags?: unknown[];
  foodSafetyNote?: string;
  safety?: {
    allergenFlags?: unknown[];
    dietaryTags?: unknown[];
    note?: string;
  };
  canonical?: {
    customer?: { name?: string; phone?: string };
    delivery?: {
      address?: { label?: string };
      instructions?: string;
    };
    items?: OrderItem[];
    notes?: { delivery?: string; kitchen?: string };
    safety?: {
      allergenFlags?: unknown[];
      dietaryTags?: unknown[];
      note?: string;
    };
    status?: { business?: string; payment?: string };
    timeline?: TimelineEvent[];
  };
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/$/, "")
  : `${RAW_API.replace(/\/$/, "")}/api/v1`;

function publicId(order?: CourierOrder | null) {
  return String(order?.publicId || order?.orderId || order?.id || "DA-MISSION");
}

function statusLabel(value?: string) {
  const key = String(value || "ready").toLowerCase();
  const labels: Record<string, string> = {
    pending: "Reçue",
    accepted: "En préparation",
    ready: "À récupérer",
    picked_up: "En route vers le client",
    delivered: "Livrée",
    cancelled: "Annulée",
    canceled: "Annulée",
    courier_proposed: "Proposée au coursier",
    courier_accepted: "Acceptée par le coursier",
    paid: "Paiement confirmé",
  };
  return labels[key] || value || "À suivre";
}

function quantity(item: OrderItem) {
  return Math.max(1, Number(item.quantity ?? item.qty ?? 1));
}

function itemName(item: OrderItem) {
  return String(item.name || item.title || "Article");
}

function displayList(values?: unknown[]) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => {
      if (typeof value === "string") return value;
      if (value && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return String(record.label || record.name || record.title || record.value || "").trim();
      }
      return String(value || "").trim();
    })
    .filter(Boolean);
}

function addressText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  return [record.label, record.line1, record.postalCode, record.city]
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter((part, index, all) => part && all.indexOf(part) === index)
    .join(", ");
}

function restaurantName(order?: CourierOrder | null) {
  const restaurant = order?.restaurant;
  const objectRestaurant = restaurant && typeof restaurant === "object" ? restaurant : null;
  return String(
    order?.restaurantName ||
      objectRestaurant?.name ||
      (typeof restaurant === "string" ? restaurant : "") ||
      order?.merchantName ||
      "Restaurant partenaire",
  );
}

function restaurantAddress(order?: CourierOrder | null) {
  const restaurant = order?.restaurant;
  const objectRestaurant = restaurant && typeof restaurant === "object" ? restaurant : null;
  return addressText(order?.restaurantAddress) || addressText(objectRestaurant?.address) || "Adresse disponible dans le guidage terrain";
}

function formatDate(value?: string) {
  if (!value) return "Heure indisponible";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("fr-BE", {
    timeZone: "Europe/Brussels",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

async function postJson(path: string, body: Record<string, unknown>) {
  const response = await daOrdersFetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  return payload;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DataRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text selectable style={[styles.dataValue, strong && styles.dataValueStrong]}>{value || "—"}</Text>
    </View>
  );
}

export default function CourierMissionDetailScreen() {
  const params = useLocalSearchParams<{ orderId?: string | string[]; publicId?: string | string[] }>();
  const rawOrderId = Array.isArray(params.publicId)
    ? params.publicId[0]
    : params.publicId || (Array.isArray(params.orderId) ? params.orderId[0] : params.orderId);
  const orderId = String(rawOrderId || "").trim();
  const [order, setOrder] = useState<CourierOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!orderId) {
      setError("Identifiant de mission absent.");
      setLoading(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const payload = await postJson("/orders/demo/get", { orderId, id: orderId });
      const resolved = payload?.order || payload?.data?.order || payload?.data || payload;
      if (!resolved || typeof resolved !== "object") throw new Error("Mission introuvable.");
      setOrder(resolved as CourierOrder);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lecture de la mission impossible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const items = useMemo(() => order?.canonical?.items || order?.items || [], [order]);
  const timeline = useMemo(() => order?.canonical?.timeline || order?.timeline || [], [order]);
  const totalUnits = useMemo(() => items.reduce((sum, item) => sum + quantity(item), 0), [items]);
  const drinkUnits = useMemo(
    () => items.reduce((sum, item) => /bissap|hibiscus|gingembre|boisson|jus|eau/i.test(itemName(item)) ? sum + quantity(item) : sum, 0),
    [items],
  );
  const clientName = String(order?.canonical?.customer?.name || order?.customer?.name || order?.customerName || "Client DelishAfrica");
  const clientPhone = String(order?.canonical?.customer?.phone || order?.customer?.phone || order?.customerPhone || "");
  const deliveryAddress = String(order?.canonical?.delivery?.address?.label || order?.deliveryAddress || order?.customer?.address || "");
  const deliveryInstructions = String(order?.canonical?.delivery?.instructions || order?.canonical?.notes?.delivery || order?.deliveryInstructions || order?.customer?.instructions || "");
  const businessStatus = String(order?.canonical?.status?.business || order?.status || "ready");
  const paymentStatus = String(order?.canonical?.status?.payment || order?.payment?.status || "unknown");
  const assignmentAccepted = String(order?.assignmentProposal?.status || "").toLowerCase() === "accepted" && Boolean(order?.assignmentProposal?.courierId);
  const statusAllowsContact = assignmentAccepted || ["picked_up", "delivered"].includes(businessStatus.toLowerCase());
  const hasKitchenSafety = Boolean(
    displayList(order?.canonical?.safety?.allergenFlags || order?.safety?.allergenFlags || order?.allergenFlags).length ||
      displayList(order?.canonical?.safety?.dietaryTags || order?.safety?.dietaryTags || order?.dietaryTags).length ||
      String(order?.canonical?.safety?.note || order?.safety?.note || order?.foodSafetyNote || "").trim(),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#75EFA4" />}
      >
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.brand}>DELISHAFRICA® · COURIER</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#75EFA4" />
            <Text style={styles.stateText}>Lecture du colis…</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorTitle}>Mission indisponible</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => void load(false)}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : null}

        {order ? (
          <>
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>CONTRÔLE COLIS COMPLET</Text>
                <Text selectable numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68} style={styles.title}>{publicId(order)}</Text>
                <Text style={styles.heroMeta}>{restaurantName(order)} · {clientName}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{statusLabel(businessStatus)}</Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <View style={styles.metricCard}><Text style={styles.metricValue}>{items.length}</Text><Text style={styles.metricLabel}>lignes</Text></View>
              <View style={styles.metricCard}><Text style={styles.metricValue}>{totalUnits}</Text><Text style={styles.metricLabel}>unités</Text></View>
              <View style={styles.metricCard}><Text style={styles.metricValue}>{drinkUnits}</Text><Text style={styles.metricLabel}>boissons</Text></View>
            </View>

            <Section title="Articles à récupérer">
              {items.length ? items.map((item, index) => {
                const options = displayList(item.options);
                const extras = displayList(item.extras);
                return (
                  <View key={String(item.id || `${itemName(item)}-${index}`)} style={[styles.itemRow, index > 0 && styles.itemRowSeparated]}>
                    <View style={styles.quantityBadge}><Text style={styles.quantityText}>{quantity(item)}×</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{itemName(item)}</Text>
                      {options.length ? <Text style={styles.itemDetail}>Options : {options.join(" · ")}</Text> : null}
                      {extras.length ? <Text style={styles.itemDetail}>Suppléments : {extras.join(" · ")}</Text> : null}
                    </View>
                  </View>
                );
              }) : <Text style={styles.emptyText}>Aucun article transmis.</Text>}
            </Section>

            <Section title="Contrôle de remise">
              <DataRow label="Restaurant" value={restaurantName(order)} strong />
              <DataRow label="Retrait" value={restaurantAddress(order)} />
              <DataRow label="Client" value={clientName} strong />
              <DataRow label="Téléphone" value={statusAllowsContact ? clientPhone || "Non communiqué" : "Disponible après acceptation Route Oracle"} />
              <DataRow label="Adresse" value={deliveryAddress || "Adresse disponible dans Mission Live"} />
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsLabel}>Instructions de livraison</Text>
                <Text selectable style={styles.instructionsText}>{deliveryInstructions || "Aucune instruction particulière."}</Text>
              </View>
            </Section>

            <Section title="Vérifications opérationnelles">
              <View style={styles.checkRow}><Text style={styles.checkIcon}>✓</Text><Text style={styles.checkText}>{items.length} ligne{items.length > 1 ? "s" : ""} et {totalUnits} unité{totalUnits > 1 ? "s" : ""} à contrôler au retrait.</Text></View>
              <View style={styles.checkRow}><Text style={styles.checkIcon}>✓</Text><Text style={styles.checkText}>{drinkUnits ? `${drinkUnits} boisson${drinkUnits > 1 ? "s" : ""} à vérifier séparément.` : "Aucune boisson identifiée dans cette commande."}</Text></View>
              <View style={styles.checkRow}><Text style={styles.checkIcon}>✓</Text><Text style={styles.checkText}>{statusLabel(paymentStatus)} · aucun encaissement à improviser.</Text></View>
              {hasKitchenSafety ? (
                <View style={styles.privacyCard}>
                  <Text style={styles.privacyTitle}>Consignes cuisine traitées</Text>
                  <Text style={styles.privacyText}>Le restaurant reçoit les détails alimentaires. Le coursier voit uniquement les informations nécessaires au colis et à la remise.</Text>
                </View>
              ) : null}
            </Section>

            <Section title="Chronologie logistique">
              {timeline.length ? timeline.map((event, index) => {
                const key = String(event.label || event.status || `event-${index}`);
                const isLast = index === timeline.length - 1;
                return (
                  <View key={`${key}-${event.at || event.changedAt || index}`} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.timelineDot, isLast && styles.timelineDotActive]} />
                      {!isLast ? <View style={styles.timelineLine} /> : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: isLast ? 0 : 18 }}>
                      <Text style={styles.timelineTitle}>{statusLabel(event.label || event.status)}</Text>
                      <Text style={styles.timelineTime}>{formatDate(event.at || event.changedAt)}</Text>
                      {event.note ? <Text style={styles.timelineNote}>{event.note}</Text> : null}
                    </View>
                  </View>
                );
              }) : <Text style={styles.emptyText}>Chronologie indisponible.</Text>}
            </Section>

            <View style={styles.readOnlyCard}>
              <Text style={styles.readOnlyTitle}>Fiche de contrôle en lecture seule</Text>
              <Text style={styles.readOnlyText}>Le retrait, la livraison et Mission Live restent dans les écrans terrain afin d’éviter une validation accidentelle pendant le contrôle du colis.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Revenir à la mission</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#00140B" },
  page: { padding: 18, paddingBottom: 72 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8, marginBottom: 18 },
  backButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(117,239,164,0.10)", borderWidth: 1, borderColor: "rgba(117,239,164,0.24)" },
  backText: { color: "#A8FBC5", fontSize: 13, fontWeight: "900" },
  brand: { flex: 1, color: "#75EFA4", fontSize: 10, fontWeight: "900", letterSpacing: 2.1, textAlign: "right" },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 28, padding: 22, backgroundColor: "#EFFFF4", borderWidth: 1, borderColor: "#75EFA4", marginBottom: 14 },
  kicker: { color: "#0B6A36", fontSize: 10, fontWeight: "900", letterSpacing: 2.2 },
  title: { color: "#03170C", fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 8 },
  heroMeta: { color: "rgba(3,23,12,0.60)", fontSize: 13, lineHeight: 19, fontWeight: "800", marginTop: 7 },
  statusPill: { maxWidth: 132, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(11,156,80,0.12)" },
  statusText: { color: "#06351D", fontSize: 11, lineHeight: 15, fontWeight: "900", textAlign: "center" },
  metricsRow: { flexDirection: "row", gap: 9, marginBottom: 14 },
  metricCard: { flex: 1, borderRadius: 20, padding: 15, backgroundColor: "#072318", borderWidth: 1, borderColor: "rgba(117,239,164,0.14)" },
  metricValue: { color: "#F3FFF7", fontSize: 26, fontWeight: "900" },
  metricLabel: { color: "rgba(227,255,236,0.56)", fontSize: 11, fontWeight: "800", marginTop: 5 },
  section: { borderRadius: 24, padding: 18, backgroundColor: "#072318", borderWidth: 1, borderColor: "rgba(117,239,164,0.14)", marginBottom: 14 },
  sectionTitle: { color: "#75EFA4", fontSize: 11, fontWeight: "900", letterSpacing: 2.1, textTransform: "uppercase", marginBottom: 14 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  itemRowSeparated: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", paddingTop: 16, marginTop: 12 },
  quantityBadge: { minWidth: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(117,239,164,0.12)" },
  quantityText: { color: "#A8FBC5", fontSize: 14, fontWeight: "900" },
  itemName: { color: "#F3FFF7", fontSize: 18, lineHeight: 23, fontWeight: "900" },
  itemDetail: { color: "rgba(227,255,236,0.62)", fontSize: 12, lineHeight: 18, marginTop: 6 },
  dataRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  dataLabel: { width: 98, color: "rgba(227,255,236,0.52)", fontSize: 12, lineHeight: 18, fontWeight: "800" },
  dataValue: { flex: 1, color: "#F3FFF7", fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "right" },
  dataValueStrong: { color: "#A8FBC5", fontWeight: "900" },
  instructionsCard: { borderRadius: 18, padding: 15, backgroundColor: "rgba(117,239,164,0.08)", marginTop: 14 },
  instructionsLabel: { color: "#75EFA4", fontSize: 10, fontWeight: "900", letterSpacing: 1.5, textTransform: "uppercase" },
  instructionsText: { color: "#F3FFF7", fontSize: 15, lineHeight: 22, fontWeight: "800", marginTop: 8 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 11, paddingVertical: 9 },
  checkIcon: { width: 24, height: 24, borderRadius: 12, overflow: "hidden", textAlign: "center", textAlignVertical: "center", color: "#03170C", backgroundColor: "#75EFA4", fontSize: 13, fontWeight: "900" },
  checkText: { flex: 1, color: "#F3FFF7", fontSize: 13, lineHeight: 20, fontWeight: "700" },
  privacyCard: { borderRadius: 18, padding: 15, backgroundColor: "rgba(255,216,101,0.08)", borderWidth: 1, borderColor: "rgba(255,216,101,0.16)", marginTop: 10 },
  privacyTitle: { color: "#F8D36B", fontSize: 14, fontWeight: "900" },
  privacyText: { color: "rgba(255,246,207,0.70)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 18, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(227,255,236,0.28)", marginTop: 5 },
  timelineDotActive: { backgroundColor: "#75EFA4" },
  timelineLine: { width: 2, flex: 1, minHeight: 48, backgroundColor: "rgba(227,255,236,0.16)", marginTop: 5 },
  timelineTitle: { color: "#F3FFF7", fontSize: 16, fontWeight: "900" },
  timelineTime: { color: "rgba(227,255,236,0.50)", fontSize: 11, fontWeight: "800", marginTop: 4 },
  timelineNote: { color: "rgba(227,255,236,0.62)", fontSize: 12, lineHeight: 18, marginTop: 7 },
  readOnlyCard: { borderRadius: 24, padding: 18, backgroundColor: "#0A2C1D", borderWidth: 1, borderColor: "rgba(117,239,164,0.18)" },
  readOnlyTitle: { color: "#A8FBC5", fontSize: 17, fontWeight: "900" },
  readOnlyText: { color: "rgba(227,255,236,0.62)", fontSize: 13, lineHeight: 21, marginTop: 8 },
  primaryButton: { borderRadius: 18, alignItems: "center", paddingVertical: 15, backgroundColor: "#75EFA4", marginTop: 16 },
  primaryButtonText: { color: "#03170C", fontSize: 15, fontWeight: "900" },
  stateCard: { alignItems: "center", gap: 12, borderRadius: 24, padding: 24, backgroundColor: "#072318" },
  stateText: { color: "#F3FFF7", fontSize: 14, fontWeight: "800" },
  errorCard: { borderRadius: 24, padding: 20, backgroundColor: "rgba(138,31,31,0.22)", borderWidth: 1, borderColor: "rgba(255,135,135,0.22)" },
  errorTitle: { color: "#FFD4D4", fontSize: 18, fontWeight: "900" },
  errorText: { color: "rgba(255,224,224,0.72)", fontSize: 13, lineHeight: 20, marginTop: 7 },
  retryButton: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.10)", marginTop: 14 },
  retryText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  emptyText: { color: "rgba(227,255,236,0.55)", fontSize: 13, lineHeight: 20 },
});
