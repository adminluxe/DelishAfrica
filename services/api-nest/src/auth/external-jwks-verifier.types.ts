import type { DaAuthTokenPayload } from './auth.types';

export type DaTrustedIdentityConfig = {
  issuer: string;
  discoveryUrl: string;
  advertisedJwksUrl: string;
  jwksUrl: string;
  audience: string;
  allowedAlgorithms: ['RS256'];
  merchantRealmRoles: string[];
  merchantClientRoles: string[];
  clockSkewSeconds: number;
  refreshSeconds: number;
};

export type DaTrustedIdentityHealth = {
  ok: boolean;
  service: 'trusted-identity-jwks-verifier';
  ready: boolean;
  issuer: string;
  discoveryUrl: string;
  advertisedJwksUrl: string;
  audience: string;
  clientAudience: string;
  courierAudience: string;
  opsAudience: string;
  supportedRoles: Array<'client' | 'merchant' | 'courier' | 'ops'>;
  jwksUrl: string;
  allowedAlgorithms: string[];
  keyCount: number;
  lastRefreshAt: string | null;
  lastError: string | null;
  ownershipEligibleRole: 'merchant';
  devLoginAccepted: false;
};

export type DaExternalTokenVerification =
  | {
      ok: true;
      payload: DaAuthTokenPayload;
    }
  | {
      ok: false;
      reason:
        | 'trusted_identity_not_ready'
        | 'malformed_token'
        | 'unsupported_algorithm'
        | 'unknown_signing_key'
        | 'invalid_signature'
        | 'issuer_mismatch'
        | 'audience_mismatch'
        | 'authorized_party_mismatch'
        | 'token_expired'
        | 'token_not_active'
        | 'issued_in_future'
        | 'subject_missing'
        | 'client_role_missing'
        | 'client_role_ambiguous'
        | 'client_audience_ambiguous'
        | 'client_client_privilege_detected'
        | 'partner_audience_ambiguous'
        | 'partner_authorized_party_mismatch'
        | 'partner_realm_role_ambiguous'
        | 'partner_resource_access_ambiguous'
        | 'partner_subject_invalid'
        | 'merchant_role_missing'
        | 'courier_role_missing'
        | 'ops_role_missing';
    };
