/** DA_P3D3C_API_CANONICAL_LEGACY_INTERCEPTOR_RUNTIME_V2_V5F */

import type { CallHandler, ExecutionContext, NestInterceptor } from "@nestjs/common";
import { map } from "rxjs/operators";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function firstString(source: UnknownRecord, keys: readonly string[], fallback = ""): string {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function firstNumber(source: UnknownRecord, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(",", "."));
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function normalizeStatus(value: unknown): string {
  const status = typeof value === "string" ? value.trim().toLowerCase() : "pending";
  if (status === "confirmed") return "accepted";
  if (status === "completed") return "delivered";
  if (status === "canceled") return "cancelled";
  return status || "pending";
}

function adaptOrder(input: unknown): UnknownRecord {
  const source = asRecord(input) ?? {};
  const customer = asRecord(source.customer ?? source.client) ?? {};
  const payment = asRecord(source.payment) ?? {};
  const publicId = firstString(source, ["publicId", "orderId", "id"], "UNKNOWN");
  const currency = firstString(source, ["currency"], "EUR").toUpperCase().slice(0, 3);
  const status = normalizeStatus(source.status);
  const items = Array.isArray(source.items) ? source.items.map((raw, index) => {
    const item = asRecord(raw) ?? {};
    const quantity = Math.max(1, Math.round(firstNumber(item, ["quantity", "qty"]) ?? 1));
    const priceMajor = firstNumber(item, ["unitPrice", "price"]) ?? 0;
    const amountMinor = firstNumber(item, ["amount", "amountMinor"]) ?? Math.round(priceMajor * quantity * 100);
    return {
      id: firstString(item, ["id", "sku"], `item-${index + 1}`),
      name: firstString(item, ["name", "title", "label"], "Article"),
      quantity,
      unitPrice: { amountMinor: Math.round(priceMajor * 100), currency },
      lineTotal: { amountMinor: Math.round(amountMinor), currency },
      options: [],
      extras: [],
      allergens: [],
      preparationState: "queued",
    };
  }) : [];
  const totalMinor = firstNumber(source, ["totalMinor", "total", "amount"]) ?? 0;
  const label = firstString(source, ["deliveryAddress", "customerAddress", "address"]) || firstString(customer, ["address"]);
  const city = firstString(source, ["city"]) || firstString(customer, ["city"]) || label.split(",").slice(-1)[0]?.trim() || "";
  return {
    schemaVersion: 1,
    identity: {
      id: firstString(source, ["id", "orderId", "publicId"], publicId),
      publicId,
      correlationId: firstString(source, ["correlationId"], `orders-demo:${publicId}`),
    },
    restaurant: {
      id: firstString(source, ["restaurantId", "partnerSlug", "merchantSlug"], "unknown-restaurant"),
      name: firstString(source, ["restaurantName", "merchantName", "restaurant"], "Restaurant"),
    },
    customer: {
      id: firstString(customer, ["id"]) || firstString(source, ["clientId", "customerId"]) || undefined,
      name: firstString(customer, ["name"]) || firstString(source, ["customerName", "clientName"], "Client"),
      phone: firstString(customer, ["phone"]) || firstString(source, ["customerPhone", "phone"]),
      email: firstString(customer, ["email"]) || firstString(source, ["customerEmail", "email"]) || undefined,
    },
    delivery: {
      address: {
        label,
        line1: label.split(",")[0]?.trim() || label,
        city,
        countryCode: "BE",
        evidence: {
          source: "platform",
          verification: "client_declared",
          recordedAt: new Date().toISOString(),
        },
      },
      instructions: firstString(source, ["deliveryInstructions", "instructions"]) || firstString(customer, ["instructions"]) || undefined,
    },
    items,
    notes: {
      customer: firstString(source, ["customerNote", "orderNote", "note", "notes"]) || undefined,
      delivery: firstString(source, ["deliveryInstructions", "instructions"]) || firstString(customer, ["instructions"]) || undefined,
    },
    safety: {
      allergenFlags: [],
      dietaryTags: [],
      requiresMerchantAcknowledgement: false,
    },
    pricing: {
      subtotal: { amountMinor: Math.round(firstNumber(source, ["subtotalMinor", "subtotal"]) ?? totalMinor), currency },
      deliveryFee: { amountMinor: Math.round(firstNumber(source, ["deliveryFeeMinor", "deliveryFee"]) ?? 0), currency },
      serviceFee: { amountMinor: Math.round(firstNumber(source, ["serviceFeeMinor", "serviceFee"]) ?? 0), currency },
      tax: { amountMinor: Math.round(firstNumber(source, ["taxMinor", "tax"]) ?? 0), currency },
      discount: { amountMinor: Math.round(firstNumber(source, ["discountMinor", "discount"]) ?? 0), currency },
      total: { amountMinor: Math.round(totalMinor), currency },
    },
    status: {
      business: status,
      payment: firstString(payment, ["status"], firstString(source, ["paymentStatus"], "pending")),
      kitchenReadiness: ["ready", "picked_up", "delivered"].includes(status) ? "ready" : status === "preparing" ? "in_progress" : "not_started",
      deliveryReadiness: status === "delivered" ? "delivered" : status === "picked_up" ? "picked_up" : status === "ready" ? "awaiting_courier" : "not_ready",
    },
    timeline: Array.isArray(source.timeline) ? source.timeline : [],
    verification: {
      customerIdentity: "client_declared",
      phone: "client_declared",
      address: "client_declared",
      pricing: firstString(payment, ["status"]) === "paid" ? "server_verified" : "unverified",
    },
    visibility: {
      client: ["identity", "restaurant", "delivery", "items", "pricing", "status", "timeline"],
      merchant: ["identity", "customer", "delivery", "items", "notes", "safety", "pricing", "status", "timeline"],
      courier: ["identity", "restaurant", "customer.name", "customer.phone", "delivery", "status", "assignment"],
      platform: ["*"],
    },
    timestamps: {
      createdAt: firstString(source, ["createdAt"], new Date().toISOString()),
      updatedAt: firstString(source, ["updatedAt"], new Date().toISOString()),
      deliveredAt: firstString(source, ["deliveredAt"]) || undefined,
    },
  };
}

export function exposeCanonicalListResponse(legacyResponse: unknown): unknown {
  const record = asRecord(legacyResponse);
  if (!record) return legacyResponse;
  const source = Array.isArray(record.orders)
    ? record.orders
    : Array.isArray(record.items)
      ? record.items
      : Array.isArray(record.data)
        ? record.data
        : [];
  return {
    ...record,
    canonicalSchemaVersion: 1,
    canonicalOrders: source.map(adaptOrder),
  };
}

export function exposeCanonicalGetResponse(legacyResponse: unknown): unknown {
  const record = asRecord(legacyResponse);
  if (!record) return legacyResponse;
  const order = asRecord(record.order) ?? asRecord(record.data) ?? asRecord(record.item) ?? record;
  return {
    ...record,
    canonicalSchemaVersion: 1,
    canonical: adaptOrder(order),
  };
}

class CanonicalReadInterceptor implements NestInterceptor {
  constructor(private readonly mode: "list" | "get") {}

  intercept(_context: ExecutionContext, next: CallHandler) {
    return next.handle().pipe(
      map((value: unknown) =>
        this.mode === "list"
          ? exposeCanonicalListResponse(value)
          : exposeCanonicalGetResponse(value),
      ),
    );
  }
}

export const canonicalListInterceptor = new CanonicalReadInterceptor("list");
export const canonicalGetInterceptor = new CanonicalReadInterceptor("get");
