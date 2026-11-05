const {test}=require('node:test');
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const {loader,QA}=require('./hf33-test-loader.cjs');
const response=(status,data)=>({status,ok:status>=200&&status<300,json:async()=>data,text:async()=>JSON.stringify(data)});
const identity=(subject='A',role='merchant')=>({ok:true,authenticated:true,role,user:{id:subject,name:'Synthetic '+subject},principal:{subject,role,ownershipEligible:true}});
const local=(subject='A')=>({authenticated:true,user:{id:subject,name:'Synthetic '+subject},refreshTokenPresent:true});
function fixture(options={}){
 const store=new Map(),calls=[],state={subject:'A',token:'SYNTHETIC_A',authenticated:true,refreshes:0};
 let f;
 const oidc={
  daMerchantOidcSession:async()=>state.authenticated?local(state.subject):{authenticated:false,user:null},
  daMerchantOidcAccessToken:async()=>state.authenticated?state.token:null,
  daMerchantOidcRefresh:async()=>{state.refreshes++;state.token='SYNTHETIC_REFRESHED';f.load('apps/merchant/utils/daIdentityEpoch.ts').daAdvanceMerchantIdentity();return local(state.subject)},
  daMerchantOidcLogout:async()=>{state.authenticated=false},
 };
 const secure={getItemAsync:async k=>store.get(k)||null,setItemAsync:async(k,v)=>{store.set(k,v)},deleteItemAsync:async k=>{store.delete(k)},isAvailableAsync:async()=>true};
 const fetch=async(url,init)=>{
  calls.push({url:String(url),init});
  if(options.fetch){const custom=await options.fetch(String(url),init,state,calls);if(custom)return custom;}
  if(String(url).endsWith('/auth/merchant/me'))return response(200,identity(state.subject));
  if(String(url).endsWith('/merchant/catalog/me'))return response(200,{ok:true,catalog:{partnerId:'partner-'+state.subject,name:'Synthetic venue '+state.subject}});
  if(String(url).endsWith('/merchant/membership/me'))return response(200,{ok:true,identity:{subject:state.subject,role:'merchant'},accessEligible:true,memberships:[{partnerId:'partner-'+state.subject,accessEligible:true}]});
  if(String(url).endsWith('/auth/health'))return response(200,{ok:true,trustedIdentity:{ready:true}});
  return response(200,{ok:true,orders:[]});
 };
 f=loader({fetch,mocks:{'./daMerchantOidc':oidc,'expo-secure-store':secure,'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_a,value)=>crypto.createHash('sha256').update(value).digest('hex')}}});
 return {...f,state,store,calls};
}
test('Local OIDC without API identity never means an active operational account',()=>{
 const f=fixture(),view=f.load('packages/contracts/src/merchantIdentity.ts').merchantConnectionView({oidc:local(),session:null,health:{ok:true,trustedIdentity:{ready:true}},access:null});
 assert.equal(view.oidcConnected,true);assert.equal(view.identityVerified,false);assert.equal(view.operational,false);assert.equal(view.apiAvailable,true);assert.notEqual(view.badge,'VALIDÉ');
});
test('Absent or failed health cannot be shown as API ready',()=>{
 const core=fixture().load('packages/contracts/src/merchantIdentity.ts');
 for(const health of [null,{}, {ok:false,ready:true},{ok:true}])assert.equal(core.merchantConnectionView({oidc:null,session:null,health,access:null}).apiAvailable,false);
});
for(const status of [401,403,503]){
 test('Merchant identity refuses HTTP '+status+' without granting ownership',async()=>{
  const f=fixture({fetch:async url=>url.endsWith('/auth/merchant/me')?response(status,{ok:false}):null});
  await assert.rejects(f.load('apps/merchant/utils/daAuthBridge.ts').daMe(),e=>e.status===status);
 });
}
for(const [label,payload]of [
 ['missing authenticated flag',{ok:true,user:{id:'A',role:'merchant'}}],
 ['missing role',{ok:true,authenticated:true,user:{id:'A'}}],
 ['wrong role',identity('A','courier')],
 ['wrong subject',identity('B')],
 ['negative reply',{ok:false,authenticated:false}],
]){
 test('Merchant rejects '+label,async()=>{
  const f=fixture({fetch:async url=>url.endsWith('/auth/merchant/me')?response(200,payload):null});
  await assert.rejects(f.load('apps/merchant/utils/daAuthBridge.ts').daMe());
 });
}
test('Authenticated human without catalog ownership is binding-required, not operational',async()=>{
 const f=fixture({fetch:async url=>url.endsWith('/merchant/catalog/me')?response(403,{ok:false}):null});
 const bridge=f.load('apps/merchant/utils/daAuthBridge.ts'),session=await bridge.daMe(),access=await bridge.daMerchantAccess();
 assert.equal(session.apiVerified,true);assert.equal(access.state,'binding_required');assert.equal(access.membershipEligible,false);
 const view=f.load('packages/contracts/src/merchantIdentity.ts').merchantConnectionView({oidc:local(),session,health:null,access});
 assert.equal(view.identityVerified,true);assert.equal(view.operational,false);
});
test('Membership for another venue cannot authorize the selected catalog',async()=>{
 const f=fixture({fetch:async url=>url.endsWith('/merchant/membership/me')?response(200,{ok:true,identity:{subject:'A',role:'merchant'},accessEligible:true,memberships:[{partnerId:'partner-B',accessEligible:true}]}):null});
 const access=await f.load('apps/merchant/utils/daAuthBridge.ts').daMerchantAccess();
 assert.equal(access.state,'membership_pending');assert.equal(access.membershipEligible,false);
 await assert.rejects(f.load('apps/merchant/utils/daOrdersApi.ts').daOrdersFetch(QA+'/orders/demo/list'),e=>e.status===403);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/orders/demo/list')).length,0);
});
test('A verified identity and matching eligible venue can use the business API',async()=>{
 const f=fixture(),orders=f.load('apps/merchant/utils/daOrdersApi.ts');
 const r=await orders.daOrdersFetch(QA+'/orders/demo/list');
 assert.equal(r.status,200);
 assert.equal(f.calls.at(-1).init.headers.get('Authorization'),'Bearer SYNTHETIC_A');
});
test('Account switch changes token, subject and local profile scope',async()=>{
 const f=fixture(),orders=f.load('apps/merchant/utils/daOrdersApi.ts');
 await orders.daOrdersFetch(QA+'/orders/demo/list');const a=await orders.daAccountScopeId();
 f.state.subject='B';f.state.token='SYNTHETIC_B';
 await orders.daOrdersFetch(QA+'/orders/demo/list');const b=await orders.daAccountScopeId();
 assert.notEqual(a,b);assert.equal(f.calls.at(-1).init.headers.get('Authorization'),'Bearer SYNTHETIC_B');
});
test('Old unscoped Thieyp draft is preserved and never imported into another identity',async()=>{
 const f=fixture();f.store.set('delishafrica.partner.presence.v1',JSON.stringify({restaurantName:'Old local Thieyp draft'}));
 f.store.set('da_orders_principal_v2',JSON.stringify({version:2,role:'merchant',subject:'old-subject'}));
 assert.equal(await f.load('apps/merchant/utils/daPresenceStore.ts').loadPartnerPresence(),null);
 assert.ok(f.store.has('delishafrica.partner.presence.v1'));
});
test('Synchronous profile cache disappears immediately on identity generation change',async()=>{
 const f=fixture(),presence=f.load('apps/merchant/utils/daPresenceStore.ts');
 await presence.savePartnerPresence({restaurantName:'Synthetic A'});
 assert.equal(presence.readPartnerPresenceCache().restaurantName,'Synthetic A');
 f.state.subject='B';f.state.token='SYNTHETIC_B';
 f.load('apps/merchant/utils/daIdentityEpoch.ts').daAdvanceMerchantIdentity();
 assert.equal(presence.readPartnerPresenceCache(),null);
 assert.equal(await presence.loadPartnerPresence(),null);
});
test('Anonymous scope cannot reuse the previous principal marker',async()=>{
 const f=fixture(),orders=f.load('apps/merchant/utils/daOrdersApi.ts'),a=await orders.daAccountScopeId();
 f.state.authenticated=false;f.store.set('da_orders_principal_v2',JSON.stringify({version:2,role:'merchant',subject:'A'}));
 const anonymous=await orders.daAccountScopeId();assert.notEqual(a,anonymous);
 await assert.rejects(orders.daOrdersFetch(QA+'/orders/demo/list'));
});
test('Production or third-party request targets never receive the QA bearer',async()=>{
 for(const host of ['https://api.delishafrica.me','https://outside.example.invalid']){
  const f=fixture();
  await assert.rejects(f.load('apps/merchant/utils/daOrdersApi.ts').daOrdersFetch(host+'/api/v1/orders/demo/list'));
  assert.equal(f.calls.length,0);
 }
});
test('A forbidden business response is not retried or turned into a token refresh',async()=>{
 const f=fixture({fetch:async url=>url.endsWith('/orders/demo/list')?response(403,{ok:false}):null});
 assert.equal((await f.load('apps/merchant/utils/daOrdersApi.ts').daOrdersFetch(QA+'/orders/demo/list')).status,403);
 assert.equal(f.state.refreshes,0);assert.equal(f.calls.filter(x=>x.url.endsWith('/orders/demo/list')).length,1);
});
test('A revoked bearer is refreshed once and never retried indefinitely',async()=>{
 const f=fixture({fetch:async url=>url.endsWith('/orders/demo/list')?response(401,{ok:false}):null});
 assert.equal((await f.load('apps/merchant/utils/daOrdersApi.ts').daOrdersFetch(QA+'/orders/demo/list')).status,401);
 assert.equal(f.state.refreshes,1);assert.equal(f.calls.filter(x=>x.url.endsWith('/orders/demo/list')).length,2);
});
test('A pending old-account identity response cannot send an order request after logout',async()=>{
 let release,enteredResolve;const entered=new Promise(r=>enteredResolve=r);
 const delayed=new Promise(r=>release=r);
 const f=fixture({fetch:async url=>{if(url.endsWith('/auth/merchant/me')){enteredResolve();return delayed}return null}});
 const orders=f.load('apps/merchant/utils/daOrdersApi.ts'),pending=orders.daOrdersFetch(QA+'/orders/demo/list');
 await entered;
 await orders.daPurgeOrdersAccountState();f.state.subject='B';f.state.token='SYNTHETIC_B';release(response(200,identity('A')));
 await assert.rejects(pending,/identity_changed/);
 assert.equal(f.calls.filter(x=>x.url.endsWith('/orders/demo/list')).length,0);
});
for(const [label,config,native]of [
 ['missing configuration',{},{}],
 ['QA flag with production API',{EXPO_PUBLIC_API_BASE_URL:'https://api.delishafrica.me',EXPO_PUBLIC_RELEASE_RING:'ataraxie-ios-qa'},{}],
 ['conflicting native environment',{EXPO_PUBLIC_API_BASE_URL:QA},{expoConfig:{extra:{EXPO_PUBLIC_API_BASE_URL:'https://api.delishafrica.me'}}}],
 ['unapproved host',{EXPO_PUBLIC_API_BASE_URL:'https://api.delishafrica.me.evil.invalid'},{}],
]){
 test('Environment fails closed for '+label,()=>{
  const f=loader({config,native});
  assert.throws(()=>f.load('apps/merchant/utils/daApiEnvironment.ts').daApiBase());
 });
}
