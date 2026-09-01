import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Linking, Platform } from 'react-native';
import { DA_OIDC_CONFIG } from './daOidcConfig';
import type { DaOidcSession } from './daOidcTypes';

const STORE_KEY = `da.oidc.${DA_OIDC_CONFIG.role}.v2`;
const CANONICAL_PUBLIC_API_BASE_URL = 'https://api.delishafrica.me/api/v1';
const API_BASE_URL = String(
  process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.EXPO_PUBLIC_API_URL ||
    CANONICAL_PUBLIC_API_BASE_URL,
).replace(/\/+$/, '');

type Json = Record<string, any>;

const DA_NETWORK_TIMEOUT_MS = 15000;
const DA_DISCOVERY_TIMEOUT_MS = 15000;
const DA_TOKEN_REVOCATION_TIMEOUT_MS = 20000;
const DA_LOGOUT_BROWSER_TIMEOUT_MS = 120000;
const DA_EXTERNAL_BROWSER_PRESENT_TIMEOUT_MS = 12000;
const DA_EXTERNAL_BROWSER_RETURN_TIMEOUT_MS = 180000;
const LOGOUT_PENDING_KEY = `${STORE_KEY}.logout.pending.v1`;
const LOGOUT_EVIDENCE_KEY = `${STORE_KEY}.logout.evidence.v1`;
const LOGOUT_PENDING_MAX_AGE_MS = 10 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number, code: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error(code));
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, code: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DA_NETWORK_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as any)?.name === 'AbortError') throw new Error(code);
    throw error;
  } finally {
    clearTimeout(timer);
  }
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

type LogoutPending = {
  version: 1;
  phase: 'external_browser_presented';
  startedAt: number;
  browserMode: 'ios_system_safari' | 'native_auth_session';
};

let activeLogoutPromise: Promise<DaOidcSession> | null = null;

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

async function readLogoutPending(): Promise<LogoutPending | null> {
  const raw = await SecureStore.getItemAsync(LOGOUT_PENDING_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as LogoutPending;
    if (
      parsed?.version !== 1 ||
      parsed?.phase !== 'external_browser_presented' ||
      typeof parsed.startedAt !== 'number' ||
      !['ios_system_safari', 'native_auth_session'].includes(parsed.browserMode)
    ) {
      throw new Error('logout_pending_invalid');
    }
    if (Date.now() - parsed.startedAt > LOGOUT_PENDING_MAX_AGE_MS) {
      await SecureStore.deleteItemAsync(LOGOUT_PENDING_KEY);
      return null;
    }
    return parsed;
  } catch {
    await SecureStore.deleteItemAsync(LOGOUT_PENDING_KEY);
    return null;
  }
}

async function writeLogoutPending(pending: LogoutPending): Promise<void> {
  await SecureStore.setItemAsync(LOGOUT_PENDING_KEY, JSON.stringify(pending));
}

async function clearLogoutPending(): Promise<void> {
  await SecureStore.deleteItemAsync(LOGOUT_PENDING_KEY);
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

  // A successful fresh authentication starts a new lifecycle. Any completed/pending logout
  // evidence from an older lifecycle must not be reusable by the next one.
  await SecureStore.deleteItemAsync(LOGOUT_PENDING_KEY);
  await SecureStore.deleteItemAsync(LOGOUT_EVIDENCE_KEY);
  lastLogoutEvidence = null;
  await persist(stored);
  return buildAuthenticated(stored);
}

export async function establishOidcSession(tokenResponse: any, expectedNonce?: string): Promise<DaOidcSession> {
  return fromTokenResponse(tokenResponse, expectedNonce);
}

export async function loadOidcSession(): Promise<DaOidcSession> {
  // HF15 S2C cold-resume hardening: if iOS/Metro rebuilt the JS runtime while the external
  // browser was completing Keycloak logout, normal app boot is allowed to finish that pending
  // security transaction. This is route-independent and does not require secure-session.tsx
  // to have survived in memory.
  const pending = await readLogoutPending();
  if (pending) {
    if (activeLogoutPromise) return activeLogoutPromise;
    const storedForResume = await readStored();
    if (!storedForResume) {
      await clearLogoutPending();
      return anonymous('not_authenticated');
    }
    return startLogoutSingleFlight(() => completePendingLogoutAfterExternalBrowser(storedForResume, pending));
  }

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
    const discovery = await withTimeout(
      AuthSession.fetchDiscoveryAsync(DA_OIDC_CONFIG.issuer),
      DA_DISCOVERY_TIMEOUT_MS,
      'refresh_discovery_timeout',
    );
    const next = await withTimeout(AuthSession.refreshAsync(
      {
        clientId: DA_OIDC_CONFIG.clientId,
        refreshToken: stored.refreshToken,
        scopes: [...DA_OIDC_CONFIG.scopes],
      },
      discovery,
    ), DA_TOKEN_REVOCATION_TIMEOUT_MS, 'refresh_exchange_timeout');
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

function safeLogoutErrorCode(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || 'logout_failed');
  return /^[a-z0-9_.:-]{1,96}$/i.test(raw) ? raw : 'logout_failed';
}

