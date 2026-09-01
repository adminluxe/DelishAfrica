/*
 * DELISHAFRICA — Merchant OIDC session
 * Authorization Code + PKCE S256, system browser, state/nonce,
 * SecureStore token isolation, API-side trusted verification, refresh and logout.
 *
 * Native Expo modules are loaded lazily so the currently installed Merchant
 * development client remains usable until the dedicated rebuild is installed.
 */

type ExpoAuthSessionModule = typeof import('expo-auth-session');
type ExpoCryptoModule = typeof import('expo-crypto');
type ExpoWebBrowserModule = typeof import('expo-web-browser');
type ExpoSecureStoreModule = typeof import('expo-secure-store');

export type MerchantOidcClaims = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  nonce?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  [key: string]: unknown;
};

export type MerchantOidcSession = {
  authenticated: boolean;
  source: 'external' | 'none';
  accessTokenPresent: boolean;
  refreshTokenPresent: boolean;
  idTokenPresent: boolean;
  expiresAt: number | null;
  user: {
    id: string;
    role: 'merchant';
    name: string;
    email?: string;
  } | null;
  apiVerification?: Record<string, unknown> | null;
  reason?: string;
};

export type MerchantOidcRuntimeStatus = {
  ready: boolean;
  rebuildRequired: boolean;
  issuer: string;
  clientId: string;
  redirectUri: string;
  logoutRedirectUri: string;
  reason?: string;
};

const ISSUER = 'https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const CLIENT_ID = 'delishafrica-merchant';
const REDIRECT_URI = 'delishafricamerchant://auth/callback';
const LOGOUT_REDIRECT_URI = 'delishafricamerchant://auth/logout';
const SCOPES = ['openid', 'profile', 'email'];

const ACCESS_KEY = 'da_merchant_oidc_access_token_v1';
const REFRESH_KEY = 'da_merchant_oidc_refresh_token_v1';
const ID_KEY = 'da_merchant_oidc_id_token_v1';
const EXPIRES_KEY = 'da_merchant_oidc_expires_at_v1';
const USER_KEY = 'da_merchant_oidc_user_v1';
const API_VERIFICATION_KEY = 'da_merchant_oidc_api_verification_v1';

function apiBase(): string {
  const env = (globalThis as any)?.process?.env || {};
  const raw =
    env.EXPO_PUBLIC_API_BASE_URL ||
    env.EXPO_PUBLIC_API_URL ||
    'https://api.delishafrica.me/api/v1';
  const normalized = String(raw).replace(/\/+$/, '');
  return normalized.endsWith('/api/v1') ? normalized : `${normalized}/api/v1`;
}

function loadModules(): {
  AuthSession: ExpoAuthSessionModule;
  Crypto: ExpoCryptoModule;
  WebBrowser: ExpoWebBrowserModule;
  SecureStore: ExpoSecureStoreModule;
} {
  try {
    // Lazy loading prevents the current pre-rebuild development client from
    // crashing just because Expo Router discovers this route.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const AuthSession = require('expo-auth-session') as ExpoAuthSessionModule;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Crypto = require('expo-crypto') as ExpoCryptoModule;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const WebBrowser = require('expo-web-browser') as ExpoWebBrowserModule;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store') as ExpoSecureStoreModule;
    return { AuthSession, Crypto, WebBrowser, SecureStore };
  } catch (error: any) {
    throw new Error(
      `merchant_oidc_native_module_unavailable:${String(error?.message || error)}`,
    );
  }
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;

  for (const char of padded) {
    if (char === '=') break;
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error('invalid_base64url_character');
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }

  const binary = String.fromCharCode(...bytes);
  try {
    return decodeURIComponent(
      Array.from(binary, (character) =>
        `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`,
      ).join(''),
    );
  } catch {
    return binary;
  }
}

function decodeJwt(token: string): MerchantOidcClaims {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('invalid_jwt_shape');
  return JSON.parse(decodeBase64Url(parts[1])) as MerchantOidcClaims;
}

