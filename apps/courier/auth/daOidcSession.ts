import { validateInitialTokenSet, validateStoredTokenSet, decodeJwtPayload } from './daOidcClaims';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { DA_OIDC_CONFIG } from './daOidcConfig';
import type { DaOidcSession } from './daOidcTypes';

const STORE_KEY = `da.oidc.${DA_OIDC_CONFIG.role}.v2`;

type Json = Record<string, any>;
let sessionGeneration = 0;
export function daOidcSessionGeneration() { return sessionGeneration; }
export function daAssertOidcSessionGeneration(expected: number) { assertSessionGeneration(expected); }
let sessionMutation: Promise<unknown> = Promise.resolve();
function mutateSession(fn: () => Promise<void>): Promise<void> {
  const next = sessionMutation.catch(() => undefined).then(fn);
  sessionMutation = next.catch(() => undefined);
  return next;
}
function assertSessionGeneration(expected: number) {
  if (expected !== sessionGeneration) throw new Error('oidc_identity_changed');
}
async function clearStored(expected = sessionGeneration): Promise<void> {
  return mutateSession(async () => {
    if (expected === sessionGeneration) await SecureStore.deleteItemAsync(STORE_KEY);
  });
}


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
  try { return token ? decodeJwtPayload(token) : {}; } catch { return {}; }
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

async function persist(stored: Stored, expected: number): Promise<void> {
  return mutateSession(async () => {
    assertSessionGeneration(expected);
    await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(stored));
    if (expected !== sessionGeneration) {
      await SecureStore.deleteItemAsync(STORE_KEY);
      throw new Error('oidc_identity_changed');
    }
  });
}

async function readStored(): Promise<Stored | null> {
  await sessionMutation;
  const expected = sessionGeneration;
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (expected !== sessionGeneration || !raw) return null;
  try {
    const parsed = JSON.parse(raw) as Stored;
    return parsed?.accessToken ? parsed : null;
  } catch {
    await clearStored();
    return null;
  }
}

async function fromTokenResponse(tokenResponse: any, expectedNonce: string | undefined, expected: number): Promise<DaOidcSession> {
  assertSessionGeneration(expected);
  const accessToken = tokenResponse?.accessToken || tokenResponse?.access_token;
  if (!accessToken || typeof accessToken !== 'string') return failed('access_token_missing');

  const idToken = tokenResponse?.idToken || tokenResponse?.id_token;
  let access: Json, id: Json;
  try {
    const validated = expectedNonce !== undefined
      ? validateInitialTokenSet(accessToken, idToken || '', expectedNonce)
      : validateStoredTokenSet(accessToken, idToken || '');
    access = validated.access.claims;
    id = validated.id.claims;
  } catch (error: any) { return failed(error?.code || 'jwt_contract_invalid'); }
  assertSessionGeneration(expected);

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

  await persist(stored, expected);
  return buildAuthenticated(stored);
}

export async function establishOidcSession(tokenResponse: any, expectedNonce?: string): Promise<DaOidcSession> {
  if (!expectedNonce) return failed('jwt_nonce_missing');
  const expected = ++sessionGeneration;
  return fromTokenResponse(tokenResponse, expectedNonce, expected);
}

export async function loadOidcSession(): Promise<DaOidcSession> {
  const stored = await readStored();
  if (!stored) return anonymous('not_authenticated');

  if (stored.expiresAt <= Math.floor(Date.now() / 1000) + 30) {
    return refreshOidcSession();
  }

  let valid = false;
  try { validateStoredTokenSet(stored.accessToken, stored.idToken || ''); valid = true; } catch { /* invalid credentials cannot become a connected account */ }
  if (!valid) {
    await clearStored();
    return failed('jwt_role_missing');
  }

  return buildAuthenticated(stored);
}

let refreshFlight: Promise<DaOidcSession> | null = null;
export function refreshOidcSession(): Promise<DaOidcSession> {
  if (!refreshFlight) {
    refreshFlight = performRefreshOidcSession().finally(() => { refreshFlight = null; });
  }
  return refreshFlight;
}
async function performRefreshOidcSession(): Promise<DaOidcSession> {
  const expected = sessionGeneration;
  const stored = await readStored();
  if (!stored?.refreshToken) {
    await clearStored(expected);
    return anonymous('refresh_token_missing');
  }

  try {
    const discovery = await AuthSession.fetchDiscoveryAsync(DA_OIDC_CONFIG.issuer);
    const next = await AuthSession.refreshAsync(
      {
        clientId: DA_OIDC_CONFIG.clientId,
        refreshToken: stored.refreshToken,
        scopes: [...DA_OIDC_CONFIG.scopes],
      },
      discovery,
    );
    assertSessionGeneration(expected);
    const subject = decodeJwt(next.accessToken).sub;
    if (!stored.subject || subject !== stored.subject) throw new Error('oidc_refresh_subject_mismatch');
    return await fromTokenResponse({
      ...next,
      refreshToken: next.refreshToken || stored.refreshToken,
      idToken: next.idToken || stored.idToken,
    }, undefined, expected);
  } catch {
    if (expected === sessionGeneration) await clearStored(expected);
    return failed('refresh_failed');
  }
}

export async function getValidOidcAccessToken(): Promise<string | null> {
  const current = await loadOidcSession();
  if (current.status !== 'authenticated') return null;
  const token = (current as any).accessToken;
  return typeof token === 'string' && token.length > 0 ? token : null;
}

export async function logoutOidcSession(): Promise<DaOidcSession> {
  sessionGeneration += 1;
  await clearStored();
  return anonymous('logged_out');
}
