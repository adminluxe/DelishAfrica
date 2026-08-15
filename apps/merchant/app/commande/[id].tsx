import { daOrdersFetch } from "../../utils/daOrdersApi";
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

type MoneyValue = {
  amountMinor?: number;
  currency?: string;
};

type OrderItem = {
  id?: string;
  name?: string;
  title?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  amount?: number;
  unitPrice?: MoneyValue | number;
  lineTotal?: MoneyValue | number;
  options?: unknown[];
  extras?: unknown[];
  allergens?: unknown[];
};

type TimelineEvent = {
  status?: string;
  label?: string;
  note?: string;
  at?: string;
  changedAt?: string;
};

type MerchantOrder = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customer?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    instructions?: string;
    allergenFlags?: unknown[];
    dietaryTags?: unknown[];
    foodSafetyNote?: string;
  };
  allergenFlags?: unknown[];
  dietaryTags?: unknown[];
  foodSafetyNote?: string;
  safety?: {
    allergenFlags?: unknown[];
    dietaryTags?: unknown[];
    note?: string;
    requiresMerchantAcknowledgement?: boolean;
    confirmedAt?: string;
    source?: string;
  };
  restaurantName?: string;
  merchantName?: string;
  deliveryAddress?: string;
  deliveryInstructions?: string;
  items?: OrderItem[];
  subtotal?: number;
  deliveryFee?: number;
  serviceFee?: number;
  total?: number;
  amount?: number;
  currency?: string;
  payment?: {
    provider?: string;
    mode?: string;
    status?: string;
    paidAt?: string;
  };
  timeline?: TimelineEvent[];
  assignmentProposal?: {
    status?: string;
    courierName?: string;
    proposedAt?: string;
    acceptedAt?: string;
  };
  canonical?: {
    customer?: { name?: string; phone?: string; email?: string };
    delivery?: { address?: { label?: string }; instructions?: string };
    items?: OrderItem[];
    notes?: { delivery?: string; kitchen?: string };
    safety?: {
      allergenFlags?: unknown[];
      dietaryTags?: unknown[];
      note?: string;
      requiresMerchantAcknowledgement?: boolean;
      confirmedAt?: string;
      source?: string;
    };
    pricing?: {
      subtotal?: MoneyValue;
      deliveryFee?: MoneyValue;
      serviceFee?: MoneyValue;
      tax?: MoneyValue;
      discount?: MoneyValue;
      total?: MoneyValue;
    };
    status?: {
      business?: string;
      payment?: string;
      kitchenReadiness?: string;
      deliveryReadiness?: string;
    };
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

function publicId(order?: MerchantOrder | null) {
  return String(order?.publicId || order?.orderId || order?.id || "DA-ORDER");
}

function statusLabel(value?: string) {
  const key = String(value || "pending").toLowerCase();
  const labels: Record<string, string> = {
    pending: "À accepter",
    accepted: "En cuisine",
    ready: "Prête pour le coursier",
    picked_up: "En route vers le client",
    delivered: "Livrée",
    cancelled: "Annulée",
    canceled: "Annulée",
    paid: "Paiement confirmé",
    courier_proposed: "Proposée au coursier",
    courier_accepted: "Acceptée par le coursier",
  };
  return labels[key] || value || "À suivre";
}

function asMinor(value: unknown): number {
  if (value && typeof value === "object" && "amountMinor" in value) {
    const n = Number((value as MoneyValue).amountMinor || 0);
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return 0;
  return Number.isInteger(n) && Math.abs(n) >= 100 ? n : Math.round(n * 100);
}

function formatMinor(value: unknown, currency = "EUR") {
  const amount = asMinor(value) / 100;
  return new Intl.NumberFormat("fr-BE", {
    style: "currency",
    currency: String(currency || "EUR").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount).replace(/\u00a0/g, " ");
}

function quantity(item: OrderItem) {
  return Math.max(1, Number(item.quantity ?? item.qty ?? 1));
}

function itemName(item: OrderItem) {
  return String(item.name || item.title || "Article");
}

function unitPriceMinor(item: OrderItem) {
  if (item.unitPrice !== undefined) return asMinor(item.unitPrice);
  if (item.price !== undefined) return asMinor(item.price);
  const qty = quantity(item);
  if (item.lineTotal !== undefined) return Math.round(asMinor(item.lineTotal) / qty);
  if (item.amount !== undefined) return Math.round(asMinor(item.amount) / qty);
  return 0;
}

function lineTotalMinor(item: OrderItem) {
  if (item.lineTotal !== undefined) return asMinor(item.lineTotal);
  if (item.amount !== undefined) return asMinor(item.amount);
  return unitPriceMinor(item) * quantity(item);
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
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `HTTP ${response.status}`);
  }
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

export default function MerchantOrderDetailScreen() {
  const params = useLocalSearchParams();
  const rawOrderId = params.id;
  const orderId = Array.isArray(rawOrderId)
    ? String(rawOrderId[0] || "")
    : typeof rawOrderId === "string"
      ? rawOrderId
      : "";
  const [order, setOrder] = useState<MerchantOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!orderId) {
      setError("Identifiant de commande absent.");
      setLoading(false);
      return;
    }
    refresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const payload = await postJson("/orders/demo/get", { orderId, id: orderId });
      const resolved = payload?.order || payload?.data?.order || payload?.data || payload;
      if (!resolved || typeof resolved !== "object") throw new Error("Commande introuvable.");
      setOrder(resolved as MerchantOrder);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Lecture de la commande impossible.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const items = useMemo(
    () => order?.canonical?.items || order?.items || [],
    [order],
  );
  const timeline = useMemo(
    () => order?.canonical?.timeline || order?.timeline || [],
    [order],
  );
  const customerName = String(order?.canonical?.customer?.name || order?.customer?.name || order?.customerName || "Client DelishAfrica");
  const customerPhone = String(order?.canonical?.customer?.phone || order?.customer?.phone || order?.customerPhone || "");
  const customerEmail = String(order?.canonical?.customer?.email || order?.customer?.email || order?.customerEmail || "");
  const deliveryAddress = String(order?.canonical?.delivery?.address?.label || order?.deliveryAddress || order?.customer?.address || "");
  const deliveryInstructions = String(order?.canonical?.delivery?.instructions || order?.canonical?.notes?.delivery || order?.deliveryInstructions || order?.customer?.instructions || "");
  const currency = String(order?.currency || order?.canonical?.pricing?.total?.currency || "EUR");
  const subtotal = order?.canonical?.pricing?.subtotal ?? order?.subtotal ?? 0;
  const deliveryFee = order?.canonical?.pricing?.deliveryFee ?? order?.deliveryFee ?? 0;
  const serviceFee = order?.canonical?.pricing?.serviceFee ?? order?.serviceFee ?? 0;
  const total = order?.canonical?.pricing?.total ?? order?.total ?? order?.amount ?? 0;
  const businessStatus = String(order?.canonical?.status?.business || order?.status || "pending");
  const paymentStatus = String(order?.canonical?.status?.payment || order?.payment?.status || "unknown");
  const safety = order?.canonical?.safety || order?.safety || {};
  const allergenFlags = displayList(
    safety.allergenFlags || order?.allergenFlags || order?.customer?.allergenFlags,
  );
  const dietaryTags = displayList(
    safety.dietaryTags || order?.dietaryTags || order?.customer?.dietaryTags,
  );
  const foodSafetyNote = String(
    safety.note ||
    order?.canonical?.notes?.kitchen ||
    order?.foodSafetyNote ||
    order?.customer?.foodSafetyNote ||
    '',
  ).trim();
  const requiresMerchantAcknowledgement = Boolean(
    safety.requiresMerchantAcknowledgement || allergenFlags.length > 0,
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor="#FFB86B" />}
      >
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Retour</Text>
          </Pressable>
          <Text style={styles.brand}>DELISHAFRICA® · MERCHANT</Text>
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <ActivityIndicator color="#FFB86B" />
            <Text style={styles.stateText}>Lecture de la commande complète…</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.errorTitle}>Commande indisponible</Text>
            <Text style={styles.stateText}>{error}</Text>
            <Pressable onPress={() => void load(false)} style={styles.retryButton}>
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : order ? (
          <>
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.kicker}>FICHE CUISINE COMPLÈTE</Text>
                <Text
                  selectable
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.68}
                  style={styles.title}
                >
                  {publicId(order)}
                </Text>
                <Text style={styles.heroMeta}>{order.restaurantName || order.merchantName || "Établissement partenaire"}</Text>
              </View>
              <View style={styles.statusPill}>
                <Text style={styles.statusText}>{statusLabel(businessStatus)}</Text>
              </View>
            </View>

            <Section title={`Articles · ${items.length}`}>
              {items.length ? items.map((item, index) => {
                const options = displayList(item.options);
                const extras = displayList(item.extras);
                const allergens = displayList(item.allergens);
                return (
                  <View key={String(item.id || `${itemName(item)}-${index}`)} style={[styles.itemRow, index > 0 && styles.itemRowSeparated]}>
                    <View style={styles.quantityBadge}>
                      <Text style={styles.quantityText}>{quantity(item)}×</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemName}>{itemName(item)}</Text>
                      <Text style={styles.itemPrice}>{formatMinor(unitPriceMinor(item), currency)} l’unité</Text>
                      {options.length ? <Text style={styles.itemDetail}>Options : {options.join(" · ")}</Text> : null}
                      {extras.length ? <Text style={styles.itemDetail}>Suppléments : {extras.join(" · ")}</Text> : null}
                      {allergens.length ? <Text style={styles.itemWarning}>Allergènes déclarés : {allergens.join(" · ")}</Text> : null}
                    </View>
                    <Text style={styles.lineTotal}>{formatMinor(lineTotalMinor(item), currency)}</Text>
                  </View>
                );
              }) : <Text style={styles.emptyText}>Aucun article transmis.</Text>}
            </Section>

            <Section title="Client et remise">
              <DataRow label="Client" value={customerName} strong />
              <DataRow label="Téléphone" value={customerPhone} />
              <DataRow label="E-mail" value={customerEmail} />
              <DataRow label="Adresse" value={deliveryAddress} />
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsLabel}>Instructions de livraison</Text>
                <Text selectable style={styles.instructionsText}>{deliveryInstructions || "Aucune instruction particulière."}</Text>
              </View>
            </Section>

            <Section title="Sécurité alimentaire">
              {requiresMerchantAcknowledgement ? (
                <View style={styles.foodSafetyPriority}>
                  <Text style={styles.foodSafetyPriorityTitle}>⚠ Vérification cuisine requise</Text>
                  <Text style={styles.foodSafetyPriorityText}>Relisez les allergènes et la note client avant toute préparation.</Text>
                </View>
              ) : null}
              <DataRow label="Allergènes signalés" value={allergenFlags.length ? allergenFlags.join(" · ") : "Aucun signalement déclaré"} />
              <DataRow label="Préférences alimentaires" value={dietaryTags.length ? dietaryTags.join(" · ") : "Aucune préférence déclarée"} />
              {foodSafetyNote ? (
                <View style={styles.instructionsCard}>
                  <Text style={styles.instructionsLabel}>Message pour la cuisine</Text>
                  <Text selectable style={styles.instructionsText}>{foodSafetyNote}</Text>
                </View>
              ) : null}
              <Text style={styles.safetyNote}>La fiche reprend uniquement les informations déclarées et transmises avec la commande.</Text>
            </Section>

            <Section title="Paiement et total">
              <DataRow label="Paiement" value={statusLabel(paymentStatus)} strong />
              <DataRow label="Prestataire" value={String(order.payment?.provider || "Paiement sécurisé")} />
              <DataRow label="Sous-total" value={formatMinor(subtotal, currency)} />
              <DataRow label="Livraison" value={formatMinor(deliveryFee, currency)} />
              {asMinor(serviceFee) ? <DataRow label="Frais de service" value={formatMinor(serviceFee, currency)} /> : null}
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatMinor(total, currency)}</Text>
              </View>
            </Section>

            <Section title="Chronologie">
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
              <Text style={styles.readOnlyTitle}>Fiche de lecture sécurisée</Text>
              <Text style={styles.readOnlyText}>Les actions cuisine restent dans « Service maintenant » afin d’éviter toute validation accidentelle pendant la lecture détaillée.</Text>
              <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.serviceButton}>
                <Text style={styles.serviceButtonText}>Revenir au service</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#120804" },
  page: { padding: 18, paddingBottom: 72 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: 8, marginBottom: 18 },
  backButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(255,184,107,0.12)", borderWidth: 1, borderColor: "rgba(255,184,107,0.24)" },
  backText: { color: "#FFC98F", fontSize: 13, fontWeight: "900" },
  brand: { flex: 1, color: "#FFB86B", fontSize: 10, fontWeight: "900", letterSpacing: 2.1, textAlign: "right" },
  hero: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderRadius: 28, padding: 22, backgroundColor: "#FFF1E4", borderWidth: 1, borderColor: "#FFB86B", marginBottom: 14 },
  kicker: { color: "#A64B18", fontSize: 10, fontWeight: "900", letterSpacing: 2.3 },
  title: { color: "#1E0C05", fontSize: 30, lineHeight: 35, fontWeight: "900", marginTop: 8 },
  heroMeta: { color: "rgba(30,12,5,0.62)", fontSize: 13, fontWeight: "800", marginTop: 7 },
  statusPill: { maxWidth: 132, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: "rgba(255,130,50,0.16)" },
  statusText: { color: "#1E0C05", fontSize: 11, lineHeight: 15, fontWeight: "900", textAlign: "center" },
  section: { borderRadius: 24, padding: 18, backgroundColor: "#241109", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", marginBottom: 14 },
  sectionTitle: { color: "#FFB86B", fontSize: 11, fontWeight: "900", letterSpacing: 2.2, textTransform: "uppercase", marginBottom: 14 },
  itemRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 4 },
  itemRowSeparated: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", paddingTop: 16, marginTop: 12 },
  quantityBadge: { minWidth: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,184,107,0.14)" },
  quantityText: { color: "#FFC98F", fontSize: 13, fontWeight: "900" },
  itemName: { color: "#FFF8F1", fontSize: 17, lineHeight: 22, fontWeight: "900" },
  itemPrice: { color: "rgba(255,248,241,0.55)", fontSize: 12, fontWeight: "700", marginTop: 4 },
  itemDetail: { color: "rgba(255,248,241,0.67)", fontSize: 12, lineHeight: 18, marginTop: 6 },
  itemWarning: { color: "#FFD39B", fontSize: 12, lineHeight: 18, fontWeight: "800", marginTop: 6 },
  lineTotal: { color: "#FFF8F1", fontSize: 14, fontWeight: "900", marginTop: 3 },
  dataRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  dataLabel: { width: 104, color: "rgba(255,248,241,0.52)", fontSize: 12, lineHeight: 18, fontWeight: "800" },
  dataValue: { flex: 1, color: "#FFF8F1", fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "right" },
  dataValueStrong: { color: "#FFC98F", fontWeight: "900" },
  instructionsCard: { borderRadius: 18, padding: 15, backgroundColor: "rgba(255,184,107,0.08)", marginTop: 14 },
  instructionsLabel: { color: "#FFB86B", fontSize: 10, fontWeight: "900", letterSpacing: 1.6, textTransform: "uppercase" },
  instructionsText: { color: "#FFF8F1", fontSize: 15, lineHeight: 22, fontWeight: "800", marginTop: 8 },
  foodSafetyPriority: { borderRadius: 18, padding: 15, backgroundColor: "rgba(255,117,66,0.12)", borderWidth: 1, borderColor: "rgba(255,155,84,0.24)", marginBottom: 10 },
  foodSafetyPriorityTitle: { color: "#FFC1A0", fontSize: 14, fontWeight: "900" },
  foodSafetyPriorityText: { color: "rgba(255,225,209,0.74)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  safetyNote: { color: "rgba(255,248,241,0.45)", fontSize: 11, lineHeight: 17, marginTop: 12 },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: "rgba(255,184,107,0.20)" },
  totalLabel: { color: "#FFF8F1", fontSize: 18, fontWeight: "900" },
  totalValue: { color: "#FFB86B", fontSize: 24, fontWeight: "900" },
  timelineRow: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 18, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,248,241,0.24)", marginTop: 4 },
  timelineDotActive: { backgroundColor: "#FF9B54" },
  timelineLine: { width: 2, flex: 1, minHeight: 30, backgroundColor: "rgba(255,248,241,0.10)", marginTop: 4 },
  timelineTitle: { color: "#FFF8F1", fontSize: 14, fontWeight: "900" },
  timelineTime: { color: "rgba(255,248,241,0.48)", fontSize: 11, fontWeight: "700", marginTop: 4 },
  timelineNote: { color: "rgba(255,248,241,0.68)", fontSize: 12, lineHeight: 18, marginTop: 5 },
  readOnlyCard: { borderRadius: 24, padding: 18, backgroundColor: "rgba(255,184,107,0.10)", borderWidth: 1, borderColor: "rgba(255,184,107,0.24)" },
  readOnlyTitle: { color: "#FFC98F", fontSize: 16, fontWeight: "900" },
  readOnlyText: { color: "rgba(255,248,241,0.66)", fontSize: 13, lineHeight: 20, marginTop: 8 },
  serviceButton: { borderRadius: 18, alignItems: "center", paddingVertical: 14, backgroundColor: "#FF9B54", marginTop: 16 },
  serviceButtonText: { color: "#1A0A04", fontSize: 15, fontWeight: "900" },
  stateCard: { minHeight: 240, borderRadius: 28, padding: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#241109", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  stateText: { color: "rgba(255,248,241,0.66)", fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 12 },
  errorTitle: { color: "#FFC1A0", fontSize: 20, fontWeight: "900" },
  retryButton: { borderRadius: 16, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: "#FF9B54", marginTop: 18 },
  retryText: { color: "#1A0A04", fontSize: 14, fontWeight: "900" },
  emptyText: { color: "rgba(255,248,241,0.58)", fontSize: 13, lineHeight: 20 },
});
