import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { DA_OIDC_CONFIG } from './daOidcConfig';
import type { DaOidcSession } from './daOidcTypes';

const STORE_KEY = `da.oidc.${DA_OIDC_CONFIG.role}.v2`;
const ACCESS_V3 = `${STORE_KEY}.access.v3`;
const REFRESH_V3 = `${STORE_KEY}.refresh.v3`;
const ID_V3 = `${STORE_KEY}.id.v3`;
const META_V3 = `${STORE_KEY}.meta.v3`;
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};
// Expo SecureStore 15.x warns above 2048 bytes; use a conservative per-value limit.
// This does not make oversized individual JWTs safe: reject and require lean IAM claims.
const VALUE_LIMIT_ASCII = 1800;

// Serialize SecureStore read/write/purge, including the legacy v2 migration.
// Without this queue, two concurrent token rotations can interleave JWTs.
let storageTail: Promise<void> = Promise.resolve();
let sessionEpoch = 0;
let refreshFlight: Promise<DaOidcSession> | null = null;
function storageTransaction<T>(work: () => Promise<T>): Promise<T> {
  const result = storageTail.then(work, work);
  storageTail = result.then(() => undefined, () => undefined);
  return result;
}

type SplitMeta = {
  version: 3;
  state: 'pending' | 'ready';
  expiresAt: number;
  displayName?: string;
  email?: string;
  subject?: string;
};
function safeStorageValue(value: string, label: string): string {
  // JWTs are ASCII. Reject non-ASCII instead of mistaking UTF-16 length for bytes.
  if (value.length > VALUE_LIMIT_ASCII || !/^[\x20-\x7e]*$/.test(value)) {
    throw new Error('secure_store_payload_oversized_' + label);
  }
  return value;
}
async function purgeSplit(): Promise<void> {
  const keys = [ACCESS_V3, REFRESH_V3, ID_V3, META_V3];
  const results = await Promise.allSettled(keys.map(key => SecureStore.deleteItemAsync(key, SECURE_OPTIONS)));
  if (results.some(item => item.status === 'rejected')) throw new Error('secure_store_purge_failed');
}
async function purgeAllUnlocked(): Promise<void> {
  const results = await Promise.allSettled([
    purgeSplit(), SecureStore.deleteItemAsync(STORE_KEY),
  ]);
  if (results.some(item => item.status === 'rejected')) throw new Error('secure_store_purge_failed');
}
async function purgeAll(): Promise<void> {
  return storageTransaction(purgeAllUnlocked);
}
async function purgeIfCurrent(epoch: number): Promise<void> {
  return storageTransaction(async () => {
    if (epoch === sessionEpoch) await purgeAllUnlocked();
  });
}

type Json = Record<string, any>;

type Stored = {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresAt: number;
  displayName?: string;
  email?: string;
  subject?: string;
};

function anonymous(reason?: string): DaOidcSession {
  return { status: 'anonymous', provider: 'keycloak', role: DA_OIDC_CONFIG.role, reason } as DaOidcSession;
}

function failed(reason: string): DaOidcSession {
  return { status: 'error', provider: 'keycloak', role: DA_OIDC_CONFIG.role, reason } as DaOidcSession;
}

function decodeJwt(token?: string): Json {
  if (!token || token.split('.').length < 2) return {};
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = part + '='.repeat((4 - (part.length % 4)) % 4);
    const B: any = (globalThis as any).Buffer;
    const raw = B
      ? B.from(padded, 'base64').toString('utf8')
      : decodeURIComponent(
          Array.prototype.map.call(
            atob(padded),
            (c: string) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2),
          ).join(''),
        );
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function tokenRoles(payload: Json): string[] {
  const expectedClient = DA_OIDC_CONFIG.clientId;
  const realmRoles = stringArray(payload?.realm_access?.roles);
  const clientRoles = stringArray(payload?.resource_access?.[expectedClient]?.roles);
  const flatRoles = stringArray(payload?.roles);
  const single = typeof payload?.role === 'string' ? [payload.role] : [];
  return Array.from(new Set([...realmRoles, ...clientRoles, ...flatRoles, ...single]));
}

