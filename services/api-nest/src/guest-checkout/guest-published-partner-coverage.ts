import type { GuestSqlExecutor } from './guest-checkout-ledger';
import type { ServerCoveragePolicy } from './guest-canonical-checkout-stager';

/**
 * P5-B LAB — fail-closed delivery coverage.
 *
 * Only a published active partner with delivery enabled AND an OPS-approved
 * (unexpired, non-revoked) zone from PostgreSQL can serve this address.
 *
 * Client and Merchant apps MUST NOT have write access to the OPS zone ledger.
 * In this stage no HTTP controller or Ops write route is mounted.
 */
export type PublishedPartnerLookup = {
  findPublishedBySlug(
    slug: string,
    fallback: [],
  ): Promise<(Record<string, unknown> & {slug: string}) | null>;
};

type CoverageResultRow = {
  service_area_code: string;
  revision: number;
};

type CoverageInput = {
  partnerSlug: string;
  countryCode: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  placeId: string;
};

const PARTNER = /^[a-z0-9][a-z0-9_-]{1,119}$/;
const POSTCODE = /^\d{4}$/;
const PLACE = /^[A-Za-z0-9_-]{8,220}$/;
const AREA = /^[a-z][a-z0-9_-]{2,119}$/;

export class PublishedPartnerCoveragePolicy implements ServerCoveragePolicy {
  constructor(
    private readonly db: GuestSqlExecutor,
    private readonly published: PublishedPartnerLookup,
  ) {}

  private deny(): { allowed: false; serviceAreaCode: string } {
    return {allowed:false,serviceAreaCode:''};
  }

  async verifyCoverage(
    input: Readonly<CoverageInput>,
  ): Promise<{allowed:boolean;serviceAreaCode:string}> {
    // Country and coordinate limits: conservative Belgium pilot only.
    if (!input || typeof input.partnerSlug !== 'string' ||
        !PARTNER.test(input.partnerSlug) ||
        input.countryCode !== 'BE' ||
        !POSTCODE.test(input.postalCode) ||
        typeof input.placeId !== 'string' ||
        !PLACE.test(input.placeId) ||
        !Number.isFinite(input.latitude) ||
        !Number.isFinite(input.longitude) ||
        input.latitude < 49 || input.latitude > 52 ||
        input.longitude < 2 || input.longitude > 7) {
      return this.deny();
    }

    // No static fallback: published partner identity must come from the
    // canonical persisted catalog, and the merchant must explicitly deliver.
    const partner = await this.published.findPublishedBySlug(input.partnerSlug, []);
    if (!partner || partner.slug !== input.partnerSlug ||
        partner.status !== 'active') return this.deny();
    const delivery = partner.delivery;
    if (!delivery || typeof delivery !== 'object' || Array.isArray(delivery) ||
        (delivery as Record<string, unknown>).enabled !== true) {
      return this.deny();
    }

    // This lookup reads a separate OPS approval table. Expired, revoked,
    // pending or unsupported zones are not eligible. SQL parameters only.
    const found = await this.db.query<CoverageResultRow>(
      `SELECT service_area_code, revision
         FROM da_guest_merchant_coverage
        WHERE partner_slug = $1
          AND country_code = $2
          AND $3::text = ANY(postal_codes)
          AND approval_status = 'approved'
          AND approval_source = 'ops_review'
          AND approved_by IS NOT NULL
          AND approved_at <= now()
          AND expires_at > now()
          AND south_lat <= $4 AND north_lat >= $4
          AND west_lng <= $5 AND east_lng >= $5
        ORDER BY revision DESC
        LIMIT 1`,
      [input.partnerSlug, input.countryCode, input.postalCode,
        input.latitude, input.longitude],
    );
    const first=found.rows[0];
    if (!first || typeof first.service_area_code !== 'string' ||
        !AREA.test(first.service_area_code) ||
        !Number.isInteger(first.revision) || first.revision < 1) {
      return this.deny();
    }
    return {allowed:true,serviceAreaCode:first.service_area_code};
  }
}