function tokenIssuer(token: string): string {
  const payload = decodeJwt(token);
  return typeof payload?.iss === 'string' ? payload.iss : '';
}

function sessionRevokeApiCandidates(accessToken: string): string[] {
  const candidates = [API_BASE_URL];
  const issuerMatchesConfiguredOidc = tokenIssuer(accessToken) === DA_OIDC_CONFIG.issuer;
  if (issuerMatchesConfiguredOidc && !candidates.includes(CANONICAL_PUBLIC_API_BASE_URL)) {
    candidates.push(CANONICAL_PUBLIC_API_BASE_URL);
  }
  return candidates;
}

async function responseJsonSafe(response: Response): Promise<Json> {
  const text = await response.text();
  if (!text) return {};
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isSuccessfulSessionRevokeAck(status: number, body: Json): boolean {
  if (status !== 200 && status !== 201) return false;
  const ttl = Number(body?.expiresInSeconds);
  return (
    body?.ok === true &&
    body?.authenticated === true &&
    body?.revoked === true &&
    body?.strategy === 'redis_hashed_sid' &&
    body?.rawSessionIdentifierStored === false &&
    Number.isFinite(ttl) &&
    ttl >= 1 &&
    ttl <= 3600
  );
}

async function revokeApiClientSession(accessToken: string): Promise<void> {
  const candidates = sessionRevokeApiCandidates(accessToken);
  let lastStatus = 0;

  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index];
    const response = await fetchWithTimeout(`${baseUrl}/auth/client/session/revoke`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    }, 'api_session_revoke_timeout');
    lastStatus = response.status;
    const body = await responseJsonSafe(response);

    if (isSuccessfulSessionRevokeAck(response.status, body)) return;
    if (response.status >= 200 && response.status < 300) {
      throw new Error('api_session_revoke_success_contract_invalid');
    }
    if (response.status === 401 && body?.code === 'client_session_revoked') return;

    const hasAnotherCandidate = index + 1 < candidates.length;
    if (response.status === 404 && hasAnotherCandidate) continue;
    throw new Error(`api_session_revoke_http_${response.status}`);
  }

  throw new Error(`api_session_revoke_http_${lastStatus || 0}`);
}

function endSessionUrl(discovery: AuthSession.DiscoveryDocument, idToken: string): string {
  if (!discovery.endSessionEndpoint) throw new Error('end_session_endpoint_missing');
  const query = [
    `id_token_hint=${encodeURIComponent(idToken)}`,
    `client_id=${encodeURIComponent(DA_OIDC_CONFIG.clientId)}`,
  ].join('&');
  return `${discovery.endSessionEndpoint}${discovery.endSessionEndpoint.includes('?') ? '&' : '?'}${query}`;
}

export type DaOidcLogoutEvidence = {
  browserMode: 'ios_system_safari' | 'native_auth_session';
  apiSessionRevokedFirst: true;
  idpBrowserRoundTrip: true;
  postLogoutOldAccessTokenRejected: true;
  postLogoutOldAccessTokenCode: 'client_session_revoked';
  preExplicitRevokeRefreshRejected: true;
  explicitRefreshRevocationConfirmed: true;
  localSessionCleared: true;
  resumedAfterRuntimeRestart: boolean;
  completedAt: number;
};

let lastLogoutEvidence: DaOidcLogoutEvidence | null = null;

export function getLastOidcLogoutEvidence(): DaOidcLogoutEvidence | null {
  return lastLogoutEvidence ? { ...lastLogoutEvidence } : null;
}

export async function loadLastOidcLogoutEvidence(): Promise<DaOidcLogoutEvidence | null> {
  if (lastLogoutEvidence) return { ...lastLogoutEvidence };
  const raw = await SecureStore.getItemAsync(LOGOUT_EVIDENCE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DaOidcLogoutEvidence;
    if (
      parsed?.apiSessionRevokedFirst !== true ||
      parsed?.idpBrowserRoundTrip !== true ||
      parsed?.postLogoutOldAccessTokenRejected !== true ||
      parsed?.postLogoutOldAccessTokenCode !== 'client_session_revoked' ||
      parsed?.preExplicitRevokeRefreshRejected !== true ||
      parsed?.explicitRefreshRevocationConfirmed !== true ||
      parsed?.localSessionCleared !== true ||
      typeof parsed.resumedAfterRuntimeRestart !== 'boolean' ||
      typeof parsed.completedAt !== 'number'
    ) {
      return null;
    }
    lastLogoutEvidence = parsed;
    return { ...parsed };
  } catch {
    return null;
  }
}

