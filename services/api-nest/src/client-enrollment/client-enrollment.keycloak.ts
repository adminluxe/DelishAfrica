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

      const recheck = await this.request(
        creds.base, '/admin/realms/' + REALM + '/users/' + createdId + '/role-mappings/realm', token,
      );
      if (recheck.status !== 200) throw new Error('enrollment_role_recheck_failed');
      const roles = await recheck.json() as Array<{ name: string; clientRole?: boolean }>;
      if (
        !Array.isArray(roles) ||
        !roles.some((value) => value.name === CLIENT_ROLE && value.clientRole === false) ||
        roles.some((value) => ['admin', 'merchant', 'courier', 'ops', 'realm-admin'].includes(value.name))
      ) throw new Error('enrollment_role_verification_failed');

      // Activation is the LAST step, after the role is proven to be Client-only.
      const activate = await this.request(
        creds.base, '/admin/realms/' + REALM + '/users/' + createdId,
        token, 'PUT', { enabled: true },
      );
      if (activate.status !== 204) throw new Error('enrollment_account_activation_failed');
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
