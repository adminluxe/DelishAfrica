import { daOrdersFetch } from "../utils/daOrdersApi";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link } from "expo-router";

type OrderStatus =
  | "pending"
  | "accepted"
  | "ready"
  | "picked_up"
  | "delivered"
  | "cancelled"
  | "canceled"
  | string;

type DemoOrder = {
  id?: string;
  orderId?: string;
  publicId?: string;
  status?: OrderStatus;
  restaurantName?: string;
  restaurant?: string | { name?: string };
  customerName?: string;
  customer?: string | { name?: string };
  items?: Array<{ name?: string; title?: string; quantity?: number }>;
  total?: number;
  amount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type CourierAlert = {
  id: string;
  tone: "urgent" | "active" | "success" | "quiet";
  title: string;
  body: string;
  meta: string;
  status: string;
};

const RAW_API =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  process.env.EXPO_PUBLIC_API_URL ||
  "https://api.delishafrica.me/api/v1";

const API_BASE_URL = RAW_API.replace(/\/+$/, "").endsWith("/api/v1")
  ? RAW_API.replace(/\/+$/, "")
  : `${RAW_API.replace(/\/+$/, "")}/api/v1`;

function textFrom(value: unknown, fallback = ""): string {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value && typeof value.name === "string") {
    return value.name;
  }
  return fallback;
}

function publicId(order: DemoOrder): string {
  return String(order.publicId || order.orderId || order.id || "Mission");
}

function firstItem(order: DemoOrder): string {
  const item = order.items?.[0];
  return item?.name || item?.title || "Commande DelishAfrica®";
}

function statusLabel(status?: OrderStatus): string {
  switch (status) {
    case "pending":
      return "Reçue";
    case "accepted":
      return "En préparation";
    case "ready":
      return "Prête";
    case "picked_up":
      return "En route";
    case "delivered":
      return "Livrée";
    case "cancelled":
    case "canceled":
      return "Annulée";
    default:
      return "À suivre";
  }
}

function buildAlert(order: DemoOrder): CourierAlert {
  const status = String(order.status || "pending");
  const id = publicId(order);
  const restaurant = textFrom(order.restaurantName || order.restaurant, "Thieyp");
  const customer = textFrom(order.customerName || order.customer, "Client DelishAfrica®");
  const item = firstItem(order);

  if (status === "ready") {
    return {
      id,
      tone: "urgent",
      title: "Mission prête à récupérer",
      body: `${item} est prêt chez ${restaurant}. Le coursier peut passer en récupération.`,
      meta: `${id} · ${customer}`,
      status,
    };
  }

  if (status === "picked_up") {
    return {
      id,
      tone: "active",
      title: "Mission en route",
      body: `${item} est récupéré. Garder le suivi précis jusqu'à la livraison.`,
      meta: `${id} · ${restaurant}`,
      status,
    };
  }

  if (status === "delivered") {
    return {
      id,
      tone: "success",
      title: "Mission livrée",
      body: `${item} est terminé. L'historique reste visible pour contrôle terrain.`,
      meta: `${id} · ${restaurant}`,
      status,
    };
  }

  if (status === "accepted") {
    return {
      id,
      tone: "quiet",
      title: "Cuisine en préparation",
      body: `${restaurant} prépare la commande. La mission apparaîtra à récupérer dès qu'elle sera prête.`,
      meta: `${id} · ${customer}`,
      status,
    };
  }

  return {
    id,
    tone: "quiet",
    title: "Commande reçue",
    body: `${item} est dans le flux. Aucune action coursier immédiate.`,
    meta: `${id} · ${restaurant}`,
    status,
  };
}

function normalizeList(payload: any): DemoOrder[] {
  const source =
    payload?.orders ||
    payload?.items ||
    payload?.data ||
    payload?.result ||
    payload?.list ||
    [];

  return Array.isArray(source) ? source : [];
}

