'use strict';
// P0 isolated QA: no payment, HTTP remote, real secrets or stores.
// Exercise actual PaymentsService.createPaymentIntent and controller.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.QA_SYNTHETIC_ONLY !== 'YES') {
  console.error('QA_FAIL=synthetic_github_runner_only');
  process.exit(2);
}
require('reflect-metadata');
require('ts-node/register/transpile-only');
// The P0 checkout guard is exercised through the real PaymentsService, but
// its CatalogOrderPolicyService DI metadata must not bootstrap PostgreSQL.
// Return a synthetic injectable class ONLY for that one metadata import.
const Module = require('node:module');
const originalLoader = Module._load;
let PaymentsService, PaymentsController;
class SyntheticCatalogPolicyQaOnly {}
try {
  Module._load = function (name, parent, isMain) {
    if (name === '../order-policy/catalog-order-policy.service' &&
        parent?.filename?.endsWith('/payments/payments.service.ts')) {
      return { CatalogOrderPolicyService: SyntheticCatalogPolicyQaOnly };
    }
    return originalLoader.call(this, name, parent, isMain);
  };
  ({ PaymentsService } = require('../src/payments/payments.service.ts'));
  ({ PaymentsController } = require('../src/payments/payments.controller.ts'));
} finally {
  Module._load = originalLoader;
}
const { ServiceUnavailableException } = require('@nestjs/common');

const ROOT = path.resolve(__dirname, '..');
const SERVICE_SOURCE = fs.readFileSync(path.join(ROOT,'src/payments/payments.service.ts'),'utf8');
const CLIENT_SOURCE = fs.readFileSync(
  path.resolve(ROOT,'../../apps/client/app/checkout-preflight.tsx'),'utf8');
const ERROR_CODE = 'checkout_durable_order_authority_not_certified';

test('actual candidate guard occurs before quote and Stripe network request', () => {
  const start = SERVICE_SOURCE.indexOf('  async createPaymentIntent(');
  const end = SERVICE_SOURCE.indexOf('  async verifyPaidOrder(', start);
  assert.ok(start > 0 && end > start);
  const method = SERVICE_SOURCE.slice(start,end);
  const call = method.indexOf('this.assertDurableCheckoutAuthority();');
  const quote = method.indexOf('this.orderPolicy.quote(');
  const network = method.indexOf("fetch('https://" + "api.stripe.com/v1/payment_intents'");
  assert.ok(call >= 0 && quote > call && network > quote);
  assert.match(
    PaymentsService.prototype.assertDurableCheckoutAuthority.toString(),
    /ServiceUnavailableException/
  );
  assert.match(SERVICE_SOURCE,/checkoutIntentCreationEnabled: false/);
  assert.match(SERVICE_SOURCE,/status: 'checkout_blocked'/);
});

test('Client maps the exact HTTP 503 code to no-charge UX without clearing cart', () => {
  assert.match(CLIENT_SOURCE,new RegExp('code === "'+ERROR_CODE+'"'));
  assert.match(CLIENT_SOURCE,/Aucun débit n’a été initié/);
  assert.match(CLIENT_SOURCE,/Votre panier est conservé/);
  const codeStart=CLIENT_SOURCE.indexOf('function checkoutApiError(');
  const payStart=CLIENT_SOURCE.indexOf('async function createPaymentIntent(',codeStart);
  assert.ok(codeStart>0 && payStart>codeStart);
  const fn=CLIENT_SOURCE.slice(codeStart,payStart);
  assert.ok(fn.indexOf(ERROR_CODE)<fn.indexOf('if (code === "payment_not_succeeded")'));
});

