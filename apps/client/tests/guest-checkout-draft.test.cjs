'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{
  fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,f);
const {GuestCheckoutDraftVault,GUEST_DRAFT_KEY}=require('../utils/guestCheckoutDraftVault.ts');
const BASE=Date.UTC(2026,9,9,16,0,0);
const order='DA-G-'+'a'.repeat(32);
const token='dagc1.Zm9v.'+'b'.repeat(43);
const rec={version:1,orderId:order,mutationId:'guest:'+order,
 token,expiresAt:new Date(BASE+14400000).toISOString(),
 createdAt:new Date(BASE).toISOString(),step:'issued'};
function holder(now=BASE){
 const data=new Map();
 return {store:new GuestCheckoutDraftVault({
  async getItemAsync(k){return data.get(k)||null},
  async setItemAsync(k,v){data.set(k,v)},
  async deleteItemAsync(k){data.delete(k)}
 },()=>now),data};
}
test('persist an opaque guest token without PII',async()=>{
 const {store,data}=holder();
 await store.save(rec);
 assert.equal((await store.restore()).record.orderId,order);
 const raw=data.get(GUEST_DRAFT_KEY);
 assert.equal(raw.includes('email'),false);
 assert.equal(raw.includes('address'),false);
});
test('advance only and keep identity immutable',async()=>{
 const {store}=holder();
 await store.save(rec);
 await store.save({...rec,step:'quoted'});
 await assert.rejects(store.save(rec),/state_regression/);
 await assert.rejects(store.save({...rec,step:'payment_pending',paymentIntentId:'pi_testabcdefgh',token:token+'z'}));
 await store.save({...rec,step:'payment_pending',paymentIntentId:'pi_testabcdefgh'});
 assert.equal((await store.restore()).record.step,'payment_pending');
});
test('a pending payment blocks silent replacement by a second order',async()=>{
 const {store}=holder();
 await store.save({...rec,step:'payment_pending',paymentIntentId:'pi_testabcdefgh'});
 const other='DA-G-'+'c'.repeat(32);
 await assert.rejects(store.save({...rec,orderId:other,mutationId:'guest:'+other}),/recover_current_first/);
 await store.clear();
 assert.equal(await store.restore(),null);
});
test('issued session expires and clears, but pending payment is retained for recovery',async()=>{
 const early=holder(BASE+14400001);
 early.data.set(GUEST_DRAFT_KEY,JSON.stringify(rec));
 assert.equal(await early.store.restore(),null);
 const pending=holder(BASE+14400001);
 pending.data.set(GUEST_DRAFT_KEY,JSON.stringify({...rec,step:'payment_pending',paymentIntentId:'pi_testabcdefgh'}));
 const result=await pending.store.restore();
 assert.equal(result.sessionExpired,true);
 assert.equal(result.needsServerRecovery,true);
});
test('malformed token and mutation ID are rejected',async()=>{
 const {store}=holder();
 await assert.rejects(store.save({...rec,token:'bearer_unsafe'}),/invalid/);
 await assert.rejects(store.save({...rec,mutationId:'guest:another'}),/invalid/);
 await assert.rejects(store.save({...rec,expiresAt:'garbage'}),/invalid/);
});
