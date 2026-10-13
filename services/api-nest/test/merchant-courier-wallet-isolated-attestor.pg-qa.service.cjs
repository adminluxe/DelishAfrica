'use strict';
// F4I dedicated QA attestor process, Unix-domain socket only.
// Runs against a disposable Keycloak + PG17 with synthetic partner records.
// NOT imported into the production AppModule.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const crypto=require('node:crypto');
const {Pool}=require('pg');
const {ExternalJwksVerifierService}=require('/qa-built/external-jwks-verifier.service.js');
const {QaWalletVerifiedSessionBridge}=require(
  '/qa-built/merchant-courier-wallet-signed-session.pg-qa.bridge.js');
const {QaFinanceAuthorityRegistryReader}=require(
  '/qa-built/merchant-courier-finance-authority.pg-qa.adapter.js');
const ISSUER='https://127.0.0.1/realms/da-wallet-partners-qa';
const SOCKET='/qa-ipc/finance-attestor.sock';
const PREFIX='DA-F4G-keycloak-partner-sid-jti-v1\n';
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
for(const [name,value] of [
  ['GITHUB_ACTIONS','true'],['QA_SYNTHETIC_ONLY','YES'],
  ['QA_F4I_PRIVATE_SERVICE','YES'],
  ['NODE_EXTRA_CA_CERTS','/qa-tls/qa.crt']]){
  assert.equal(process.env[name],value,'isolated QA only: '+name);
}
assert.notEqual(process.env.NODE_ENV,'production');
assert.equal(process.getuid?.(),1001);
for(const name of ['QA_ATTESTOR_DB_PASSWORD','QA_REGISTRY_DB_PASSWORD',
  'QA_MERCHANT_DB_PASSWORD','QA_COURIER_DB_PASSWORD',
  'QA_INTROSPECT_CLIENT_SECRET']){
  assert.ok((process.env[name]||'').length>=24,'missing private credential');
}
assert.equal(process.env.QA_BOOTSTRAP_ADMIN_PASSWORD,undefined);
const makePool=(role,secret)=>new Pool({
  host:'127.0.0.1',port:5432,database:'postgres',
  user:role,password:secret,max:2,
  connectionTimeoutMillis:4000,statement_timeout:7500,
});
const attestor=makePool('da_qa_wallet_attestor_isolated_013',
  process.env.QA_ATTESTOR_DB_PASSWORD);
const registryDb=makePool('da_qa_finance_registry_reader_012',
  process.env.QA_REGISTRY_DB_PASSWORD);
const merchantPool=makePool('da_qa_merchant_commerce_app',
  process.env.QA_MERCHANT_DB_PASSWORD);
const courierPool=makePool('da_qa_courier_commerce_app',
  process.env.QA_COURIER_DB_PASSWORD);
