import {
  CANONICAL_ORDER_SCHEMA_VERSION,
  type CanonicalAddress,
  type CanonicalDataEvidence,
  type CanonicalMoney,
  type CanonicalOrderItem,
  type CanonicalOrderTimelineEvent,
  type CanonicalOrderTruth,
  type ISODateTime,
  type OrderBusinessStatus,
  type OrderPaymentStatus,
} from "./order";

export type LegacyOrderRecord = Record<string, unknown>;

const STRING_STATUSES = new Set<OrderBusinessStatus>([
  "pending",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "delivered",
  "cancelled",
]);

function asRecord(value: unknown): LegacyOrderRecord {
  return value && typeof value === "object"
    ? (value as LegacyOrderRecord)
    : {};
}

function firstString(
  source: LegacyOrderRecord,
  keys: readonly string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return fallback;
}

function firstNumber(
  source: LegacyOrderRecord,
  keys: readonly string[],
  fallback = 0,
): number {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function moneyFromMajor(
  amount: number,
  currency: string,
): CanonicalMoney {
  return {
    amountMinor: Math.round(amount * 100),
    currency: currency.toUpperCase().slice(0, 3) || "EUR",
  };
}

function normalizeBusinessStatus(value: unknown): OrderBusinessStatus {
  if (typeof value !== "string") return "pending";

  const normalized = value.trim().toLowerCase();

  if (normalized === "confirmed") return "accepted";
  if (normalized === "completed") return "delivered";
  if (normalized === "canceled") return "cancelled";

  return STRING_STATUSES.has(normalized as OrderBusinessStatus)
    ? (normalized as OrderBusinessStatus)
    : "pending";
}

function normalizePaymentStatus(value: unknown): OrderPaymentStatus {
  if (typeof value !== "string") return "pending";

  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "unpaid":
    case "pending":
    case "authorized":
    case "paid":
    case "failed":
    case "refunded":
    case "partially_refunded":
      return normalized;
    case "succeeded":
    case "complete":
    case "completed":
      return "paid";
    default:
      return "pending";
  }
}

function evidence(now: ISODateTime): CanonicalDataEvidence {
  return {
    source: "platform",
    verification: "unverified",
    recordedAt: now,
  };
}

function normalizeAddress(
  source: LegacyOrderRecord,
  now: ISODateTime,
): CanonicalAddress {
  const rawAddress = asRecord(
    source.deliveryAddress ??
      source.customerAddress ??
      source.address,
  );

  const label =
    firstString(rawAddress, ["label", "formattedAddress", "address"]) ||
    firstString(source, [
      "deliveryAddress",
      "customerAddress",
      "address",
    ]);

  return {
    label,
    line1:
      firstString(rawAddress, ["line1", "street", "address"]) ||
      label,
    line2: firstString(rawAddress, ["line2", "complement"]) || undefined,
    city:
      firstString(rawAddress, ["city", "ville"]) ||
      firstString(source, ["city", "ville"]),
    postalCode:
      firstString(rawAddress, ["postalCode", "postcode", "zip"]) ||
      undefined,
    countryCode:
      firstString(rawAddress, ["countryCode", "country"], "BE")
        .toUpperCase()
        .slice(0, 2),
    instructions:
      firstString(source, [
        "deliveryInstructions",
        "instructions",
      ]) || undefined,
    evidence: evidence(now),
  };
}

function normalizeItems(
  source: LegacyOrderRecord,
  currency: string,
): CanonicalOrderItem[] {
  const rawItems = Array.isArray(source.items)
    ? source.items
    : source.item
      ? [source.item]
      : [];

  return rawItems.map((rawItem, index) => {
    const item = asRecord(rawItem);
    const quantity = Math.max(
      1,
      Math.round(firstNumber(item, ["quantity", "qty"], 1)),
    );
    const unitPriceMajor = firstNumber(
      item,
      ["unitPrice", "price", "amount"],
      0,
    );

    return {
      id: firstString(item, ["id", "sku"], `legacy-item-${index + 1}`),
      sku: firstString(item, ["sku"]) || undefined,
      name: firstString(item, ["name", "title", "label"], "Article"),
      quantity,
      unitPrice: moneyFromMajor(unitPriceMajor, currency),
      lineTotal: moneyFromMajor(unitPriceMajor * quantity, currency),
      options: [],
      extras: [],
      customerNote:
        firstString(item, ["customerNote", "note", "notes"]) ||
        undefined,
      allergens: [],
      preparationState: "queued",
    };
  });
}

function normalizeTimeline(
  source: LegacyOrderRecord,
  status: OrderBusinessStatus,
  now: ISODateTime,
): CanonicalOrderTimelineEvent[] {
  if (Array.isArray(source.timeline)) {
    return source.timeline.map((rawEvent, index) => {
      const event = asRecord(rawEvent);

      return {
        id: firstString(event, ["id"], `legacy-event-${index + 1}`),
        status: normalizeBusinessStatus(event.status ?? event.key),
        label: firstString(
          event,
          ["label", "title", "note"],
          "Mise à jour commande",
        ),
        note: firstString(event, ["note", "description"]) || undefined,
        actor: "platform",
        at: firstString(event, ["at", "createdAt"], now),
        sourceEventId:
          firstString(event, ["sourceEventId"]) || undefined,
        immutable: true,
      };
    });
  }

  return [
    {
      id: "legacy-current-status",
      status,
      label: "État importé depuis le contrat historique",
      actor: "platform",
      at: now,
      immutable: true,
    },
  ];
}

