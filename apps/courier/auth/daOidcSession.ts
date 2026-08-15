import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { DA_OIDC_CONFIG } from './daOidcConfig';
import {
  assertUserInfoMatches,
  toSafeSession,
  validateInitialTokenSet,
  validateStoredTokenSet,
} from './daOidcClaims';
import { clearOidcVault, readOidcVault, writeOidcVault } from './daOidcVault';
import type {
  DaOidcSession,
  DaOidcTokenSet,
  DaOidcUserInfo,
  DaOidcVaultMeta,
} from './daOidcTypes';
import { DaOidcError } from './daOidcTypes';

let refreshInFlight: Promise<DaOidcSession> | null = null;

function anonymous(reason?: string): DaOidcSession {
  return {
    status: 'anonymous',
    provider: 'keycloak',
    role: DA_OIDC_CONFIG.role,
    reason,
  };
}

function reauth(reason: string): DaOidcSession {
  return {
    status: 'reauth_required',
    provider: 'keycloak',
    role: DA_OIDC_CONFIG.role,
    reason,
  };
}

function safeError(error: unknown, fallback: string): DaOidcSession {
  const code = error instanceof DaOidcError ? error.code : fallback;
  return {
    status: 'error',
    provider: 'keycloak',
    role: DA_OIDC_CONFIG.role,
    reason: code,
  };
}

function normalizeTokenSet(
  token: {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    tokenType?: string;
    issuedAt?: number;
    expiresIn?: number;
    scope?: string;
  },
  previous?: DaOidcTokenSet,
): DaOidcTokenSet {
  const accessToken = token.accessToken;
  const refreshToken = token.refreshToken || previous?.refreshToken;
  const idToken = token.idToken || previous?.idToken;
  const issuedAt = token.issuedAt || Math.floor(Date.now() / 1000);
  const expiresIn = token.expiresIn || previous?.expiresIn || 0;
  const tokenType = String(token.tokenType || previous?.tokenType || 'Bearer');

  if (!accessToken || !refreshToken || !idToken) {
    throw new DaOidcError('token_set_incomplete', 'Réponse de jetons incomplète.');
  }
  if (tokenType.toLowerCase() !== 'bearer') {
    throw new DaOidcError('token_type_rejected', 'Type de jeton refusé.');
  }
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new DaOidcError('token_expiry_invalid', 'Durée de jeton invalide.');
  }

  return {
    accessToken,
    refreshToken,
    idToken,
    tokenType: 'Bearer',
    issuedAt,
    expiresIn,
    scope: token.scope || previous?.scope,
  };
}

async function discovery(): Promise<AuthSession.DiscoveryDocument> {
  const result = await AuthSession.fetchDiscoveryAsync(DA_OIDC_CONFIG.issuer);
  if (
    !result.authorizationEndpoint ||
    !result.tokenEndpoint ||
    !result.userInfoEndpoint ||
    !result.revocationEndpoint ||
    !result.endSessionEndpoint
  ) {
    throw new DaOidcError('discovery_incomplete', 'Discovery OIDC incomplète.', true);
  }
  return result;
}

async function fetchUserInfo(
  accessToken: string,
  doc: AuthSession.DiscoveryDocument,
): Promise<DaOidcUserInfo> {
  return (await AuthSession.fetchUserInfoAsync({ accessToken }, doc)) as DaOidcUserInfo;
}

export async function establishOidcSession(
  tokenResponse: {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    tokenType?: string;
    issuedAt?: number;
    expiresIn?: number;
    scope?: string;
  },
  expectedNonce: string,
): Promise<DaOidcSession> {
  const tokenSet = normalizeTokenSet(tokenResponse);
  const validated = validateInitialTokenSet(
    tokenSet.accessToken,
    tokenSet.idToken,
    expectedNonce,
  );
  const doc = await discovery();
  const userInfo = await fetchUserInfo(tokenSet.accessToken, doc);
  assertUserInfoMatches(validated.access.claims, userInfo);
  const safe = toSafeSession(validated.access.claims, userInfo);
  await writeOidcVault(tokenSet, {
    subject: safe.subject,
    displayName: safe.displayName,
    email: safe.email,
  });
  return safe;
}

