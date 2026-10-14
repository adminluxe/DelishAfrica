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

/** Separate QA-only two-stage Client API contract; NOT imported by app UI. */
const sequenceSource=fs.readFileSync(
  path.resolve(__dirname,'../utils/daCanonicalCheckout.qa.ts'),'utf8');
const sequenceCompiled=ts.transpileModule(sequenceSource,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
  reportDiagnostics:true,
});
assert.equal((sequenceCompiled.diagnostics||[])
  .filter(d=>d.category===ts.DiagnosticCategory.Error).length,0);
const sequenceModule={exports:{}};
(new Function('exports','module','require',sequenceCompiled.outputText))(
  sequenceModule.exports,sequenceModule,(name)=>{
    if(name==='./daCheckoutAttemptFence')return m.exports;
    throw Error('QA_CANONICAL_UNEXPECTED_REQUIRE_'+name);
  });
const {DaQaCanonicalCheckoutSequence}=sequenceModule.exports;
const SERVER_ORDER='7b48962f-83b8-4b35-a223-9234d1e652ce';
const SERVER_PI='pi_QACANONICALINTENT00001';
const QA_INPUT={
  ownerScope:'qa-verified-client-owner-001',
  cartFingerprint:'qa-v2-basket|restaurant|rice:1|juice:2',
  reservationDraftId:'reserve:STARTMUTATION001',
  clientMutationId:'qa-native-checkout-mutation-001',
  partnerSlug:'qa-restaurant',
  items:[{id:'rice',quantity:1},{id:'juice',quantity:2}],
};
const SHA_Q='a'.repeat(64),SHA_CART='b'.repeat(64);
const serverOrderResponse={
  ok:true,mode:'test',state:'pending_payment',
  orderId:SERVER_ORDER,clientMutationId:QA_INPUT.clientMutationId,
  merchantSlug:'qa-restaurant',amount:2690,currency:'eur',
  canonicalQuoteFingerprint:SHA_Q,canonicalCartFingerprint:SHA_CART,
};
const serverIntentResponse={
  ok:true,provider:'stripe',mode:'test',status:'requires_payment_method',
  orderId:SERVER_ORDER,paymentIntentId:SERVER_PI,
  clientSecret:SERVER_PI+'_secret_QASYNTHETIC_ONLY',
  publishableKey:'pk_test_SYNTHETIC_NOT_REAL_20261012',
  amount:2690,currency:'eur',
  canonicalQuoteFingerprint:SHA_Q,canonicalCartFingerprint:SHA_CART,
};

