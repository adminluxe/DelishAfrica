/**
 * AfriTaste Manager read-only BFF QA contract.
 * Authenticated identity and merchant scope must come from server trust ports,
 * NEVER from the native request body, query or JSON claims.
 * No payment execution, settlement, payout, ledger POST or stock mutations.
 */
export type MerchantRole = 'owner' | 'admin' | 'manager' | 'finance' | 'kitchen' | 'support';
export type ReadArea = 'finance' | 'inventory' | 'suppliers';
/** A merchant token also needs the intended resource audience and known OIDC client. */
export function approvedMerchantTokenBinding(azp: unknown, aud: unknown): boolean {
  const clients = ['afritaste-mobile', 'delishafrica-merchant'];
  const audience = typeof aud === 'string' ? [aud] : aud;
  return typeof azp === 'string' && clients.includes(azp) &&
    Array.isArray(audience) && audience.includes('delishafrica-merchant') &&
    !audience.includes('delishafrica-master-dashboard');
}
export type OwnedPartner = Readonly<{partnerId: string; slug: string}>;
export type TrustedMerchantPrincipal = Readonly<{
  issuer: string; subject: string; role: string;
  authSource: string; ownershipEligible: boolean;
}>;
export type EligibleMembership = Readonly<{
  issuer: string; subject: string; partnerId: string; slug: string;
  membershipRole: MerchantRole; membershipStatus: string;
  contractStatus: string; kybStatus: string;
  partnerLifecycleStatus: string; accessEligible: boolean;
  revokedAt: string | null;
}>;
export type ReadScope = Readonly<{
  issuer: string; subject: string; merchantId: string; slug: string;
  role: MerchantRole;
}>;
export type TrustedIdentityPorts = Readonly<{
  resolveBearer: (authorization: string | undefined) => Promise<TrustedMerchantPrincipal | null>;
  listOwned: (subject: string) => Promise<readonly OwnedPartner[]>;
  listMemberships: (issuer: string, subject: string) => Promise<readonly EligibleMembership[]>;
}>;
export type DataPorts = Readonly<{
  readFinance: (scope: ReadScope) => Promise<unknown>;
  readInventory: (scope: ReadScope) => Promise<unknown>;
  readSuppliers: (scope: ReadScope) => Promise<unknown>;
}>;
export class ReadDenied extends Error {
  constructor(public readonly status: 401 | 403 | 409 | 503, public readonly code: string) {
    super(code);
  }
}
const deny = (status: 401 | 403 | 409 | 503, code: string): never => {
  throw new ReadDenied(status, code);
};
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, max = 160): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const boundedNonnegative = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const validTime = (v: unknown): v is string =>
  str(v, 40) && !Number.isNaN(Date.parse(v)) && new Date(v).toISOString() === v;
const roles: Record<ReadArea, readonly MerchantRole[]> = {
  finance: ['owner', 'admin', 'finance'],
  inventory: ['owner', 'admin', 'manager', 'kitchen'],
  suppliers: ['owner', 'admin', 'manager'],
};
const isMembership = (v: EligibleMembership, p: TrustedMerchantPrincipal, o: OwnedPartner, area: ReadArea) =>
  v.issuer === p.issuer && v.subject === p.subject &&
  v.partnerId === o.partnerId && v.slug === o.slug &&
  v.accessEligible === true && v.membershipStatus === 'active' &&
  v.contractStatus === 'active' && v.kybStatus === 'verified' &&
  v.partnerLifecycleStatus === 'published' &&
  v.revokedAt === null && roles[area].includes(v.membershipRole);

/** Tested pure authorization engine; no HTTP or storage side effects. */
export class AtmReadonlyCore {
  constructor(private readonly trust: TrustedIdentityPorts,
              private readonly source: DataPorts) {}

  private async scope(authorization: string | undefined,
                      selectedSlug: string | undefined, area: ReadArea): Promise<ReadScope> {
    if (!str(authorization, 12000) ||
        !/^Bearer [A-Za-z0-9._~-]+$/i.test(authorization))
      return deny(401, 'merchant_auth_required');
    const principal = await this.trust.resolveBearer(authorization).catch(() => null);
    if (!principal) return deny(401, 'merchant_auth_required');
    if (principal.role !== 'merchant' || principal.authSource !== 'external' ||
        principal.ownershipEligible !== true ||
        !str(principal.issuer, 250) || !str(principal.subject, 250))
      return deny(403, 'trusted_merchant_identity_required');
    if (selectedSlug !== undefined &&
        (!str(selectedSlug, 120) || !/^[a-z0-9][a-z0-9_-]{1,119}$/.test(selectedSlug)))
      return deny(403, 'invalid_partner_selection');
    let owned: readonly OwnedPartner[];
    let memberships: readonly EligibleMembership[];
    try {
      [owned, memberships] = await Promise.all([
        this.trust.listOwned(principal.subject),
        this.trust.listMemberships(principal.issuer, principal.subject),
      ]);
    } catch {
      return deny(503, 'merchant_membership_authority_unavailable');
    }
    if (!Array.isArray(owned) || !Array.isArray(memberships))
      return deny(503, 'merchant_membership_authority_unavailable');
    const scoped = owned.flatMap(o =>
      memberships.filter(m => isMembership(m, principal, o, area))
        .map(m => ({issuer: principal.issuer, subject: principal.subject,
          merchantId: o.partnerId, slug: o.slug, role: m.membershipRole})));
    const unique = [...new Map(scoped.map(s => [s.merchantId, s])).values()];
    const allowed = selectedSlug === undefined
      ? unique : unique.filter(s => s.slug === selectedSlug);
    if (allowed.length === 0) return deny(403, 'merchant_read_grant_required');
    if (allowed.length !== 1) return deny(409, 'merchant_partner_selection_required');
    return Object.freeze(allowed[0]);
  }

