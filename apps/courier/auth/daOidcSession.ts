import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { DA_OIDC_CONFIG } from './daOidcConfig';
import type { DaOidcSession } from './daOidcTypes';

const STORE_KEY = `da.oidc.${DA_OIDC_CONFIG.role}.v2`;

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

async function persist(stored: Stored): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(stored));
}

async function readStored(): Promise<Stored | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Stored;
    return parsed?.accessToken ? parsed : null;
  } catch {
    await SecureStore.deleteItemAsync(STORE_KEY);
    return null;
  }
}

async function fromTokenResponse(tokenResponse: any, expectedNonce?: string): Promise<DaOidcSession> {
  const accessToken = tokenResponse?.accessToken || tokenResponse?.access_token;
  if (!accessToken || typeof accessToken !== 'string') return failed('access_token_missing');

  const access = decodeJwt(accessToken);
  const idToken = tokenResponse?.idToken || tokenResponse?.id_token;
  const id = decodeJwt(idToken);

  if (expectedNonce && idToken && typeof id?.nonce === 'string' && id.nonce !== expectedNonce) {
    return failed('jwt_nonce_mismatch');
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

  await persist(stored);
  return buildAuthenticated(stored);
}

export async function establishOidcSession(tokenResponse: any, expectedNonce?: string): Promise<DaOidcSession> {
  return fromTokenResponse(tokenResponse, expectedNonce);
}

export async function loadOidcSession(): Promise<DaOidcSession> {
  const stored = await readStored();
  if (!stored) return anonymous('not_authenticated');

  if (stored.expiresAt <= Math.floor(Date.now() / 1000) + 30) {
    return refreshOidcSession();
  }

  const payload = decodeJwt(stored.accessToken);
  if (!hasExpectedRole(payload)) {
    await SecureStore.deleteItemAsync(STORE_KEY);
    return failed('jwt_role_missing');
  }

  return buildAuthenticated(stored);
}

export async function refreshOidcSession(): Promise<DaOidcSession> {
  const stored = await readStored();
  if (!stored?.refreshToken) {
    await SecureStore.deleteItemAsync(STORE_KEY);
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
    return fromTokenResponse(next);
  } catch {
    await SecureStore.deleteItemAsync(STORE_KEY);
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
  await SecureStore.deleteItemAsync(STORE_KEY);
  return anonymous('logged_out');
}
