import Constants from 'expo-constants';

// OIDC callback must match the ACTUAL installed binary scheme (DEV differs from Store).
// Fail closed if the Expo manifest does not declare either allowed scheme.
const configuredScheme = Constants.expoConfig?.scheme;
const permittedSchemes = ['delishafricacourier', 'delishafricacourierdev'] as const;
const candidateScheme = typeof configuredScheme === 'string'
  ? configuredScheme
  : Array.isArray(configuredScheme)
    ? configuredScheme.find((value) => permittedSchemes.includes(value as (typeof permittedSchemes)[number]))
    : undefined;
const activeScheme = candidateScheme && permittedSchemes.includes(candidateScheme as (typeof permittedSchemes)[number])
  ? candidateScheme
  : '';

export const DA_OIDC_CONFIG = Object.freeze({
  issuer: 'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  clientId: 'delishafrica-courier',
  audience: 'delishafrica-courier',
  role: 'courier' as const,
  redirectUri: activeScheme ? `${activeScheme}://auth/callback` : '',
  postLogoutRedirectUri: activeScheme ? `${activeScheme}://auth/logout` : '',
  scopes: ['openid', 'profile', 'email'] as const,
  clockSkewSeconds: 60,
  refreshSkewSeconds: 90,
  vaultKeys: Object.freeze({
    access: 'da_oidc_courier_access_v1',
    refresh: 'da_oidc_courier_refresh_v1',
    id: 'da_oidc_courier_id_v1',
    meta: 'da_oidc_courier_meta_v1',
  }),
});