async function withQaEnv(fn){
  const beforeFlag=process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA;
  const beforeNodeEnv=process.env.NODE_ENV;
  process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA='YES';
  process.env.NODE_ENV='test';
  try{return await fn();}
  finally{
    if(beforeFlag===undefined)delete process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA;
    else process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA=beforeFlag;
    if(beforeNodeEnv===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=beforeNodeEnv;
  }
}
test('QA reserve placeholder can bind one PostgreSQL UUID only before Stripe intent',async()=>{
  const state=inMemory(),f=fence(state);
  await f.begin({...sample,orderId:QA_INPUT.reservationDraftId});
  const linked=await f.bindServerOrderId(QA_INPUT.reservationDraftId,SERVER_ORDER);
  assert.equal(linked.orderId,SERVER_ORDER);
  assert.equal(linked.clientMutationId,sample.clientMutationId);
  assert.equal((await f.bindServerOrderId(SERVER_ORDER,SERVER_ORDER)).orderId,SERVER_ORDER);
  await assert.rejects(()=>f.bindServerOrderId(SERVER_ORDER,
    '7b48962f-83b8-4b35-a223-9234d1e652ff'),
    /DA_CHECKOUT_FENCE_SERVER_ORDER_BIND_FORBIDDEN/);
  await f.markIntent(SERVER_ORDER,SERVER_PI);
  await assert.rejects(()=>f.bindServerOrderId(SERVER_ORDER,SERVER_ORDER),
    /DA_CHECKOUT_FENCE_SERVER_ORDER_BIND_FORBIDDEN/);
  assert.equal((await f.inspect()).phase,'intent_created');
  console.log('QA_CLIENT_SERVER_ORDER_BIND=IMMUTABLE_UUID_PRE_STRIPE_ONLY');
});
test('QA two-stage Client requests only SKU/quantity and reuses DB-provided UUID/hash',async()=>{
  await withQaEnv(async()=>{
    const state=inMemory(),calls=[];
    const transport={
      async post(route,payload,headers){
        calls.push({route,payload,headers,snapshot:JSON.parse(state.raw()||'null')});
        if(route.endsWith('/orders/create'))return {status:201,data:serverOrderResponse};
        if(route.endsWith('/payments/create-intent'))
          return {status:200,data:serverIntentResponse};
        throw Error('QA_UNEXPECTED_ROUTE');
      },
    };
    const result=await new DaQaCanonicalCheckoutSequence(
      transport,fence(state)).reserveAndPrepare(QA_INPUT);
    assert.equal(calls.length,2);
    assert.equal(calls[0].snapshot.phase,'reserved');
    assert.equal(calls[0].snapshot.orderId,QA_INPUT.reservationDraftId);
    assert.equal(calls[1].snapshot.orderId,SERVER_ORDER);
    assert.equal(calls[1].snapshot.phase,'reserved');
    assert.equal(calls[0].payload.orderId,undefined);
    assert.equal(calls[0].payload.amount,undefined);
    assert.equal(calls[0].payload.paid,undefined);
    assert.equal(calls[0].payload.currency,undefined);
    assert.deepEqual(calls[0].payload.items,QA_INPUT.items);
    assert.equal(calls[1].payload.orderId,SERVER_ORDER);
    assert.equal(calls[1].payload.canonicalQuoteFingerprint,SHA_Q);
    assert.equal(calls[1].payload.canonicalCartFingerprint,SHA_CART);
    assert.equal(calls[1].payload.amount,undefined);
    assert.equal(calls[0].headers['Idempotency-Key'],QA_INPUT.clientMutationId);
    assert.equal(calls[1].headers['Idempotency-Key'],QA_INPUT.clientMutationId);
    assert.equal(result.orderId,SERVER_ORDER);
    assert.equal(result.amount,2690);
    assert.equal(result.clientSecret,SERVER_PI+'_secret_QASYNTHETIC_ONLY');
    const stored=await fence(state).inspect();
    assert.equal(stored.orderId,SERVER_ORDER);
    assert.equal(stored.phase,'intent_created');
    assert.equal(stored.paymentIntentId,SERVER_PI);
    assert.ok(!state.raw().includes('clientSecret'));
    await assert.rejects(()=>new DaQaCanonicalCheckoutSequence(
      transport,fence(state)).reserveAndPrepare(QA_INPUT),
      /DA_CHECKOUT_ATTEMPT_AMBIGUOUS_RECONCILIATION_REQUIRED/);
    assert.equal(calls.length,2,'ambiguous previous PI may never contact backend again');
    console.log('QA_CLIENT_TWO_STAGE_UUID_AND_MUTATION_PERSISTENCE=PASS');
  });
});
test('QA Client interruption after order reservation cannot mint a new mutation',async()=>{
  await withQaEnv(async()=>{
    const state=inMemory(),headers=[],seenRoutes=[];
    let failIntent=true;
    const transport={async post(route,payload,header){
      headers.push(header['Idempotency-Key']);
      seenRoutes.push(route);
      if(route.endsWith('/orders/create'))return {status:201,data:serverOrderResponse};
      if(failIntent){failIntent=false;throw Error('QA_NETWORK_UNCERTAIN');}
      return {status:200,data:serverIntentResponse};
    }};
    await assert.rejects(()=>new DaQaCanonicalCheckoutSequence(
      transport,fence(state)).reserveAndPrepare(QA_INPUT),/QA_NETWORK_UNCERTAIN/);
    const crashed=await fence(state).inspect();
    assert.equal(crashed.orderId,SERVER_ORDER);
    assert.equal(crashed.phase,'reserved');
    const proposed={...QA_INPUT,
      reservationDraftId:'reserve:OTHERDRAFTMUTATION',
      clientMutationId:'OTHERNEW_MUTATION_002',
    };
    const result=await new DaQaCanonicalCheckoutSequence(
      transport,fence(state)).reserveAndPrepare(proposed);
    assert.equal(result.orderId,SERVER_ORDER);
    assert.equal(headers.length,4);
    assert.deepEqual([...new Set(headers)],[QA_INPUT.clientMutationId]);
    assert.equal(seenRoutes.filter(x=>x.endsWith('/orders/create')).length,2);
    assert.equal((await fence(state).inspect()).phase,'intent_created');
    console.log('QA_CLIENT_CRASH_AFTER_POST_INTENT=RETRY_SAME_MUTATION_ONLY');
  });
});
test('QA wrong server order or payment amount fails before PaymentSheet',async()=>{
  await withQaEnv(async()=>{
    const state=inMemory();
    let calls=0;
    const transport={async post(route){
      calls++;
      if(route.endsWith('/orders/create'))return {status:201,data:serverOrderResponse};
      return {status:200,data:{...serverIntentResponse,amount:999}};
    }};
    await assert.rejects(()=>new DaQaCanonicalCheckoutSequence(
      transport,fence(state)).reserveAndPrepare(QA_INPUT),
      /DA_QA_CANONICAL_INTENT_RESPONSE_INVALID_NO_PAYMENT/);
    assert.equal(calls,2);
    assert.equal((await fence(state).inspect()).phase,'reserved');
    assert.equal((await fence(state).inspect()).orderId,SERVER_ORDER);
    const stateWrong=inMemory();
    let orderCalls=0;
    const wrong={async post(){
      orderCalls++;return {status:201,data:{...serverOrderResponse,merchantSlug:'another-merchant'}};
    }};
    await assert.rejects(()=>new DaQaCanonicalCheckoutSequence(
      wrong,fence(stateWrong)).reserveAndPrepare(QA_INPUT),
      /DA_QA_CANONICAL_ORDER_RESPONSE_INVALID_NO_PAYMENT/);
    assert.equal(orderCalls,1);
    assert.equal((await fence(stateWrong).inspect()).orderId,QA_INPUT.reservationDraftId);
    console.log('QA_CLIENT_PROVIDER_BINDING_MISMATCH=FAIL_CLOSED');
  });
});
test('QA disabled production or secure storage outage never reaches backend',async()=>{
  const saved=process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA;
  const savedMode=process.env.NODE_ENV;
  let networkCalls=0;
  const transport={async post(){networkCalls++;throw Error('UNREACHABLE');}};
  try{
    process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA='';
    process.env.NODE_ENV='test';
    await assert.rejects(()=>new DaQaCanonicalCheckoutSequence(
      transport,fence(inMemory())).reserveAndPrepare(QA_INPUT),
      /DA_QA_CANONICAL_CHECKOUT_DISABLED/);
    process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA='YES';
    process.env.NODE_ENV='production';
    await assert.rejects(()=>new DaQaCanonicalCheckoutSequence(
      transport,fence(inMemory())).reserveAndPrepare(QA_INPUT),
      /DA_QA_CANONICAL_CHECKOUT_DISABLED/);
    process.env.NODE_ENV='test';
    const unavailable={
      read:async()=>{throw Error('SECURESTORE_FAILED')},
      write:async()=>{},clear:async()=>{},
    };
    await assert.rejects(()=>new DaQaCanonicalCheckoutSequence(
      transport,new DaCheckoutAttemptFence(unavailable)).reserveAndPrepare(QA_INPUT),
      /DA_CHECKOUT_FENCE_UNAVAILABLE_NO_NEW_PAYMENT/);
    assert.equal(networkCalls,0);
    console.log('QA_CLIENT_DISABLED_AND_SECURESTORE_FAILURE=ZERO_BACKEND_TRAFFIC');
  }finally{
    if(saved===undefined)delete process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA;
    else process.env.EXPO_PUBLIC_DA_CANONICAL_CHECKOUT_QA=saved;
    if(savedMode===undefined)delete process.env.NODE_ENV;
    else process.env.NODE_ENV=savedMode;
  }
});
test('QA finance status never unlocks an ambiguous payment under hold, mismatch or HTTP outage',async()=>{
  await withQaEnv(async()=>{
    const state=inMemory(),f=fence(state);
    await f.begin({...sample,orderId:SERVER_ORDER,
      clientMutationId:QA_INPUT.clientMutationId});
    await f.markIntent(SERVER_ORDER,SERVER_PI);
    await f.markSheetOpened(SERVER_ORDER);
    let status='financial_hold',intent=SERVER_PI,up=true;
    const transport={async post(route,body,headers){
      assert.equal(route,'/qa-isolated/client-commerce/orders/status');
      assert.equal(body.orderId,SERVER_ORDER);
      assert.equal(body.clientMutationId,QA_INPUT.clientMutationId);
      assert.equal(headers['Idempotency-Key'],QA_INPUT.clientMutationId);
      if(!up)return {status:503,data:{ok:false}};
      return {status:200,data:{
        ok:true,mode:'test',orderId:SERVER_ORDER,
        clientMutationId:QA_INPUT.clientMutationId,
        financialStatus:status,dispatchEligible:status==='paid',
        paymentIntentId:intent,amount:2690,currency:'eur',
        canonicalQuoteFingerprint:SHA_Q,
        canonicalCartFingerprint:SHA_CART,
      }};
    }};
    const sequence=new DaQaCanonicalCheckoutSequence(transport,f);
    let result=await sequence.reconcileVerifiedPayment();
    assert.deepEqual(result,{financialStatus:'financial_hold',cleared:false});
    assert.ok(state.raw());
    status='awaiting_payment';
    result=await sequence.reconcileVerifiedPayment();
    assert.deepEqual(result,{financialStatus:'awaiting_payment',cleared:false});
    assert.ok(state.raw());
    status='paid';intent='pi_QANOTTHEORIGINAL00001';
    await assert.rejects(()=>sequence.reconcileVerifiedPayment(),
      /DA_QA_CANONICAL_FINANCE_PI_MISMATCH/);
    assert.ok(state.raw());
    intent=SERVER_PI;up=false;
    await assert.rejects(()=>sequence.reconcileVerifiedPayment(),
      /DA_QA_CANONICAL_FINANCE_HTTP_UNAVAILABLE/);
    assert.ok(state.raw());
    console.log('QA_CLIENT_FINANCIAL_HOLD_FOREIGN_PI_AND_OUTAGE=LOCK_PRESERVED');
  });
});
test('QA only finance paid read for same order PI unlocks SecureStore after PaymentSheet',async()=>{
  await withQaEnv(async()=>{
    const state=inMemory(),f=fence(state);
    await f.begin({...sample,orderId:SERVER_ORDER,
      clientMutationId:QA_INPUT.clientMutationId});
    await f.markIntent(SERVER_ORDER,SERVER_PI);
    await f.markSheetOpened(SERVER_ORDER);
    let calls=0;
    const transport={async post(route,body){
      calls++;
      assert.equal(route,'/qa-isolated/client-commerce/orders/status');
      assert.equal(body.orderId,SERVER_ORDER);
      return {status:200,data:{
        ok:true,mode:'test',orderId:SERVER_ORDER,
        clientMutationId:QA_INPUT.clientMutationId,
        financialStatus:'paid',dispatchEligible:true,
        paymentIntentId:SERVER_PI,amount:2690,currency:'eur',
        canonicalQuoteFingerprint:SHA_Q,canonicalCartFingerprint:SHA_CART,
      }};
    }};
    const sequence=new DaQaCanonicalCheckoutSequence(transport,f);
    const result=await sequence.reconcileVerifiedPayment();
    assert.deepEqual(result,{financialStatus:'paid',cleared:true});
    assert.equal(state.raw(),null);
    assert.equal(calls,1);
    console.log('QA_CLIENT_FINANCE_AUTHORITATIVE_PAID_READ=ONLY_UNLOCK_PATH');
  });
});
test('QA financial receipt cannot unlock before bank sheet opens',async()=>{
  await withQaEnv(async()=>{
    const state=inMemory(),f=fence(state);
    await f.begin({...sample,orderId:SERVER_ORDER,
      clientMutationId:QA_INPUT.clientMutationId});
    await f.markIntent(SERVER_ORDER,SERVER_PI);
    let calls=0;
    const transport={async post(){calls++;throw Error('NETWORK_NEVER_EXPECTED')}};
    const result=await new DaQaCanonicalCheckoutSequence(
      transport,f).reconcileVerifiedPayment();
    assert.deepEqual(result,{financialStatus:'not_ready',cleared:false});
    assert.equal(calls,0);
    assert.equal((await f.inspect()).phase,'intent_created');
    console.log('QA_CLIENT_PRE_SHEET_FINANCE_READ=NO_UNLOCK');
  });
});
