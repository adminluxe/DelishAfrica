import * as SecureStore from 'expo-secure-store';
import { daDevLogin, daGetToken, daMe } from './daAuthBridge';
import {
  daMerchantOidcAccessToken,
  daMerchantOidcRefresh,
  daMerchantOidcSession,
} from './daMerchantOidc';

const ROLE = 'merchant' as const;
const PROFILE_BASE = '__DELISHAFRICA_PARTNER_PROFILE_LITE_V1__';
const PRINCIPAL_MARKER_KEY = 'da_orders_principal_v2';
const ACTIVE_SCOPE_KEY = 'da_orders_active_scope_v2';
const LEGACY_SESSION_MARKER_KEY = 'da_orders_session_marker_v1';
const LEGACY_MIGRATION_OWNER_KEY = 'da_merchant_legacy_migration_owner_v2';

type PrincipalState = { token: string; subject: string; role: typeof ROLE; user: Record<string, unknown> };
type PrincipalMarker = { version: 2; role: typeof ROLE; subject: string; updatedAt: string };

let principalCache: PrincipalState | null = null;
let principalFlight: Promise<PrincipalState> | null = null;
let activeScopeCache: string | null = null;

function hashScope(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function readPrincipalMarker(): Promise<PrincipalMarker | null> {
  try {
    const raw = await SecureStore.getItemAsync(PRINCIPAL_MARKER_KEY);
    if (!raw) return null;
    const marker = JSON.parse(raw) as PrincipalMarker;
    return marker?.version === 2 && marker.role === ROLE && marker.subject ? marker : null;
  } catch {
    return null;
  }
}

async function savePrincipalMarker(subject: string): Promise<void> {
  await SecureStore.setItemAsync(PRINCIPAL_MARKER_KEY, JSON.stringify({
    version: 2,
    role: ROLE,
    subject,
    updatedAt: new Date().toISOString(),
  } satisfies PrincipalMarker));
}

function sessionSubject(session: any, fallback = ''): string {
  const user = session?.user || {};
  return String(user.id || user.merchantSlug || fallback || '').trim();
}

function sessionIsValid(session: any): boolean {
  const role = String(session?.user?.role || '');
  return Boolean(session && session.ok !== false && session.authenticated !== false && sessionSubject(session) && (!role || role === ROLE));
}

async function externalPrincipal(forceRefresh = false): Promise<PrincipalState | null> {
  try {
    let external = await daMerchantOidcSession();
    if (forceRefresh || (!external.authenticated && external.refreshTokenPresent)) {
      try { external = await daMerchantOidcRefresh(); } catch { return null; }
    }
    if (!external.authenticated) return null;

    let token = await daMerchantOidcAccessToken();
    if (!token) return null;
    let verified: any;
    try {
      verified = await daMe();
    } catch {
      // A token can still look locally unexpired while the API has revoked it.
      // Refresh once, then verify the rotated token before falling back.
      if (forceRefresh || !external.refreshTokenPresent) return null;
      try {
        external = await daMerchantOidcRefresh();
        if (!external.authenticated) return null;
        token = await daMerchantOidcAccessToken();
        if (!token) return null;
        verified = await daMe();
      } catch {
        return null;
      }
    }
    if (!sessionIsValid(verified)) return null;
    const subject = sessionSubject(verified, external.user?.id || '');
    if (!subject) return null;
    await savePrincipalMarker(subject);
    return { token, subject, role: ROLE, user: (verified.user || external.user || {}) as Record<string, unknown> };
  } catch {
    return null;
  }
}

async function developmentPrincipal(): Promise<PrincipalState> {
  const existingToken = await daGetToken();
  if (existingToken) {
    try {
      const verified = await daMe();
      if (sessionIsValid(verified)) {
        const subject = sessionSubject(verified, 'merchant_thieyp');
        await savePrincipalMarker(subject);
        return { token: existingToken, subject, role: ROLE, user: (verified.user || {}) as Record<string, unknown> };
      }
    } catch {
      // Fresh development session below.
    }
  }
  const login = await daDevLogin({ role: ROLE, merchantSlug: 'thieyp', name: 'Partenaire Thieyp' });
  const token = String(login.accessToken || login.token || '');
  if (!token) throw new Error('Session restaurateur indisponible.');
  const subject = sessionSubject(login, 'merchant_thieyp');
  if (!subject) throw new Error('Identité restaurateur non résolue.');
  await savePrincipalMarker(subject);
  return { token, subject, role: ROLE, user: ((login?.user || {}) as Record<string, unknown>) };
}

async function ensurePrincipal(force = false): Promise<PrincipalState> {
  if (!force && principalCache) return principalCache;
  if (!force && principalFlight) return principalFlight;
  principalFlight = (async () => {
    const external = await externalPrincipal(force);
    const principal = external || await developmentPrincipal();
    principalCache = principal;
    return principal;
  })();
  try { return await principalFlight; } finally { principalFlight = null; }
}

async function subjectForStorage(): Promise<string> {
  try { return (await ensurePrincipal(false)).subject; }
  catch {
    const marker = await readPrincipalMarker();
    if (marker?.subject) return marker.subject;
    return 'merchant_thieyp';
  }
}

async function canMigrateLegacyValues(subject: string): Promise<boolean> {
  const owner = await SecureStore.getItemAsync(LEGACY_MIGRATION_OWNER_KEY);
  if (owner) return owner === subject;
  if (subject === 'merchant_thieyp') {
    await SecureStore.setItemAsync(LEGACY_MIGRATION_OWNER_KEY, subject);
    return true;
  }
  try {
    const raw = await SecureStore.getItemAsync(PROFILE_BASE);
    if (!raw) return false;
    const profile = JSON.parse(raw) as Record<string, unknown>;
    const stable = String(profile.id || profile.merchantSlug || profile.email || '').trim().toLowerCase();
    if (!stable) return false;
    const candidates = new Set([stable, `merchant_${stable}`, `merchant_account_${hashScope(stable)}`]);
    if (!candidates.has(subject.toLowerCase())) return false;
    await SecureStore.setItemAsync(LEGACY_MIGRATION_OWNER_KEY, subject);
    return true;
  } catch {
    return false;
  }
}

async function bindActiveScope(scope: string): Promise<void> {
  const previous = activeScopeCache || await SecureStore.getItemAsync(ACTIVE_SCOPE_KEY);
  if (previous && previous !== scope) {
    delete (globalThis as any).__DELISHAFRICA_PARTNER_PROFILE_LITE_V1__;
  }
  activeScopeCache = scope;
  await SecureStore.setItemAsync(ACTIVE_SCOPE_KEY, scope);
}

async function migrateValue(base: string, target: string, subject: string): Promise<void> {
  try {
    if (await SecureStore.getItemAsync(target)) return;
    const candidates = [`${base}.${hashScope(subject)}`];
    if (await canMigrateLegacyValues(subject)) {
      if (subject === 'merchant_thieyp') candidates.push(`${base}.${hashScope('merchant_thieyp')}`);
      candidates.push(base);
    }
    for (const candidate of candidates) {
      if (candidate === target) continue;
      const value = await SecureStore.getItemAsync(candidate);
      if (!value) continue;
      await SecureStore.setItemAsync(target, value);
      return;
    }
  } catch {
    // Migration is best effort; legacy data is never copied across principals.
  }
}

export async function daAccountScopeId(): Promise<string> {
  const subject = await subjectForStorage();
  const scope = hashScope(`${ROLE}:${subject}`);
  await bindActiveScope(scope);
  return scope;
}

export async function daAccountStorageKey(base: string): Promise<string> {
  const subject = await subjectForStorage();
  const scope = hashScope(`${ROLE}:${subject}`);
  await bindActiveScope(scope);
  const target = `${base}.${scope}`;
  await migrateValue(base, target, subject);
  return target;
}

export async function daOrdersFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const send = async (principal: PrincipalState) => {
    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${principal.token}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    return fetch(input, { ...init, headers });
  };
  let response = await send(await ensurePrincipal(false));
  if (response.status !== 401) return response;
  principalCache = null;
  response = await send(await ensurePrincipal(true));
  return response;
}

export async function daSessionRehydrationStatus(): Promise<Record<string, unknown>> {
  try {
    const principal = await ensurePrincipal(false);
    return { ok: true, role: ROLE, subjectHash: hashScope(principal.subject), scope: await daAccountScopeId() };
  } catch (error: any) {
    return { ok: false, role: ROLE, reason: String(error?.message || error) };
  }
}

export async function daPurgeOrdersAccountState(): Promise<void> {
  principalCache = null;
  principalFlight = null;
  activeScopeCache = null;
  delete (globalThis as any).__DELISHAFRICA_PARTNER_PROFILE_LITE_V1__;
  for (const key of [LEGACY_SESSION_MARKER_KEY, PRINCIPAL_MARKER_KEY, ACTIVE_SCOPE_KEY]) {
    try { await SecureStore.deleteItemAsync(key); } catch { /* best effort */ }
  }
}
