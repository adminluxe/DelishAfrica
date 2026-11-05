import { daApiBase } from './daApiEnvironment';
import { verifiedMerchantIdentity } from '../../../packages/contracts/src/merchantIdentity';
import { daMerchantIdentityEpoch, daAssertMerchantIdentity } from './daIdentityEpoch';
import { daMerchantOidcAccessToken, daMerchantOidcLogout, daMerchantOidcSession } from './daMerchantOidc';
type DaRole = 'client' | 'merchant' | 'courier' | 'ops';
export type DaAuthUser = { id: string; role: DaRole; name: string; email?: string; merchantSlug?: string; courierId?: string; clientId?: string };
export type DaAuthSession = {
  ok: boolean; authenticated?: boolean; required?: boolean; token?: string; accessToken?: string; user?: DaAuthUser | null;
  reason?: string; source?: 'external' | 'development' | 'none'; ownershipEligible?: boolean; apiVerified?: boolean; status?: number;
};
export type DaMerchantAccess = {
  state: 'ready' | 'binding_required' | 'membership_pending' | 'selection_required' | 'unavailable';
  partnerId: string | null; partnerName: string | null; membershipEligible: boolean; status?: number;
};
function failure(code: string, status = 0) {
  return Object.assign(new Error(code), { code, status });
}
async function requestSession(path: string, init?: RequestInit): Promise<any> {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(daApiBase() + path, { ...init, signal: controller.signal, redirect: 'error' });
    const data = await response.json().catch(() => null);
    if (!response.ok) throw failure(response.status === 401 ? 'merchant_auth_required' : response.status === 403 ? 'merchant_access_forbidden' : 'merchant_service_unavailable', response.status);
    if (!data || data.ok !== true) throw failure('merchant_response_unverified', 502);
    return data;
  } finally { clearTimeout(timer); }
}
export async function daAuthHealth(): Promise<any> { return requestSession('/auth/health'); }
export async function daGetToken(): Promise<string | null> {
  const local = await daMerchantOidcSession();
  return local.authenticated === true ? daMerchantOidcAccessToken() : null;
}
export async function daMe(): Promise<DaAuthSession> {
  const local = await daMerchantOidcSession();
  if (local.authenticated !== true || !local.user?.id) return { ok: false, authenticated: false, apiVerified: false, ownershipEligible: false, source: 'none', user: null, reason: 'merchant_oidc_session_required' };
  const epoch = daMerchantIdentityEpoch(), token = await daMerchantOidcAccessToken();
  daAssertMerchantIdentity(epoch);
  if (!token) return { ok: false, authenticated: false, apiVerified: false, ownershipEligible: false, source: 'none', user: null, reason: 'merchant_token_unavailable' };
  const api = await requestSession('/auth/merchant/me', { headers: { Authorization: 'Bearer ' + token } });
  daAssertMerchantIdentity(epoch);
  const identity = verifiedMerchantIdentity(api, local.user.id);
  if (!identity) throw failure('merchant_identity_unverified', 403);
  return { ok: true, authenticated: true, apiVerified: true, required: true, source: 'external',
    ownershipEligible: identity.ownershipEligible, user: { id: identity.subject, role: 'merchant', name: identity.name, email: identity.email } };
}
export async function daMerchantAccess(): Promise<DaMerchantAccess> {
  const identity = await daMe();
  if (!identity.apiVerified) throw failure('merchant_auth_required', 401);
  const epoch = daMerchantIdentityEpoch(), token = await daGetToken();
  daAssertMerchantIdentity(epoch);
  if (!token) throw failure('merchant_auth_required', 401);
  const headers = { Authorization: 'Bearer ' + token };
  let catalog: any;
  try { catalog = await requestSession('/merchant/catalog/me', { headers }); }
  catch (error: any) {
    daAssertMerchantIdentity(epoch);
    if (error.status === 401) throw error;
    return { state: error.status === 403 ? 'binding_required' : error.status === 409 ? 'selection_required' : 'unavailable', partnerId: null, partnerName: null, membershipEligible: false, status: error.status };
  }
  daAssertMerchantIdentity(epoch);
  const partnerId = typeof catalog.catalog?.partnerId === 'string' ? catalog.catalog.partnerId.trim() : '';
  if (!partnerId) return { state: 'unavailable', partnerId: null, partnerName: null, membershipEligible: false };
  const basic = { partnerId, partnerName: String(catalog.catalog?.name || 'Votre établissement') };
  try {
    const membership = await requestSession('/merchant/membership/me', { headers });
    daAssertMerchantIdentity(epoch);
    if (membership.identity?.subject !== identity.user?.id || membership.identity?.role !== 'merchant' || !Array.isArray(membership.memberships)) throw failure('merchant_membership_unverified', 403);
    const membershipEligible = membership.memberships.some((entry: any) => entry?.partnerId === partnerId && entry?.accessEligible === true);
    return { ...basic, membershipEligible, state: membershipEligible ? 'ready' : 'membership_pending' };
  } catch (error: any) {
    daAssertMerchantIdentity(epoch);
    if (error.status === 401) throw error;
    return { ...basic, membershipEligible: false, state: 'unavailable', status: error.status };
  }
}
export async function daVerify(): Promise<DaAuthSession> { return daMe(); }
export async function daLogout(): Promise<void> {
  try { await daMerchantOidcLogout(); }
  finally { await require('./daOrdersApi').daPurgeOrdersAccountState(); }
}
export async function daLogoutAll(): Promise<void> { return daLogout(); }
export function daAuthRole(): DaRole { return 'merchant'; }
export function daAuthLabel(): string { return 'Compte partenaire'; }
export function daAuthAccent(): string { return '#D9893D'; }
export function daAuthApiBase(): string { return daApiBase(); }
