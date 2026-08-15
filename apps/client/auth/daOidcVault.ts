import * as SecureStore from 'expo-secure-store';
import { DA_OIDC_CONFIG } from './daOidcConfig';
import type { DaOidcStoredBundle, DaOidcTokenSet, DaOidcVaultMeta } from './daOidcTypes';
import { DaOidcError } from './daOidcTypes';

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

async function ensureAvailable(): Promise<void> {
  if (!(await SecureStore.isAvailableAsync())) {
    throw new DaOidcError('secure_store_unavailable', 'Stockage sécurisé indisponible.');
  }
}

async function deleteQuietly(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key, OPTIONS);
  } catch {
    // Purge best effort; the caller still receives a fail-closed state.
  }
}

export async function clearOidcVault(): Promise<void> {
  await ensureAvailable();
  await Promise.all([
    deleteQuietly(DA_OIDC_CONFIG.vaultKeys.access),
    deleteQuietly(DA_OIDC_CONFIG.vaultKeys.refresh),
    deleteQuietly(DA_OIDC_CONFIG.vaultKeys.id),
    deleteQuietly(DA_OIDC_CONFIG.vaultKeys.meta),
  ]);
}

export async function writeOidcVault(
  tokenSet: DaOidcTokenSet,
  safe: Pick<DaOidcVaultMeta, 'subject' | 'displayName' | 'email'>,
): Promise<void> {
  await ensureAvailable();
  const pending: DaOidcVaultMeta = {
    version: 1,
    pending: true,
    role: DA_OIDC_CONFIG.role,
    issuedAt: tokenSet.issuedAt,
    expiresAt: tokenSet.issuedAt + tokenSet.expiresIn,
    ...safe,
  };
  const complete: DaOidcVaultMeta = { ...pending, pending: false };

  try {
    await SecureStore.setItemAsync(
      DA_OIDC_CONFIG.vaultKeys.meta,
      JSON.stringify(pending),
      OPTIONS,
    );
    await SecureStore.setItemAsync(DA_OIDC_CONFIG.vaultKeys.access, tokenSet.accessToken, OPTIONS);
    await SecureStore.setItemAsync(DA_OIDC_CONFIG.vaultKeys.refresh, tokenSet.refreshToken, OPTIONS);
    await SecureStore.setItemAsync(DA_OIDC_CONFIG.vaultKeys.id, tokenSet.idToken, OPTIONS);
    await SecureStore.setItemAsync(
      DA_OIDC_CONFIG.vaultKeys.meta,
      JSON.stringify(complete),
      OPTIONS,
    );
  } catch {
    await clearOidcVault().catch(() => undefined);
    throw new DaOidcError('secure_store_write_failed', 'Écriture sécurisée impossible.');
  }
}

export async function readOidcVault(): Promise<DaOidcStoredBundle | null> {
  await ensureAvailable();
  const [accessToken, refreshToken, idToken, rawMeta] = await Promise.all([
    SecureStore.getItemAsync(DA_OIDC_CONFIG.vaultKeys.access, OPTIONS),
    SecureStore.getItemAsync(DA_OIDC_CONFIG.vaultKeys.refresh, OPTIONS),
    SecureStore.getItemAsync(DA_OIDC_CONFIG.vaultKeys.id, OPTIONS),
    SecureStore.getItemAsync(DA_OIDC_CONFIG.vaultKeys.meta, OPTIONS),
  ]);

  if (!accessToken && !refreshToken && !idToken && !rawMeta) return null;
  if (!accessToken || !refreshToken || !idToken || !rawMeta) {
    await clearOidcVault();
    throw new DaOidcError('secure_store_incomplete', 'Session sécurisée incomplète.');
  }

  let meta: DaOidcVaultMeta;
  try {
    meta = JSON.parse(rawMeta) as DaOidcVaultMeta;
  } catch {
    await clearOidcVault();
    throw new DaOidcError('secure_store_meta_invalid', 'Métadonnées de session invalides.');
  }

  if (meta.version !== 1 || meta.pending || meta.role !== DA_OIDC_CONFIG.role) {
    await clearOidcVault();
    throw new DaOidcError('secure_store_transaction_incomplete', 'Transaction de session incomplète.');
  }

  return {
    tokenSet: {
      accessToken,
      refreshToken,
      idToken,
      tokenType: 'Bearer',
      issuedAt: meta.issuedAt,
      expiresIn: Math.max(0, meta.expiresAt - meta.issuedAt),
    },
    meta,
  };
}


const BUSINESS_REFRESH_SKEW_SECONDS = 45;
let businessRefreshFlight: Promise<DaOidcStoredBundle> | null = null;