function hasExpectedRole(payload: Json): boolean {
  const expected = String(DA_OIDC_CONFIG.role || '').toLowerCase();
  return tokenRoles(payload).some((role) => role.toLowerCase() === expected);
}

function buildAuthenticated(stored: Stored): DaOidcSession {
  return {
    status: 'authenticated',
    provider: 'keycloak',
    role: DA_OIDC_CONFIG.role,
    displayName: stored.displayName,
    email: stored.email,
    subject: stored.subject,
    accessToken: stored.accessToken,
    refreshToken: stored.refreshToken,
    idToken: stored.idToken,
    expiresAt: stored.expiresAt,
  } as DaOidcSession;
}

async function persistUnlocked(stored: Stored): Promise<void> {
  if (typeof stored.accessToken !== 'string' || !stored.accessToken) {
    throw new Error('secure_store_access_token_required');
  }
  const meta: SplitMeta = {
    version: 3, state: 'pending', expiresAt: stored.expiresAt,
    displayName: stored.displayName, email: stored.email, subject: stored.subject,
  };
  if (!Number.isSafeInteger(meta.expiresAt) || meta.expiresAt <= 0 ||
      typeof meta.subject !== 'string' || !meta.subject.trim()) {
    throw new Error('secure_store_metadata_invalid');
  }
  const access = safeStorageValue(stored.accessToken, 'access');
  const refresh = safeStorageValue(stored.refreshToken || '', 'refresh');
  const id = safeStorageValue(stored.idToken || '', 'id');
  const pending = JSON.stringify(meta);
  const ready = JSON.stringify({ ...meta, state: 'ready' });
  if (pending.length > VALUE_LIMIT_ASCII || ready.length > VALUE_LIMIT_ASCII) {
    throw new Error('secure_store_metadata_oversized');
  }
  // Write-once transaction marker: partial keychain writes never count as a session.
  try {
    await SecureStore.setItemAsync(META_V3, pending, SECURE_OPTIONS);
    await SecureStore.setItemAsync(ACCESS_V3, access, SECURE_OPTIONS);
    await SecureStore.setItemAsync(REFRESH_V3, refresh, SECURE_OPTIONS);
    await SecureStore.setItemAsync(ID_V3, id, SECURE_OPTIONS);
    await SecureStore.setItemAsync(META_V3, ready, SECURE_OPTIONS);
    // Old aggregated token blob is no longer used after a completed split.
    await SecureStore.deleteItemAsync(STORE_KEY).catch(() => undefined);
  } catch {
    await purgeAllUnlocked().catch(() => undefined);
    throw new Error('secure_store_write_failed');
  }
}
async function persist(stored: Stored, epoch: number): Promise<void> {
  return storageTransaction(async () => {
    if (epoch !== sessionEpoch) throw new Error('session_superseded');
    await persistUnlocked(stored);
    // Logout may have invalidated this operation while native Keychain was writing.
    // The already queued logout will clear the keys; never return authenticated.
    if (epoch !== sessionEpoch) throw new Error('session_superseded');
  });
}
function validStored(stored: unknown): stored is Stored {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return false;
  const v = stored as Stored;
  return typeof v.accessToken === 'string' && v.accessToken.length > 0 &&
    Number.isSafeInteger(v.expiresAt) && v.expiresAt > 0 &&
    typeof v.subject === 'string' && Boolean(v.subject.trim()) &&
    (v.refreshToken === undefined || typeof v.refreshToken === 'string') &&
    (v.idToken === undefined || typeof v.idToken === 'string');
}
async function readStoredUnlocked(): Promise<Stored | null> {
  const values = await Promise.all([
    SecureStore.getItemAsync(META_V3, SECURE_OPTIONS),
    SecureStore.getItemAsync(ACCESS_V3, SECURE_OPTIONS),
    SecureStore.getItemAsync(REFRESH_V3, SECURE_OPTIONS),
    SecureStore.getItemAsync(ID_V3, SECURE_OPTIONS),
  ]);
  const [rawMeta, access, refresh, id] = values;
  if (values.some(value => value !== null)) {
    if (!rawMeta || !access || refresh === null || id === null) {
      await purgeAllUnlocked().catch(() => undefined);
      return null;
    }
    try {
      const meta = JSON.parse(rawMeta) as SplitMeta;
      if (meta.version !== 3 || meta.state !== 'ready') throw new Error('partial');
      const stored: Stored = {
        accessToken: access,
        refreshToken: refresh || undefined,
        idToken: id || undefined,
        expiresAt: meta.expiresAt,
        displayName: meta.displayName,
        email: meta.email,
        subject: meta.subject,
      };
      if (!validStored(stored) || access.length > VALUE_LIMIT_ASCII ||
          refresh.length > VALUE_LIMIT_ASCII || id.length > VALUE_LIMIT_ASCII) {
        throw new Error('invalid');
      }
      // Self-consistency only; the API is the authoritative JWT signature/role verifier.
      const accessClaims = decodeJwt(access);
      const idClaims = id ? decodeJwt(id) : null;
      if (accessClaims.sub !== meta.subject ||
          accessClaims.iss !== DA_OIDC_CONFIG.issuer ||
          (idClaims && (idClaims.sub !== meta.subject ||
            idClaims.iss !== DA_OIDC_CONFIG.issuer))) {
        throw new Error('mixed_session_principals');
      }
      return stored;
    } catch {
      await purgeAllUnlocked().catch(() => undefined);
      return null;
    }
  }
  // One-time migration of the old aggregated blob. No values or secrets are logged.
  const legacy = await SecureStore.getItemAsync(STORE_KEY);
  if (!legacy) return null;
  try {
    const stored: unknown = JSON.parse(legacy);
    if (!validStored(stored)) throw new Error('invalid');
    await persistUnlocked(stored);
    return stored;
  } catch {
    await purgeAllUnlocked().catch(() => undefined);
    return null;
  }
}

