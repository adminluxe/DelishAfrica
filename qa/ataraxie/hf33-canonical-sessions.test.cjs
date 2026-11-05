const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader}=require('./hf33-test-loader.cjs');
const issuer='https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
function fixture(app){
 const store=new Map(),started=deferred(),done=deferred(),state={refreshes:0};
 const key='da.oidc.'+app+'.v2';
 const jwt=(sub='A',patch={})=>[Buffer.from(JSON.stringify({alg:'RS256'})).toString('base64url'),Buffer.from(JSON.stringify({iss:issuer,sub,aud:'delishafrica-'+app,azp:'delishafrica-'+app,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,nonce:'NONCE',realm_access:{roles:[app]},...patch})).toString('base64url'),'synthetic'].join('.');
 store.set(key,JSON.stringify({accessToken:jwt(),refreshToken:'SYNTHETIC_REFRESH',idToken:jwt(),subject:'A',expiresAt:Math.floor(Date.now()/1000)+3600}));
 const secure={getItemAsync:async k=>store.get(k)||null,setItemAsync:async(k,v)=>{store.set(k,v)},deleteItemAsync:async k=>{store.delete(k)}};
 const f=loader({mocks:{'expo-auth-session':{fetchDiscoveryAsync:async()=>({tokenEndpoint:issuer+'/token'}),refreshAsync:async()=>{state.refreshes++;started.resolve();return done.promise}},'expo-secure-store':secure,'expo-web-browser':{},'react-native':{Platform:{OS:'android'},AppState:{},Linking:{}}},fetch:async()=>({ok:false,status:503,json:async()=>({}),text:async()=> '{}'})});
 return{api:f.load('apps/'+app+'/auth/daOidcSession.ts'),store,key,jwt,started,done,state};
}
for(const app of ['client','courier']){
 test(app+' initial authentication requires the exact expected nonce',async()=>{
  for(const patch of [{nonce:undefined},{nonce:'WRONG'}]){
   const f=fixture(app),result=await f.api.establishOidcSession({accessToken:f.jwt(),idToken:f.jwt('A',patch)},'NONCE');
   assert.notEqual(result.status,'authenticated');
  }
 });
 test(app+' rejects wrong issuer, audience and mismatched subjects before saving',async()=>{
  for(const [access,id]of [[{iss:'https://example.com'},{}],[{aud:'wrong'},{}],[{sub:'B'},{}]]){
   const f=fixture(app),before=f.store.get(f.key),result=await f.api.establishOidcSession({accessToken:f.jwt('A',access),idToken:f.jwt('A',id)},'NONCE');
   assert.notEqual(result.status,'authenticated');assert.equal(f.store.get(f.key),before);
  }
 });
 test(app+' preserves ID and refresh tokens when a refresh response omits replacements',async()=>{
  const f=fixture(app),old=JSON.parse(f.store.get(f.key)),pending=f.api.refreshOidcSession();await f.started.promise;
  f.done.resolve({accessToken:f.jwt()});const result=await pending;
  assert.equal(result.status,'authenticated');const next=JSON.parse(f.store.get(f.key));
  assert.equal(next.refreshToken,old.refreshToken);assert.equal(next.idToken,old.idToken);
 });
 test(app+' coalesces simultaneous token rotations',async()=>{
  const f=fixture(app),a=f.api.refreshOidcSession(),b=f.api.refreshOidcSession();await f.started.promise;
  f.done.resolve({accessToken:f.jwt()});await Promise.all([a,b]);assert.equal(f.state.refreshes,1);
 });
 test(app+' a delayed refresh cannot restore a session once logout has started',async()=>{
  const f=fixture(app),pending=f.api.refreshOidcSession();await f.started.promise;
  await f.api.logoutOidcSession();const afterLogout=f.store.get(f.key);
  f.done.resolve({accessToken:f.jwt(),refreshToken:'SYNTHETIC_ROTATED'});
  const result=await pending;assert.notEqual(result.status,'authenticated');assert.equal(f.store.get(f.key),afterLogout);
 });
 test(app+' old refresh failure cannot delete a new login',async()=>{
  const f=fixture(app),pending=f.api.refreshOidcSession();await f.started.promise;
  const result=await f.api.establishOidcSession({accessToken:f.jwt('B'),idToken:f.jwt('B'),refreshToken:'SYNTHETIC_B'},'NONCE');
  assert.equal(result.status,'authenticated');const saved=f.store.get(f.key);
  f.done.resolve({accessToken:f.jwt('A')});await pending;assert.equal(f.store.get(f.key),saved);
 });
}