function sessionFromStoredMeta(meta: DaOidcVaultMeta): DaOidcSession {
  return {
    status: 'authenticated',
    provider: 'keycloak',
    role: DA_OIDC_CONFIG.role,
    subject: meta.subject,
    displayName: meta.displayName,
    email: meta.email,
    issuedAt: meta.issuedAt,
    expiresAt: meta.expiresAt,
  };
}

function shouldRefresh(expiresAt: number): boolean {
  return expiresAt <= Math.floor(Date.now() / 1000) + DA_OIDC_CONFIG.refreshSkewSeconds;
}

export async function loadOidcSession(): Promise<DaOidcSession> {
  try {
    const stored = await readOidcVault();
    if (!stored) return anonymous('no_oidc_session');
    validateStoredTokenSet(stored.tokenSet.accessToken, stored.tokenSet.idToken);
    if (shouldRefresh(stored.meta.expiresAt)) return await refreshOidcSession();
    return sessionFromStoredMeta(stored.meta);
  } catch (error) {
    if (error instanceof DaOidcError && error.code === 'jwt_expired') {
      return await refreshOidcSession();
    }
    if (error instanceof DaOidcError && !error.recoverable) {
      await clearOidcVault().catch(() => undefined);
    }
    return safeError(error, 'oidc_rehydrate_failed');
  }
}

async function doRefresh(): Promise<DaOidcSession> {
  const stored = await readOidcVault();
  if (!stored) return reauth('missing_refresh_session');

  try {
    const doc = await discovery();
    const refreshed = await AuthSession.refreshAsync(
      {
        clientId: DA_OIDC_CONFIG.clientId,
        refreshToken: stored.tokenSet.refreshToken,
        scopes: [...DA_OIDC_CONFIG.scopes],
      },
      doc,
    );
    const tokenSet = normalizeTokenSet(refreshed, stored.tokenSet);
    const validated = validateStoredTokenSet(tokenSet.accessToken, tokenSet.idToken);
    const userInfo = await fetchUserInfo(tokenSet.accessToken, doc);
    assertUserInfoMatches(validated.access.claims, userInfo);
    const safe = toSafeSession(validated.access.claims, userInfo);
    await writeOidcVault(tokenSet, {
      subject: safe.subject,
      displayName: safe.displayName,
      email: safe.email,
    });
    return safe;
  } catch (error) {
    const normalized = String(
      error instanceof Error ? `${error.name}:${error.message}` : error,
    ).toLowerCase();
    if (normalized.includes('invalid_grant') || normalized.includes('invalid refresh')) {
      await clearOidcVault().catch(() => undefined);
      return reauth('refresh_rejected');
    }
    return safeError(error, 'refresh_network_or_provider_error');
  }
}

export async function refreshOidcSession(): Promise<DaOidcSession> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return await refreshInFlight;
}

export async function getValidOidcAccessToken(): Promise<string | null> {
  const session = await loadOidcSession();
  if (session.status !== 'authenticated') return null;
  const stored = await readOidcVault();
  return stored?.tokenSet.accessToken || null;
}

export async function clearOidcSession(): Promise<void> {
  await clearOidcVault();
}

function buildLogoutUrl(idToken: string, endpoint: string): string {
  const params = new URLSearchParams({
    id_token_hint: idToken,
    post_logout_redirect_uri: DA_OIDC_CONFIG.postLogoutRedirectUri,
    client_id: DA_OIDC_CONFIG.clientId,
  });
  return `${endpoint}?${params.toString()}`;
}

export async function logoutOidcSession(): Promise<DaOidcSession> {
  const stored = await readOidcVault().catch(() => null);
  try {
    if (stored) {
      const doc = await discovery();
      await AuthSession.revokeAsync(
        {
          clientId: DA_OIDC_CONFIG.clientId,
          token: stored.tokenSet.refreshToken,
          tokenTypeHint: AuthSession.TokenTypeHint.RefreshToken,
        },
        doc,
      ).catch(() => false);
      const logoutUrl = buildLogoutUrl(stored.tokenSet.idToken, doc.endSessionEndpoint!);
      await WebBrowser.openAuthSessionAsync(
        logoutUrl,
        DA_OIDC_CONFIG.postLogoutRedirectUri,
      ).catch(() => ({ type: 'dismiss' as const }));
    }
  } finally {
    await clearOidcVault().catch(() => undefined);
  }
  return anonymous('local_logout_complete');
}
