/**
 * DA_P3D3B_ISOLATED_API_CANONICAL_ADAPTER_RUNTIME_V2_V1
 *
 * Converts the current orders/demo API record into CanonicalOrderTruth.
 * This file is isolated from the API runtime until P3D3C.
 */

import {
  CANONICAL_ORDER_SCHEMA_VERSION,
  type CanonicalAddress,
  type CanonicalAllergenFlag,
  type CanonicalDataEvidence,
  type CanonicalMoney,
  type CanonicalOrderItem,
  type CanonicalOrderTimelineEvent,
  type CanonicalOrderTruth,
  type ISODateTime,
  type OrderBusinessStatus,
  type OrderPaymentStatus,
  type VerificationState,
} from "./order";

export type ApiLegacyOrderRecord = Record<string, unknown>;

export interface CanonicalAdapterDiagnostics {
  source: "orders_demo_legacy";
  schemaVersion: typeof CANONICAL_ORDER_SCHEMA_VERSION;
  sourceIdentity: string;
  warnings: string[];
  mappedFields: string[];
}

export interface CanonicalAdapterResult {
  canonical: CanonicalOrderTruth;
  diagnostics: CanonicalAdapterDiagnostics;
}

const BUSINESS_STATUSES = new Set<OrderBusinessStatus>([
  "pending",
  "accepted",
  "preparing",
  "ready",
  "picked_up",
  "delivered",
  "cancelled",
]);

