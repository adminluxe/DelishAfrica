const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loader,QA}=require('./hf33-test-loader.cjs');
for(const app of ['client','merchant','courier']){
 test(app+': auth health uses the same configured QA API as orders',async()=>{
  const f=loader();await f.load('apps/'+app+'/utils/daAuthBridge.ts').daAuthHealth();
  assert.equal(f.calls[0].url,QA+'/auth/health');
 });
 test(app+': profile inspection stays on configured QA API',async()=>{
  const f=loader();await f.load('apps/'+app+'/utils/daProfileTrust.ts').daInspectProfileTrust({role:app,name:'Synthetic Test',phone:'synthetic',email:'qa@example.invalid'});
  assert.equal(f.calls[0].url,QA+'/profile-trust/inspect');
 });
 test(app+': territory lookup stays on configured QA API',async()=>{
  const f=loader();await f.load('apps/'+app+'/utils/daTrustNetwork.ts').daResolveTerritory(1,2);
  assert.equal(new URL(f.calls[0].url).origin,new URL(QA).origin);
 });
}
