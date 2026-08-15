/**
 * DA_P3D2_SHARED_CANONICAL_ORDER_CONTRACT_FOUNDATION_RUNTIME_V2_V1B
 *
 * Additive canonical contract.
 * No application or API consumes it until a dedicated migration phase.
 */

export const CANONICAL_ORDER_SCHEMA_VERSION = 1 as const;

export type ISODateTime = string;
export type MoneyMinor = number;

export type VerificationState =
  | "unverified"
  | "client_declared"
  | "provider_verified"
  | "server_verified"
  | "operator_verified";

export type DataSourceActor =
  | "client"
  | "merchant"
  | "courier"
  | "platform"
  | "payment_provider"
  | "mapping_provider";

export type OrderBusinessStatus =
  | "pending"
  | "accepted"
  | "preparing"
  | "ready"
  | "picked_up"
  | "delivered"
  | "cancelled";

export type OrderPaymentStatus =
  | "unpaid"
  | "pending"
  | "authorized"
  | "paid"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type KitchenReadiness =
  | "not_started"
  | "in_progress"
  | "ready"
  | "blocked";

export type DeliveryReadiness =
  | "not_ready"
  | "awaiting_courier"
  | "courier_assigned"
  | "picked_up"
  | "delivered";

export type AllergenSeverity = "info" | "warning" | "critical";

export interface CanonicalMoney {
  amountMinor: MoneyMinor;
  currency: string;
}

export interface CanonicalDataEvidence {
  source: DataSourceActor;
  verification: VerificationState;
  recordedAt: ISODateTime;
  sourceId?: string;
}

export interface CanonicalGeoPoint {
  latitude: number;
  longitude: number;
  evidence: CanonicalDataEvidence;
  provider?: "google" | "apple" | "mapbox" | "manual";
  placeId?: string;
  accuracyMeters?: number;
}

export interface CanonicalAddress {
  label: string;
  line1: string;
  line2?: string;
  city: string;
  postalCode?: string;
  countryCode: string;
  geo?: CanonicalGeoPoint;
  accessCode?: string;
  floor?: string;
  instructions?: string;
  evidence: CanonicalDataEvidence;
}

export interface CanonicalOrderItemOption {
  id: string;
  label: string;
  value: string;
  priceDelta: CanonicalMoney;
}

export interface CanonicalOrderItemExtra {
  id: string;
  name: string;
  quantity: number;
  unitPrice: CanonicalMoney;
  lineTotal: CanonicalMoney;
}

export interface CanonicalAllergenFlag {
  code: string;
  label: string;
  severity: AllergenSeverity;
  source: "menu" | "client" | "merchant";
  acknowledgedByMerchantAt?: ISODateTime;
  acknowledgedByMerchantId?: string;
}

export interface CanonicalOrderItem {
  id: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: CanonicalMoney;
  lineTotal: CanonicalMoney;
  options: CanonicalOrderItemOption[];
  extras: CanonicalOrderItemExtra[];
  customerNote?: string;
  allergens: CanonicalAllergenFlag[];
  preparationState: "queued" | "preparing" | "ready" | "unavailable";
}

export interface CanonicalOrderTimelineEvent {
  id: string;
  status: OrderBusinessStatus;
  label: string;
  note?: string;
  actor: DataSourceActor;
  at: ISODateTime;
  sourceEventId?: string;
  immutable: true;
}

export interface CanonicalRoleVisibility {
  client: readonly string[];
  merchant: readonly string[];
  courier: readonly string[];
  platform: readonly string[];
}

export interface CanonicalOrderTruth {
  schemaVersion: typeof CANONICAL_ORDER_SCHEMA_VERSION;

  identity: {
    id: string;
    publicId: string;
    correlationId: string;
  };

  restaurant: {
    id: string;
    name: string;
    phone?: string;
    address?: CanonicalAddress;
  };

  customer: {
    id?: string;
    name: string;
    phone: string;
    email?: string;
  };

  delivery: {
    address: CanonicalAddress;
    recipientName?: string;
    recipientPhone?: string;
    instructions?: string;
    contactless?: boolean;
  };

  items: CanonicalOrderItem[];

  notes: {
    customer?: string;
    delivery?: string;
    merchantInternal?: string;
  };

  safety: {
    allergenFlags: CanonicalAllergenFlag[];
    dietaryTags: string[];
    requiresMerchantAcknowledgement: boolean;
  };

  pricing: {
    subtotal: CanonicalMoney;
    deliveryFee: CanonicalMoney;
    serviceFee: CanonicalMoney;
    tax: CanonicalMoney;
    discount: CanonicalMoney;
    total: CanonicalMoney;
    integrityHash?: string;
  };

  status: {
    business: OrderBusinessStatus;
    payment: OrderPaymentStatus;
    kitchenReadiness: KitchenReadiness;
    deliveryReadiness: DeliveryReadiness;
  };

  assignment?: {
    courierId?: string;
    assignedAt?: ISODateTime;
    pickedUpAt?: ISODateTime;
    deliveredAt?: ISODateTime;
  };

  timeline: CanonicalOrderTimelineEvent[];

  verification: {
    customerIdentity: VerificationState;
    phone: VerificationState;
    address: VerificationState;
    pricing: VerificationState;
  };

  visibility: CanonicalRoleVisibility;

  timestamps: {
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
    acceptedAt?: ISODateTime;
    readyAt?: ISODateTime;
    pickedUpAt?: ISODateTime;
    deliveredAt?: ISODateTime;
    cancelledAt?: ISODateTime;
  };
}

export function isCanonicalMoney(value: unknown): value is CanonicalMoney {
  if (!value || typeof value !== "object") return false;

  const money = value as Partial<CanonicalMoney>;

  return (
    Number.isInteger(money.amountMinor) &&
    typeof money.currency === "string" &&
    money.currency.trim().length === 3
  );
}

export function isCanonicalOrderTruth(
  value: unknown,
): value is CanonicalOrderTruth {
  if (!value || typeof value !== "object") return false;

  const order = value as Partial<CanonicalOrderTruth>;

  return (
    order.schemaVersion === CANONICAL_ORDER_SCHEMA_VERSION &&
    typeof order.identity?.id === "string" &&
    typeof order.identity?.publicId === "string" &&
    typeof order.identity?.correlationId === "string" &&
    typeof order.restaurant?.id === "string" &&
    typeof order.restaurant?.name === "string" &&
    typeof order.customer?.name === "string" &&
    typeof order.customer?.phone === "string" &&
    Array.isArray(order.items) &&
    Array.isArray(order.timeline) &&
    isCanonicalMoney(order.pricing?.total)
  );
}

export function assertCanonicalOrderTruth(
  value: unknown,
): asserts value is CanonicalOrderTruth {
  if (!isCanonicalOrderTruth(value)) {
    throw new TypeError("Invalid DelishAfrica CanonicalOrderTruth payload.");
  }
}
