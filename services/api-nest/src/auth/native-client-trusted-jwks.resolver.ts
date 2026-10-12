/**
 * Candidate Client-only JWKS resolver. NOT WIRED INTO PRODUCTION.
 * Trust anchor is a reviewed, STATIC server-side issuer. It is never a token
 * claim, user input, query param, tenant-provided host, redirect or JWT jku.
 *
 * HTTPS certificate and hostname verification are delegated to the Node TLS
 * trust store. No insecure TLS flags are set, no redirects are followed, and
 * only the exact issuer's well-known and cert endpoints are contacted.
 */
import type {
  NativeClientIssuerPinnedJwks,
  NativeClientRsaJwk,
} from './native-client-jwt-verifier';

type JsonObject = Record<string, unknown>;
const MAX_DISCOVERY_BYTES = 65536;
const MAX_JWKS_BYTES = 131072;
const TIMEOUT_MILLIS = 9000;
const MAX_CACHE_MILLIS = 120000;

function obj(x: unknown): JsonObject | null {
  return !!x && typeof x === 'object' && !Array.isArray(x)
    ? x as JsonObject : null;
}
function validateIssuer(value: string): void {
  let u: URL;
  try { u=new URL(value); } catch { throw Error('native_client_issuer_config_invalid'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.port ||
      u.search || u.hash || u.href !== value ||
      !/^\/realms\/[a-zA-Z0-9_-]+$/.test(u.pathname)) {
    throw Error('native_client_issuer_config_invalid');
  }
  if (u.hostname === '127.0.0.1') {
    // Strictly ephemeral, disconnected Github Actions labs only.
    if (process.env.GITHUB_ACTIONS !== 'true' ||
        process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
        process.env.QA_HTTPS_ORIGIN !== 'https://127.0.0.1') {
      throw Error('native_client_loopback_forbidden_outside_synthetic_ci');
    }
  } else if (!/^(?:[a-z0-9-]+\.)+[a-z]{2,}$/i.test(u.hostname) ||
             /(?:^|\.)localhost$/.test(u.hostname) ||
             u.hostname.endsWith('.local')) {
    throw Error('native_client_issuer_host_untrusted');
  }
}
async function readCappedJson(url: string, maxBytes: number): Promise<JsonObject> {
  const response=await fetch(url,{
    method:'GET',redirect:'manual',cache:'no-store',
    signal:AbortSignal.timeout(TIMEOUT_MILLIS),
    headers:{accept:'application/json'},
  });
  if (response.status !== 200 ||
      !/application\/(?:[a-z0-9.-]+\+)?json/i.test(response.headers.get('content-type')||'')) {
    await response.body?.cancel().catch(()=>{});
    throw Error('native_client_discovery_http_or_content_type_rejected');
  }
  const length=Number(response.headers.get('content-length'));
  if (response.headers.has('content-length') &&
      (!Number.isFinite(length) || length > maxBytes || length < 0)) {
    await response.body?.cancel().catch(()=>{});
    throw Error('native_client_discovery_too_large');
  }
  if (!response.body) throw Error('native_client_discovery_body_missing');
  const reader=response.body.getReader();
  const parts:Uint8Array[]=[];
  let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>maxBytes)throw Error('native_client_discovery_too_large');
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(()=>{});
  }
  let data:unknown;
  try { data=JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { throw Error('native_client_discovery_json_invalid'); }
  const result=obj(data);
  if(!result)throw Error('native_client_discovery_json_invalid');
  return result;
}
function checkKeys(untrusted: unknown): readonly NativeClientRsaJwk[] {
  const raw=obj(untrusted);
  const arr=raw?.keys;
  if(!Array.isArray(arr) || arr.length<1 || arr.length>16) {
    throw Error('native_client_jwks_key_set_invalid');
  }
  const ids=new Set<string>();
  const trusted:NativeClientRsaJwk[]=[];
  for(const candidate of arr) {
    const k=obj(candidate);
    if(!k ||
      // Private key material and external key selectors must NEVER appear
      // in any OIDC JWKS response, including alternate/ignored algorithms.
      ['d','p','q','dp','dq','qi','oth','jku','x5u'].some(key=>k[key]!==undefined)) {
      throw Error('native_client_jwks_key_invalid_or_duplicate');
    }

    // A real Keycloak realm may advertise encryption and alternative-alg
    // keys in the SAME JWKS. Those keys are NOT authentication candidates.
    // Our verification policy accepts ONLY RSA/RS256 signing keys. Never
    // reject an otherwise valid realm merely for publishing an enc key.
    const eligible=k.kty==='RSA' &&
      (k.use===undefined || k.use==='sig') &&
      (k.alg===undefined || k.alg==='RS256');
    if(!eligible)continue;

    if(typeof k.kid!=='string' || !/^[a-z0-9_.-]{1,128}$/i.test(k.kid) ||
       ids.has(k.kid) || typeof k.n!=='string' ||
       !/^[A-Za-z0-9_-]{250,1200}$/.test(k.n) ||
       typeof k.e!=='string' || !/^[A-Za-z0-9_-]{2,12}$/.test(k.e)) {
      throw Error('native_client_jwks_key_invalid_or_duplicate');
    }
    ids.add(k.kid);
    trusted.push(Object.freeze({
      kty:'RSA',kid:k.kid,alg:'RS256',use:'sig',n:k.n,e:k.e,
    }));
  }
  if(trusted.length===0)throw Error('native_client_jwks_no_accepted_rs256_key');
  return Object.freeze(trusted);
}

/**
 * Cached fail-closed HTTPS metadata and keys, single-flight on concurrent
 * refresh. Expiration or upstream failure NEVER falls back to stale keys.
 * Rotation will be picked up within cache TTL; product revocation semantics
 * must still be enforced by session and ledger policy at every request.
 */
export class NativeClientTrustedJwksResolver {
  private cached: {until:number;value:NativeClientIssuerPinnedJwks}|null=null;
  private loading:Promise<NativeClientIssuerPinnedJwks>|null=null;
  readonly issuer:string;
  constructor(issuer:string) {
    validateIssuer(issuer);
    this.issuer=issuer;
  }
  async loadTrustedJwks():Promise<NativeClientIssuerPinnedJwks> {
    if(this.cached && Date.now()<this.cached.until)return this.cached.value;
    if(!this.loading) {
      this.loading=this.refresh().finally(()=>{this.loading=null;});
    }
    return this.loading;
  }
  private async refresh():Promise<NativeClientIssuerPinnedJwks> {
    const discoveryUrl=this.issuer+'/.well-known/openid-configuration';
    const expectedJwks=this.issuer+'/protocol/openid-connect/certs';
    const discovery=await readCappedJson(discoveryUrl,MAX_DISCOVERY_BYTES);
    if (discovery.issuer!==this.issuer || discovery.jwks_uri!==expectedJwks) {
      throw Error('native_client_oidc_issuer_or_jwks_mismatch');
    }
    const jwks=await readCappedJson(expectedJwks,MAX_JWKS_BYTES);
    const keys=checkKeys(jwks);
    const trusted=Object.freeze({
      issuer:this.issuer,
      provenanceVerified:true as const,
      keys,
    });
    this.cached={until:Date.now()+MAX_CACHE_MILLIS,value:trusted};
    return trusted;
  }
}
