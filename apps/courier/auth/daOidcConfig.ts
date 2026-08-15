export const DA_OIDC_CONFIG = Object.freeze({
  issuer: 'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  clientId: 'delishafrica-courier',
  audience: 'delishafrica-courier',
  role: 'courier' as const,
  redirectUri: 'delishafricacourier://auth/callback',
  postLogoutRedirectUri: 'delishafricacourier://auth/logout',
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
