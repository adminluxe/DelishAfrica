/**
 * Fail-closed Client-only access-token isolation for the shared Keycloak realm.
 *
 * JWT signature, issuer, lifetime and authorized party are validated by the
 * separate ExternalJwksVerifierService. This guard is only an additional
 * authorization check on the claims AFTER cryptographic verification.
 *
 * Do not confuse this with an FGAP permission audit of the provisioning
 * service account. Both must pass independently before public enrollment.
 */
export type ClientIsolationFailure =
  | 'client_role_missing'
  | 'client_role_ambiguous'
  | 'client_audience_ambiguous'
  | 'client_client_privilege_detected';

type ClientTokenClaims = {
  aud?: unknown;
  realm_access?: unknown;
  resource_access?: unknown;
};

const REALM_SAFE_ROLES = new Set([
  'client',
  'default-roles-afritaste',
  'offline_access',
  'uma_authorization',
]);

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown): string[] | null {
  return Array.isArray(value) && value.every((v) => typeof v === 'string')
    ? value as string[]
    : null;
}

/** null = isolated Client claim set, otherwise a terminal denial reason. */
export function validateClientTokenIsolation(
  claims: ClientTokenClaims,
  clientAudience: string,
): ClientIsolationFailure | null {
  const realmRoles = strings(object(claims.realm_access)?.roles);
  if (!realmRoles || !realmRoles.includes('client')) {
    return 'client_role_missing';
  }
  if (realmRoles.some((role) => !REALM_SAFE_ROLES.has(role))) {
    return 'client_role_ambiguous';
  }

  // Keycloak normally issues ['account', '<audience>'] to a signed-in user.
  // Reject cross-product audiences rather than treating one of them as Client.
  const audiences = typeof claims.aud === 'string'
    ? [claims.aud] : strings(claims.aud);
  if (!audiences || !audiences.includes(clientAudience) ||
      audiences.some((aud) => aud !== clientAudience && aud !== 'account')) {
    return 'client_audience_ambiguous';
  }

  const resources = claims.resource_access === undefined
    ? {} : object(claims.resource_access);
  if (!resources) return 'client_client_privilege_detected';
  for (const [clientId, grant] of Object.entries(resources)) {
    const resource = object(grant);
    if (!resource || (resource.roles !== undefined && !strings(resource.roles))) {
      return 'client_client_privilege_detected';
    }
    const roles = strings(resource.roles) || [];
    // Ordinary Keycloak self-service Account UI roles are not administration.
    // A newly created DelishAfrica Client has no other client-role mapping.
    if (clientId !== 'account' && roles.length !== 0) {
      return 'client_client_privilege_detected';
    }
  }
  return null;
}
