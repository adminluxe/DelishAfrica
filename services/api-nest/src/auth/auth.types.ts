export type DaAuthRole = 'client' | 'merchant' | 'courier' | 'ops';

export type DaAuthTokenSource = 'dev-login' | 'external';
export type DaResolvedAuthSource = DaAuthTokenSource | 'legacy-unknown';

export type DaAuthUser = {
  id: string;
  role: DaAuthRole;
  name: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
  opsScope?: string[];
};

export type DaAuthTokenPayload = {
  sub: string;
  role: DaAuthRole;
  name: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
  opsScope?: string[];
  authSource?: DaAuthTokenSource;
  iat: number;
  exp: number;
  iss: string;
  aud: string | string[];
};

export type DaAuthPrincipal = {
  issuer: string;
  subject: string;
  role: DaAuthRole;
  name: string;
  email?: string;
  merchantSlug?: string;
  courierId?: string;
  clientId?: string;
  opsScope?: string[];
  authSource: DaResolvedAuthSource;
  ownershipEligible: boolean;
  expiresAt: string;
};

export type DaAuthPrincipalResolution =
  | {
      ok: true;
      authenticated: true;
      principal: DaAuthPrincipal;
      payload: DaAuthTokenPayload;
    }
  | {
      ok: false;
      authenticated: false;
      reason: 'missing_bearer_token' | 'invalid_or_expired_token';
      principal: null;
    };
