import Constants from 'expo-constants';
import { Platform } from 'react-native';

// OIDC callback must match the ACTUAL installed binary scheme (DEV differs from Store).
// Fail closed if the Expo manifest does not declare either allowed scheme.
const configuredScheme = Constants.expoConfig?.scheme;
const permittedSchemes = ['delishafricaclient', 'delishafricaclientdev'] as const;
const candidateScheme = typeof configuredScheme === 'string'
  ? configuredScheme
  : Array.isArray(configuredScheme)
    ? configuredScheme.find((value) => permittedSchemes.includes(value as (typeof permittedSchemes)[number]))
    : undefined;
// The URI must also correspond to the native application ID for this platform.
const configuredPackage = Platform.OS === 'ios'
  ? Constants.expoConfig?.ios?.bundleIdentifier
  : Platform.OS === 'android'
    ? Constants.expoConfig?.android?.package
    : undefined;
const expectedPackage = candidateScheme === 'delishafricaclientdev'
  ? 'com.delishafrica.client.dev'
  : candidateScheme === 'delishafricaclient'
    ? 'com.delishafrica.client'
    : '';
const activeScheme = candidateScheme && permittedSchemes.includes(candidateScheme as (typeof permittedSchemes)[number])
  && expectedPackage && configuredPackage === expectedPackage
  ? candidateScheme
  : '';

export const DA_OIDC_CONFIG = Object.freeze({
  issuer: 'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  clientId: 'delishafrica-client',
  audience: 'delishafrica-client',
  role: 'client' as const,
  redirectUri: activeScheme ? `${activeScheme}://auth/callback` : '',
  postLogoutRedirectUri: activeScheme ? `${activeScheme}://auth/logout` : '',
  scopes: ['openid', 'profile', 'email'] as const,
  clockSkewSeconds: 60,
  refreshSkewSeconds: 90,
  vaultKeys: Object.freeze({
    access: 'da_oidc_client_access_v1',
    refresh: 'da_oidc_client_refresh_v1',
    id: 'da_oidc_client_id_v1',
    meta: 'da_oidc_client_meta_v1',
  }),
});
