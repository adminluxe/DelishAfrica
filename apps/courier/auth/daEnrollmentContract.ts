// Native signup contract. A pending registration is NOT a business session.
export type EnrollmentApp = 'client' | 'merchant' | 'courier';
export const ENROLLMENT_PROFILES = Object.freeze({
  client: { clientId: 'delishafrica-client-enrollment', audience: 'delishafrica-client-enrollment-api' },
  merchant: { clientId: 'delishafrica-merchant-candidate', audience: 'delishafrica-merchant-candidate-api' },
  courier: { clientId: 'delishafrica-courier-candidate', audience: 'delishafrica-courier-candidate-api' },
});
export type EnrollmentRuntime = Readonly<{
  application: EnrollmentApp; issuer: string; apiOrigin: string; clientId: string;
  audience: string; redirectUri: string; environment: 'qa';
}>;
export type NativeIdentity = { platform: string; scheme: unknown; packageId: unknown };
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
/** Trusted native manifest only; never route parameters, remote JSON or arbitrary links.
 * No QA origin is currently provisioned by this file. A reviewed native build must
 * carry the exact QA origin/issuer under extra.daEnrollment before any network call.
 */
export function parseEnrollmentRuntime(application: EnrollmentApp, value: unknown, native: NativeIdentity): EnrollmentRuntime | null {
  if (!record(value) || Object.keys(value).length !== 4
    || !['version', 'environment', 'issuer', 'apiOrigin'].every(k => Object.hasOwn(value, k))
    || value.version !== 1 || value.environment !== 'qa'
    || !['ios', 'android'].includes(native.platform)) return null;
  const scheme = `delishafrica${application}dev`;
  if (native.packageId !== `com.delishafrica.${application}.dev`
    || !(native.scheme === scheme || Array.isArray(native.scheme) && native.scheme.includes(scheme))) return null;
  try {
    const issuer = new URL(String(value.issuer)), api = new URL(String(value.apiOrigin));
    const qaHost = (url: URL) => url.protocol === 'https:' && url.port === ''
      && url.username === '' && url.password === '' && url.search === '' && url.hash === ''
      && /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.qa\.delishafrica\.me$/.test(url.hostname);
    if (!qaHost(issuer) || !qaHost(api) || issuer.pathname !== '/realms/da-candidate'
      || issuer.href !== value.issuer || api.origin !== value.apiOrigin || api.pathname !== '/') return null;
    return Object.freeze({ application, issuer: issuer.href, apiOrigin: api.origin,
      ...ENROLLMENT_PROFILES[application], redirectUri: `${scheme}://auth/signup`, environment: 'qa' });
  } catch { return null; }
}
export type PendingRegistration = Readonly<{
  registrationId: string; application: EnrollmentApp; subject: string;
  status: 'email_verified_pending_phone' | 'email_verified_pending_activation';
  emailVerified: true; phoneVerified: false; professionalApproved: false;
  ownershipEligible: false; dispatchAuthorized: false; payoutsAuthorized: false;
}>;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export function parsePendingRegistration(application: EnrollmentApp, value: unknown): PendingRegistration | null {
  if (!record(value) || Object.keys(value).length !== 11 || value.ok !== true
    || value.application !== application || typeof value.registrationId !== 'string' || !UUID.test(value.registrationId)
    || typeof value.subject !== 'string' || !UUID.test(value.subject)
    || value.status !== (application === 'client' ? 'email_verified_pending_activation' : 'email_verified_pending_phone')
    || value.emailVerified !== true || value.phoneVerified !== false
    || !['professionalApproved','ownershipEligible','dispatchAuthorized','payoutsAuthorized'].every(k => value[k] === false)) return null;
  const { ok: _ok, ...receipt } = value;
  return Object.freeze(receipt) as PendingRegistration;
}
