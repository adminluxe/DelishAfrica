'use strict';
/**
 * DISCONNECTED QA ONLY. Loads the actual TypeScript candidate PG adapter,
 * using a Node binary in the network namespace of a disposable Postgres 17
 * container. Never connects to Stripe, VPS, Keycloak or the public internet.
 */
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {Pool}=require('pg');
const {QaClientCommercePgAdapter}=require('/qa-built/client-commerce.pg-qa.adapter.js');

if (process.env.GITHUB_ACTIONS!=='true' ||
    process.env.QA_SYNTHETIC_ONLY!=='YES' ||
    process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1' ||
    process.env.QA_COMMERCE_DB_NAME!=='postgres' ||
    process.env.QA_COMMERCE_DB_USER!=='postgres' ||
    !/^[a-f0-9]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'')) {
  throw Error('QA_COMMERCE_POSTGRES_DISCONNECTED_FLAGS_REQUIRED');
}

const issuer='https://qa.example.invalid/realms/da-client';
const alice={issuer,subject:'a63f867f-9f42-4573-9268-dc65a164d2c1',
  role:'client',authSource:'external',ownershipEligible:true};
const bob={issuer,subject:'b63f867f-9f42-4573-9268-dc65a164d2c2',
  role:'client',authSource:'external',ownershipEligible:true};
const quote=Object.freeze({
  source:'server-canonical-catalog',
  quoteFingerprint:'a'.repeat(64),
  cartFingerprint:'b'.repeat(64),
  merchantSlug:'qa-merchant',
  totalMinor:1200,
  currency:'EUR',
});
const pool=new Pool({
  host:'127.0.0.1',user:'postgres',database:'postgres',
  port:5432,max:14,connectionTimeoutMillis:10000,
  statement_timeout:12000,query_timeout:12000,
});
const anotherPool=new Pool({
  host:'127.0.0.1',user:'postgres',database:'postgres',
  port:5432,max:5,connectionTimeoutMillis:10000,
  statement_timeout:12000,query_timeout:12000,
});
const primary=new QaClientCommercePgAdapter(
  pool,process.env.QA_COMMERCE_HMAC_KEY);
const another=new QaClientCommercePgAdapter(
  anotherPool,process.env.QA_COMMERCE_HMAC_KEY);
const scalar=async(sql,values=[])=>{
  const row=(await pool.query(sql,values)).rows[0];
  return row?Object.values(row)[0]:null;
};
const mustReject=async(op,re,label)=>{
  await assert.rejects(op,re,label);
};

