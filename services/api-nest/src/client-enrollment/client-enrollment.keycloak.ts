import { Injectable } from '@nestjs/common';

type ClientIdentityInput = {
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  password: string;
};

type AdminCredentials = {
  base: string;
  clientId: string;
  secret: string;
};

type RealmRole = { id: string; name: string; clientRole: boolean };

const REALM = 'afritaste';
const CLIENT_ROLE = 'client';
const AUTHORIZED_INTERNAL_HOST = 'afritaste-keycloak';

function validateAdminUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('enrollment_keycloak_endpoint_invalid'); }
  // All Admin API traffic must stay inside the private Keycloak Docker network.
  if (
    url.protocol !== 'http:' ||
    url.hostname !== AUTHORIZED_INTERNAL_HOST ||
    url.port !== '8080' ||
    url.pathname !== '/' ||
    url.username || url.password || url.search || url.hash
  ) throw new Error('enrollment_keycloak_endpoint_not_private');
  return url.origin;
}

@Injectable()
export class ClientEnrollmentKeycloak {
  private credentials(): AdminCredentials {
    const clientId = String(process.env.DA_CLIENT_ENROLLMENT_KC_CLIENT_ID || '');
    const secret = String(process.env.DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET || '');
    if (clientId !== 'delishafrica-client-enrollment' || !secret) {
      throw new Error('enrollment_keycloak_credentials_missing');
    }
    return {
      base: validateAdminUrl(String(process.env.DA_CLIENT_ENROLLMENT_KC_BASE_URL || '')),
      clientId,
      secret,
    };
  }

  private async request(
    base: string,
    route: string,
    accessToken: string,
    method = 'GET',
    body?: unknown,
  ): Promise<Response> {
    try {
      return await fetch(base + route, {
        method,
        headers: {
          authorization: 'Bearer ' + accessToken,
          accept: 'application/json',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error('enrollment_keycloak_network_unavailable');
    }
  }

  private async getToken(creds: AdminCredentials): Promise<string> {
    let res: Response;
    try {
      res = await fetch(creds.base + '/realms/' + REALM + '/protocol/openid-connect/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: creds.clientId,
          client_secret: creds.secret,
        }).toString(),
        signal: AbortSignal.timeout(8000),
      });
    } catch {
      throw new Error('enrollment_keycloak_token_unavailable');
    }
    if (res.status !== 200) throw new Error('enrollment_keycloak_token_rejected');
    let data: { access_token?: unknown };
    try { data = await res.json() as { access_token?: unknown }; }
    catch { throw new Error('enrollment_keycloak_token_invalid'); }
    if (typeof data.access_token !== 'string' || data.access_token.length < 24) {
      throw new Error('enrollment_keycloak_token_invalid');
    }
    return data.access_token;
  }

  private async verifyOnlyClientRole(
    creds: AdminCredentials,
    token: string,
    subjectId: string,
  ): Promise<void> {
    const recheck = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId + '/role-mappings/realm', token,
    );
    if (recheck.status !== 200) throw new Error('enrollment_role_recheck_failed');
    const roles = await recheck.json() as Array<{ name: string; clientRole?: boolean }>;
    if (
      !Array.isArray(roles) ||
      !roles.some((value) => value.name === CLIENT_ROLE && value.clientRole === false) ||
      roles.some((value) => ['admin', 'merchant', 'courier', 'ops', 'realm-admin'].includes(value.name))
    ) throw new Error('enrollment_role_verification_failed');