function asRecord(value: unknown): ApiLegacyOrderRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as ApiLegacyOrderRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function firstString(
  source: ApiLegacyOrderRecord,
  keys: readonly string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = source[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return fallback;
}

function firstFiniteNumber(
  source: ApiLegacyOrderRecord,
  keys: readonly string[],
): number | undefined {
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

  return undefined;
}

function normalizeCurrency(value: unknown): string {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : "";

  return /^[A-Z]{3}$/.test(normalized) ? normalized : "EUR";
}

function moneyMinor(
  amountMinor: number | undefined,
  currency: string,
): CanonicalMoney {
  return {
    amountMinor:
      amountMinor === undefined || !Number.isFinite(amountMinor)
        ? 0
        : Math.round(amountMinor),
    currency,
  };
}

function inferMinorAmount(
  source: ApiLegacyOrderRecord,
  minorKeys: readonly string[],
  majorKeys: readonly string[],
): number {
  const explicitMinor = firstFiniteNumber(source, minorKeys);

  if (explicitMinor !== undefined) {
    return Math.round(explicitMinor);
  }

  const major = firstFiniteNumber(source, majorKeys);

  return major === undefined ? 0 : Math.round(major * 100);
}

function normalizeBusinessStatus(value: unknown): OrderBusinessStatus {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";

  if (normalized === "confirmed") return "accepted";
  if (normalized === "completed") return "delivered";
  if (normalized === "canceled") return "cancelled";

  return BUSINESS_STATUSES.has(normalized as OrderBusinessStatus)
    ? (normalized as OrderBusinessStatus)
    : "pending";
}

function normalizePaymentStatus(value: unknown): OrderPaymentStatus {
  const normalized =
    typeof value === "string" ? value.trim().toLowerCase() : "";

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

function evidence(
  now: ISODateTime,
  verification: VerificationState,
  sourceId?: string,
): CanonicalDataEvidence {
  return {
    source: "platform",
    verification,
    recordedAt: now,
    sourceId,
  };
}

function splitAddressLabel(label: string): {
  line1: string;
  city: string;
} {
  const chunks = label
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (chunks.length < 2) {
    return {
      line1: label,
      city: "",
    };
  }

  return {
    line1: chunks.slice(0, -1).join(", "),
    city: chunks[chunks.length - 1] ?? "",
  };
}

function normalizeAddress(
  source: ApiLegacyOrderRecord,
  customer: ApiLegacyOrderRecord,
  now: ISODateTime,
  sourceId: string,
): CanonicalAddress {
  const rawAddress = asRecord(
    source.deliveryAddress ??
      source.customerAddress ??
      source.address ??
      customer.address,
  );

  const scalarLabel =
    firstString(source, [
      "deliveryAddress",
      "customerAddress",
      "address",
    ]) || firstString(customer, ["address"]);

  const label =
    firstString(rawAddress, [
      "label",
      "formattedAddress",
      "address",
      "line1",
    ]) || scalarLabel;

  const split = splitAddressLabel(label);

  const city =
    firstString(rawAddress, ["city", "ville"]) ||
    firstString(customer, ["city", "ville"]) ||
    firstString(source, ["city", "ville"]) ||
    split.city;

  const latitude = firstFiniteNumber(rawAddress, [
    "latitude",
    "lat",
  ]);
  const longitude = firstFiniteNumber(rawAddress, [
    "longitude",
    "lng",
    "lon",
  ]);
  const placeId = firstString(rawAddress, ["placeId", "place_id"]);
  const hasVerifiedGeo =
    latitude !== undefined &&
    longitude !== undefined &&
    Boolean(placeId);

  return {
    label,
    line1:
      firstString(rawAddress, ["line1", "street", "address"]) ||
      split.line1 ||
      label,
    line2:
      firstString(rawAddress, [
        "line2",
        "complement",
        "addressComplement",
      ]) || undefined,
    city,
    postalCode:
      firstString(rawAddress, [
        "postalCode",
        "postcode",
        "zip",
      ]) || undefined,
    countryCode:
      firstString(
        rawAddress,
        ["countryCode", "country"],
        "BE",
      )
        .toUpperCase()
        .slice(0, 2),
    geo:
      latitude !== undefined && longitude !== undefined
        ? {
            latitude,
            longitude,
            placeId: placeId || undefined,
            provider: placeId ? "google" : "manual",
            evidence: evidence(
              now,
              hasVerifiedGeo
                ? "provider_verified"
                : "client_declared",
              sourceId,
            ),
          }
        : undefined,
    accessCode:
      firstString(rawAddress, ["accessCode", "doorCode"]) ||
      undefined,
    floor: firstString(rawAddress, ["floor"]) || undefined,
    instructions:
      firstString(source, [
        "deliveryInstructions",
        "instructions",
      ]) ||
      firstString(customer, ["instructions"]) ||
      undefined,
    evidence: evidence(
      now,
      hasVerifiedGeo ? "provider_verified" : "client_declared",
      sourceId,
    ),
  };
}

function normalizeAllergens(
  value: unknown,
): CanonicalAllergenFlag[] {
  return asArray(value).flatMap((raw, index) => {
    if (typeof raw === "string" && raw.trim()) {
      return [
        {
          code: raw.trim().toLowerCase().replace(/\s+/g, "_"),
          label: raw.trim(),
          severity: "warning" as const,
          source: "client" as const,
        },
      ];
    }

    const record = asRecord(raw);
    const label = firstString(record, ["label", "name", "code"]);

    if (!label) return [];

    const rawSeverity = firstString(record, ["severity"]);
    const severity =
      rawSeverity === "critical" ||
      rawSeverity === "warning" ||
      rawSeverity === "info"
        ? rawSeverity
        : "warning";

    return [
      {
        code:
          firstString(record, ["code"]) ||
          `allergen_${index + 1}`,
        label,
        severity,
        source: "client" as const,
      },
    ];
  });
}

function normalizeItems(
  source: ApiLegacyOrderRecord,
  currency: string,
): CanonicalOrderItem[] {
  const rawItems = asArray(source.items);

  return rawItems.map((rawItem, index) => {
    const item = asRecord(rawItem);
    const quantity = Math.max(
      1,
      Math.round(
        firstFiniteNumber(item, ["quantity", "qty"]) ?? 1,
      ),
    );

    const unitAmountMinor = inferMinorAmount(
      item,
      ["unitAmountMinor", "amountMinor"],
      ["unitPrice", "price"],
    );

    const explicitAmount = firstFiniteNumber(item, ["amount"]);
    const lineAmountMinor =
      explicitAmount !== undefined
        ? Math.round(explicitAmount)
        : unitAmountMinor * quantity;

    const options = asArray(
      item.options ?? item.variants ?? item.modifiers,
    ).map((rawOption, optionIndex) => {
      const option = asRecord(rawOption);

      return {
        id:
          firstString(option, ["id", "code"]) ||
          `option-${index + 1}-${optionIndex + 1}`,
        label: firstString(
          option,
          ["label", "name"],
          "Option",
        ),
        value: firstString(
          option,
          ["value", "selection", "name"],
          "Sélection",
        ),
        priceDelta: moneyMinor(
          inferMinorAmount(
            option,
            ["amountMinor", "priceDeltaMinor"],
            ["price", "priceDelta"],
          ),
          currency,
        ),
      };
    });

    const extras = asArray(
      item.extras ?? item.supplements,
    ).map((rawExtra, extraIndex) => {
      const extra = asRecord(rawExtra);
      const extraQuantity = Math.max(
        1,
        Math.round(
          firstFiniteNumber(extra, ["quantity", "qty"]) ?? 1,
        ),
      );
      const extraUnitMinor = inferMinorAmount(
        extra,
        ["unitAmountMinor", "amountMinor"],
        ["unitPrice", "price"],
      );

      return {
        id:
          firstString(extra, ["id", "code"]) ||
          `extra-${index + 1}-${extraIndex + 1}`,
        name: firstString(
          extra,
          ["name", "label"],
          "Supplément",
        ),
        quantity: extraQuantity,
        unitPrice: moneyMinor(extraUnitMinor, currency),
        lineTotal: moneyMinor(
          extraUnitMinor * extraQuantity,
          currency,
        ),
      };
    });

    return {
      id:
        firstString(item, ["id", "sku"]) ||
        `api-item-${index + 1}`,
      sku: firstString(item, ["sku"]) || undefined,
      name: firstString(
        item,
        ["name", "title", "label"],
        "Article",
      ),
      quantity,
      unitPrice: moneyMinor(unitAmountMinor, currency),
      lineTotal: moneyMinor(lineAmountMinor, currency),
      options,
      extras,
      customerNote:
        firstString(item, [
          "customerNote",
          "note",
          "notes",
          "instructions",
        ]) || undefined,
      allergens: normalizeAllergens(
        item.allergens ?? item.allergenFlags,
      ),
      preparationState: "queued",
    };
  });
}

function normalizeTimeline(
  source: ApiLegacyOrderRecord,
  status: OrderBusinessStatus,
  now: ISODateTime,
): CanonicalOrderTimelineEvent[] {
  const rawTimeline = asArray(source.timeline);

  if (!rawTimeline.length) {
    return [
      {
        id: `legacy-status-${status}`,
        status,
        label: "État importé depuis orders/demo",
        actor: "platform",
        at: now,
        immutable: true,
      },
    ];
  }

  return rawTimeline.map((rawEvent, index) => {
    const event = asRecord(rawEvent);
    const eventStatus = normalizeBusinessStatus(
      event.status ?? event.key,
    );

    return {
      id:
        firstString(event, ["id", "eventId"]) ||
        `legacy-event-${index + 1}`,
      status: eventStatus,
      label: firstString(
        event,
        ["label", "title", "note"],
        eventStatus,
      ),
      note:
        firstString(event, ["note", "description"]) || undefined,
      actor:
        firstString(event, ["actor"]) === "merchant"
          ? "merchant"
          : firstString(event, ["actor"]) === "courier"
            ? "courier"
            : firstString(event, ["actor"]) === "client"
              ? "client"
              : "platform",
      at: firstString(
        event,
        ["at", "changedAt", "createdAt"],
        now,
      ),
      sourceEventId:
        firstString(event, ["sourceEventId", "eventId"]) ||
        undefined,
      immutable: true,
    };
  });
}

export function adaptOrdersDemoRecordToCanonical(
  input: unknown,
  now: ISODateTime = new Date().toISOString(),
): CanonicalAdapterResult {
  const source = asRecord(input);
  const customer = asRecord(source.customer ?? source.client);
  const payment = asRecord(source.payment);
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
  const sourceIdentity =
    firstString(source, ["source"]) || "orders_demo";
  const currency = normalizeCurrency(source.currency);
  const status = normalizeBusinessStatus(source.status);
  const items = normalizeItems(source, currency);

  const subtotalMinor = inferMinorAmount(
    source,
    ["subtotalMinor", "subtotal"],
    [],
  );
  const deliveryFeeMinor = inferMinorAmount(
    source,
    ["deliveryFeeMinor", "deliveryFee"],
    [],
  );
  const serviceFeeMinor = inferMinorAmount(
    source,
    ["serviceFeeMinor", "serviceFee"],
    [],
  );
  const taxMinor = inferMinorAmount(
    source,
    ["taxMinor", "tax"],
    [],
  );
  const discountMinor = inferMinorAmount(
    source,
    ["discountMinor", "discount"],
    [],
  );
  const totalMinor = inferMinorAmount(
    source,
    ["totalMinor", "total", "amount"],
    [],
  );

  const createdAt = firstString(source, ["createdAt"], now);
  const updatedAt = firstString(
    source,
    ["updatedAt"],
    createdAt,
  );

  const itemAllergens = items.flatMap((item) => item.allergens);
  const sourceAllergens = normalizeAllergens(
    source.allergens ?? source.allergenFlags,
  );
  const allergenFlags = [...itemAllergens, ...sourceAllergens];
  const warnings: string[] = [];
  const mappedFields: string[] = [
    "identity",
    "restaurant",
    "customer",
    "delivery",
    "items",
    "pricing",
    "status",
    "timeline",
    "timestamps",
  ];

  const address = normalizeAddress(
    source,
    customer,
    now,
    sourceIdentity,
  );

  if (!address.geo) {
    warnings.push("delivery_address_not_geocoded");
  }

  if (!items.length) {
    warnings.push("items_missing");
  }

  if (!firstString(source, ["customerPhone", "phone"]) &&
      !firstString(customer, ["phone"])) {
    warnings.push("customer_phone_missing");
  }

  if (totalMinor === 0 && items.length) {
    warnings.push("pricing_total_zero");
  }

  const canonical: CanonicalOrderTruth = {
    schemaVersion: CANONICAL_ORDER_SCHEMA_VERSION,

    identity: {
      id: internalId,
      publicId,
      correlationId: firstString(
        source,
        ["correlationId"],
        `orders-demo:${publicId}`,
      ),
    },

    restaurant: {
      id: firstString(
        source,
        ["restaurantId", "partnerSlug", "merchantSlug"],
        "unknown-restaurant",
      ),
      name: firstString(
        source,
        ["restaurantName", "merchantName", "restaurant"],
        "Restaurant",
      ),
      phone:
        firstString(source, ["restaurantPhone"]) || undefined,
    },

    customer: {
      id:
        firstString(
          customer,
          ["id"],
          firstString(source, ["clientId", "customerId"]),
        ) || undefined,
      name:
        firstString(customer, ["name"]) ||
        firstString(
          source,
          ["customerName", "clientName", "customer", "client"],
          "Client",
        ),
      phone:
        firstString(customer, ["phone"]) ||
        firstString(source, ["customerPhone", "phone"]),
      email:
        firstString(customer, ["email"]) ||
        firstString(source, ["customerEmail", "email"]) ||
        undefined,
    },

    delivery: {
      address,
      recipientName:
        firstString(source, ["recipientName"]) || undefined,
      recipientPhone:
        firstString(source, ["recipientPhone"]) || undefined,
      instructions:
        firstString(source, [
          "deliveryInstructions",
          "instructions",
        ]) ||
        firstString(customer, ["instructions"]) ||
        undefined,
      contactless:
        typeof source.contactless === "boolean"
          ? source.contactless
          : undefined,
    },

    items,

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
        ]) ||
        firstString(customer, ["instructions"]) ||
        undefined,
    },

    safety: {
      allergenFlags,
      dietaryTags: asArray(source.dietaryTags)
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean),
      requiresMerchantAcknowledgement: allergenFlags.some(
        (flag) =>
          flag.severity === "warning" ||
          flag.severity === "critical",
      ),
    },

    pricing: {
      subtotal: moneyMinor(subtotalMinor, currency),
      deliveryFee: moneyMinor(deliveryFeeMinor, currency),
      serviceFee: moneyMinor(serviceFeeMinor, currency),
      tax: moneyMinor(taxMinor, currency),
      discount: moneyMinor(discountMinor, currency),
      total: moneyMinor(totalMinor, currency),
    },

    status: {
      business: status,
      payment: normalizePaymentStatus(
        payment.status ?? source.paymentStatus,
      ),
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

    assignment:
      source.assignmentProposal || source.courierId
        ? {
            courierId:
              firstString(source, ["courierId"]) || undefined,
            assignedAt:
              firstString(source, ["assignedAt"]) || undefined,
            pickedUpAt:
              firstString(source, [
                "pickedUpAt",
                "picked_up_at",
              ]) || undefined,
            deliveredAt:
              firstString(source, ["deliveredAt"]) || undefined,
          }
        : undefined,

    timeline: normalizeTimeline(source, status, now),

    verification: {
      customerIdentity: "client_declared",
      phone:
        firstString(customer, ["phone"]) ||
        firstString(source, ["customerPhone", "phone"])
          ? "client_declared"
          : "unverified",
      address: address.geo
        ? address.geo.evidence.verification
        : "client_declared",
      pricing:
        payment.status === "paid"
          ? "server_verified"
          : "unverified",
    },

    visibility: {
      client: [
        "identity",
        "restaurant",
        "delivery",
        "items",
        "pricing",
        "status",
        "timeline",
      ],
      merchant: [
        "identity",
        "customer",
        "delivery",
        "items",
        "notes",
        "safety",
        "pricing",
        "status",
        "timeline",
      ],
      courier: [
        "identity",
        "restaurant",
        "customer.name",
        "customer.phone",
        "delivery",
        "status",
        "assignment",
      ],
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

  return {
    canonical,
    diagnostics: {
      source: "orders_demo_legacy",
      schemaVersion: CANONICAL_ORDER_SCHEMA_VERSION,
      sourceIdentity,
      warnings,
      mappedFields,
    },
  };
}

export function adaptOrdersDemoListToCanonical(
  input: unknown,
  now: ISODateTime = new Date().toISOString(),
): CanonicalAdapterResult[] {
  const payload = asRecord(input);
  const records =
    Array.isArray(input)
      ? input
      : asArray(
          payload.orders ??
            payload.items ??
            payload.data ??
            payload.results,
        );

  return records.map((record) =>
    adaptOrdersDemoRecordToCanonical(record, now),
  );
}
