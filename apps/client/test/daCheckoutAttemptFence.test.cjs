'use strict';
/**
 * Local-only crash/replay tests for Client checkout attempt fence.
 * No EAS, Expo, real Stripe, secrets or network.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require(require.resolve('typescript',{paths:[path.resolve(__dirname,'..')]}));
const source=fs.readFileSync(path.resolve(__dirname,'../utils/daCheckoutAttemptFence.ts'),'utf8');
const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  reportDiagnostics:true,
});
assert.equal((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const m={exports:{}};
(new Function('exports','module',compiled.outputText))(m.exports,m);
const {DaCheckoutAttemptFence}=m.exports;
const sample={
  ownerScope:'qa-owner-hmac-scope-001',
  cartFingerprint:'qa-partner|2690|rice:1:1500|juice:2:400',
  orderId:'DA-LOCAL-QA-001',
  clientMutationId:'client-qa-mutation-order001',
};
function inMemory(initial=null){
  let stored=initial,writes=0,clears=0;
  return {
    storage:{
      async read(){return stored},
      async write(v){stored=v;writes++},
      async clear(){stored=null;clears++},
    },
    raw:()=>stored,writes:()=>writes,clears:()=>clears,
    setRaw:s=>{stored=s;},
  };
}
function fence(store){
  return new DaCheckoutAttemptFence(store.storage,()=>new Date('2026-10-12T19:00:00Z').toISOString());
}
test('reservation is written BEFORE provider call and retries keep original mutation',async()=>{
  const state=inMemory();
  const first=await fence(state).begin(sample);
  assert.equal(first.phase,'reserved');
  assert.equal(state.writes(),1);
  assert.equal(first.paymentIntentId,null);
  const retry=await fence(state).begin({...sample,
    orderId:'DA-LOCAL-QA-OTHER',
    clientMutationId:'client-qa-other-mutation',
  });
  assert.deepEqual(retry,first);
  assert.equal(state.writes(),1);
  assert.ok(!state.raw().includes('sk_test_'));
  assert.ok(!state.raw().includes('client_secret'));
  console.log('QA_CHECKOUT_ATTEMPT_PRE_POST_PERSISTENCE=SAME_IDEMPOTENCY_KEY');
});
test('crash after provider intent cannot mint another payment mutation',async()=>{
  const state=inMemory();
  const f=fence(state);
  await f.begin(sample);
  await f.markIntent(sample.orderId,'pi_QACHECKOUTINTENT00001');
  const afterRestart=fence(state);
  await assert.rejects(()=>afterRestart.begin({...sample,
    orderId:'DA-LOCAL-QA-OTHER',clientMutationId:'NEW-MUTATION-KEY-ERROR'}),
    /DA_CHECKOUT_ATTEMPT_AMBIGUOUS_RECONCILIATION_REQUIRED/);
  await assert.rejects(()=>afterRestart.begin({...sample,
    cartFingerprint:'another-restaurant|test-cart'}),
    /DA_CHECKOUT_PREVIOUS_ATTEMPT_DIFFERENT_CART_NO_NEW_PAYMENT/);
  await assert.rejects(()=>afterRestart.markIntent(sample.orderId,'pi_FAKEFOREIGN0001234'),
    /DA_CHECKOUT_FENCE_INTENT_REBIND_FORBIDDEN/);
  await assert.rejects(()=>afterRestart.clearAfterVerifiedOrder(sample.orderId,'pi_QACHECKOUTINTENT00001'),
    /DA_CHECKOUT_FENCE_NOT_PROVEN_PAID/);
  assert.equal(state.clears(),0);
  console.log('QA_CHECKOUT_ATTEMPT_CRASH_AFTER_INTENT=NO_SECOND_PAYMENT');
});
test('crash during bank sheet holds payment until same order is proven paid',async()=>{
  const state=inMemory(); const f=fence(state);
  await f.begin(sample);
  await f.markIntent(sample.orderId,'pi_QACHECKOUTINTENT00001');
  await f.markSheetOpened(sample.orderId);
  assert.equal((await f.inspect()).phase,'sheet_open');
  await assert.rejects(()=>fence(state).begin({...sample,orderId:'DA-NEW-ORDER-007'}),
    /DA_CHECKOUT_ATTEMPT_AMBIGUOUS_RECONCILIATION_REQUIRED/);
  await f.markPaymentReported(sample.orderId);
  assert.equal((await fence(state).inspect()).phase,'reported_success');
  await assert.rejects(()=>f.clearAfterVerifiedOrder(sample.orderId,'pi_FOREIGN'),
    /DA_CHECKOUT_FENCE_NOT_PROVEN_PAID/);
  await f.clearAfterVerifiedOrder(sample.orderId,'pi_QACHECKOUTINTENT00001');
  assert.equal(state.raw(),null);
  assert.equal(state.clears(),1);
  const next=await fence(state).begin({...sample,
    orderId:'DA-LEGIT-SECOND-ORDER',
    clientMutationId:'client-qa-next-mutation-001',
  });
  assert.equal(next.orderId,'DA-LEGIT-SECOND-ORDER');
  console.log('QA_CHECKOUT_ATTEMPT_SERVER_VERIFIED_RECEIPT=UNLOCKS_NEXT_ORDER');
});
test('ambiguous storage, corruption or write failure fail closed without Stripe',async()=>{
  const state=inMemory('not json');
  await assert.rejects(()=>fence(state).begin(sample),
    /DA_CHECKOUT_FENCE_INVALID_NO_NEW_PAYMENT/);
  state.setRaw(JSON.stringify({version:1,ownerScope:'bad'}));
  await assert.rejects(()=>fence(state).begin(sample),
    /DA_CHECKOUT_FENCE_INVALID_NO_NEW_PAYMENT/);
  const brokenRead={
    read:async()=>{throw Error('NO_DB')},write:async()=>{},clear:async()=>{},
  };
  await assert.rejects(()=>new DaCheckoutAttemptFence(brokenRead).begin(sample),
    /DA_CHECKOUT_FENCE_UNAVAILABLE_NO_NEW_PAYMENT/);
  const badWrite={
    read:async()=>null,write:async()=>{throw Error('NO_SECURE_STORE')},clear:async()=>{},
  };
  await assert.rejects(()=>new DaCheckoutAttemptFence(badWrite).begin(sample),
    /DA_CHECKOUT_FENCE_WRITE_FAILED_NO_NEW_PAYMENT/);
  console.log('QA_CHECKOUT_ATTEMPT_STORAGE_FAULT=NO_NEW_PAYMENT');
});
test('a verified paid order can recover a crash before sheet callback',async()=>{
  const state=inMemory(); const before=fence(state);
  await before.begin(sample);
  await before.markIntent(sample.orderId,'pi_QACHECKOUTINTENT00001');
  await before.markSheetOpened(sample.orderId);
  const afterRestart=fence(state);
  await assert.rejects(()=>afterRestart.begin(sample),
    /DA_CHECKOUT_ATTEMPT_AMBIGUOUS_RECONCILIATION_REQUIRED/);
  // Caller must have independently re-read the paid order/PI from API.
  await afterRestart.clearAfterVerifiedOrder(sample.orderId,'pi_QACHECKOUTINTENT00001');
  assert.equal(state.raw(),null);
  console.log('QA_CHECKOUT_ATTEMPT_POST_SHEET_CALLBACK_CRASH=UNLOCK_ONLY_AFTER_SERVER_PROOF');
});
test('QA checkout UI persists mutation before provider and locks PaymentSheet before presentation',()=>{
  const ui=fs.readFileSync(path.resolve(__dirname,'../app/checkout-preflight.tsx'),'utf8');
  const position=(token)=>ui.indexOf(token);
  assert.ok(ui.includes('EXPO_PUBLIC_DA_CHECKOUT_FENCE_QA === "YES"'));
  assert.ok(ui.includes('process.env.NODE_ENV !== "production"'));
  assert.ok(position('await checkoutAttemptFence().begin(')>=0);
  assert.ok(position('await checkoutAttemptFence().begin(')<position('const intent = await createPaymentIntent('));
  assert.ok(position('await checkoutAttemptFence().markIntent(')>position('const intent = await createPaymentIntent('));
  assert.ok(position('await checkoutAttemptFence().markSheetOpened(')<position('stripe.module.presentPaymentSheet?.()'));
  assert.ok(position('await checkoutAttemptFence().markPaymentReported(')>position('stripe.module.presentPaymentSheet?.()'));
  assert.ok(ui.includes('await fence.clearAfterVerifiedOrder(orderId, verifiedPaymentIntentId)'));
  assert.ok(ui.includes('Aucun second débit ne sera lancé'));
  console.log('QA_CHECKOUT_CLIENT_UI_PRE_PROVIDER_FENCE=STATIC_FAIL_CLOSED');
});

test('user cancelling or app restarting cannot clear a sheet-open lock',async()=>{
  const state=inMemory(); const f=fence(state);
  await f.begin(sample); await f.markIntent(sample.orderId,'pi_QACHECKOUTINTENT00001');
  await f.markSheetOpened(sample.orderId);
  await assert.rejects(()=>f.begin(sample),
    /DA_CHECKOUT_ATTEMPT_AMBIGUOUS_RECONCILIATION_REQUIRED/);
  await assert.rejects(()=>f.markIntent(sample.orderId,'pi_QACHECKOUTINTENT00001'),
    /DA_CHECKOUT_FENCE_INTENT_REBIND_FORBIDDEN/);
  assert.equal((await fence(state).inspect()).phase,'sheet_open');
  console.log('QA_CHECKOUT_ATTEMPT_PAYMENT_SHEET_CANCEL=MANUAL_RECONCILIATION_FIRST');
});