async function persistLogoutEvidence(evidence: DaOidcLogoutEvidence): Promise<void> {
  lastLogoutEvidence = evidence;
  await SecureStore.setItemAsync(LOGOUT_EVIDENCE_KEY, JSON.stringify(evidence));
}

async function proveOldAccessTokenRejected(accessToken: string): Promise<void> {
  const candidates = sessionRevokeApiCandidates(accessToken);
  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index];
    const response = await fetchWithTimeout(
      `${baseUrl}/auth/client/me`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      },
      'post_logout_old_access_token_probe_timeout',
    );
    const body = await responseJsonSafe(response);
    if (response.status === 401 && body?.code === 'client_session_revoked') return;
    const hasAnotherCandidate = index + 1 < candidates.length;
    if (response.status === 404 && hasAnotherCandidate) continue;
    throw new Error(`post_logout_old_access_token_expected_401_got_${response.status}_${typeof body?.code === 'string' ? body.code : 'no_code'}`);
  }
  throw new Error('post_logout_old_access_token_probe_failed');
}

async function isApiSessionAlreadyRevoked(accessToken: string): Promise<boolean> {
  const candidates = sessionRevokeApiCandidates(accessToken);
  for (let index = 0; index < candidates.length; index += 1) {
    const baseUrl = candidates[index];
    const response = await fetchWithTimeout(
      `${baseUrl}/auth/client/me`,
      { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } },
      'pre_logout_api_probe_timeout',
    );
    const body = await responseJsonSafe(response);
    if (response.status === 401 && body?.code === 'client_session_revoked') return true;
    if (response.status === 200) return false;
    const hasAnotherCandidate = index + 1 < candidates.length;
    if (response.status === 404 && hasAnotherCandidate) continue;
    throw new Error(`pre_logout_api_probe_unexpected_${response.status}_${typeof body?.code === 'string' ? body.code : 'no_code'}`);
  }
  return false;
}

async function clearLocalSessionAndLogoutState(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
  await clearLogoutPending();
}

function startLogoutSingleFlight(factory: () => Promise<DaOidcSession>): Promise<DaOidcSession> {
  if (activeLogoutPromise) return activeLogoutPromise;
  const promise = factory().finally(() => {
    activeLogoutPromise = null;
  });
  activeLogoutPromise = promise;
  return promise;
}

async function waitForExternalBrowserRoundTrip(url: string): Promise<void> {
  if (Platform.OS !== 'ios') throw new Error('external_browser_roundtrip_ios_only');

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let sawAwayFromApp = false;
    let presentTimer: ReturnType<typeof setTimeout> | null = null;
    let returnTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      subscription.remove();
      if (presentTimer) clearTimeout(presentTimer);
      if (returnTimer) clearTimeout(returnTimer);
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve();
    };

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'inactive' || state === 'background') {
        sawAwayFromApp = true;
        if (presentTimer) {
          clearTimeout(presentTimer);
          presentTimer = null;
        }
        return;
      }
      if (state === 'active' && sawAwayFromApp) {
        finish();
      }
    });

    presentTimer = setTimeout(() => {
      if (!sawAwayFromApp) finish(new Error('idp_logout_external_browser_not_presented'));
    }, DA_EXTERNAL_BROWSER_PRESENT_TIMEOUT_MS);

    returnTimer = setTimeout(() => {
      finish(new Error('idp_logout_external_browser_return_timeout'));
    }, DA_EXTERNAL_BROWSER_RETURN_TIMEOUT_MS);

    Linking.openURL(url).catch(() => finish(new Error('idp_logout_external_browser_open_failed')));
  });
}

