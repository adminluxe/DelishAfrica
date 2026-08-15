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
