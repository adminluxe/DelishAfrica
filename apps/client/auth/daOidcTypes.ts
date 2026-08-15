export type DaOidcRole = 'client' | 'courier';

export type DaOidcSessionStatus =
  | 'anonymous'
  | 'authenticated'
  | 'reauth_required'
  | 'error';

export type DaOidcSession = {
  status: DaOidcSessionStatus;
  provider: 'keycloak';
  role: DaOidcRole;
  subject?: string;
  displayName?: string;
  email?: string;
  issuedAt?: number;
  expiresAt?: number;
  reason?: string;
};

export type DaOidcJwtHeader = {
  alg?: string;
  typ?: string;
  kid?: string;
  [key: string]: unknown;
};

export type DaOidcJwtClaims = {
  iss?: string;
  sub?: string;
  aud?: string | string[];
  azp?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  nonce?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  roles?: string[];
  role?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  [key: string]: unknown;
};

export type DaOidcUserInfo = {
  sub?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
  [key: string]: unknown;
};

export type DaOidcTokenSet = {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  tokenType: 'Bearer';
  issuedAt: number;
  expiresIn: number;
  scope?: string;
};

export type DaOidcVaultMeta = {
  version: 1;
  pending: boolean;
  role: DaOidcRole;
  subject?: string;
  displayName?: string;
  email?: string;
  issuedAt: number;
  expiresAt: number;
};

export type DaOidcStoredBundle = {
  tokenSet: DaOidcTokenSet;
  meta: DaOidcVaultMeta;
};

export type DaOidcValidationResult = {
  header: DaOidcJwtHeader;
  claims: DaOidcJwtClaims;
};

export class DaOidcError extends Error {
  readonly code: string;
  readonly recoverable: boolean;

  constructor(code: string, message: string, recoverable = false) {
    super(message);
    this.name = 'DaOidcError';
    this.code = code;
    this.recoverable = recoverable;
  }
}
