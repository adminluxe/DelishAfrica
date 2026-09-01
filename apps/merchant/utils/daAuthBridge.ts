import {
  daMerchantOidcAccessToken,
  daMerchantOidcLogout,
  daMerchantOidcSession,
  type MerchantOidcSession,
} from './daMerchantOidc';

type DaRole = 'client' | 'merchant' | 'courier' | 'ops';

export type DaAuthUser = {
  id: string;
  role: DaRole;
  name: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
};

export type DaAuthSession = {
  ok: boolean;
  authenticated?: boolean;
  required?: boolean;
  token?: string;
  accessToken?: string;
  user?: DaAuthUser | null;
  reason?: string;
  source?: 'external' | 'development' | 'none';
  ownershipEligible?: boolean;
};

const DEV_ACCESS_KEY = 'da_auth_access_token_v1';
const DEV_REFRESH_KEY = 'da_auth_refresh_token_v1';
const MEMORY: Record<string, string> = {};

function apiBase(): string {
  const env = (globalThis as any)?.process?.env || {};
  const raw =
    env.EXPO_PUBLIC_API_BASE_URL ||
    env.EXPO_PUBLIC_API_URL ||
    'https://api.delishafrica.me/api/v1';
  const normalized = String(raw).replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

function getSecureStore(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-secure-store');
  } catch {
    return null;
  }
}


async function getItem(key: string): Promise<string | null> {
  const SecureStore = getSecureStore();
  if (SecureStore?.getItemAsync) return await SecureStore.getItemAsync(key);
  return MEMORY[key] || null;
}

async function deleteItem(key: string): Promise<void> {
  const SecureStore = getSecureStore();
  if (SecureStore?.deleteItemAsync) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  delete MEMORY[key];
}

async function requestSession(path: string, init?: RequestInit): Promise<DaAuthSession> {
  const response = await fetch(`${apiBase()}${path}`, init);
  const data = await response.json();
  return data as DaAuthSession;
}

function externalToDaSession(session: MerchantOidcSession): DaAuthSession {
  return {
    ok: session.authenticated,
    authenticated: session.authenticated,
    required: false,
    source: session.authenticated ? 'external' : 'none',
    reason: session.reason,
    user: session.user,
    ownershipEligible: session.authenticated,
  };
}

export async function daAuthHealth(): Promise<any> {
  const response = await fetch(`${apiBase()}/auth/health`);
  return await response.json();
}

export async function daGetToken(): Promise<string | null> {
  const external = await daMerchantOidcSession();
  if (!external.authenticated) return null;
  return await daMerchantOidcAccessToken();
}

export async function daLogout(): Promise<void> {
  try {
    const ordersApi = require('./daOrdersApi');
    await ordersApi.daPurgeOrdersAccountState?.();
  } catch {
    // Best effort account-bound cache purge.
  }
  await deleteItem(DEV_ACCESS_KEY);
  await deleteItem(DEV_REFRESH_KEY);
}

export async function daLogoutAll(): Promise<void> {
  try {
    await daMerchantOidcLogout();
  } finally {
    await daLogout();
  }
}

export async function daMe(): Promise<DaAuthSession> {
  const external = await daMerchantOidcSession();
  if (external.authenticated) {
    const token = await daMerchantOidcAccessToken();
    if (token) {
      const api = await requestSession('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return { ...api, source: 'external', ownershipEligible: true };
    }
    return externalToDaSession(external);
  }

  return externalToDaSession(external);
}

export async function daVerify(): Promise<DaAuthSession> {
  const externalToken = await daMerchantOidcAccessToken();
  if (!externalToken) {
    return {
      ok: false,
      authenticated: false,
      required: false,
      source: 'none',
      ownershipEligible: false,
      reason: 'missing_local_token',
      user: null,
    };
  }
  const api = await requestSession('/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: externalToken }),
  });
  return {
    ...api,
    source: 'external',
    ownershipEligible: true,
  };
}

export function daAuthRole(): DaRole {
  return 'merchant';
}

export function daAuthLabel(): string {
  return 'Partenaire Thieyp';
}

export function daAuthAccent(): string {
  return '#D9893D';
}

export function daAuthApiBase(): string {
  return apiBase();
}