    // Direct mappings alone are not enough: realm defaults and composite
    // roles can silently grant Courier, Merchant or realm-admin authority.
    const compositeResponse = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId + '/role-mappings/realm/composite',
      token,
    );
    if (compositeResponse.status !== 200) throw new Error('enrollment_composite_roles_unavailable');
    const effective = await compositeResponse.json() as Array<{ name: string; clientRole?: boolean }>;
    const safeRealmRoles = new Set([
      CLIENT_ROLE, 'default-roles-' + REALM, 'offline_access', 'uma_authorization',
    ]);
    if (
      !Array.isArray(effective) ||
      !effective.some((value) => value?.name === CLIENT_ROLE && value.clientRole === false) ||
      effective.some((value) => typeof value?.name !== 'string' ||
        value.clientRole !== false || !safeRealmRoles.has(value.name))
    ) throw new Error('enrollment_effective_roles_unsafe');
  }

  /**
   * Realm-role composites alone do not reveal inherited client roles.
   * For each newly provisioned Client, prove that NO effective role exists
   * under Keycloak's realm-management client.
   * Missing read permissions are a hard failure, never an optional skip.
   */
  private async verifyNoRealmManagementAccess(
    creds: AdminCredentials,
    token: string,
    subjectId: string,
  ): Promise<void> {
    const clients = await this.request(
      creds.base,
      '/admin/realms/' + REALM + '/clients?clientId=realm-management',
      token,
    );
    if (clients.status !== 200) throw new Error('enrollment_admin_client_inspection_unavailable');
    const matches = await clients.json() as Array<{ id?: unknown; clientId?: unknown }>;
    if (!Array.isArray(matches) || matches.length !== 1 ||
        matches[0]?.clientId !== 'realm-management' ||
        typeof matches[0]?.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(matches[0].id)) {
      throw new Error('enrollment_admin_client_reference_untrusted');
    }
    const mapping = await this.request(
      creds.base,
      '/admin/realms/' + REALM + '/users/' + subjectId +
        '/role-mappings/clients/' + matches[0].id + '/composite',
      token,
    );
    if (mapping.status !== 200) throw new Error('enrollment_admin_role_inspection_unavailable');
    const effective = await mapping.json() as Array<{ name?: unknown }>;
    if (!Array.isArray(effective) || effective.length !== 0) {
      throw new Error('enrollment_admin_client_privilege_detected');
    }
  }

  private checkCreatedId(subjectId: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(subjectId)) {
      throw new Error('enrollment_user_id_invalid');
    }
  }

  /** Called only AFTER ClientEnrollmentRepository.complete has committed. */
  async activateClientIdentity(subjectId: string): Promise<void> {
    this.checkCreatedId(subjectId);
    const creds = this.credentials();
    const token = await this.getToken(creds);
    // A new Client must have neither privileged realm nor client mappings.
    await this.verifyOnlyClientRole(creds, token, subjectId);
    await this.verifyNoRealmManagementAccess(creds, token, subjectId);
    const before = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId, token,
    );
    if (before.status !== 200) throw new Error('enrollment_identity_unavailable');
    const user = await before.json() as {
      enabled?: boolean; emailVerified?: boolean;
      attributes?: { delishafrica_enrollment_version?: string[] };
    };
    if (
      user.enabled !== false ||
      user.emailVerified !== true ||
      !Array.isArray(user.attributes?.delishafrica_enrollment_version) ||
      !user.attributes.delishafrica_enrollment_version.includes('client-v1')
    ) throw new Error('enrollment_identity_provenance_unsafe');

    const activate = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId,
      token, 'PUT', { enabled: true },
    );
    if (activate.status !== 204) throw new Error('enrollment_account_activation_failed');
    const confirm = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId, token,
    );
    if (confirm.status !== 200) throw new Error('enrollment_activation_recheck_failed');
    const account = await confirm.json() as { enabled?: boolean; emailVerified?: boolean };
    if (account.enabled !== true || account.emailVerified !== true) {
      throw new Error('enrollment_activation_not_confirmed');
    }
  }

  /** Best-effort compensation if the ledger or activation fails. */
  async disableClientIdentity(subjectId: string): Promise<void> {
    this.checkCreatedId(subjectId);
    const creds = this.credentials();
    const token = await this.getToken(creds);
    const response = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId,
      token, 'PUT', { enabled: false },
    );
    if (response.status !== 204) throw new Error('enrollment_compensation_failed');
  }

  async createClientIdentity(input: ClientIdentityInput): Promise<string> {
    const creds = this.credentials();
    const token = await this.getToken(creds);

    const roleResponse = await this.request(
      creds.base, '/admin/realms/' + REALM + '/roles/' + CLIENT_ROLE, token,
    );
    if (roleResponse.status !== 200) throw new Error('enrollment_client_realm_role_missing');
    const role = await roleResponse.json() as RealmRole;
    if (
      typeof role.id !== 'string' ||
      role.name !== CLIENT_ROLE ||
      role.clientRole !== false
    ) throw new Error('enrollment_client_role_misconfigured');

    let createdId: string | null = null;
    try {
      const response = await this.request(
        creds.base, '/admin/realms/' + REALM + '/users', token, 'POST',
        {
          username: input.email,
          email: input.email,
          emailVerified: true, // SMS AND e-mail provider proofs were verified by our API.
          // Keep this account unable to authenticate until the Client realm
          // role has been assigned and independently re-checked.
          enabled: false,
          firstName: input.firstName,
          lastName: input.lastName,
          requiredActions: [],
          credentials: [{ type: 'password', value: input.password, temporary: false }],
          attributes: {
            phoneNumber: [input.phone],
            delishafrica_enrollment_version: ['client-v1'],
          },
        },
      );
      if (response.status === 409) throw new Error('enrollment_identity_already_exists');
      if (response.status !== 201) throw new Error('enrollment_keycloak_create_rejected');

      const location = response.headers.get('location') || '';
      const match = location.match(/\/users\/([0-9a-fA-F-]{36})$/);
      if (!match) throw new Error('enrollment_keycloak_user_id_missing');
      createdId = match[1];

      const mapped = await this.request(
        creds.base, '/admin/realms/' + REALM + '/users/' + createdId + '/role-mappings/realm',
        token, 'POST', [role],
      );
      if (mapped.status !== 204) throw new Error('enrollment_realm_role_mapping_failed');

      await this.verifyOnlyClientRole(creds, token, createdId);
      await this.verifyNoRealmManagementAccess(creds, token, createdId);

      // Two-phase enrollment: provisioning returns a DISABLED identity.
      // The enrollment ledger must be durably committed BEFORE the account
      // becomes able to authenticate. A crash now leaves a disabled account.
      return createdId;
    } catch (error) {
      // Fail closed after partial remote creation. Require operator reconciliation.
      // Do not delete identities automatically or retry provisioning with new secrets.
      if (createdId) {
        try {
          await this.request(
            creds.base, '/admin/realms/' + REALM + '/users/' + createdId,
            token, 'PUT', { enabled: false },
          );
        } catch {
          // Do not expose Keycloak diagnostic details.
        }
      }
      throw error;
    }
  }
}
