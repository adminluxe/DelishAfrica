import * as SecureStore from 'expo-secure-store';
import { daDevLogin, daGetToken, daMe } from './daAuthBridge';

import { daGetBusinessOidcSession } from '../auth/daOidcVault';

const ROLE = 'client' as const;
const PROFILE_BASE = '__DELISHAFRICA_CLIENT_PROFILE_LITE_V1__';
const INSTALLATION_KEY = 'da_client_installation_id_v1';
const LEGACY_SESSION_MARKER_KEY = 'da_orders_session_marker_v1';
const PRINCIPAL_MARKER_KEY = 'da_orders_principal_v2';
const ACTIVE_SCOPE_KEY = 'da_orders_active_scope_v2';
const LEGACY_MIGRATION_OWNER_KEY = 'da_client_legacy_migration_owner_v2';

type PrincipalState = { token: string; subject: string; role: typeof ROLE; user: Record<string, unknown> };
type PrincipalMarker = { version: 2; role: typeof ROLE; subject: string; updatedAt: string };

let principalCache: PrincipalState | null = null;
let principalFlight: Promise<PrincipalState> | null = null;
let activeScopeCache: string | null = null;

function randomId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function hashScope(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function legacyInstallationSubject(): Promise<string> {
  let id = await SecureStore.getItemAsync(INSTALLATION_KEY);
  if (!id) {
    id = randomId();
    await SecureStore.setItemAsync(INSTALLATION_KEY, id);
  }
  return 'client_device_' + id;
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
  const marker: PrincipalMarker = { version: 2, role: ROLE, subject, updatedAt: new Date().toISOString() };
  await SecureStore.setItemAsync(PRINCIPAL_MARKER_KEY, JSON.stringify(marker));
}

function sessionSubject(session: any, fallback = ''): string {
  const user = session?.user || {};
  return String(user.id || user.clientId || fallback || '').trim();
}

function sessionIsValid(session: any): boolean {
  const role = String(session?.user?.role || '');
  return Boolean(session && session.ok !== false && session.authenticated !== false && sessionSubject(session) && (!role || role === ROLE));
}

function isLegacyDeviceSubject(subject: string): boolean {
  return subject.startsWith(`${ROLE}_device_`);
}

async function legacyProfileSubject(): Promise<string | null> {
  const legacySubject = await legacyInstallationSubject();
  const candidates = [
    `${PROFILE_BASE}.${hashScope(legacySubject)}`,
    PROFILE_BASE,
  ];
  for (const key of candidates) {
    try {
      const raw = await SecureStore.getItemAsync(key);
      if (!raw) continue;
      const profile = JSON.parse(raw) as Record<string, unknown>;
      const stable = String(profile.id || profile.email || profile.phone || '').trim().toLowerCase();
      if (stable) return `${ROLE}_account_${hashScope(stable)}`;
    } catch {
      // Try the next migration source.
    }
  }
  return null;
}

async function identityHint(): Promise<string> {
  const marker = await readPrincipalMarker();
  if (marker?.subject) return marker.subject;
  return (await legacyProfileSubject()) || (await legacyInstallationSubject());
}

async function canMigrateLegacyValues(subject: string): Promise<boolean> {
  const owner = await SecureStore.getItemAsync(LEGACY_MIGRATION_OWNER_KEY);
  if (owner) return owner === subject;
  const legacyOwner = await legacyProfileSubject();
  if (!legacyOwner || legacyOwner !== subject) return false;
  await SecureStore.setItemAsync(LEGACY_MIGRATION_OWNER_KEY, subject);
  return true;
}

async function oidcPrincipalState(): Promise<PrincipalState | null> {
  try {
    const session = await daGetBusinessOidcSession();
    if (!session) return null;
    await savePrincipalMarker(session.subject);
    return {
      token: session.accessToken,
      subject: session.subject,
      role: ROLE,
      user: {
        id: session.subject,
        role: ROLE,
        ...(session.displayName ? { name: session.displayName } : {}),
        ...(session.email ? { email: session.email } : {}),
      },
    };
  } catch {
    return null;
  }
}

async function validateStoredSession(): Promise<PrincipalState | null> {
  const oidc = await oidcPrincipalState();
  if (oidc) return oidc;

  const token = await daGetToken();
  if (!token) return null;
  try {
    const session = await daMe();
    if (!sessionIsValid(session)) return null;
    const subject = sessionSubject(session);
    if (isLegacyDeviceSubject(subject)) return null;
    await savePrincipalMarker(subject);
    return { token, subject, role: ROLE, user: (session.user || {}) as Record<string, unknown> };
  } catch {
    return null;
  }
}

async function createFreshSession(): Promise<PrincipalState> {
  // DA_BUSINESS_OIDC_BRIDGE_V2: the authenticated Client OIDC vault is the
  // primary business-session authority. The progressive bridge remains a
  // compatibility fallback only while the migration is completed.
  const oidc = await oidcPrincipalState();
  if (oidc) return oidc;

  const hint = await identityHint();
  const login = await daDevLogin({
    role: ROLE,
    name: 'Client DelishAfrica',
    clientId: hint,
  });
  const token = String(login.accessToken || login.token || '').trim();
  if (!token) throw new Error('Session client indisponible.');
  const verified = await daMe();
  const subject = sessionIsValid(verified) ? sessionSubject(verified, hint) : sessionSubject(login, hint);
  if (!subject) throw new Error('Identité client non résolue.');
  await savePrincipalMarker(subject);
  return { token, subject, role: ROLE, user: ((verified?.user || login?.user || {}) as Record<string, unknown>) };
}

async function ensurePrincipal(force = false): Promise<PrincipalState> {
  if (!force && principalCache) {
    const currentOidc = await daGetBusinessOidcSession().catch(() => null);
    const currentToken = currentOidc?.accessToken || await daGetToken().catch(() => null);
    if (currentToken && currentToken === principalCache.token) return principalCache;
    principalCache = null;
  }
  if (!force && principalFlight) return principalFlight;
  principalFlight = (async () => {
    const existing = force ? null : await validateStoredSession();
    const principal = existing || await createFreshSession();
    principalCache = principal;
    return principal;
  })();
  try {
    return await principalFlight;
  } finally {
    principalFlight = null;
  }
}

async function subjectForStorage(): Promise<string> {
  try {
    return (await ensurePrincipal(false)).subject;
  } catch {
    const marker = await readPrincipalMarker();
    if (marker?.subject) return marker.subject;
    return await identityHint();
  }
}

async function bindActiveScope(scope: string): Promise<void> {
  const previous = activeScopeCache || await SecureStore.getItemAsync(ACTIVE_SCOPE_KEY);
  if (previous && previous !== scope) {
    delete (globalThis as any).__DELISHAFRICA_CLIENT_PROFILE_LITE_V1__;
  delete (globalThis as any).__DELISHAFRICA_PENDING_PAYMENT_COMMIT_V1__;
  }
  activeScopeCache = scope;
  await SecureStore.setItemAsync(ACTIVE_SCOPE_KEY, scope);
}

async function migrateValue(base: string, target: string, subject: string): Promise<void> {
  try {
    if (await SecureStore.getItemAsync(target)) return;
    const candidates = [`${base}.${hashScope(subject)}`];
    if (await canMigrateLegacyValues(subject)) {
      const legacySubject = await legacyInstallationSubject();
      candidates.push(`${base}.${hashScope(legacySubject)}`, base);
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
  delete (globalThis as any).__DELISHAFRICA_CLIENT_PROFILE_LITE_V1__;
  delete (globalThis as any).__DELISHAFRICA_PENDING_PAYMENT_COMMIT_V1__;
  for (const key of [LEGACY_SESSION_MARKER_KEY, PRINCIPAL_MARKER_KEY, ACTIVE_SCOPE_KEY]) {
    try { await SecureStore.deleteItemAsync(key); } catch { /* best effort */ }
  }
}
