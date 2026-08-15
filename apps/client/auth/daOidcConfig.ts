export const DA_OIDC_CONFIG = Object.freeze({
  issuer: 'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  clientId: 'delishafrica-client',
  audience: 'delishafrica-client',
  role: 'client' as const,
  redirectUri: 'delishafricaclient://auth/callback',
  postLogoutRedirectUri: 'delishafricaclient://auth/logout',
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