for (const config of [
  {name:'no Stripe key (mock also forbidden)',stripeKey:''},
  {name:'synthetic TEST key',stripeKey:'sk_test_ONLY_FAKE_QA_NOT_VALID'},
  {name:'synthetic LIVE key',stripeKey:'sk_live_ONLY_FAKE_QA_NOT_VALID'},
]) {
  test('HTTP 503 fail closed under '+config.name+', no quote/fetch/write',async () => {
    const previous={...process.env};
    const originalFetch=global.fetch;
    let quoteCalled=0, fetchCalled=0;
    process.env.STRIPE_SECRET_KEY=config.stripeKey;
    process.env.DA_CHECKOUT_DURABLE_RESERVATION_CERTIFIED='YES';
    process.env.EXPO_PUBLIC_DA_FINANCE_QA_ONLY='YES';
    global.fetch=async()=>{fetchCalled++;throw Error('NO_NETWORK_ALLOWED');};
    try{
      const quoteService={
        quote:async()=>{quoteCalled++;throw Error('QUOTE_MUST_NOT_RUN');},
      };
      const paymentService=new PaymentsService(quoteService);
      const input={
        orderId:'QA_ORDER_NEVER_CHARGED',
        clientMutationId:'qa-no-payment-synthetic',
        items:[{id:'qa',quantity:1}],
      };
      const principal={issuer:'https://identity.qa.invalid',subject:'qa-customer',role:'client',clientId:'qa-customer'};
      await assert.rejects(
        ()=>paymentService.createPaymentIntent(input,'qa-idempotency',principal),
        e=>{
          assert.ok(e instanceof ServiceUnavailableException);
          assert.equal(e.getStatus(),503);
          const body=e.getResponse();
          assert.equal(body.ok,false);
          assert.equal(body.code,ERROR_CODE);
          assert.equal(body.paymentInitiated,false);
          assert.equal(body.retryable,false);
          return true;
        },
      );
      const controller=new PaymentsController(paymentService);
      await assert.rejects(
        ()=>controller.createIntent({daPaymentsPrincipal:principal},input,'qa-idempotency'),
        e=>e.getStatus()===503&&e.getResponse().code===ERROR_CODE,
      );
      assert.equal(quoteCalled,0);
      assert.equal(fetchCalled,0);
      assert.deepEqual(input.items,[{id:'qa',quantity:1}]);
      assert.equal(paymentService.health().checkoutIntentCreationEnabled,false);
      const provider=paymentService.providers().providers[0];
      assert.equal(provider.userVisible,false);
      assert.equal(provider.status,'checkout_blocked');
      console.log('QA_PASS=NO_PAYMENT_'+(config.stripeKey.includes('live')?'LIVE':config.stripeKey.includes('test')?'TEST':'NO_KEY'));
    }finally{
      global.fetch=originalFetch;
      for(const key of Object.keys(process.env))if(!(key in previous))delete process.env[key];
      Object.assign(process.env,previous);
    }
  });
}
test('legacy API reconciliation remains declared; synthetic controllers not promoted',()=>{
  assert.match(SERVICE_SOURCE,/async verifyPaidOrder\(/);
  assert.match(SERVICE_SOURCE,/handleStripeWebhook\(/);
  const module=fs.readFileSync(path.join(ROOT,'src/app.module.ts'),'utf8');
  assert.ok(!module.includes('NativeClientCheckoutQaController'));
  assert.ok(!module.includes('PartnerFinanceReadonlyQaController'));
  console.log('QA_PASS=LEGACY_RECONCILIATION_NOT_REMOVED');
});


const os = require('node:os');
function syntheticStore(run) {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'da-orders-durable-p0-'));
  const file=path.join(folder,'orders-qa.json');
  const previous=process.env.DA_DEMO_ORDERS_STORE_FILE;
  const modulePath=require.resolve('../src/orders/orders.demo.store.ts');
  process.env.DA_DEMO_ORDERS_STORE_FILE=file;
  delete require.cache[modulePath];
  try {
    const store=require(modulePath);
    return run({store,file,folder});
  } finally {
    delete require.cache[modulePath];
    if(previous===undefined) delete process.env.DA_DEMO_ORDERS_STORE_FILE;
    else process.env.DA_DEMO_ORDERS_STORE_FILE=previous;
    fs.rmSync(folder,{recursive:true,force:true});
  }
}

test('VPS-matching order store JSON persists and rereads synthetic order',()=>{
  syntheticStore(({store,file,folder})=>{
    assert.equal(fs.existsSync(file),false);
    const created=store.createDemoOrder({
      id:'QA_ORDER_PERSISTED',
      partnerSlug:'qa-partner',
      items:[{id:'qa-item',name:'Synthetic QA only',quantity:1,price:1}],
      total:1,
    });
    assert.equal(created.id,'QA_ORDER_PERSISTED');
    assert.equal(fs.existsSync(file),true);
    const stat=fs.statSync(file);
    assert.equal(stat.mode&0o777,0o600);
    assert.equal(store.getDemoOrder('QA_ORDER_PERSISTED').id,created.id);
    const onDisk=JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(onDisk.orders.length,1);
    assert.equal(onDisk.orders[0].id,created.id);
    assert.equal(fs.readdirSync(folder).filter(name=>name.endsWith('.tmp')).length,0);
    console.log('QA_PASS=ORDER_JSON_WRITE_READBACK');
  });
});

test('corrupted on-disk order store is NEVER misread as empty',()=>{
  syntheticStore(({store,file})=>{
    fs.writeFileSync(file,'{not_json',{mode:0o600});
    assert.throws(()=>store.listDemoOrders(),/orders_persistence_unavailable:/);
    assert.throws(()=>store.createDemoOrder({id:'QA_SHOULD_FAIL'}),/orders_persistence_unavailable:/);
    console.log('QA_PASS=CORRUPTED_ORDER_STORE_FAILS_CLOSED');
  });
});

test('disk write failure raises and never returns success or phantom order',()=>{
  syntheticStore(({store,file})=>{
    const realWrite=fs.writeFileSync;
    let deniedWrites=0;
    fs.writeFileSync=function(target,...args){
      const dest=String(target);
      if(dest.startsWith(file+'.')&&dest.endsWith('.tmp')){
        deniedWrites++;
        const err=new Error('qa_simulated_disk_full');
        err.code='ENOSPC';
        throw err;
      }
      return realWrite.call(this,target,...args);
    };
    try {
      assert.throws(
        ()=>store.createDemoOrder({id:'QA_MUST_NOT_CONFIRM',items:[{id:'qa',name:'Only QA',quantity:1,price:1}]}),
        /qa_simulated_disk_full/
      );
    } finally {
      fs.writeFileSync=realWrite;
    }
    assert.equal(deniedWrites,1);
    assert.equal(fs.existsSync(file),false);
    assert.equal(store.listDemoOrders().length,0);
    console.log('QA_PASS=ENOSPC_ORDER_WRITE_FAILS_CLOSED');
  });
});
