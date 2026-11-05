const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {loader}=require('./hf33-test-loader.cjs');
function fixture(){
 const store=new Map(),calls=[],state={subject:'A',generation:0,ack:true};
 const session={loadOidcSession:async()=>({status:'authenticated',role:'courier',subject:state.subject,accessToken:'SYNTHETIC_'+state.subject}),refreshOidcSession:async()=>({status:'authenticated',role:'courier',subject:state.subject,accessToken:'SYNTHETIC_'+state.subject}),getValidOidcAccessToken:async()=>'SYNTHETIC_'+state.subject,daOidcSessionGeneration:()=>state.generation,daAssertOidcSessionGeneration:e=>{if(e!==state.generation)throw new Error('oidc_identity_changed')}};
 const f=loader({mocks:{'../auth/daOidcSession':session,'expo-secure-store':{getItemAsync:async k=>store.get(k)||null,setItemAsync:async(k,v)=>{store.set(k,v)},deleteItemAsync:async k=>store.delete(k),isAvailableAsync:async()=>true},'expo-crypto':{CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_a,s)=>crypto.createHash('sha256').update(s).digest('hex')}},fetch:async(url,init)=>{
  calls.push({url:String(url),init});const data=String(url).endsWith('/auth/me')?{ok:true,authenticated:true,user:{id:state.subject,role:'courier'}}:state.ack?{ok:true}:{};
  return{ok:true,status:200,json:async()=>data};
 }});
 return{...f,api:f.load('apps/courier/utils/daPresenceStore.ts'),state,store,calls};
}
test('Legacy proofs without an API provenance are retained but never imported',async()=>{
 const f=fixture();f.store.set('delishafrica.courier.presence.v1',JSON.stringify({riderName:'Legacy',proofs:{phone:{token:'SYNTHETIC'}}}));
 assert.equal(await f.api.loadCourierPresence(),null);assert.ok(f.store.has('delishafrica.courier.presence.v1'));
});
test('A Courier account switch invalidates the synchronous presence cache',async()=>{
 const f=fixture();await f.api.saveCourierPresence({riderName:'Synthetic A',available:false},0);
 assert.equal(f.api.readCourierPresenceCache().riderName,'Synthetic A');
 f.state.generation++;f.state.subject='B';assert.equal(f.api.readCourierPresenceCache(),null);
 assert.equal(await f.api.loadCourierPresence(),null);
});
test('A stale Courier form cannot send or save presence for a new account',async()=>{
 const f=fixture();f.state.generation++;f.state.subject='B';
 await assert.rejects(f.api.saveCourierPresence({riderName:'Synthetic A',available:true},0),/identity_changed/);
 assert.equal(f.calls.length,0);
});
test('A 200 response without an explicit server ACK never confirms availability',async()=>{
 const f=fixture();f.state.ack=false;
 await assert.rejects(f.api.saveCourierPresence({riderName:'Synthetic A',available:true},0));
 assert.equal(f.api.readCourierPresenceCache(),null);
 assert.equal([...f.store.keys()].filter(x=>x.startsWith('delishafrica.courier.presence.v1.v4.')).length,0);
});
