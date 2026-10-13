/**
 * DelishAfrica QA F4E: strict partner authorization-party and audience gate.
 * Invoked only AFTER RSA signature verification in ExternalJwksVerifierService.
 * No wallet read is authorized on this check alone: the tenant, legal
 * organization, KYB/contract/roster and SQL attestation must also pass.
 */
export type DaPartnerIsolationReason =
  | 'partner_audience_ambiguous'
  | 'partner_authorized_party_mismatch'
  | 'partner_realm_role_ambiguous'
  | 'partner_resource_access_ambiguous'
  | 'partner_subject_invalid';

type JsonObject = Record<string, unknown>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BANNED_CROSS_REALM_ROLES=new Set([
  'client','ops','admin','realm-admin','manage-users','view-users',
]);
function record(x:unknown):JsonObject|null {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
    ? x as JsonObject : null;
}
function strings(x:unknown):string[]|null {
  return Array.isArray(x)&&x.every((v)=>typeof v==='string')
    ? x as string[] : null;
}
/** null=admissible partner claim structure; else deny. Not a JWT verifier. */
export function validatePartnerTokenIsolation(
  claims:JsonObject, expectedAudience:string, role:'merchant'|'courier',
):DaPartnerIsolationReason|null {
  const aud=typeof claims.aud==='string'?[claims.aud]:strings(claims.aud);
  if(!expectedAudience||!aud||!aud.includes(expectedAudience)||
     aud.some(x=>x!=='account'&&x!==expectedAudience)){
    return 'partner_audience_ambiguous';
  }
  if(claims.azp!==expectedAudience){
    return 'partner_authorized_party_mismatch';
  }
  if(typeof claims.sub!=='string'||!UUID.test(claims.sub)){
    return 'partner_subject_invalid';
  }
  const realm=record(claims.realm_access);
  if(claims.realm_access!==undefined&&!realm){
    return 'partner_realm_role_ambiguous';
  }
  const realmRoles=realm?.roles===undefined?[]:strings(realm?.roles);
  if(!realmRoles)return 'partner_realm_role_ambiguous';
  const forbidden=new Set(BANNED_CROSS_REALM_ROLES);
  forbidden.add(role==='merchant'?'courier':'merchant');
  if(realmRoles.some(x=>forbidden.has(x))){
    return 'partner_realm_role_ambiguous';
  }
  const grants=claims.resource_access===undefined?{}:record(claims.resource_access);
  if(!grants)return 'partner_resource_access_ambiguous';
  for(const [clientId,raw] of Object.entries(grants)){
    const value=record(raw);
    if(!value)return 'partner_resource_access_ambiguous';
    const roles=value.roles===undefined?[]:strings(value.roles);
    if(!roles)return 'partner_resource_access_ambiguous';
    if(clientId!=='account'&&clientId!==expectedAudience&&roles.length){
      return 'partner_resource_access_ambiguous';
    }
    if(clientId===expectedAudience&&roles.some(r=>forbidden.has(r))){
      return 'partner_resource_access_ambiguous';
    }
  }
  return null;
}