const registry=new QaFinanceAuthorityRegistryReader(registryDb);
function externalVerifier(){
  const proto=ExternalJwksVerifierService.prototype;
  const old=proto.readConfig;
  proto.readConfig=()=>({
    issuer:ISSUER,discoveryUrl:ISSUER+'/.well-known/openid-configuration',
    advertisedJwksUrl:ISSUER+'/protocol/openid-connect/certs',
    jwksUrl:ISSUER+'/protocol/openid-connect/certs',
    audience:'delishafrica-merchant',allowedAlgorithms:['RS256'],
    merchantRealmRoles:['merchant'],merchantClientRoles:['merchant'],
    clockSkewSeconds:30,refreshSeconds:600,
  });
  let v;
  try{v=new ExternalJwksVerifierService();}
  finally{proto.readConfig=old;}
  return v;
}
const verifier=externalVerifier();
async function introspect(token){
  const credentials=Buffer.from(
    'da-f4g-confidential-attestor-qa:'+process.env.QA_INTROSPECT_CLIENT_SECRET)
    .toString('base64');
  const r=await fetch(ISSUER+'/protocol/openid-connect/token/introspect',{
    method:'POST',redirect:'manual',signal:AbortSignal.timeout(7500),
    headers:{authorization:'Basic '+credentials,
      'content-type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({token}),
  });
  if(r.status!==200)return null;
  const result=await r.json();
  return result.active===true?result:null;
}
const trust={
  verify:{async verifyToken(token){
    const v=await verifier.verifyToken(token);
    if(!v.ok)return v;
    const status=await introspect(token);
    if(!status||status.iss!==v.payload.iss||
       status.sub!==v.payload.sub)return {ok:false,reason:'revoked'};
    return v;
  }},
  async checkLiveSession(issuer,subject,sid,jti){
    const digest=sha(PREFIX+[issuer,subject,sid,jti].join('\n'));
    const r=await attestor.query(
      'SELECT issuer,subject::text,owner_role,audience,expires_at,revoked_at '+
      'FROM public.da_qa_partner_oidc_sessions_011 '+
      'WHERE session_key_sha256=$1::char(64)',[digest]);
    if(r.rows.length!==1)return null;
    const row=r.rows[0];
    if(row.issuer!==issuer||row.subject!==subject||row.revoked_at||
       new Date(row.expires_at).getTime()<=Date.now())return null;
    return {source:'independent-revocation-ledger',active:true,
      issuer,subject,sid,jti,checkedAtEpochMs:Date.now()};
  },
  readMerchantWalletScopes:(issuer,subject)=>
    registry.readMerchantWalletScopes(issuer,subject),
  readCourierWalletScope:(issuer,subject)=>
    registry.readCourierWalletScope(issuer,subject),
  merchantPool,courierPool,attestor,
};
const bridge=new QaWalletVerifiedSessionBridge(trust,ISSUER);
async function request(req,res){
  try{
    if(req.method!=='POST'||req.url!=='/wallet'||
       req.headers['content-type']!=='application/json')throw Error('deny');
    let body='';
    for await(const chunk of req){
      body+=chunk.toString('utf8');
      if(body.length>13000)throw Error('deny');
    }
    const input=JSON.parse(body);
    if(!input||typeof input!=='object'||Array.isArray(input)||
       Object.keys(input).sort().join(',')!=='authorization,limit')
      throw Error('deny');
    const report=await bridge.readWallet(input.authorization,input.limit);
    res.writeHead(200,{'content-type':'application/json',
      'cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(report));
  }catch{
    res.writeHead(403,{'cache-control':'no-store'});
    res.end('qa_f4i_denied');
  }
}
async function main(){
  await verifier.onModuleInit();
  assert.equal(verifier.health().ready,true);
  const role=(await attestor.query('SELECT session_user AS login')).rows[0]?.login;
  assert.equal(role,'da_qa_wallet_attestor_isolated_013');
  assert.equal((await registryDb.query('SELECT session_user AS login')).rows[0]?.login,
    'da_qa_finance_registry_reader_012');
  assert.equal(fs.existsSync(SOCKET),false);
  const server=http.createServer((req,res)=>{void request(req,res);});
  server.requestTimeout=10000;
  await new Promise((resolve,reject)=>{
    server.once('error',reject);
    server.listen(SOCKET,resolve);
  });
  fs.chmodSync(SOCKET,0o660);
  console.log('QA_F4I_SEPARATE_ATTESTOR_SOCKET_READY=PASS');
  const close=async()=>{
    server.closeAllConnections();
    await new Promise(resolve=>server.close(resolve));
    await Promise.all([attestor.end(),registryDb.end(),
      merchantPool.end(),courierPool.end()]);
    await verifier.onModuleDestroy();
  };
  process.once('SIGTERM',()=>void close().then(()=>process.exit(0)));
}
void main().catch(()=>{
  console.error('QA_F4I_PRIVATE_ATTESTOR_STARTUP_DENIED');
  process.exitCode=1;
});