test('real PgPool + repository: 8 concurrent Nest-compatible reservations and stable payment authority', async()=>{
  try{
    assert.equal(await scalar('SELECT 1 AS ok'),1);
    const orderInput='qa-adapter-mutation-concurrent-001';
    const attempts=Array.from({length:8},(_,i)=>(
      (i%2===0?primary:another).reserveOrder(alice,quote,orderInput)
    ));
    const all=await Promise.all(attempts);
    const ids=new Set(all.map(v=>v.orderId));
    assert.equal(ids.size,1,'cross-pool race must return exactly one UUID');
    const order=all[0];
    assert(all.every(x=>x.issuer===alice.issuer&&
      x.clientSubject===alice.subject&&x.totalMinor===quote.totalMinor&&
      x.state==='pending_payment'));
    assert.equal(Number(await scalar(
      'SELECT count(*) FROM public.da_client_commerce_orders_qa '+
      'WHERE issuer=$1 AND client_subject=$2 AND client_mutation_id=$3',
      [issuer,alice.subject,orderInput])),1);
    console.log('QA_ADAPTER_8_WAY_TWO_POOLS=ONE_ORDER');

    await mustReject(
      ()=>primary.reserveOrder(alice,{...quote,totalMinor:1300},orderInput),
      /qa_idempotency_payload_mismatch/,
      'same identity+mutation with a modified price must fail');
    await mustReject(
      ()=>primary.reserveOrder(alice,{...quote,quoteFingerprint:'c'.repeat(64)},orderInput),
      /qa_idempotency_payload_mismatch/,
      'replay may not change server quote');

    const paymentAttempts=await Promise.all(Array.from({length:8},(_,i)=>(
      (i%2===0?primary:another).reserveTestPayment(alice,order.orderId)
    )));
    assert.equal(new Set(paymentAttempts.map(x=>x.authorityId)).size,1);
    assert.equal(new Set(paymentAttempts.map(x=>x.stripeIdempotencyKey)).size,1);
    assert(paymentAttempts.every(x=>x.state==='reserved'&&
      x.stripeMode==='test'&&x.stripePaymentIntentId===null));
    assert.equal(Number(await scalar(
      'SELECT count(*) FROM public.da_client_commerce_payment_authority_qa '+
      'WHERE order_id=$1',[order.orderId])),1);
    console.log('QA_ADAPTER_8_WAY_TEST_PAYMENT=ONE_AUTHORITY_AND_ONE_PROVIDER_KEY');

    await mustReject(
      ()=>another.reserveTestPayment(bob,order.orderId),
      /qa_order_missing_or_cross_principal/,
      'another Client must not bind a foreign order');
    assert.equal(Number(await scalar(
      'SELECT count(*) FROM public.da_client_commerce_payment_authority_qa '+
      'WHERE order_id=$1',[order.orderId])),1);
    console.log('QA_ADAPTER_CROSS_SUBJECT_PAYMENT=DENIED');

    // SQL is the ultimate authority: an internal caller must not rebind
    // the generated payment to another amount or another client.
    await mustReject(
      ()=>pool.query('UPDATE public.da_client_commerce_payment_authority_qa '+
        'SET total_minor=9999 WHERE order_id=$1',[order.orderId]),
      /qa_payment_binding_immutable/);
    await mustReject(
      ()=>pool.query('UPDATE public.da_client_commerce_orders_qa '+
        'SET total_minor=9999 WHERE order_id=$1',[order.orderId]),
      /qa_order_financial_binding_immutable/);
    console.log('QA_ADAPTER_DB_FINANCIAL_BINDINGS=IMMUTABLE');

    // Admission and quote provenance are trusted inputs from the Nest guard
    // and server catalog in production; this candidate validates their
    // strict shape and NEVER constructs them from a client HTTP request.
    const before=Number(await scalar(
      'SELECT count(*) FROM public.da_client_commerce_orders_qa'));
    for (const bad of [
      {...alice,role:'merchant'}, {...alice,authSource:'dev-login'},
      {...alice,ownershipEligible:false}, {...alice,issuer:'http://evil.invalid'},
      {...alice,subject:'missing'},
    ]){
      await mustReject(()=>primary.reserveOrder(
        bad,quote,'qa-invalid-identity-001'),/qa_verified_client_required/);
    }
    for(const badQuote of [
      {...quote,source:'mobile-body'},
      {...quote,totalMinor:-1}, {...quote,currency:'usd'},
      {...quote,quoteFingerprint:'broken'},
      {...quote,merchantSlug:'../../evil'},
    ]){
      await mustReject(()=>primary.reserveOrder(
        alice,badQuote,'qa-invalid-quote-001'),/qa_trusted_server_quote_required/);
    }
    assert.equal(Number(await scalar(
      'SELECT count(*) FROM public.da_client_commerce_orders_qa')),before);
    console.log('QA_ADAPTER_UNTRUSTED_IDENTITY_AND_QUOTE=NO_DB_WRITES');
    console.log('QA_ADAPTER_STRIPE_CALLS=ZERO');
    console.log('QA_ADAPTER_PRODUCTION_ROUTES=NOT_WIRED');
  } finally{
    await Promise.allSettled([pool.end(),anotherPool.end()]);
  }
});