function audienceMatches(aud: unknown): boolean {
  return aud === CLIENT_ID || (Array.isArray(aud) && aud.includes(CLIENT_ID));
}

function merchantRoles(claims: MerchantOidcClaims): string[] {
  const clientRoles = claims.resource_access?.[CLIENT_ID]?.roles || [];
  const realmRoles = claims.realm_access?.roles || [];
  return [...new Set([...clientRoles, ...realmRoles])];
}

function assertClaims(
  claims: MerchantOidcClaims,
  options: { nonce?: string; requireMerchantRole?: boolean },
): void {
  const now = Math.floor(Date.now() / 1000);
  if (claims.iss !== ISSUER) throw new Error('oidc_issuer_mismatch');
  if (!audienceMatches(claims.aud)) throw new Error('oidc_audience_mismatch');
  if (typeof claims.exp !== 'number' || claims.exp <= now + 20) {
    throw new Error('oidc_token_expired_or_too_close');
  }
  if (options.nonce && claims.nonce !== options.nonce) {
    throw new Error('oidc_nonce_mismatch');
  }
  if (options.requireMerchantRole && !merchantRoles(claims).includes('merchant')) {
    throw new Error('oidc_merchant_role_missing');
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<any> {
  const response = await fetch(url, init);
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 300) };
  }
  if (!response.ok) {
    throw new Error(`http_${response.status}:${String(data?.reason || data?.message || 'request_failed')}`);
  }
  return data;
}

async function fetchDiscoveryStrict(AuthSession: ExpoAuthSessionModule): Promise<any> {
  const discovery = await AuthSession.fetchDiscoveryAsync(ISSUER);
  const raw = discovery.discoveryDocument as Record<string, any> | undefined;
  if (raw?.issuer !== ISSUER) throw new Error('discovery_issuer_mismatch');
  const pkceMethods = raw?.code_challenge_methods_supported;
  if (!Array.isArray(pkceMethods) || !pkceMethods.includes('S256')) {
    throw new Error('discovery_s256_not_supported');
  }
  if (!discovery.authorizationEndpoint || !discovery.tokenEndpoint) {
    throw new Error('discovery_endpoints_missing');
  }
  return discovery;
}

