'use strict';
/** F4L private QA verifier. Uses REAL Keycloak JWKS RSA+TLS and introspection.
 * Only called inside the disconnected CI network. Never accepts unsigned
 * metadata, mobile identities or an asserted client ID from a JSON body.
 */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const ISS='https://127.0.0.1/realms/da-wallet-partners-qa';
const CLIENT='da-f4l-dispatch-machine-qa';
const AUD='delishafrica-dispatch-authority';
const ROLE='da_dispatch_assign',SCOPE='da.dispatch.assign';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const safeJson=(input,max)=>{
 if(typeof input!=='string'||input.length>max)throw Error('qa_f4l_invalid_json');
 const v=JSON.parse(Buffer.from(input,'base64url').toString('utf8'));
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('qa_f4l_bad_object');
 return v;
};
async function json(url){
 const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(8000)});
 if(r.status!==200)throw Error('qa_f4l_oidc_fetch_denied');
 const t=await r.text();
 if(t.length>1024*1024)throw Error('qa_f4l_oidc_too_large');
 return JSON.parse(t);
}
async function verifyMachineAuthorization(authorization,secret){
 if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.NODE_EXTRA_CA_CERTS!=='/qa-tls/qa.crt')throw Error('qa_f4l_no_runtime_authority');
 if(typeof authorization!=='string'||authorization.length>15000
 ||!/^Bearer [A-Za-z0-9_.-]+$/.test(authorization))throw Error('qa_f4l_bearer_required');
 const token=authorization.slice(7),parts=token.split('.');
 if(parts.length!==3||parts.some(p=>!p||p.length>11000||
   !/^[A-Za-z0-9_-]+$/.test(p)))throw Error('qa_f4l_malformed_token');
 const header=safeJson(parts[0],2000),claims=safeJson(parts[1],11000);
 if(header.alg!=='RS256'||!['JWT','at+jwt',undefined].includes(header.typ)
 ||typeof header.kid!=='string'||!header.kid||header.kid.length>250)
 throw Error('qa_f4l_bad_header');
 const discovery=await json(ISS+'/.well-known/openid-configuration');
 const jwksUrl=ISS+'/protocol/openid-connect/certs';
 if(discovery.issuer!==ISS||discovery.jwks_uri!==jwksUrl)
 throw Error('qa_f4l_discovery_mismatch');
 const jwks=await json(jwksUrl);
 const key=(jwks.keys||[]).find(x=>x.kid===header.kid&&x.kty==='RSA'&&
 (!x.use||x.use==='sig')&&(!x.alg||x.alg==='RS256'));
 if(!key)throw Error('qa_f4l_unknown_signing_key');
 const valid=crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1],'ascii'),
  crypto.createPublicKey({key,format:'jwk'}),Buffer.from(parts[2],'base64url'));
 if(!valid)throw Error('qa_f4l_invalid_signature');
 const now=Math.floor(Date.now()/1000);
 if(claims.iss!==ISS||claims.azp!==CLIENT||!UUID.test(claims.sub||'')
 ||![claims.aud].flat().includes(AUD)
 ||[claims.aud].flat().some(x=>['delishafrica-merchant','delishafrica-courier','delishafrica-client'].includes(x))
 ||!String(claims.scope||'').split(' ').includes(SCOPE)
 ||!claims.realm_access?.roles?.includes(ROLE)
 ||claims.realm_access?.roles?.some(x=>['merchant','courier','client','ops'].includes(x))
 ||!Number.isInteger(claims.exp)||claims.exp<=now
 ||!Number.isInteger(claims.iat)||claims.iat>now+10
 ||(claims.nbf!==undefined&&(!Number.isInteger(claims.nbf)||claims.nbf>now+10))
 ||typeof claims.jti!=='string'||!claims.jti)
 throw Error('qa_f4l_claims_denied');
 assert.ok(secret&&secret.length>=24);
 const form=new URLSearchParams({token});
 const introspect=await fetch(ISS+'/protocol/openid-connect/token/introspect',{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(8000),
  headers:{authorization:'Basic '+Buffer.from(
   'da-f4g-confidential-attestor-qa:'+secret).toString('base64'),
   'content-type':'application/x-www-form-urlencoded'},body:form});
 if(introspect.status!==200)throw Error('qa_f4l_introspection_denied');
 const live=await introspect.json();
 if(live.active!==true||live.sub!==claims.sub||live.iss!==ISS
 ||live.client_id!==CLIENT||!String(live.scope||'').split(' ').includes(SCOPE))
 throw Error('qa_f4l_token_inactive');
 return Object.freeze({issuer:ISS,subject:claims.sub,clientId:CLIENT,
  tokenDigest:crypto.createHash('sha256').update(token).digest('hex')});
}
module.exports={verifyMachineAuthorization,ISS,CLIENT,AUD,ROLE,SCOPE};
