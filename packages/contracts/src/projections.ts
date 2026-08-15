import type {
  CanonicalAllergenFlag,
  CanonicalMoney,
  CanonicalOrderItem,
  CanonicalOrderTimelineEvent,
  CanonicalOrderTruth,
} from "./order";

export interface ClientOrderProjection {
  identity: CanonicalOrderTruth["identity"];
  restaurant: CanonicalOrderTruth["restaurant"];
  delivery: CanonicalOrderTruth["delivery"];
  items: CanonicalOrderItem[];
  pricing: CanonicalOrderTruth["pricing"];
  status: CanonicalOrderTruth["status"];
  timeline: CanonicalOrderTimelineEvent[];
  timestamps: CanonicalOrderTruth["timestamps"];
}

export interface MerchantOrderProjection {
  identity: CanonicalOrderTruth["identity"];
  customer: CanonicalOrderTruth["customer"];
  delivery: CanonicalOrderTruth["delivery"];
  items: CanonicalOrderItem[];
  notes: CanonicalOrderTruth["notes"];
  safety: {
    allergenFlags: CanonicalAllergenFlag[];
    dietaryTags: string[];
    requiresMerchantAcknowledgement: boolean;
  };
  pricing: CanonicalOrderTruth["pricing"];
  status: CanonicalOrderTruth["status"];
  timeline: CanonicalOrderTimelineEvent[];
  timestamps: CanonicalOrderTruth["timestamps"];
}

export interface CourierOrderProjection {
  identity: CanonicalOrderTruth["identity"];
  restaurant: Pick<
    CanonicalOrderTruth["restaurant"],
    "id" | "name" | "phone" | "address"
  >;
  customer: Pick<
    CanonicalOrderTruth["customer"],
    "name" | "phone"
  >;
  delivery: CanonicalOrderTruth["delivery"];
  status: CanonicalOrderTruth["status"];
  assignment: CanonicalOrderTruth["assignment"];
  timestamps: CanonicalOrderTruth["timestamps"];
}

export function projectOrderForClient(
  order: CanonicalOrderTruth,
): ClientOrderProjection {
  return {
    identity: order.identity,
    restaurant: order.restaurant,
    delivery: order.delivery,
    items: order.items,
    pricing: order.pricing,
    status: order.status,
    timeline: order.timeline,
    timestamps: order.timestamps,
  };
}

export function projectOrderForMerchant(
  order: CanonicalOrderTruth,
): MerchantOrderProjection {
  return {
    identity: order.identity,
    customer: order.customer,
    delivery: order.delivery,
    items: order.items,
    notes: order.notes,
    safety: order.safety,
    pricing: order.pricing,
    status: order.status,
    timeline: order.timeline,
    timestamps: order.timestamps,
  };
}

export function projectOrderForCourier(
  order: CanonicalOrderTruth,
): CourierOrderProjection {
  return {
    identity: order.identity,
    restaurant: order.restaurant,
    customer: {
      name: order.customer.name,
      phone: order.customer.phone,
    },
    delivery: order.delivery,
    status: order.status,
    assignment: order.assignment,
    timestamps: order.timestamps,
  };
}

export function moneyMajorValue(money: CanonicalMoney): number {
  return money.amountMinor / 100;
}
