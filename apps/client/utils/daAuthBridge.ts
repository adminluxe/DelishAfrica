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
};

const ACCESS_KEY = 'da_auth_access_token_v1';
const REFRESH_KEY = 'da_auth_refresh_token_v1';

const MEMORY: Record<string, string> = {};

function apiBase(): string {
  const extra = (globalThis as any)?.process?.env || {};
  const raw =
    extra.EXPO_PUBLIC_API_BASE_URL ||
    extra.EXPO_PUBLIC_API_URL ||
    'https://api.delishafrica.me/api/v1';

  return String(raw).replace(/\/+$/, '').endsWith('/api/v1')
    ? String(raw).replace(/\/+$/, '')
    : String(raw).replace(/\/+$/, '') + '/api/v1';
}

function getSecureStore(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-secure-store');
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string): Promise<void> {
  const SecureStore = getSecureStore();

  if (SecureStore?.setItemAsync) {
    await SecureStore.setItemAsync(key, value);
    return;
  }

  MEMORY[key] = value;
}

async function getItem(key: string): Promise<string | null> {
  const SecureStore = getSecureStore();

  if (SecureStore?.getItemAsync) {
    return await SecureStore.getItemAsync(key);
  }

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

export async function daAuthHealth(): Promise<any> {
  const res = await fetch(`${apiBase()}/auth/health`);
  return await res.json();
}

export async function daDevLogin(payload?: {
  role?: DaRole;
  name?: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
}): Promise<DaAuthSession> {
  const res = await fetch(`${apiBase()}/auth/dev-login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      role: 'client',
      name: 'Client DelishAfrica',
      ...(payload || {}),
    }),
  });

  const data = await res.json();

  const token = data.accessToken || data.token;
  if (token) {
    await setItem(ACCESS_KEY, token);
  }

  return data;
}

export async function daGetToken(): Promise<string | null> {
  return await getItem(ACCESS_KEY);
}

export async function daLogout(): Promise<void> {
  try {
    const ordersApi = require('./daOrdersApi');
    await ordersApi.daPurgeOrdersAccountState?.();
  } catch {
    // Best effort account-bound cache purge.
  }
  await deleteItem(ACCESS_KEY);
  await deleteItem(REFRESH_KEY);
}

export async function daMe(): Promise<DaAuthSession> {
  const token = await daGetToken();

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${apiBase()}/auth/me`, { headers });
  return await res.json();
}

export async function daVerify(): Promise<DaAuthSession> {
  const token = await daGetToken();

  if (!token) {
    return {
      ok: false,
      authenticated: false,
      required: false,
      reason: 'missing_local_token',
      user: null,
    };
  }

  const res = await fetch(`${apiBase()}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
  });

  return await res.json();
}

export function daAuthRole(): DaRole {
  return 'client';
}

export function daAuthLabel(): string {
  return 'Client DelishAfrica';
}

export function daAuthAccent(): string {
  return '#4BA3FF';
}

export function daAuthApiBase(): string {
  return apiBase();
}
