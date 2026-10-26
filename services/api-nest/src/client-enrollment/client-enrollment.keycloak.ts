import { Injectable } from '@nestjs/common';

/**
 * DelishAfrica R6G | Keycloak 26.8.1+ FGAP v2 - group-scoped enrollment.
 *
 * This client gets no realm-admin, manage-users, view-users or map-roles.
 * Only group-scoped 'view', 'view-members', 'manage-members' and
 * 'manage-membership' are allowed for the single Client enrollment group.
 * An existing Merchant, Courier or Ops subject MUST be inaccessible.
 */
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
type RealmRole = { id?: string; name?: string; clientRole?: boolean };
type UserGroup = { id?: string; name?: string; path?: string };
type KeycloakUser = {
  id?: string;
  emailVerified?: boolean;
  enabled?: boolean;
  attributes?: Record<string, unknown>;
};

const REALM = 'afritaste';
const CLIENT_ROLE = 'client';
const CLIENT_GROUP_PATH = '/da-clients-enrollment-v1';
const AUTHORIZED_INTERNAL_HOST = 'afritaste-keycloak';
const ALLOWED_REALM_ROLES = new Set([
  CLIENT_ROLE,
  'default-roles-' + REALM,
  'offline_access',
  'uma_authorization',
]);
const SUBJECT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validateAdminUrl(raw: string): string {
  let url: URL;
  try { url = new URL(raw); }
  catch { throw new Error('enrollment_keycloak_endpoint_invalid'); }
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
      clientId, secret,
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
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
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

  private checkCreatedId(subjectId: string): void {
    if (!SUBJECT_ID.test(subjectId)) {
      throw new Error('enrollment_user_id_invalid');
    }
  }

  private async verifyOnlyClientRole(
    creds: AdminCredentials,
    token: string,
    subjectId: string,
  ): Promise<KeycloakUser> {
    this.checkCreatedId(subjectId);
    const root = '/admin/realms/' + REALM + '/users/' + subjectId;

    // The service may inspect ONLY members of its dedicated Client group.
    const groupResponse = await this.request(creds.base, root + '/groups', token);
    if (groupResponse.status !== 200) throw new Error('enrollment_client_group_unreadable');
    const groups = await groupResponse.json() as UserGroup[];
    if (
      !Array.isArray(groups) ||
      groups.length !== 1 ||
      groups[0]?.path !== CLIENT_GROUP_PATH
    ) throw new Error('enrollment_client_group_mismatch');

    // Keycloak's /realm endpoint returns *direct* mappings only.
    // Group-inherited 'client' is visible through /realm/composite instead.
    const recheck = await this.request(
      creds.base, root + '/role-mappings/realm/composite', token,
    );
    if (recheck.status !== 200) throw new Error('enrollment_effective_role_unreadable');
    const roles = await recheck.json() as RealmRole[];
    if (
      !Array.isArray(roles) ||
      !roles.some((role) => role.name === CLIENT_ROLE && role.clientRole === false) ||
      roles.some((role) =>
        role.clientRole !== false ||
        !role.name ||
        !ALLOWED_REALM_ROLES.has(role.name),
      )
    ) throw new Error('enrollment_effective_role_not_client_only');

    const userResponse = await this.request(creds.base, root, token);
    if (userResponse.status !== 200) throw new Error('enrollment_client_user_unreadable');
    const account = await userResponse.json() as KeycloakUser;
    const markers = account.attributes?.delishafrica_enrollment_version;
    if (
      account.id !== subjectId ||
      account.emailVerified !== true ||
      !Array.isArray(markers) ||
      markers.length !== 1 ||
      markers[0] !== 'client-v1'
    ) throw new Error('enrollment_client_provenance_invalid');
    return account;
  }

  /** Called only AFTER ClientEnrollmentRepository.complete has committed. */
  async activateClientIdentity(subjectId: string): Promise<void> {
    this.checkCreatedId(subjectId);
    const creds = this.credentials();
    const token = await this.getToken(creds);
    const before = await this.verifyOnlyClientRole(creds, token, subjectId);
    if (before.enabled !== false) throw new Error('enrollment_activation_initial_state_invalid');
    const response = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId,
      token, 'PUT', { enabled: true },
    );
    if (response.status !== 204) throw new Error('enrollment_account_activation_failed');
    const after = await this.verifyOnlyClientRole(creds, token, subjectId);
    if (after.enabled !== true) throw new Error('enrollment_activation_not_confirmed');
  }

  /** Never attempt to change a Merchant/Courier/Ops subject during compensation. */
  async disableClientIdentity(subjectId: string): Promise<void> {
    this.checkCreatedId(subjectId);
    const creds = this.credentials();
    const token = await this.getToken(creds);
    const current = await this.verifyOnlyClientRole(creds, token, subjectId);
    if (current.enabled === false) return;
    const response = await this.request(
      creds.base, '/admin/realms/' + REALM + '/users/' + subjectId,
      token, 'PUT', { enabled: false },
    );
    if (response.status !== 204) throw new Error('enrollment_compensation_failed');
  }

  async createClientIdentity(input: ClientIdentityInput): Promise<string> {
    const creds = this.credentials();
    const token = await this.getToken(creds);
    let createdId: string | null = null;
    try {
      // Keycloak v2 checks group-scoped creation rights on POST /users.
      // The group carries the 'client' realm role: NO direct role mappings.
      // Production MUST be upgraded to a version fixing CVE-2026-18571.
      const response = await this.request(
        creds.base, '/admin/realms/' + REALM + '/users', token, 'POST',
        {
          username: input.email,
          email: input.email,
          emailVerified: true, // Signed SMS and email proofs were verified by our API.
          enabled: false,
          groups: [CLIENT_GROUP_PATH],
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
      this.checkCreatedId(createdId);

      const created = await this.verifyOnlyClientRole(creds, token, createdId);
      if (created.enabled !== false) {
        throw new Error('enrollment_new_account_was_enabled');
      }
      // Ledger commit precedes activation in ClientEnrollmentService.
      return createdId;
    } catch (error) {
      if (createdId) {
        // The new identity should already be disabled. Never blindly
        // mutate another principal in the absence of provenance proof.
        try { await this.disableClientIdentity(createdId); }
        catch { /* quarantined for operator review */ }
      }
      throw error;
    }
  }
}
