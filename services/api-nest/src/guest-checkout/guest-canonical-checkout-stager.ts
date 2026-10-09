import type { CanonicalOrderQuote } from '../order-policy/catalog-order-policy.service';
import type { GuestCheckoutLedger } from './guest-checkout-ledger';
import type {
  GuestContactInput, GuestPrivateFulfillmentVault, TrustedDeliveryVerification,
} from './guest-private-fulfillment-vault';

/**
 * P5 laboratory only. No HTTP endpoint, no Stripe Intent and no dispatch.
 * Links authoritative catalog quote, server-resolved Google Place, a coverage
 * policy and the one canonical encrypted guest checkout vault.
 */
type Cart = Readonly<{
  partnerSlug: string;
  items: readonly { id: string; quantity: number }[];
  amount?: unknown; // ignored; mobile never sets the checkout price.
}>;
export type GuestStagingInput = Readonly<{
  cart: Cart;
  deliveryPlaceId: string;
  contact: GuestContactInput;
}>;
export type GooglePlace = {
  ok: boolean;
  status: 'confirmed' | 'review';
  address: {
    placeId: string; formattedAddress: string;
    latitude: number; longitude: number;
    precision: string; deliverable: boolean; evidence: string;
  };
  territory: { countryCode: string; postalCode: string; city: string };
};
export type ServerPlaceProvider = {
  resolve(input: {placeId: string}, requesterKey: string): Promise<GooglePlace>;
};
export type ServerQuoteProvider = {
  quote(input: Record<string, unknown>): Promise<CanonicalOrderQuote>;
};
export type ServerCoveragePolicy = {
  verifyCoverage(input: Readonly<{
    partnerSlug: string; countryCode: string; postalCode: string;
    latitude: number; longitude: number; placeId: string;
  }>): Promise<{allowed: boolean; serviceAreaCode: string}>;
};
export type GuestStagingSummary = {
  ok: true;
  orderId: string; amountCents: number; currency: 'eur';
  quoteFingerprint: string; partnerSlug: string; expiresAt: string;
  serviceAreaCode: string; alreadyPrepared: boolean;
  paymentAvailable: false;
};
const PLACE_ID=/^[A-Za-z0-9_-]{8,220}$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const POSTCODES=new Set([
  '1000','1020','1030','1040','1050','1060','1070','1080','1081',
  '1082','1083','1090','1120','1130','1140','1150','1160',
  '1170','1180','1190','1200','1210',
]);
function canonicalItems(items: unknown): {id: string; quantity: number}[] {
  if (!Array.isArray(items) || items.length === 0 || items.length > 40) {
    throw new Error('guest_p5_cart_invalid');
  }
  const visited=new Set<string>();
  return items.map((item) => {
    if (!item || typeof item !== 'object' ||
        typeof item.id !== 'string' ||
        !/^[A-Za-z0-9_.:-]{1,120}$/.test(item.id) ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 || item.quantity > 50 ||
        visited.has(item.id)) {
      throw new Error('guest_p5_cart_invalid');
    }
    visited.add(item.id);
    return {id:item.id,quantity:item.quantity};
  });
}

export class GuestCanonicalCheckoutStager {
  constructor(
    private readonly ledger: GuestCheckoutLedger,
    private readonly vault: GuestPrivateFulfillmentVault,
    private readonly catalog: ServerQuoteProvider,
    private readonly places: ServerPlaceProvider,
    private readonly coverage: ServerCoveragePolicy,
  ) {}

  async prepare(
    token: string,
    input: GuestStagingInput,
    requesterKey: string,
  ): Promise<GuestStagingSummary> {
    // Reject before any billable Google provider call.
    const active=await this.ledger.findForCapability(token);
    if (!active || (active.state !== 'issued' && active.state !== 'quoted')) {
      throw new Error('guest_p5_session_invalid');
    }
    if (!input || !input.cart ||
        typeof input.cart.partnerSlug !== 'string' ||
        !SLUG.test(input.cart.partnerSlug) ||
        typeof input.deliveryPlaceId !== 'string' ||
        !PLACE_ID.test(input.deliveryPlaceId)) {
      throw new Error('guest_p5_input_invalid');
    }
    const items=canonicalItems(input.cart.items);

    // Amount, currency, partner availability all come from server catalog.
    const quote=await this.catalog.quote({
      partnerSlug:input.cart.partnerSlug,items,
    });
    if (!quote || quote.partnerSlug !== input.cart.partnerSlug) {
      throw new Error('guest_p5_quote_partner_mismatch');
    }

    // Re-resolve the Place ID on our backend; do not use client-side
    // addressTruth as a delivery guarantee.
    const resolved=await this.places.resolve(
      {placeId:input.deliveryPlaceId},
      String(requesterKey || 'unknown').slice(0,128),
    );
    if (resolved?.ok !== true || resolved.status !== 'confirmed' ||
        resolved.address?.deliverable !== true ||
        resolved.address?.evidence !== 'google_places_new' ||
        resolved.address?.placeId !== input.deliveryPlaceId ||
        !['street_number','premise'].includes(resolved.address.precision) ||
        resolved.territory?.countryCode !== 'BE' ||
        !POSTCODES.has(resolved.territory.postalCode) ||
        !Number.isFinite(resolved.address.latitude) ||
        !Number.isFinite(resolved.address.longitude) ||
        !resolved.address.formattedAddress) {
      throw new Error('guest_p5_unconfirmed_or_uncovered_place');
    }

    // Merchant-specific coverage is a separate SERVER service.
    // A Google location in Brussels is not sufficient by itself.
    const allowed=await this.coverage.verifyCoverage({
      partnerSlug:quote.partnerSlug,
      countryCode:resolved.territory.countryCode,
      postalCode:resolved.territory.postalCode,
      latitude:resolved.address.latitude,
      longitude:resolved.address.longitude,
      placeId:resolved.address.placeId,
    });
    if (allowed?.allowed !== true ||
        !/^[a-z][a-z0-9_-]{2,119}$/.test(allowed.serviceAreaCode)) {
      throw new Error('guest_p5_merchant_service_area_denied');
    }

    // Only the GOOGLE provider address and city go into the encrypted record.
    const contact: GuestContactInput={
      ...input.contact,
      address:resolved.address.formattedAddress,
      city:resolved.territory.city,
    };
    const delivery: TrustedDeliveryVerification={
      verifiedByServer:true,eligible:true,
      serviceAreaCode:allowed.serviceAreaCode,
      locationProof: {
        placeId:resolved.address.placeId,
        countryCode:'BE',
        postalCode:resolved.territory.postalCode,
        latitude:resolved.address.latitude,
        longitude:resolved.address.longitude,
        source:'google_places_new',
      },
    };

    // Recoverable sequence: a crash between quote and sealing leaves state
    // QUOTED but cannot create a payment (P4 database trigger).
    const frozen=await this.ledger.attachVerifiedQuote(token,{
      amountCents:quote.total,
      currency:quote.currency,
      fingerprint:quote.quoteFingerprint,
    });
    const sealed=await this.vault.seal(token,quote,contact,delivery);
    return {
      ok:true,orderId:sealed.orderId,
      amountCents:quote.total,currency:'eur',
      quoteFingerprint:quote.quoteFingerprint,
      partnerSlug:quote.partnerSlug,
      expiresAt:frozen.expiresAt,
      serviceAreaCode:allowed.serviceAreaCode,
      alreadyPrepared:sealed.replay,
      paymentAvailable:false,
    };
  }
}
