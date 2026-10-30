'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {
  ServerOnlyOrchidBridgeRead,OrchidBridgeScopedShadowSource,
}=require('../dist/atm-readonly/orchid-bridge-source.qa.js');
const {AtmReadonlyCore}=require('../dist/atm-readonly/atm-readonly.core.js');

const scope={issuer:'https://keycloak.afritaste.delishafrica.me/realms/afritaste',
  subject:'qa-subject',slug:'qa-merchant',merchantId:'qa-partner',role:'finance'};
const order={orderId:'qa-order',merchantSlug:'qa-merchant',
  paymentIntentId:'qa-payment'};
const upstream={ok:true,orderId:'qa-order',paymentIntentId:'qa-payment',
  recordId:'qa-reconciliation-1',state:'confirmed'};
const enable=()=>{process.env.NODE_ENV='test';
  process.env.DA_ATM_ORCHID_BRIDGE_QA_ENABLED='YES';};
const refs=(list=[order])=>({listRecentMerchantPaymentReferences:async (slug,limit)=>{
  assert.equal(slug,scope.slug);assert.equal(limit,10);
  return list;
}});
const bridge=(payload=upstream)=>({readReconciliation:async id=>{
  assert.equal(id,order.orderId);return payload;
}});
const valid=()=>new OrchidBridgeScopedShadowSource(refs(),bridge());
test('synthetic OrchidPay integration creates only nonattested SHADOW events',async()=>{
  enable();const result=await valid().readFinance(scope);
  assert.equal(result.mode,'SHADOW');assert.equal(result.readOnly,true);
  assert.equal(result.events.length,1);
  const e=result.events[0];
  assert.equal(e.verified,false);
  assert.equal(e.mode,'SHADOW');
  assert.equal(e.kind,'LEDGER_SHADOW');
  assert.equal(e.amountMinor,null);assert.equal(e.currency,null);
  assert.equal(e.merchantId,scope.merchantId);
  assert.match(e.sourceSHA,/^[a-f0-9]{64}$/);
  assert.equal(result.balance,undefined);assert.equal(result.payout,undefined);
});
test('empty authoritative order page creates no invented revenue',async()=>{
  enable();const source=new OrchidBridgeScopedShadowSource(refs([]),{
    readReconciliation:async()=>{throw Error('MUST_NOT_CALL_UPSTREAM');},
  });
  const result=await source.readFinance(scope);
  assert.deepEqual(result.events,[]);
});
for(const bad of [
  {...upstream,orderId:'foreign-order'},
  {...upstream,paymentIntentId:'foreign-payment'},
  {...upstream,recordId:null},
  {...upstream,ok:false},
  {...upstream,state:'paid'},
  null,
]){
  test('unknown bridge response fails closed '+JSON.stringify(bad),async()=>{
    enable();
    const source=new OrchidBridgeScopedShadowSource(refs(),bridge(bad));
    await assert.rejects(source.readFinance(scope));
  });
}
for(const list of [
  [{...order,merchantSlug:'foreign'}],
  [{...order,paymentIntentId:''}],
  [order,order],
  Array.from({length:11},(_,i)=>({...order,orderId:'different-'+i})),
]){
  test('untrusted or unbounded DB order refs denied '+list.length,async()=>{
    enable();
    const source=new OrchidBridgeScopedShadowSource(refs(list),bridge());
    await assert.rejects(source.readFinance(scope));
  });
}
test('production never touches the DB or bridge',async()=>{
  process.env.NODE_ENV='production';
  process.env.DA_ATM_ORCHID_BRIDGE_QA_ENABLED='YES';
  let calls=0;
  const s=new OrchidBridgeScopedShadowSource({
    listRecentMerchantPaymentReferences:async()=>{calls++;return [];},
  },{readReconciliation:async()=>{calls++;return upstream;}});
  await assert.rejects(s.readFinance(scope));
  assert.equal(calls,0);
  process.env.NODE_ENV='test';
});
test('server-only transport: missing secret file denies before HTTP',async()=>{
  enable();delete process.env.DA_ATM_ORCHID_BFF_TOKEN_FILE;
  const api=new ServerOnlyOrchidBridgeRead(async()=>{
    throw Error('SHOULD_NEVER_FETCH');
  });
  await assert.rejects(api.readReconciliation(order.orderId));
});
test('server-only transport only calls authorized loopback GET and never leaks token to URL',async()=>{
  enable();process.env.DA_ATM_ORCHID_BFF_TOKEN_FILE='C:\\qa-test\\read-only-token';
  const observed=[];
  const api=new ServerOnlyOrchidBridgeRead(async(url,opts)=>{
    observed.push({url,opts});
    return {status:200,headers:new Headers({'content-type':'application/json'}),
      text:async()=>JSON.stringify(upstream)};
  },()=> 'fake-secret-is-32-characters-or-longer-aa');
  const result=await api.readReconciliation(order.orderId);
  assert.deepEqual(result,upstream);
  assert.equal(observed.length,1);
  const {url,opts}=observed[0];
  assert.equal(url,'http://127.0.0.1:8091/api/pay/orchidpay/reconciliation/order/qa-order');
  assert.equal(opts.method,'GET');assert.equal(opts.redirect,'error');
  assert.equal(opts.cache,'no-store');
  assert.equal(opts.body,undefined);
  assert.equal(opts.headers['X-ATM-Token'],'fake-secret-is-32-characters-or-longer-aa');
  assert.doesNotMatch(url,/fake-secret/);
});
test('transport refuses redirect and non-JSON content',async()=>{
  enable();process.env.DA_ATM_ORCHID_BFF_TOKEN_FILE='C:\\qa-test\\read-only-token';
  const api=new ServerOnlyOrchidBridgeRead(async()=>({
    status:302,headers:new Headers({'content-type':'application/json'}),
    text:async()=>'{}',
  }),()=> 'fake-secret-is-32-characters-or-longer-aa');
  await assert.rejects(api.readReconciliation('qa-order'));
});
test('untrusted bridge order id rejected before reading secret',async()=>{
  enable();process.env.DA_ATM_ORCHID_BFF_TOKEN_FILE='C:\\qa-test\\read-only-token';
  let calls=0;
  const api=new ServerOnlyOrchidBridgeRead(async()=>{calls++;throw Error('SHOULD_NOT_FETCH');},
    ()=>{calls++;return 'fake-secret-is-32-characters-or-longer-aa';});
  await assert.rejects(api.readReconciliation('../other'));
  assert.equal(calls,0);
});