  async read(area: ReadArea, authorization: string | undefined,
             selectedSlug?: string): Promise<unknown> {
    // Must be explicitly enabled by the server operator, never an EXPO_PUBLIC switch.
    if (process.env.DA_ATM_READONLY_QA_ENABLED !== 'YES' ||
        process.env.NODE_ENV === 'production')
      return deny(503, 'atm_readonly_not_promoted');
    const scope = await this.scope(authorization, selectedSlug, area);
    let raw: unknown;
    try {
      raw = await (area === 'finance' ? this.source.readFinance(scope) :
        area === 'inventory' ? this.source.readInventory(scope) :
          this.source.readSuppliers(scope));
    } catch {
      return deny(503, 'trusted_read_source_unavailable');
    }
    if (!obj(raw)) return deny(503, 'trusted_read_source_unavailable');
    const at = new Date().toISOString();
    if (area === 'finance') {
      if (raw.mode !== 'SHADOW' || raw.readOnly !== true ||
          !str(raw.tenantId) || raw.merchantId !== scope.merchantId ||
          !Array.isArray(raw.events) || raw.events.length > 100 ||
          raw.events.some((event: unknown) => !validShadowEvent(event, scope, raw.tenantId as string)))
        return deny(503, 'finance_evidence_contract_invalid');
      return Object.freeze({
        ok: true, schema: 'orchidpay.atm.shadow.v1', readOnly: true,
        mode: 'SHADOW', tenantId: raw.tenantId, merchantId: scope.merchantId,
        generatedAt: at, events: raw.events,
      });
    }
    if (!Array.isArray(raw.items) || raw.items.length > 250 ||
        raw.merchantId !== scope.merchantId ||
        !validTime(raw.updatedAt) ||
        !validateItems(raw.items, scope.merchantId, area))
      return deny(503, area + '_source_contract_invalid');
    return Object.freeze({
      ok: true, schema: area === 'inventory' ? 'atm.inventory.read.v1' : 'atm.suppliers.read.v1',
      readOnly: true, merchantId: scope.merchantId, updatedAt: raw.updatedAt,
      items: raw.items,
    });
  }
}
function validateItems(items: unknown[], merchantId: string, area: 'inventory' | 'suppliers'): boolean {
  const seen = new Set<string>();
  return items.every(row => {
    if (!obj(row) || !str(row.id) || seen.has(row.id) ||
        row.merchantId !== merchantId || !str(row.name, 120)) return false;
    seen.add(row.id);
    if (area === 'inventory')
      return boundedNonnegative(row.quantity) && boundedNonnegative(row.minimum) &&
        ['kg', 'L', 'piece'].includes(String(row.unit)) &&
        (row.supplierId === null || str(row.supplierId));
    return str(row.specialty, 120) && boundedNonnegative(row.leadDays) &&
      (row.leadDays as number) <= 120 && typeof row.active === 'boolean';
  });
}
function validShadowEvent(event: unknown, scope: ReadScope, tenantId: string): boolean {
  if (!obj(event) || event.tenantId !== tenantId ||
      event.merchantId !== scope.merchantId || event.mode !== 'SHADOW' ||
      event.verified !== false ||
      !['ORDER_CREATED','ORDER_DELIVERED','LEDGER_SHADOW','REFUND','PARTIAL_CAPTURE'].includes(String(event.kind))) return false;
  for (const field of ['siteId','partyId','orderId','id','sourceKind','sourceRef','sourceSHA'])
    if (!str(event[field], 256)) return false;
  if (!validTime(event.observedAt) || !validTime(event.effectiveAt) ||
      !boundedNonnegative(event.eventVersion) || event.eventVersion < 1)
    return false;
  if (!(event.amountMinor === null && event.currency === null) &&
      !(boundedNonnegative(event.amountMinor) && typeof event.currency === 'string' &&
        /^[A-Z]{3}$/.test(event.currency))) return false;
  return event.paymentId === undefined || str(event.paymentId);
}
