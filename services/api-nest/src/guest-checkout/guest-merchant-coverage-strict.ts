import type { CatalogPartner } from '../catalog-foundation/catalog-foundation.types';
import type { ServerCoveragePolicy } from './guest-canonical-checkout-stager';

/**
 * Guest Checkout P5-B: trusted, explicit merchant delivery footprint.
 * LAB ONLY. No public controller, no implicit Bruxelles-wide approval.
 *
 * A published catalogue entry does NOT authorize delivery by itself.
 * Only a versioned and explicitly approved zone can grant an order area.
 */
export type PublishedCatalogReader = {
  findPublishedBySlug(slug: string, staticFallback: CatalogPartner[]): Promise<CatalogPartner | null>;
};

type PlainObject = Record<string, unknown>;
type CoverageInput = Parameters<ServerCoveragePolicy['verifyCoverage']>[0];
type CoverageResult = Awaited<ReturnType<ServerCoveragePolicy['verifyCoverage']>>;

const CODE = /^[a-z][a-z0-9_-]{2,119}$/;
const POSTCODE = /^\d{4}$/;
const EARTH_RADIUS_M = 6371008.8;
const DENIED: CoverageResult = Object.freeze({ allowed: false, serviceAreaCode: 'not_approved' });

function object(value: unknown): PlainObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as PlainObject : null;
}

function finiteLatLong(latitude: unknown, longitude: unknown): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number' &&
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = Math.PI / 180;
  const latitudeDelta = (bLat - aLat) * rad;
  const longitudeDelta = (bLon - aLon) * rad;
  const h = Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(aLat * rad) * Math.cos(bLat * rad) *
    Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(Math.max(0, h))));
}

export class GuestMerchantCoverageStrict implements ServerCoveragePolicy {
  constructor(private readonly catalog: PublishedCatalogReader) {}

  async verifyCoverage(input: CoverageInput): Promise<CoverageResult> {
    if (!input || typeof input.partnerSlug !== 'string' ||
        !CODE.test(input.partnerSlug) || input.countryCode !== 'BE' ||
        typeof input.postalCode !== 'string' || !POSTCODE.test(input.postalCode) ||
        typeof input.placeId !== 'string' || !/^[A-Za-z0-9_-]{8,220}$/.test(input.placeId) ||
        !finiteLatLong(input.latitude, input.longitude)) return DENIED;

    // Empty fallback is intentional: never approve an unsigned local/demo card.
    const partner = await this.catalog.findPublishedBySlug(input.partnerSlug, []);
    if (!partner || partner.slug !== input.partnerSlug) return DENIED;
    const published = object(partner);
    if (published?.status !== 'active') return DENIED;
    const delivery = object(published.delivery);
    if (delivery?.enabled !== true) return DENIED;

    // A strict, opt-in contract. Existing "serviceAreaLabel" and deliveryFee
    // are marketing/price fields, NOT a verified geographic permission.
    const coverage = object(delivery.guestCheckoutCoverage);
    if (!coverage || coverage.version !== 1 ||
        coverage.enabled !== true ||
        coverage.approvedByMerchant !== true ||
        coverage.approvedByOps !== true ||
        !Array.isArray(coverage.zones) ||
        coverage.zones.length < 1 || coverage.zones.length > 50) return DENIED;

    for (const candidate of coverage.zones) {
      const zone = object(candidate);
      if (!zone || zone.enabled !== true ||
          typeof zone.code !== 'string' || !CODE.test(zone.code) ||
          zone.countryCode !== input.countryCode ||
          !Array.isArray(zone.postalCodes) ||
          zone.postalCodes.length < 1 || zone.postalCodes.length > 80 ||
          !zone.postalCodes.every((z) => typeof z === 'string' && POSTCODE.test(z)) ||
          !zone.postalCodes.includes(input.postalCode)) continue;
      const center = object(zone.center);
      if (!center || !finiteLatLong(center.latitude, center.longitude)) continue;
      const distance = zone.maxDistanceMeters;
      if (typeof distance !== 'number' || !Number.isFinite(distance) ||
          distance < 100 || distance > 25000) continue;
      const actual = metersBetween(
        center.latitude as number,
        center.longitude as number,
        input.latitude,
        input.longitude,
      );
      if (actual <= distance) return { allowed: true, serviceAreaCode: zone.code };
    }
    return DENIED;
  }
}
