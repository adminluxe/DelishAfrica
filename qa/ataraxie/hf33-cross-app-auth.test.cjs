const {test}=require('node:test'),assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {loader,QA}=require('./hf33-test-loader.cjs');
function fixture(app){
 const state={subject:'A',token:'SYNTHETIC_A',authenticated:true},calls=[];
 const session=async()=>state.authenticated?{status:'authenticated',role:app,subject:state.subject,accessToken:state.token}:{status:'anonymous',role:app};
 const f=loader({mocks:{'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_a,s)=>crypto.createHash('sha256').update(s).digest('hex')},'../auth/daOidcSession':{loadOidcSession:session,refreshOidcSession:session,getValidOidcAccessToken:async()=>state.token}},fetch:async(url,init)=>{
  calls.push({url:String(url),init});const data=String(url).endsWith('/auth/me')?{ok:true,authenticated:true,user:{id:state.subject,role:app}}:{ok:true,orders:[]};
  return{ok:true,status:200,json:async()=>data};
 }});
 return{api:f.load('apps/'+app+'/utils/daOrdersApi.ts'),state,calls};
}
for(const app of ['client','courier']){
 test(app+' rejects production and foreign origins before loading an account',async()=>{
  const f=fixture(app);
  for(const url of ['https://api.delishafrica.me/api/v1/orders/demo/list','https://example.com/api/v1/orders'])await assert.rejects(f.api.daOrdersFetch(url));
  assert.equal(f.calls.length,0);
 });
 test(app+' switches bearer token with the authenticated subject',async()=>{
  const f=fixture(app);await f.api.daOrdersFetch(QA+'/orders/demo/list');
  f.state.subject='B';f.state.token='SYNTHETIC_B';await f.api.daOrdersFetch(QA+'/orders/demo/list');
  assert.equal(f.calls.at(-1).init.headers.get('Authorization'),'Bearer SYNTHETIC_B');
  assert.equal(f.calls.at(-1).init.redirect,'error');
 });
 test(app+' cached identity cannot issue orders after logout',async()=>{
  const f=fixture(app);await f.api.daOrdersFetch(QA+'/orders/demo/list');f.state.authenticated=false;
  const count=f.calls.filter(x=>x.url.endsWith('/orders/demo/list')).length;
  await assert.rejects(f.api.daOrdersFetch(QA+'/orders/demo/list'));
  assert.equal(f.calls.filter(x=>x.url.endsWith('/orders/demo/list')).length,count);
 });
}

for(const app of ['client','courier']){
 test(app+' authenticated accounts never inherit the previous profile marker',async()=>{
  const f=fixture(app),a=await f.api.daAccountScopeId();f.state.subject='B';f.state.token='SYNTHETIC_B';
  const b=await f.api.daAccountScopeId();assert.notEqual(a,b);assert.match(a,/^v4\.[a-f0-9]{64}$/);
  f.state.authenticated=false;assert.notEqual(await f.api.daAccountScopeId(),b);
 });
}