export default function CourierNotificationsScreen() {
  const [orders, setOrders] = useState<DemoOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const response = await daOrdersFetch(`${API_BASE_URL}/orders/demo/list`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scope: "courier-inapp-notifications" }),
      });

      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(json?.message || `HTTP ${response.status}`);
      }

      setOrders(normalizeList(json));
    } catch (err: any) {
      setError(err?.message || "Impossible de charger les alertes internes.");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const alerts = useMemo(() => {
    return orders
      .map(buildAlert)
      .sort((a, b) => {
        const priority: Record<string, number> = {
          ready: 0,
          picked_up: 1,
          accepted: 2,
          pending: 3,
          delivered: 4,
        };
        return (priority[a.status] ?? 9) - (priority[b.status] ?? 9);
      });
  }, [orders]);

  const counts = useMemo(() => {
    const ready = alerts.filter((a) => a.status === "ready").length;
    const active = alerts.filter((a) => a.status === "picked_up").length;
    const done = alerts.filter((a) => a.status === "delivered").length;
    return { ready, active, done, total: alerts.length };
  }, [alerts]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>DELISHAFRICA® · COURIER</Text>
        <View style={styles.row}>
          <Text style={styles.title}>Alertes internes</Text>
          <Text style={styles.live}>LIVE</Text>
        </View>
        <Text style={styles.subtitle}>
          Centre opérationnel pour prioriser les missions et garder le terrain parfaitement lisible.
        </Text>
      </View>

      <View style={styles.grid}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{counts.ready}</Text>
          <Text style={styles.metricLabel}>À récupérer</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{counts.active}</Text>
          <Text style={styles.metricLabel}>En route</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{counts.done}</Text>
          <Text style={styles.metricLabel}>Livrées</Text>
        </View>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={load}>
          <Text style={styles.primaryButtonText}>
            {loading ? "Chargement..." : "Rafraîchir les alertes"}
          </Text>
        </Pressable>

        <Link href="/courier-eta" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Voir ETA mission</Text>
          </Pressable>
        </Link>

        <Link href="/orders" asChild>
          <Pressable style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Voir les missions</Text>
          </Pressable>
        </Link>
      </View>

      {loading ? (
        <View style={styles.emptyCard}>
          <ActivityIndicator />
          <Text style={styles.emptyText}>Lecture des missions en cours…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>Alertes indisponibles</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.note}>
            Le flux reste sécurisé. Les missions conservent leur statut tant qu’aucune action terrain n’est confirmée.
          </Text>
        </View>
      ) : alerts.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aucune alerte active</Text>
          <Text style={styles.emptyText}>
            Tout est calme côté terrain. Les nouvelles missions apparaîtront ici automatiquement au rafraîchissement.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {alerts.map((alert) => (
            <View key={`${alert.id}-${alert.status}`} style={[styles.alertCard, styles[alert.tone]]}>
              <View style={styles.alertTop}>
                <Text style={styles.alertTitle}>{alert.title}</Text>
                <Text style={styles.badge}>{statusLabel(alert.status)}</Text>
              </View>
              <Text style={styles.alertBody}>{alert.body}</Text>
              <Text style={styles.alertMeta}>{alert.meta}</Text>
            </View>
          ))}
        </View>
      )}
</ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#07140f",
  },
content: {
paddingHorizontal: 18,
paddingTop: 56,
paddingBottom: 46,
},
hero: {
padding: 22,
borderRadius: 30,
    backgroundColor: "#103B2A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    marginBottom: 16,
  },
  kicker: {
    color: "#BCE8CE",
    fontWeight: "800",
    letterSpacing: 1.2,
    fontSize: 12,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 30,
    fontWeight: "900",
    flex: 1,
  },
  live: {
    color: "#0B1B13",
    backgroundColor: "#BCE8CE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontWeight: "900",
    fontSize: 12,
  },
  subtitle: {
    color: "#D7F5E2",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  grid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  metric: {
    flex: 1,
    backgroundColor: "#0C2118",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(188,232,206,0.18)",
  },
  metricValue: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "900",
  },
  metricLabel: {
    color: "#BCE8CE",
    marginTop: 4,
    fontSize: 12,
    fontWeight: "700",
  },
  actions: {
    gap: 10,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: "#BCE8CE",
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#07140F",
    fontWeight: "900",
    textAlign: "center",
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: "rgba(188,232,206,0.10)",
    borderColor: "rgba(188,232,206,0.22)",
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: "#EFFFF3",
    fontWeight: "800",
    textAlign: "center",
  },
  list: {
    gap: 12,
  },
  alertCard: {
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
  },
  urgent: {
    backgroundColor: "#183524",
    borderColor: "#BCE8CE",
  },
  active: {
    backgroundColor: "#102B33",
    borderColor: "rgba(180,235,255,0.55)",
  },
  success: {
    backgroundColor: "#17261B",
    borderColor: "rgba(188,232,206,0.28)",
  },
  quiet: {
    backgroundColor: "#101A16",
    borderColor: "rgba(255,255,255,0.12)",
  },
  alertTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  alertTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 17,
    flex: 1,
  },
  badge: {
    color: "#07140F",
    backgroundColor: "#EFFFF3",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    fontSize: 11,
    fontWeight: "900",
  },
  alertBody: {
    color: "#D8F6E4",
    lineHeight: 21,
    marginTop: 10,
  },
  alertMeta: {
    color: "#9DCEB3",
    marginTop: 10,
    fontWeight: "800",
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: "#0C2118",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(188,232,206,0.18)",
    gap: 10,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },
  emptyText: {
    color: "#D8F6E4",
    lineHeight: 21,
  },
  errorCard: {
    backgroundColor: "#351515",
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255,190,190,0.35)",
  },
  errorTitle: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 18,
  },
  errorText: {
    color: "#FFD7D7",
    marginTop: 8,
    lineHeight: 21,
  },
  note: {
    color: "#FFD7D7",
    marginTop: 10,
    fontSize: 12,
    opacity: 0.85,
  },
});
