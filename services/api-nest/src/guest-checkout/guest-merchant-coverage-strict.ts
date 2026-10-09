import { createHash } from 'node:crypto';
import type { CatalogPartner } from '../catalog-foundation/catalog-foundation.types';
import type { ServerCoveragePolicy } from './guest-canonical-checkout-stager';

/**
 * P5B approved partner delivery footprint. LAB ONLY, no public HTTP route.
 * Ops approval comes from a SEPARATE trusted registry, never just a boolean
 * in a merchant-editable catalogue payload.
 */
export type PublishedCatalogReader = {
  findPublishedBySlug(slug: string, fallback: CatalogPartner[]): Promise<CatalogPartner | null>;
};
export type IndependentOpsCoverageApprovals = {
  isApproved(input: {
    partnerSlug: string;
    coverageDigestSha256: string;
  }): Promise<boolean>;
};
type RecordValue = Record<string, unknown>;
type CoverageInput = Parameters<ServerCoveragePolicy['verifyCoverage']>[0];
type CoverageResult = Awaited<ReturnType<ServerCoveragePolicy['verifyCoverage']>>;
type NormalizedZone = {
  code: string;
  countryCode: 'BE';
  postalCodes: string[];
  center: { latitude: number; longitude: number };
  maxDistanceMeters: number;
};
const CODE = /^[a-z][a-z0-9_-]{2,119}$/;
const POSTCODE = /^\d{4}$/;
const EARTH_RADIUS_M = 6371008.8;
const DENIED: CoverageResult = Object.freeze({allowed:false,serviceAreaCode:'not_approved'});

function plain(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue : null;
}
function validPosition(lat: unknown, lon: unknown): lat is number {
  return typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
function metersBetween(aLat: number,aLon: number,bLat: number,bLon: number): number {
  const rad = Math.PI / 180;
  const phi = (bLat - aLat) * rad;
  const lam = (bLon - aLon) * rad;
  const h = Math.sin(phi/2)**2 + Math.cos(aLat*rad)*Math.cos(bLat*rad)*Math.sin(lam/2)**2;
  return 2*EARTH_RADIUS_M*Math.asin(Math.min(1,Math.sqrt(Math.max(0,h))));
}

export function normalizeApprovedCoverage(raw: unknown): {
  version: 1; revision: number; zones: NormalizedZone[];
} | null {
  const v=plain(raw);
  if (!v || v.version!==1 || v.enabled!==true ||
      v.approvedByMerchant!==true ||
      !Number.isSafeInteger(v.revision) || Number(v.revision)<1 ||
      Number(v.revision)>1000000 ||
      !Array.isArray(v.zones) || v.zones.length<1 || v.zones.length>50) return null;
  const codes=new Set<string>();
  const zones:NormalizedZone[]=[];
  for(const entry of v.zones) {
    const z=plain(entry);
    const center=plain(z?.center);
    if (!z || z.enabled!==true || z.countryCode!=='BE' ||
        typeof z.code!=='string' || !CODE.test(z.code) || codes.has(z.code) ||
        !Array.isArray(z.postalCodes) || z.postalCodes.length<1 ||
        z.postalCodes.length>80 || !z.postalCodes.every((x)=>
          typeof x==='string' && POSTCODE.test(x)) ||
        !center || !validPosition(center.latitude,center.longitude) ||
        typeof z.maxDistanceMeters!=='number' ||
        !Number.isFinite(z.maxDistanceMeters) ||
        z.maxDistanceMeters<100 || z.maxDistanceMeters>25000) return null;
    codes.add(z.code);
    zones.push({
      code:z.code,countryCode:'BE',
      postalCodes:[...new Set(z.postalCodes as string[])].sort(),
      center:{latitude:center.latitude,longitude:center.longitude as number},
      maxDistanceMeters:z.maxDistanceMeters,
    });
  }
  zones.sort((a,b)=>a.code.localeCompare(b.code,'en'));
  return {version:1,revision:v.revision as number,zones};
}

export function coverageApprovalDigest(partnerSlug:string, raw:unknown): string | null {
  if(!CODE.test(partnerSlug)) return null;
  const normalized=normalizeApprovedCoverage(raw);
  if(!normalized) return null;
  return createHash('sha256').update(JSON.stringify({
    contract:'da-guest-coverage-v1',partnerSlug,...normalized,
  })).digest('hex');
}

export class GuestMerchantCoverageStrict implements ServerCoveragePolicy {
  constructor(
    private readonly catalog: PublishedCatalogReader,
    private readonly opsApprovals: IndependentOpsCoverageApprovals,
  ) {}

  async verifyCoverage(input: CoverageInput): Promise<CoverageResult> {
    if(!input || typeof input.partnerSlug!=='string' ||
       !CODE.test(input.partnerSlug) || input.countryCode!=='BE' ||
       typeof input.postalCode!=='string' || !POSTCODE.test(input.postalCode) ||
       typeof input.placeId!=='string' ||
       !/^[A-Za-z0-9_-]{8,220}$/.test(input.placeId) ||
       !validPosition(input.latitude,input.longitude)) return DENIED;

    const published=await this.catalog.findPublishedBySlug(input.partnerSlug,[]);
    if(!published || published.slug!==input.partnerSlug) return DENIED;
    const merchant=plain(published);
    if(merchant?.status!=='active') return DENIED;
    const delivery=plain(merchant.delivery);
    if(delivery?.enabled!==true) return DENIED;

    const normalized=normalizeApprovedCoverage(delivery.guestCheckoutCoverage);
    const digest=coverageApprovalDigest(input.partnerSlug,delivery.guestCheckoutCoverage);
    if(!normalized || !digest) return DENIED;
    const eligible=normalized.zones.find((z)=>
      z.postalCodes.includes(input.postalCode) &&
      metersBetween(z.center.latitude,z.center.longitude,input.latitude,input.longitude)
        <= z.maxDistanceMeters
    );
    if(!eligible) return DENIED;

    // This approval is read from an OPS-WRITE-ONLY table or equivalent ledger.
    // An Ops boolean inside the merchant payload is never sufficient.
    try {
      const approved=await this.opsApprovals.isApproved({
        partnerSlug:input.partnerSlug,coverageDigestSha256:digest,
      });
      if(approved!==true) return DENIED;
    } catch {
      // DB outage, revoked record, or unknown Ops approval: deny all payments.
      return DENIED;
    }
    return {allowed:true,serviceAreaCode:eligible.code};
  }
}