async function openIdpLogoutBrowser(url: string): Promise<'ios_system_safari' | 'native_auth_session'> {
  // Expo SDK 54 uses expo-web-browser 15.x. That native iOS implementation can leave
  // openAuthSessionAsync pending forever when ASWebAuthenticationSession.start() returns false.
  // The production logout therefore uses the real external system browser on iOS, which still
  // shares normal browser cookies, and waits for the user to return after Keycloak says logged out.
  if (Platform.OS === 'ios') {
    await waitForExternalBrowserRoundTrip(url);
    return 'ios_system_safari';
  }

  const result = await withTimeout(
    WebBrowser.openAuthSessionAsync(url, null, { preferEphemeralSession: false }),
    DA_LOGOUT_BROWSER_TIMEOUT_MS,
    'idp_logout_browser_timeout',
  );
  if (!['cancel', 'dismiss', 'success'].includes(result.type)) {
    throw new Error(`idp_logout_browser_result_${result.type}`);
  }
  return 'native_auth_session';
}

async function probeRefreshTokenAfterBrowser(
  discovery: AuthSession.DiscoveryDocument,
  refreshToken: string,
): Promise<'rejected' | 'active_consumed'> {
  if (!discovery.tokenEndpoint) throw new Error('token_endpoint_missing');
  const response = await fetchWithTimeout(
    discovery.tokenEndpoint,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: [
        'grant_type=refresh_token',
        `client_id=${encodeURIComponent(DA_OIDC_CONFIG.clientId)}`,
        `refresh_token=${encodeURIComponent(refreshToken)}`,
      ].join('&'),
    },
    'idp_logout_refresh_probe_timeout',
  );
  const body = await responseJsonSafe(response);

  if (response.status === 200) {
    const replacementRefresh =
      typeof body?.refresh_token === 'string' && body.refresh_token
        ? body.refresh_token
        : refreshToken;
    if (discovery.revocationEndpoint) {
      try {
        await fetchWithTimeout(
          discovery.revocationEndpoint,
          {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: [
              `client_id=${encodeURIComponent(DA_OIDC_CONFIG.clientId)}`,
              `token=${encodeURIComponent(replacementRefresh)}`,
              'token_type_hint=refresh_token',
            ].join('&'),
          },
          'unexpected_refresh_cleanup_timeout',
        );
      } catch {
        // The API SID denylist is already active. The fresh replacement is best-effort cleanup.
      }
    }
    return 'active_consumed';
  }

  const oauthError = typeof body?.error === 'string' ? body.error : '';
  if ((response.status === 400 || response.status === 401) && oauthError === 'invalid_grant') {
    return 'rejected';
  }
  throw new Error(`idp_logout_refresh_probe_http_${response.status}_${oauthError || 'no_error'}`);
}

async function revokeRefreshTokenExplicitly(
  discovery: AuthSession.DiscoveryDocument,
  refreshToken: string,
): Promise<void> {
  if (!discovery.revocationEndpoint) throw new Error('revocation_endpoint_missing');
  const response = await fetchWithTimeout(
    discovery.revocationEndpoint,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: [
        `client_id=${encodeURIComponent(DA_OIDC_CONFIG.clientId)}`,
        `token=${encodeURIComponent(refreshToken)}`,
        'token_type_hint=refresh_token',
      ].join('&'),
    },
    'refresh_token_revocation_timeout',
  );
  if (response.status !== 200 && response.status !== 204) {
    throw new Error(`refresh_token_revocation_http_${response.status}`);
  }
}

async function completeLogoutAfterExternalBrowser(
  stored: Stored,
  discovery: AuthSession.DiscoveryDocument,
  browserMode: 'ios_system_safari' | 'native_auth_session',
  resumedAfterRuntimeRestart: boolean,
): Promise<DaOidcSession> {
  await proveOldAccessTokenRejected(stored.accessToken);

  const refreshState = await probeRefreshTokenAfterBrowser(discovery, stored.refreshToken || '');
  if (refreshState !== 'rejected') {
    // The refresh probe demonstrated that the IdP logout was NOT complete. Because the probe may
    // rotate/consume a refresh token, do not allow a later cold-resume to reinterpret the now
    // invalid original token as proof of logout. Fail closed, clear the local session, and require
    // one fresh authentication/certification cycle.
    await clearLocalSessionAndLogoutState();
    await SecureStore.deleteItemAsync(LOGOUT_EVIDENCE_KEY);
    lastLogoutEvidence = null;
    return failed('idp_logout_not_confirmed_fresh_cycle_required');
  }

  await revokeRefreshTokenExplicitly(discovery, stored.refreshToken || '');
  await clearLocalSessionAndLogoutState();

  const evidence: DaOidcLogoutEvidence = {
    browserMode,
    apiSessionRevokedFirst: true,
    idpBrowserRoundTrip: true,
    postLogoutOldAccessTokenRejected: true,
    postLogoutOldAccessTokenCode: 'client_session_revoked',
    preExplicitRevokeRefreshRejected: true,
    explicitRefreshRevocationConfirmed: true,
    localSessionCleared: true,
    resumedAfterRuntimeRestart,
    completedAt: Date.now(),
  };
  await persistLogoutEvidence(evidence);
  return anonymous(resumedAfterRuntimeRestart ? 'logged_out_resumed' : 'logged_out');
}