async function apiVerifyExternal(accessToken: string): Promise<Record<string, unknown>> {
  const data = await requestJson(`${apiBase()}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: accessToken }),
  });

  if (data?.ok === false || data?.authenticated === false) {
    throw new Error(`api_external_verification_failed:${String(data?.reason || 'rejected')}`);
  }
  const role = data?.user?.role || data?.principal?.role || data?.role;
  if (role && role !== 'merchant') throw new Error('api_external_role_mismatch');
  return data as Record<string, unknown>;
}

async function saveTokens(
  SecureStore: ExpoSecureStoreModule,
  tokenResponse: any,
  accessClaims: MerchantOidcClaims,
  apiVerification: Record<string, unknown>,
): Promise<void> {
  const expiresAt =
    typeof accessClaims.exp === 'number'
      ? accessClaims.exp
      : Math.floor(Date.now() / 1000) + Number(tokenResponse.expiresIn || 0);
  const user = {
    id: String(accessClaims.sub || ''),
    role: 'merchant' as const,
    name: String(accessClaims.name || accessClaims.preferred_username || 'Merchant'),
    email: typeof accessClaims.email === 'string' ? accessClaims.email : undefined,
  };

  await SecureStore.setItemAsync(ACCESS_KEY, String(tokenResponse.accessToken));
  if (tokenResponse.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, String(tokenResponse.refreshToken));
  }
  if (tokenResponse.idToken) {
    await SecureStore.setItemAsync(ID_KEY, String(tokenResponse.idToken));
  }
  await SecureStore.setItemAsync(EXPIRES_KEY, String(expiresAt));
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
  await SecureStore.setItemAsync(API_VERIFICATION_KEY, JSON.stringify(apiVerification));
}

async function clearTokens(SecureStore: ExpoSecureStoreModule): Promise<void> {
  await Promise.all(
    [ACCESS_KEY, REFRESH_KEY, ID_KEY, EXPIRES_KEY, USER_KEY, API_VERIFICATION_KEY].map((key) =>
      SecureStore.deleteItemAsync(key),
    ),
  );
}

export function daMerchantOidcConstants() {
  return { issuer: ISSUER, clientId: CLIENT_ID, redirectUri: REDIRECT_URI, logoutRedirectUri: LOGOUT_REDIRECT_URI };
}

export function daMerchantOidcRuntimeStatus(): MerchantOidcRuntimeStatus {
  try {
    loadModules();
    return {
      ready: true,
      rebuildRequired: false,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      logoutRedirectUri: LOGOUT_REDIRECT_URI,
    };
  } catch (error: any) {
    return {
      ready: false,
      rebuildRequired: true,
      issuer: ISSUER,
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      logoutRedirectUri: LOGOUT_REDIRECT_URI,
      reason: String(error?.message || error),
    };
  }
}

export async function daMerchantOidcLogin(): Promise<MerchantOidcSession> {
  const { AuthSession, Crypto, WebBrowser, SecureStore } = loadModules();
  WebBrowser.maybeCompleteAuthSession();

  const discovery = await fetchDiscoveryStrict(AuthSession);
  const nonce = Crypto.randomUUID();
  const request = new AuthSession.AuthRequest({
    clientId: CLIENT_ID,
    responseType: AuthSession.ResponseType.Code,
    redirectUri: REDIRECT_URI,
    scopes: SCOPES,
    usePKCE: true,
    codeChallengeMethod: AuthSession.CodeChallengeMethod.S256,
    prompt: (AuthSession as any).Prompt.Login,
    extraParams: {
      nonce,
    },
  });

  const result = await request.promptAsync(discovery);
  if (result.type !== 'success') {
    throw new Error(`oidc_authorization_${result.type}`);
  }
  const code = result.params?.code;
  if (!code) throw new Error('oidc_authorization_code_missing');
  if (!request.codeVerifier) throw new Error('oidc_pkce_verifier_missing');

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId: CLIENT_ID,
      code,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery,
  );

  if (!tokenResponse.accessToken || !tokenResponse.idToken || !tokenResponse.refreshToken) {
    throw new Error('oidc_token_response_incomplete');
  }

  const accessClaims = decodeJwt(tokenResponse.accessToken);
  const idClaims = decodeJwt(tokenResponse.idToken);
  assertClaims(accessClaims, { requireMerchantRole: true });
  assertClaims(idClaims, { nonce });

  const apiVerification = await apiVerifyExternal(tokenResponse.accessToken);
  await saveTokens(SecureStore, tokenResponse, accessClaims, apiVerification);
  return await daMerchantOidcSession();
}

let merchantRefreshInFlight: Promise<MerchantOidcSession> | null = null;

async function readMerchantOidcSession(allowRefresh: boolean): Promise<MerchantOidcSession> {
  let SecureStore: ExpoSecureStoreModule;
  try {
    SecureStore = loadModules().SecureStore;
  } catch {
    return {
      authenticated: false,
      source: 'none',
      accessTokenPresent: false,
      refreshTokenPresent: false,
      idTokenPresent: false,
      expiresAt: null,
      user: null,
      reason: 'merchant_oidc_native_module_unavailable',
    };
  }

  const [accessToken, refreshToken, idToken, expiresRaw, userRaw, apiRaw] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
    SecureStore.getItemAsync(ID_KEY),
    SecureStore.getItemAsync(EXPIRES_KEY),
    SecureStore.getItemAsync(USER_KEY),
    SecureStore.getItemAsync(API_VERIFICATION_KEY),
  ]);
  const expiresAt = expiresRaw ? Number(expiresRaw) : null;
  const authenticated = Boolean(accessToken && expiresAt && expiresAt > Math.floor(Date.now() / 1000) + 20);

  if (!authenticated && refreshToken && allowRefresh) {
    try {
      return await daMerchantOidcRefresh();
    } catch {
      return {
        authenticated: false,
        source: 'none',
        accessTokenPresent: Boolean(accessToken),
        refreshTokenPresent: true,
        idTokenPresent: Boolean(idToken),
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
        user: userRaw ? JSON.parse(userRaw) : null,
        apiVerification: apiRaw ? JSON.parse(apiRaw) : null,
        reason: 'oidc_refresh_unavailable',
      };
    }
  }

  return {
    authenticated,
    source: authenticated ? 'external' : 'none',
    accessTokenPresent: Boolean(accessToken),
    refreshTokenPresent: Boolean(refreshToken),
    idTokenPresent: Boolean(idToken),
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : null,
    user: userRaw ? JSON.parse(userRaw) : null,
    apiVerification: apiRaw ? JSON.parse(apiRaw) : null,
    reason: authenticated ? undefined : accessToken ? 'oidc_token_expired' : 'oidc_session_absent',
  };
}

async function performMerchantOidcRefresh(): Promise<MerchantOidcSession> {
  const { AuthSession, SecureStore } = loadModules();
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) throw new Error('oidc_refresh_token_missing');

  try {
    const discovery = await fetchDiscoveryStrict(AuthSession);
    const tokenResponse = await AuthSession.refreshAsync(
      { clientId: CLIENT_ID, refreshToken, scopes: SCOPES },
      discovery,
    );
    if (!tokenResponse.accessToken) throw new Error('oidc_refreshed_access_token_missing');

    const accessClaims = decodeJwt(tokenResponse.accessToken);
    assertClaims(accessClaims, { requireMerchantRole: true });
    const apiVerification = await apiVerifyExternal(tokenResponse.accessToken);

    const preservedIdToken = tokenResponse.idToken || (await SecureStore.getItemAsync(ID_KEY));
    const rotated = {
      ...tokenResponse,
      refreshToken: tokenResponse.refreshToken || refreshToken,
      idToken: preservedIdToken || undefined,
    };
    await saveTokens(SecureStore, rotated, accessClaims, apiVerification);
    return await readMerchantOidcSession(false);
  } catch (error: any) {
    const normalized = String(error?.message || error).toLowerCase();
    if (normalized.includes('invalid_grant') || normalized.includes('invalid refresh')) {
      await clearTokens(SecureStore).catch(() => undefined);
    }
    throw error;
  }
}

export async function daMerchantOidcRefresh(): Promise<MerchantOidcSession> {
  if (!merchantRefreshInFlight) {
    merchantRefreshInFlight = performMerchantOidcRefresh().finally(() => {
      merchantRefreshInFlight = null;
    });
  }
  return await merchantRefreshInFlight;
}

export async function daMerchantOidcSession(): Promise<MerchantOidcSession> {
  return await readMerchantOidcSession(true);
}

export async function daMerchantOidcAccessToken(): Promise<string | null> {
  try {
    const session = await daMerchantOidcSession();
    if (!session.authenticated) return null;
    return await loadModules().SecureStore.getItemAsync(ACCESS_KEY);
  } catch {
    return null;
  }
}

export async function daMerchantOidcLogout(): Promise<void> {
  const { AuthSession, WebBrowser, SecureStore } = loadModules();
  const [idToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ID_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);

  try {
    const discovery = await fetchDiscoveryStrict(AuthSession);
    if (refreshToken && discovery.revocationEndpoint) {
      await AuthSession.revokeAsync(
        {
          clientId: CLIENT_ID,
          token: refreshToken,
          tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken,
        },
        discovery,
      );
    }

    if (idToken && discovery.endSessionEndpoint) {
      const url = new URL(discovery.endSessionEndpoint);
      url.searchParams.set('client_id', CLIENT_ID);
      url.searchParams.set('id_token_hint', idToken);
      url.searchParams.set('post_logout_redirect_uri', LOGOUT_REDIRECT_URI);
      await WebBrowser.openAuthSessionAsync(url.toString(), LOGOUT_REDIRECT_URI);
    }
  } finally {
    await clearTokens(SecureStore);
  }
}