function oidcRuntimeConfig(): { issuer: string; clientId: string } {
  const config = DA_OIDC_CONFIG as unknown as Record<string, unknown>;
  const issuer = String(
    config.issuer ||
      config.issuerUrl ||
      'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  )
    .trim()
    .replace(/\/+$/, '');
  const clientId = String(config.clientId || 'delishafrica-client').trim();

  if (!issuer || !clientId) {
    throw new DaOidcError('oidc_refresh_config_invalid', 'Configuration de session invalide.');
  }

  return { issuer, clientId };
}

function bundleNeedsRefresh(bundle: DaOidcStoredBundle): boolean {
  const now = Math.floor(Date.now() / 1000);
  return bundle.meta.expiresAt <= now + BUSINESS_REFRESH_SKEW_SECONDS;
}

async function refreshBusinessOidcBundle(
  bundle: DaOidcStoredBundle,
): Promise<DaOidcStoredBundle> {
  if (businessRefreshFlight) return businessRefreshFlight;

  businessRefreshFlight = (async () => {
    const refreshToken = String(bundle.tokenSet.refreshToken || '').trim();
    if (!refreshToken) {
      throw new DaOidcError('oidc_refresh_token_missing', 'Session expirée. Rouvrez votre session.');
    }

    const { issuer, clientId } = oidcRuntimeConfig();
    const body = new URLSearchParams();
    body.set('grant_type', 'refresh_token');
    body.set('client_id', clientId);
    body.set('refresh_token', refreshToken);

    let response: Response;
    try {
      response = await fetch(`${issuer}/protocol/openid-connect/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch {
      throw new DaOidcError(
        'oidc_refresh_network_failed',
        'Renouvellement de session momentanément indisponible.',
      );
    }

    let payload: Record<string, unknown> = {};
    try {
      payload = (await response.json()) as Record<string, unknown>;
    } catch {
      payload = {};
    }

    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        await clearOidcVault().catch(() => undefined);
        throw new DaOidcError(
          'oidc_refresh_rejected',
          'Session expirée. Rouvrez votre session sécurisée.',
        );
      }
      throw new DaOidcError(
        'oidc_refresh_http_failed',
        `Renouvellement de session indisponible (${response.status}).`,
      );
    }

    const accessToken = String(payload.access_token || '').trim();
    const nextRefreshToken = String(payload.refresh_token || refreshToken).trim();
    const nextIdToken = String(payload.id_token || bundle.tokenSet.idToken || '').trim();
    const tokenType: 'Bearer' = 'Bearer';
    const responseTokenType = String(payload.token_type || 'Bearer').trim().toLowerCase();
    if (responseTokenType !== 'bearer') {
      throw new DaOidcError(
        'oidc_refresh_token_type_invalid',
        'Type de session renouvelée invalide.',
      );
    }

    const expiresIn = Number(payload.expires_in);
    const issuedAt = Math.floor(Date.now() / 1000);

    if (
      !accessToken ||
      !nextRefreshToken ||
      !nextIdToken ||
      !Number.isFinite(expiresIn) ||
      expiresIn <= 0
    ) {
      throw new DaOidcError(
        'oidc_refresh_payload_invalid',
        'Réponse de renouvellement de session invalide.',
      );
    }

    await writeOidcVault(
      {
        accessToken,
        refreshToken: nextRefreshToken,
        idToken: nextIdToken,
        tokenType,
        issuedAt,
        expiresIn: Math.floor(expiresIn),
      },
      {
        subject: bundle.meta.subject,
        ...(bundle.meta.displayName ? { displayName: bundle.meta.displayName } : {}),
        ...(bundle.meta.email ? { email: bundle.meta.email } : {}),
      },
    );

    const refreshed = await readOidcVault();
    if (!refreshed) {
      throw new DaOidcError(
        'oidc_refresh_persist_failed',
        'Session renouvelée mais stockage sécurisé indisponible.',
      );
    }

    return refreshed;
  })();

  try {
    return await businessRefreshFlight;
  } finally {
    businessRefreshFlight = null;
  }
}

// DA_BUSINESS_OIDC_BRIDGE_V2: safe business-session adapter.
// It exposes only the already-established Client OIDC session fields required
// by the business request wrapper and never logs token material.
export type DaBusinessOidcSession = {
  accessToken: string;
  subject: string;
  displayName?: string;
  email?: string;
  expiresAt: number;
};

export async function daGetBusinessOidcSession(): Promise<DaBusinessOidcSession | null> {
  const stored = await readOidcVault();
  if (!stored) return null;

  const bundle = bundleNeedsRefresh(stored)
    ? await refreshBusinessOidcBundle(stored)
    : stored;

  const accessToken = String(bundle.tokenSet.accessToken || '').trim();
  const subject = String(bundle.meta.subject || '').trim();
  if (!accessToken || !subject) return null;

  return {
    accessToken,
    subject,
    ...(bundle.meta.displayName ? { displayName: bundle.meta.displayName } : {}),
    ...(bundle.meta.email ? { email: bundle.meta.email } : {}),
    expiresAt: bundle.meta.expiresAt,
  };
}