async function completePendingLogoutAfterExternalBrowser(
  stored: Stored,
  pending: LogoutPending,
): Promise<DaOidcSession> {
  try {
    const discovery = await withTimeout(
      AuthSession.fetchDiscoveryAsync(DA_OIDC_CONFIG.issuer),
      DA_DISCOVERY_TIMEOUT_MS,
      'idp_discovery_timeout',
    );
    if (!stored.refreshToken) throw new Error('refresh_token_missing_for_idp_logout');
    return await completeLogoutAfterExternalBrowser(
      stored,
      discovery,
      pending.browserMode,
      true,
    );
  } catch (error) {
    return failed(safeLogoutErrorCode(error));
  }
}

async function recoverLegacyPartialRevocationIfSafe(stored: Stored): Promise<DaOidcSession | null> {
  const alreadyRevoked = await isApiSessionAlreadyRevoked(stored.accessToken);
  if (!alreadyRevoked) return null;
  if (!stored.refreshToken) {
    await clearLocalSessionAndLogoutState();
    return anonymous('partial_revocation_recovered');
  }

  const discovery = await withTimeout(
    AuthSession.fetchDiscoveryAsync(DA_OIDC_CONFIG.issuer),
    DA_DISCOVERY_TIMEOUT_MS,
    'partial_recovery_idp_discovery_timeout',
  );
  const state = await probeRefreshTokenAfterBrowser(discovery, stored.refreshToken);
  if (state === 'rejected') {
    // This path is cleanup only for a pre-HF6 transaction. It does not mint certification evidence;
    // the caller must start a fresh cycle afterwards.
    await revokeRefreshTokenExplicitly(discovery, stored.refreshToken);
    await clearLocalSessionAndLogoutState();
    await SecureStore.deleteItemAsync(LOGOUT_EVIDENCE_KEY);
    lastLogoutEvidence = null;
    return anonymous('partial_revocation_recovered');
  }

  // A refresh token was still active. The probe has consumed/rotated it, so the safest behavior is
  // local fail-closed cleanup and a fresh authentication cycle rather than trying to infer an IdP
  // browser result from a later invalid_grant.
  await clearLocalSessionAndLogoutState();
  await SecureStore.deleteItemAsync(LOGOUT_EVIDENCE_KEY);
  lastLogoutEvidence = null;
  return failed('partial_revocation_refresh_was_active_fresh_cycle_required');
}

async function executeLogoutOidcSession(): Promise<DaOidcSession> {
  const stored = await readStored();
  if (!stored) {
    await clearLogoutPending();
    return anonymous('not_authenticated');
  }

  lastLogoutEvidence = null;
  await SecureStore.deleteItemAsync(LOGOUT_EVIDENCE_KEY);

  try {
    const pending = await readLogoutPending();
    if (pending) {
      return await completePendingLogoutAfterExternalBrowser(stored, pending);
    }

    const legacy = await recoverLegacyPartialRevocationIfSafe(stored);
    if (legacy) return legacy;

    // Security boundary remains first: the product API writes the hashed SID denylist before
    // any browser interaction, so the old access token is denied immediately.
    await revokeApiClientSession(stored.accessToken);

    const discovery = await withTimeout(
      AuthSession.fetchDiscoveryAsync(DA_OIDC_CONFIG.issuer),
      DA_DISCOVERY_TIMEOUT_MS,
      'idp_discovery_timeout',
    );

    if (!stored.idToken) throw new Error('id_token_missing_for_idp_logout');
    if (!stored.refreshToken) throw new Error('refresh_token_missing_for_idp_logout');

    const intendedBrowserMode: 'ios_system_safari' | 'native_auth_session' =
      Platform.OS === 'ios' ? 'ios_system_safari' : 'native_auth_session';
    await writeLogoutPending({
      version: 1,
      phase: 'external_browser_presented',
      startedAt: Date.now(),
      browserMode: intendedBrowserMode,
    });

    const browserMode = await openIdpLogoutBrowser(endSessionUrl(discovery, stored.idToken));
    return await completeLogoutAfterExternalBrowser(stored, discovery, browserMode, false);
  } catch (error) {
    return failed(safeLogoutErrorCode(error));
  }
}

export function logoutOidcSession(): Promise<DaOidcSession> {
  return startLogoutSingleFlight(executeLogoutOidcSession);
}