async function readStored(): Promise<Stored | null> {
  return storageTransaction(readStoredUnlocked);
}

async function fromTokenResponse(
  tokenResponse: any,
  expectedNonce?: string,
  expectedEpoch: number = sessionEpoch,
): Promise<DaOidcSession> {
  if (expectedEpoch !== sessionEpoch) return failed('session_superseded');
  const accessToken = tokenResponse?.accessToken || tokenResponse?.access_token;
  if (!accessToken || typeof accessToken !== 'string') return failed('access_token_missing');

  const access = decodeJwt(accessToken);
  const idToken = tokenResponse?.idToken || tokenResponse?.id_token;
  const id = decodeJwt(idToken);

  if (expectedNonce) {
    // A successful authorization-code exchange MUST return an ID token with the exact nonce.
    // Decoded claims are only defense in depth; the API verifies the access token signature.
    if (!idToken || typeof id?.nonce !== 'string') return failed('jwt_nonce_required');
    if (id.nonce !== expectedNonce) return failed('jwt_nonce_mismatch');
    if (typeof id.sub !== 'string' || typeof access.sub !== 'string' || id.sub !== access.sub) {
      return failed('jwt_subject_mismatch');
    }
    if (id.iss !== DA_OIDC_CONFIG.issuer) return failed('jwt_issuer_mismatch');
    const audiences = Array.isArray(id.aud) ? id.aud : [id.aud];
    if (!audiences.includes(DA_OIDC_CONFIG.clientId)) return failed('jwt_audience_mismatch');
    if (typeof id.exp !== 'number' || id.exp <= Math.floor(Date.now() / 1000) - DA_OIDC_CONFIG.clockSkewSeconds) {
      return failed('jwt_id_expired');
    }
  }

  if (!hasExpectedRole(access) && !hasExpectedRole(id)) {
    return failed('jwt_role_missing');
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt =
    typeof access?.exp === 'number'
      ? access.exp
      : now + Number(tokenResponse?.expiresIn || tokenResponse?.expires_in || 300);

  const stored: Stored = {
    accessToken,
    refreshToken: tokenResponse?.refreshToken || tokenResponse?.refresh_token,
    idToken,
    expiresAt,
    displayName:
      (typeof id?.name === 'string' && id.name) ||
      (typeof access?.name === 'string' && access.name) ||
      undefined,
    email:
      (typeof id?.email === 'string' && id.email) ||
      (typeof access?.email === 'string' && access.email) ||
      undefined,
    subject:
      (typeof access?.sub === 'string' && access.sub) ||
      (typeof id?.sub === 'string' && id.sub) ||
      undefined,
  };

  try {
    await persist(stored, expectedEpoch);
  } catch {
    return failed(expectedEpoch !== sessionEpoch
      ? 'session_superseded' : 'secure_store_write_failed');
  }
  if (expectedEpoch !== sessionEpoch) return failed('session_superseded');
  return buildAuthenticated(stored);
}

export function currentOidcSessionEpoch(): number {
  // Captured BEFORE the OAuth browser opens. A later logout invalidates
  // all unfinished authorization-code requests; never reuse this epoch.
  return sessionEpoch;
}

export async function establishOidcSession(
  tokenResponse: any, expectedNonce?: string, expectedEpoch: number = sessionEpoch,
): Promise<DaOidcSession> {
  return fromTokenResponse(tokenResponse, expectedNonce, expectedEpoch);
}

export async function loadOidcSession(): Promise<DaOidcSession> {
  const epoch = sessionEpoch;
  let stored: Stored | null;
  try { stored = await readStored(); }
  catch { return failed('secure_store_read_failed'); }
  if (epoch !== sessionEpoch) return anonymous('logged_out');
  if (!stored) return anonymous('not_authenticated');

  if (stored.expiresAt <= Math.floor(Date.now() / 1000) + 30) {
    return refreshOidcSession();
  }

  const payload = decodeJwt(stored.accessToken);
  if (!hasExpectedRole(payload)) {
    await purgeIfCurrent(epoch).catch(() => undefined);
    return failed('jwt_role_missing');
  }

  return buildAuthenticated(stored);
}

export function refreshOidcSession(): Promise<DaOidcSession> {
  // Keycloak refresh tokens can rotate. Never race two refresh requests
  // using the same refresh token and accidentally log out a valid session.
  if (refreshFlight) return refreshFlight;
  const epoch = sessionEpoch;
  const flight = (async (): Promise<DaOidcSession> => {
    let stored: Stored | null;
    try { stored = await readStored(); }
    catch { return failed('secure_store_read_failed'); }
    if (epoch !== sessionEpoch) return anonymous('logged_out');
    if (!stored?.refreshToken) {
      await purgeIfCurrent(epoch).catch(() => undefined);
      return anonymous('refresh_token_missing');
    }
    try {
      const discovery = await AuthSession.fetchDiscoveryAsync(DA_OIDC_CONFIG.issuer);
      if (epoch !== sessionEpoch) return anonymous('logged_out');
      const next = await AuthSession.refreshAsync(
        {
          clientId: DA_OIDC_CONFIG.clientId,
          refreshToken: stored.refreshToken,
          scopes: [...DA_OIDC_CONFIG.scopes],
        },
        discovery,
      );
      if (epoch !== sessionEpoch) return anonymous('logged_out');
      return fromTokenResponse(next, undefined, epoch);
    } catch {
      if (epoch !== sessionEpoch) return anonymous('logged_out');
      await purgeIfCurrent(epoch).catch(() => undefined);
      return failed('refresh_failed');
    }
  })();
  refreshFlight = flight;
  void flight.then(
    () => { if (refreshFlight === flight) refreshFlight = null; },
    () => { if (refreshFlight === flight) refreshFlight = null; },
  );
  return flight;
}

export async function getValidOidcAccessToken(): Promise<string | null> {
  const current = await loadOidcSession();
  if (current.status !== 'authenticated') return null;
  const token = (current as any).accessToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function logoutOidcSession(): Promise<DaOidcSession> {
  // Invalidate in-flight token exchanges immediately, before awaiting storage.
  sessionEpoch += 1;
  try { await purgeAll(); }
  catch { return failed('secure_store_purge_failed'); }
  return anonymous('logged_out');
}
