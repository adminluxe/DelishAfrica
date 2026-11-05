import * as SecureStore from 'expo-secure-store';
import { daMe, daMerchantAccess, type DaMerchantAccess } from './daAuthBridge';
import { daMerchantOidcAccessToken, daMerchantOidcRefresh, daMerchantOidcSession } from './daMerchantOidc';
import { daApiScope, daAssertApiRequest } from './daApiEnvironment';
import { daMerchantIdentityEpoch, daAdvanceMerchantIdentity, daAssertMerchantIdentity } from './daIdentityEpoch';
import { verifiedMerchantIdentity } from '../../../packages/contracts/src/merchantIdentity';
const ROLE = 'merchant' as const;
type Credential = { token: string; subject: string; epoch: number; environment: string };
type Principal = Credential & { user: Record<string, unknown>; access: DaMerchantAccess };
let principalCache: Principal | null = null;
let principalFlight: { key: string; promise: Promise<Principal> } | null = null;
function accessError(code: string, status = 401) { return Object.assign(new Error(code), { code, status }); }
async function credentials(force = false): Promise<Credential> {
  const external = force ? await daMerchantOidcRefresh() : await daMerchantOidcSession();
  if (external.authenticated !== true || !external.user?.id) throw accessError('merchant_oidc_session_required');
  const epoch = daMerchantIdentityEpoch(), token = await daMerchantOidcAccessToken();
  daAssertMerchantIdentity(epoch);
  if (!token) throw accessError('merchant_oidc_session_required');
  return { token, subject: external.user.id, epoch, environment: daApiScope() };
}
function matches(a: Credential, b: Credential): boolean {
  return a.token === b.token && a.subject === b.subject && a.epoch === b.epoch && a.environment === b.environment;
}
async function ensurePrincipal(force = false): Promise<Principal> {
  const credential = await credentials(force);
  if (!force && principalCache && matches(principalCache, credential)) return principalCache;
  const key = JSON.stringify([credential.environment, credential.subject, credential.token, credential.epoch]);
  if (!force && principalFlight?.key === key) return principalFlight.promise;
  const flight = { key, promise: (async () => {
    const session = await daMe();
    daAssertMerchantIdentity(credential.epoch);
    const identity = verifiedMerchantIdentity(session, credential.subject);
    if (!identity) throw accessError('merchant_identity_unverified', 403);
    const access = await daMerchantAccess();
    daAssertMerchantIdentity(credential.epoch);
    const principal: Principal = { ...credential, user: session.user || {}, access };
    principalCache = principal;
    return principal;
  })() };
  principalFlight = flight;
  try { return await flight.promise; } finally { if (principalFlight === flight) principalFlight = null; }
}
async function digestScope(values: string[]): Promise<string> {
  // Existing native crypto module; no new native dependency or personal data in the key.
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(values));
}
export async function daAccountScopeId(): Promise<string> {
  const local = await daMerchantOidcSession();
  if (local.authenticated !== true) return digestScope(['v3', ROLE, daApiScope(), 'anonymous', 'unbound']);
  const principal = await ensurePrincipal();
  const scope = await digestScope(['v3', ROLE, principal.environment, principal.subject, principal.access.partnerId || 'unbound']);
  daAssertMerchantIdentity(principal.epoch);
  return scope;
}
export async function daAccountStorageKey(base: string): Promise<string> {
  // Legacy unscoped/Thieyp records stay untouched. They are never silently imported.
  return base + '.v3.' + await daAccountScopeId();
}
export async function daOrdersFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = daAssertApiRequest(input);
  const send = async (principal: Principal) => {
    daAssertMerchantIdentity(principal.epoch);
    if (principal.access.state !== 'ready' || !principal.access.membershipEligible) throw accessError(
      principal.access.state === 'membership_pending' ? 'merchant_membership_not_eligible' : 'merchant_establishment_access_required', 403);
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', 'Bearer ' + principal.token);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(url, { ...init, headers, redirect: 'error' });
    daAssertMerchantIdentity(principal.epoch);
    if (response.status === 401 || response.status === 403) principalCache = null;
    return response;
  };
  let response = await send(await ensurePrincipal());
  if (response.status !== 401) return response;
  response = await send(await ensurePrincipal(true));
  return response;
}
export async function daSessionRehydrationStatus(): Promise<Record<string, unknown>> {
  try {
    const principal = await ensurePrincipal();
    return { ok: true, role: ROLE, scope: await daAccountScopeId(), accessState: principal.access.state };
  } catch (error: any) { return { ok: false, role: ROLE, reason: String(error?.code || error?.message || 'merchant_identity_unverified') }; }
}
export async function daPurgeOrdersAccountState(): Promise<void> {
  daAdvanceMerchantIdentity();
  principalCache = null;
  principalFlight = null;
  delete (globalThis as any).__DELISHAFRICA_PARTNER_PROFILE_LITE_V1__;
  for (const key of ['da_orders_session_marker_v1', 'da_orders_principal_v2', 'da_orders_active_scope_v2']) {
    try { await SecureStore.deleteItemAsync(key); } catch { /* legacy markers only; personal drafts remain preserved */ }
  }
}