export function normalizeLegacyOrder(
  input: unknown,
  now: ISODateTime = new Date().toISOString(),
): CanonicalOrderTruth {
  const source = asRecord(input);
  const publicId = firstString(
    source,
    ["publicId", "orderId", "id"],
    "UNKNOWN",
  );
  const internalId = firstString(
    source,
    ["id", "orderId", "publicId"],
    publicId,
  );
  const currency = firstString(source, ["currency"], "EUR");
  const status = normalizeBusinessStatus(source.status);
  const totalMajor = firstNumber(
    source,
    ["total", "amount", "totalAmount"],
    0,
  );
  const subtotalMajor = firstNumber(
    source,
    ["subtotal"],
    totalMajor,
  );
  const deliveryFeeMajor = firstNumber(
    source,
    ["deliveryFee"],
    0,
  );
  const serviceFeeMajor = firstNumber(
    source,
    ["serviceFee"],
    0,
  );
  const createdAt = firstString(source, ["createdAt"], now);
  const updatedAt = firstString(source, ["updatedAt"], createdAt);

  return {
    schemaVersion: CANONICAL_ORDER_SCHEMA_VERSION,

    identity: {
      id: internalId,
      publicId,
      correlationId: firstString(
        source,
        ["correlationId"],
        `legacy:${publicId}`,
      ),
    },

    restaurant: {
      id: firstString(
        source,
        ["restaurantId", "merchantId"],
        "legacy-restaurant",
      ),
      name: firstString(
        source,
        ["restaurantName", "restaurant"],
        "Restaurant",
      ),
      phone:
        firstString(source, ["restaurantPhone"]) || undefined,
    },

    customer: {
      id: firstString(source, ["customerId", "clientId"]) || undefined,
      name: firstString(
        source,
        ["customerName", "clientName", "customer", "client"],
        "Client",
      ),
      phone: firstString(
        source,
        ["customerPhone", "phone"],
      ),
      email:
        firstString(source, ["customerEmail", "email"]) || undefined,
    },

    delivery: {
      address: normalizeAddress(source, now),
      recipientName:
        firstString(source, ["recipientName"]) || undefined,
      recipientPhone:
        firstString(source, ["recipientPhone"]) || undefined,
      instructions:
        firstString(source, [
          "deliveryInstructions",
          "instructions",
        ]) || undefined,
      contactless:
        typeof source.contactless === "boolean"
          ? source.contactless
          : undefined,
    },

    items: normalizeItems(source, currency),

    notes: {
      customer:
        firstString(source, [
          "customerNote",
          "orderNote",
          "note",
          "notes",
        ]) || undefined,
      delivery:
        firstString(source, [
          "deliveryInstructions",
          "instructions",
        ]) || undefined,
    },

    safety: {
      allergenFlags: [],
      dietaryTags: [],
      requiresMerchantAcknowledgement: false,
    },

    pricing: {
      subtotal: moneyFromMajor(subtotalMajor, currency),
      deliveryFee: moneyFromMajor(deliveryFeeMajor, currency),
      serviceFee: moneyFromMajor(serviceFeeMajor, currency),
      tax: moneyFromMajor(firstNumber(source, ["tax"], 0), currency),
      discount: moneyFromMajor(
        firstNumber(source, ["discount"], 0),
        currency,
      ),
      total: moneyFromMajor(totalMajor, currency),
    },

    status: {
      business: status,
      payment: normalizePaymentStatus(source.paymentStatus),
      kitchenReadiness:
        status === "preparing"
          ? "in_progress"
          : status === "ready" ||
              status === "picked_up" ||
              status === "delivered"
            ? "ready"
            : "not_started",
      deliveryReadiness:
        status === "ready"
          ? "awaiting_courier"
          : status === "picked_up"
            ? "picked_up"
            : status === "delivered"
              ? "delivered"
              : "not_ready",
    },

    timeline: normalizeTimeline(source, status, now),

    verification: {
      customerIdentity: "unverified",
      phone: "unverified",
      address: "unverified",
      pricing: "unverified",
    },

    visibility: {
      client: ["identity", "restaurant", "delivery", "items", "pricing", "status", "timeline"],
      merchant: ["identity", "customer", "delivery", "items", "notes", "safety", "pricing", "status", "timeline"],
      courier: ["identity", "restaurant", "customer.name", "delivery", "status", "assignment"],
      platform: ["*"],
    },

    timestamps: {
      createdAt,
      updatedAt,
      acceptedAt:
        firstString(source, ["acceptedAt"]) || undefined,
      readyAt: firstString(source, ["readyAt"]) || undefined,
      pickedUpAt:
        firstString(source, ["pickedUpAt", "picked_up_at"]) ||
        undefined,
      deliveredAt:
        firstString(source, ["deliveredAt"]) || undefined,
      cancelledAt:
        firstString(source, ["cancelledAt", "canceledAt"]) ||
        undefined,
    },
  };
}
