'use strict';
/**
 * F4L one-time QA issuer fixture. Runs against a real DISCONNECTED Keycloak 26.4.7.
 * Admin bootstrap credentials exist ONLY here; neither worker nor attestator
 * receives a Keycloak admin credential. No production Keycloak calls.
 */
const fs=require('node:fs');
const crypto=require('node:crypto');
const assert=require('node:assert/strict');
const ROOT='https://127.0.0.1';
const REALM='da-wallet-partners-qa';
const ISS=ROOT+'/realms/'+REALM;
const CLIENT='da-f4l-dispatch-machine-qa';
const AUD='delishafrica-dispatch-authority';
const ROLE='da_dispatch_assign',SCOPE='da.dispatch.assign';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
for(const [key,val] of Object.entries({
 GITHUB_ACTIONS:'true',QA_SYNTHETIC_ONLY:'YES',
 QA_KEYCLOAK_ORIGIN:ROOT,NODE_EXTRA_CA_CERTS:'/qa-tls/qa.crt'}))
 assert.equal(process.env[key],val,'isolated F4L fixture only: '+key);
assert.ok((process.env.QA_BOOTSTRAP_ADMIN_PASSWORD||'').length>=24);
async function call(method,path,token,body,expected=200){
 const r=await fetch(ROOT+path,{method,redirect:'manual',
  signal:AbortSignal.timeout(18000),headers:{
   ...(token?{authorization:'Bearer '+token}:{}),
   ...(body===undefined?{}:{'content-type':'application/json'})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})});
 assert.equal(r.status,expected,'Keycloak fixture operation '+method+' '+path);
 const value=await r.text();
 return value?JSON.parse(value):null;
}
async function main(){
 const master=await fetch(ROOT+'/realms/master/protocol/openid-connect/token',{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(18000),
  headers:{'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({client_id:'admin-cli',grant_type:'password',
   username:'qa_admin',password:process.env.QA_BOOTSTRAP_ADMIN_PASSWORD})});
 assert.equal(master.status,200);
 const admin=(await master.json()).access_token;
 assert.ok(admin&&typeof admin==='string');
 await call('POST','/admin/realms/'+REALM+'/roles',admin,
  {name:ROLE,description:'QA machine dispatch assign only'},201);
 const role=await call('GET','/admin/realms/'+REALM+'/roles/'+ROLE,admin);
 const secret=crypto.randomBytes(40).toString('base64url');
 await call('POST','/admin/realms/'+REALM+'/clients',admin,{
  clientId:CLIENT,enabled:true,protocol:'openid-connect',
  publicClient:false,clientAuthenticatorType:'client-secret',
  secret,standardFlowEnabled:false,implicitFlowEnabled:false,
  directAccessGrantsEnabled:false,serviceAccountsEnabled:true,
  authorizationServicesEnabled:false,fullScopeAllowed:false,
 },201);
 const matches=await call('GET','/admin/realms/'+REALM+
  '/clients?clientId='+CLIENT,admin);
 const id=matches.find(x=>x.clientId===CLIENT)?.id;
 assert.match(id,UUID);
 // Restrict effective roles to just the one service realm grant.
 await call('POST','/admin/realms/'+REALM+'/clients/'+id+
  '/scope-mappings/realm',admin,[role],204);
 const service=await call('GET','/admin/realms/'+REALM+
  '/clients/'+id+'/service-account-user',admin);
 assert.match(service.id,UUID);
 await call('POST','/admin/realms/'+REALM+'/users/'+service.id+
  '/role-mappings/realm',admin,[role],204);
 await call('POST','/admin/realms/'+REALM+'/clients/'+id+
  '/protocol-mappers/models',admin,{
   name:'qa-dispatch-audience',protocol:'openid-connect',
   protocolMapper:'oidc-audience-mapper',consentRequired:false,
   config:{'included.client.audience':AUD,
    'access.token.claim':'true','id.token.claim':'false'},
  },201);
 // A dedicated OPTIONAL OIDC scope; not a blanket realm/client wildcard.
 await call('POST','/admin/realms/'+REALM+'/client-scopes',admin,{
  name:SCOPE,description:'F4L synthetic dispatch assignments',
  protocol:'openid-connect',attributes:{
   'include.in.token.scope':'true','display.on.consent.screen':'false'},
 },201);
 const all=await call('GET','/admin/realms/'+REALM+'/client-scopes',admin);
 const sid=all.find(x=>x.name===SCOPE)?.id;
 assert.match(sid,UUID);
 await call('PUT','/admin/realms/'+REALM+'/clients/'+id+
  '/optional-client-scopes/'+sid,admin,undefined,204);
 const tokenResponse=await fetch(ISS+'/protocol/openid-connect/token',{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(18000),
  headers:{authorization:'Basic '+
   Buffer.from(CLIENT+':'+secret).toString('base64'),
   'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'client_credentials',scope:SCOPE})});
 assert.equal(tokenResponse.status,200,'Keycloak client-credentials token');
 const token=(await tokenResponse.json()).access_token;
 assert.ok(token);
 const claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
 assert.equal(claims.iss,ISS);
 assert.equal(claims.azp,CLIENT);
 assert.equal(claims.sub,service.id);
 assert.ok([claims.aud].flat().includes(AUD),'audience mapper');
 assert.ok(String(claims.scope||'').split(' ').includes(SCOPE),'OIDC scope');
 assert.ok(claims.realm_access?.roles?.includes(ROLE),'machine realm role');
 const data={issuer:ISS,subject:service.id,clientId:CLIENT,
  clientSecret:secret,audience:AUD,scope:SCOPE,role:ROLE};
 fs.writeFileSync('/qa-seed/f4l-dispatch-machine.json',
  JSON.stringify(data),{mode:0o600});
 console.log('QA_F4L_KEYCLOAK_REAL_CLIENT_CREDENTIALS_SCOPED=PASS');
 console.log('QA_F4L_MACHINE_ISSUER_AUDIENCE_AZP_ROLE_SCOPE=PASS');
}
void main().catch(e=>{
 console.error('QA_F4L_MACHINE_PROVISION_FAILED',String(e.message).slice(0,140));
 process.exitCode=1;
});
