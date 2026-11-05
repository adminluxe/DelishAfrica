const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader}=require('./hf33-test-loader.cjs');
const issuer='https://keycloak.afritaste.delishafrica.me/realms/afritaste';
const jwt=(subject='A',nonce='NONCE')=>['eyJhbGciOiJSUzI1NiJ9',Buffer.from(JSON.stringify({iss:issuer,aud:'delishafrica-merchant',sub:subject,exp:Math.floor(Date.now()/1000)+3600,nonce,realm_access:{roles:['merchant']}})).toString('base64url'),'synthetic'].join('.');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
function fixture(options={}){
 const store=new Map(),refreshStarted=deferred(),refreshDone=deferred();
 const prefix='da_merchant_oidc_';
 for(const[k,v]of Object.entries({access_token:jwt(),refresh_token:'SYNTHETIC_REFRESH',id_token:jwt(),expires_at:String(Math.floor(Date.now()/1000)+3600),user:JSON.stringify({id:'A',role:'merchant'}),api_verification:'{}'}))store.set(prefix+k+'_v1',v);
 const discovery={authorizationEndpoint:issuer+'/auth',tokenEndpoint:issuer+'/token',discoveryDocument:{issuer,code_challenge_methods_supported:['S256']}};
 const secure={getItemAsync:async k=>store.get(k)||null,setItemAsync:async(k,v)=>{store.set(k,v)},deleteItemAsync:async k=>{store.delete(k)}};
 const auth={fetchDiscoveryAsync:async()=>discovery,refreshAsync:async()=>{refreshStarted.resolve();return refreshDone.promise},AuthRequest:class{constructor(){this.codeVerifier='SYNTHETIC_PKCE'}async promptAsync(){return{type:'success',params:{code:'SYNTHETIC'}}}},ResponseType:{Code:'code'},CodeChallengeMethod:{S256:'S256'},Prompt:{Login:'login'},exchangeCodeAsync:async()=>options.exchange||{accessToken:jwt(),idToken:jwt('B'),refreshToken:'SYNTHETIC_NEW'}};
 const f=loader({mocks:{'expo-secure-store':secure,'expo-auth-session':auth,'expo-crypto':{randomUUID:()=> 'NONCE'},'expo-web-browser':{maybeCompleteAuthSession:()=>{}}},fetch:async(_u,init)=>{const token=init.headers.Authorization.slice(7);const sub=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;const data={ok:true,authenticated:true,role:'merchant',user:{id:sub},principal:{subject:sub,role:'merchant'}};return{ok:true,status:200,text:async()=>JSON.stringify(data)}}});
 return {api:f.load('apps/merchant/utils/daMerchantOidc.ts'),store,refreshStarted,refreshDone};
}
test('Actual Merchant OIDC rejects mismatched login subjects before credential writes',async()=>{
 const f=fixture();await assert.rejects(f.api.daMerchantOidcLogin(),/subject_mismatch/);assert.match(f.store.get('da_merchant_oidc_access_token_v1'),/synthetic/);
});
test('Actual Merchant OIDC rejects a missing expected nonce',async()=>{
 const f=fixture({exchange:{accessToken:jwt(),idToken:jwt('A','WRONG'),refreshToken:'SYNTHETIC'}});
 await assert.rejects(f.api.daMerchantOidcLogin(),/nonce_mismatch/);
});
test('A delayed refresh cannot resurrect Merchant credentials after logout',async()=>{
 const f=fixture(),refresh=f.api.daMerchantOidcRefresh();await f.refreshStarted.promise;
 await f.api.daMerchantOidcLogout();assert.equal(f.store.size,0);
 f.refreshDone.resolve({accessToken:jwt(),idToken:jwt(),refreshToken:'SYNTHETIC_ROTATED'});
 await assert.rejects(refresh,/identity_changed/);assert.equal(f.store.size,0);
});
test('Refresh cannot silently switch the Merchant subject',async()=>{
 const f=fixture(),refresh=f.api.daMerchantOidcRefresh();await f.refreshStarted.promise;
 f.refreshDone.resolve({accessToken:jwt('B'),idToken:jwt('B'),refreshToken:'SYNTHETIC_ROTATED'});
 await assert.rejects(refresh,/refresh_subject_mismatch/);assert.equal(JSON.parse(f.store.get('da_merchant_oidc_user_v1')).id,'A');
});
