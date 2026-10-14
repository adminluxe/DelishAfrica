'use strict';
/**
 * DelishAfrica P0: REAL QA HTTP -> signed RSA JWT -> PostgreSQL admission ->
 * immutable PostgreSQL order/snapshot -> financial authority -> fake Stripe.
 *
 * NO public controllers registered in AppModule. Real PostgreSQL 17 is
 * disposable and has --network none; the only HTTP calls are to the Nest
 * server loopback and a DI-injected, in-process fake Stripe fetcher.
 *
 * NOT real Keycloak discovery, SMS provider, Stripe, EAS, App Store or LIVE.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const {
  NativeClientNestCommerceGuard,
  NATIVE_CLIENT_COMMERCE_DEPS,
} = require('/qa-built/src/auth/native-client-nest-commerce.guard.js');
const {
  nativeClientEmailBindingHmac,
} = require('/qa-built/src/auth/native-client-commerce.policy.js');
const {
  QaIsolatedClientCommerceController,
  QA_NATIVE_CLIENT_CHECKOUT_PORTS,
} = require('/qa-built/src/client-commerce/native-client-checkout.qa.controller.js');
const {
  createQaPgFirstCheckoutPorts,
} = require('/qa-built/src/client-commerce/native-client-checkout-pg-first.qa.ports.js');

if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED !== 'YES' ||
    process.env.NODE_ENV === 'production' ||
    process.env.QA_COMMERCE_DB_HOST !== '127.0.0.1' ||
    process.env.QA_COMMERCE_DB_NAME !== 'postgres' ||
    !/^[a-f0-9]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY || '')) {
  throw Error('QA_P0_SIGNED_HTTP_PG17_DISCONNECTED_ONLY');
}

const cfg = user => ({
  host: '127.0.0.1', port: 5432, database: 'postgres',
  user, max: 6, query_timeout: 12000, statement_timeout: 12000,
  connectionTimeoutMillis: 7500,
});
const admin = new Pool(cfg('postgres'));
const commerce = new Pool(cfg('da_qa_client_commerce_app'));
const creator = new Pool(cfg('da_qa_stripe_intent_creator'));
const receipt = new Pool(cfg('da_qa_client_commerce_app'));
let admissionReader;
const issuer = 'https://auth.qa.example.invalid/realms/da-client';
const subject = 'a63f867f-9f42-4573-9268-dc65a164d2c1';
const foreignSubject = 'b63f867f-9f42-4573-9268-dc65a164d2c2';
const clientId = 'delishafrica-client';
const email = 'qa-signed-http@example.invalid';
const emailHmacSecret = 'QA_SIGNED_HTTP_ADMISSION_NEVER_LIVE_' + 't'.repeat(40);
const account = 'acct_DAP0SIGNEDHTTP2026';
const stripeSecret = ['sk', 'test', 'P0_SIGNED_HTTP_FAKEONLY20261014'].join('_');
const publishableKey = ['pk', 'test', 'P0_SIGNED_HTTP_FAKEONLY20261014'].join('_');
const intentId = 'pi_DAP0SIGNEDHTTP000001';
const now = () => Math.floor(Date.now()/1000);
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048, publicExponent: 65537,
});
const jwk = {
  ...publicKey.export({ format: 'jwk' }),
  kid: 'qa-signed-http-jwks-20261014', use: 'sig', alg: 'RS256',
};
const claims = {
  iss: issuer, sub: subject, azp: clientId, aud: [clientId, 'account'],
  email, email_verified: true,
  realm_access: {roles: ['client', 'default-roles-da-client']},
};
function sign(overrides = {}) {
  const t = now();
  const a = Buffer.from(JSON.stringify({
    alg: 'RS256', kid: jwk.kid, typ: 'at+jwt',
  })).toString('base64url');
  const b = Buffer.from(JSON.stringify({
    ...claims, iat: t-20, exp: t+240, ...overrides,
  })).toString('base64url');
  const base = a + '.' + b;
  return base + '.' + crypto.sign('RSA-SHA256', Buffer.from(base),
    privateKey).toString('base64url');
}

const partnerSlug = 'qa-restaurant';
const cart = {
  partnerSlug,
  items: [{ id:'rice', quantity:1, amount:1 },
    { id:'juice', quantity:2, price:1 }],
  total:1, currency:'xof', paid:true, providerVerified:true,
  metadata:{role:'ops', userId:foreignSubject},
};
const catalog = {
  async quote({ partnerSlug: slug, items }) {
    assert.equal(slug, partnerSlug);
    assert.deepEqual(items, [
      {id:'rice',quantity:1}, {id:'juice',quantity:2},
    ]);
    return {
      ok:true, version:1, partnerSlug, currency:'eur',
      availabilityDate:'2026-10-14',
      quoteFingerprint:crypto.createHash('sha256')
        .update('p0-signed-http-published-catalog-qa-v1').digest('hex'),
      subtotal:2300, deliveryFee:390, total:2690,
      minimumOrderAmount:1200,
      items:[
        {id:'rice',sku:'rice',name:'Jollof rice',category:'Menu',
         quantity:1,unitAmount:1500,lineAmount:1500},
        {id:'juice',sku:'juice',name:'Bissap',category:'Drink',
         quantity:2,unitAmount:400,lineAmount:800},
      ],
    };
  },
};
const fakeIntents = new Map();
let providerPosts = 0;
let loseProviderResponse = false;
const fakeStripe = async (url, init) => {
  assert.ok(String(url).startsWith('https://api.stripe.com/v1/'));
  if (url === 'https://api.stripe.com/v1/account' && init.method === 'GET') {
    return Response.json({object:'account', id:account});
  }
  if (url === 'https://api.stripe.com/v1/payment_intents' && init.method === 'POST') {
    providerPosts++;
    const key = init.headers['Idempotency-Key'];
    assert.match(key, /^da-qa-test-v1-[a-f0-9]{64}$/);
    const body = new URLSearchParams(init.body);
    assert.equal(body.get('amount'),'2690');
    assert.equal(body.get('currency'),'eur');
    assert.equal(body.get('confirm'),'false');
    assert.equal(body.get('transfer_data[destination]'),null);
    let intent = fakeIntents.get(key);
    if (!intent) {
      const metadata = {};
      for (const [k,v] of body) if (k.startsWith('metadata[') && k.endsWith(']')) {
        metadata[k.slice(9,-1)] = v;
      }
      intent = {
        object:'payment_intent', id:intentId, livemode:false,
        amount:2690, currency:'eur', status:'requires_payment_method',
        client_secret:intentId+'_secret_SYNTHETICONLY', metadata,
        on_behalf_of:null, transfer_data:null,
      };
      fakeIntents.set(key,intent);
    }
    if (loseProviderResponse) {
      loseProviderResponse=false;
      throw Error('QA_SIMULATED_STRIPE_RESPONSE_TIMEOUT');
    }
    return Response.json(intent);
  }
  if (url === 'https://api.stripe.com/v1/payment_intents/'+intentId &&
      init.method === 'GET') {
    return Response.json([...fakeIntents.values()][0]);
  }
  throw Error('QA_UNEXPECTED_PROVIDER_PATH_OR_MUTATION');
};

test('real signed Client HTTP + committed PG admission + PG-first order + fake Stripe replay',
  async () => {
  let app;
  let jwksOutage = false, admissionOutage = false;
  const mutation = 'qa-p0-signed-http-mutation-20261014';
  const deps = {
    issuer,clientId,audience:clientId,emailHmacSecret,
    maxTokenLifetimeSeconds:3600,
    async loadTrustedJwks() {
      if (jwksOutage) throw Error('QA_PINNED_JWKS_SERVICE_DOWN');
      return { issuer, provenanceVerified:true, keys:[jwk] };
    },
    async readCommittedAdmission(identityIssuer, identitySubject) {
      if (admissionOutage) throw Error('QA_DATABASE_ADMISSION_DOWN');
      const r = await admissionReader.query(
        'SELECT issuer,subject_id,email_binding_hmac,sms_recipient_hmac,'+
        'email_server_verified,sms_provider_verified,status,committed_at,'+
        'revoked_at,version FROM public.da_native_client_admissions '+
        'WHERE issuer=$1 AND subject_id=$2::uuid',
        [identityIssuer,identitySubject],
      );
      if (r.rows.length !== 1) return null;
      const row = r.rows[0];
      const sub = String(row.subject_id);
      return {
        schemaVersion:row.version, status:row.status, subjectId:sub,
        emailBindingHmac:String(row.email_binding_hmac).trim(),
        smsRecipientHmac:row.sms_recipient_hmac
          ?String(row.sms_recipient_hmac).trim():'',
        emailVerifiedSubjectId:row.email_server_verified===true?sub:'',
        smsVerifiedSubjectId:row.sms_provider_verified===true?sub:'',
        providerSmsProofAccepted:row.sms_provider_verified===true,
        providerEmailProofAccepted:row.email_server_verified===true,
        transactionCommittedAtSeconds:row.committed_at
          ?Math.floor(new Date(row.committed_at).getTime()/1000):0,
        revokedAtSeconds:row.revoked_at
          ?Math.floor(new Date(row.revoked_at).getTime()/1000):null,
      };
    },
  };

  try {
    // These roles/tables exist only in ephemeral --network none PG17.
    await admin.query(
      'CREATE ROLE da_qa_p0_admission_reader LOGIN NOSUPERUSER '+
      'NOCREATEDB NOCREATEROLE NOINHERIT'
    );
    await admin.query(
      'GRANT SELECT (issuer,subject_id,email_binding_hmac,'+
      'sms_recipient_hmac,email_server_verified,sms_provider_verified,'+
      'status,committed_at,revoked_at,version) '+
      'ON public.da_native_client_admissions '+
      'TO da_qa_p0_admission_reader'
    );
    admissionReader=new Pool(cfg('da_qa_p0_admission_reader'));
    await admin.query(
      'INSERT INTO public.da_native_client_admissions '+
      '(issuer,subject_id,email_binding_hmac) VALUES ($1,$2::uuid,$3)',
      [issuer,subject,nativeClientEmailBindingHmac(emailHmacSecret,email)],
    );

    const ports = createQaPgFirstCheckoutPorts({
      canonicalCatalog:catalog,
      orderReservationPool:commerce,
      stripeIntentCreatorPool:creator,
      ownedReceiptPool:receipt,
      providerIdempotencyHmacKey:process.env.QA_COMMERCE_HMAC_KEY,
      stripe:{
        secretKey:stripeSecret,publishableKey,
        expectedAccountId:account,syntheticOnly:true,fetcher:fakeStripe,
      },
    });
    const moduleRef = await Test.createTestingModule({
      controllers:[QaIsolatedClientCommerceController],
      providers:[
        NativeClientNestCommerceGuard,
        {provide:NATIVE_CLIENT_COMMERCE_DEPS,useValue:deps},
        {provide:QA_NATIVE_CLIENT_CHECKOUT_PORTS,useValue:ports},
      ],
    }).compile();
    app = moduleRef.createNestApplication({logger:false});
    await app.listen(0,'127.0.0.1');
    const base='http://127.0.0.1:'+
      app.getHttpServer().address().port+
      '/qa-isolated/client-commerce/';
    async function send(route, token, body=cart, idempotency=mutation) {
      const response=await fetch(base+route,{
        method:'POST',signal:AbortSignal.timeout(9000),
        headers:{
          'content-type':'application/json',
          'idempotency-key':idempotency,
          ...(token?{authorization:'Bearer '+token}:{}),
        },
        body:JSON.stringify(body),
      });
      return {code:response.status,data:await response.json()};
    }
    const orderRoute='orders/create';
    const intentRoute='payments/create-intent';
    const statusRoute='orders/status';
    const jwt=sign();
    assert.equal((await send(orderRoute,null)).code,401);
    assert.equal((await send(orderRoute,jwt+'bad')).code,401);
    assert.equal((await send(orderRoute,sign({sub:foreignSubject}))).code,403);
    assert.equal((await send(orderRoute,sign({realm_access:{roles:['client','courier']}}))).code,403);
    assert.equal((await send(orderRoute,sign({iss:'https://other.invalid/realms/da-client'}))).code,401);
    assert.equal((await send(orderRoute,jwt)).code,403); // PG pending
    assert.equal(providerPosts,0);
    assert.equal(fakeIntents.size,0);
    admissionOutage=true;
    assert.equal((await send(orderRoute,jwt)).code,503);
    admissionOutage=false;
    jwksOutage=true;
    assert.equal((await send(orderRoute,jwt)).code,503);
    jwksOutage=false;
    console.log('QA_SIGNED_HTTP_JWT_PENDING_ROLES_401_403_503=PROVIDER_ZERO');

    await admin.query(
      'UPDATE public.da_native_client_admissions '+
      'SET status=$1,email_server_verified=true,sms_provider_verified=true,'+
      "email_verified_at=statement_timestamp()-interval '2 minutes',"+
      "sms_verified_at=statement_timestamp()-interval '1 minute',"+
      'sms_recipient_hmac=$2,sms_provider_proof_hmac=$3,'+
      'committed_at=statement_timestamp() '+
      'WHERE issuer=$4 AND subject_id=$5::uuid',
      ['approved','a'.repeat(64),'b'.repeat(64),issuer,subject],
    );
    const created=await send(orderRoute,jwt);
    assert.equal(created.code,201,JSON.stringify(created.data));
    assert.match(created.data.orderId,/^[0-9a-f-]{36}$/);
    assert.equal(created.data.currency,'eur');
    assert.equal(created.data.amount,2690);
    assert.equal(created.data.state,'pending_payment');
    assert.equal(await (async()=>{
      const r=await admin.query(
        'SELECT count(*)::int AS n FROM public.da_client_commerce_order_snapshot_qa '+
        'WHERE order_id=$1::uuid',[created.data.orderId]);
      return r.rows[0].n;
    })(),1);
    assert.equal(providerPosts,0);
    const replay=await send(orderRoute,jwt);
    assert.equal(replay.code,201);
    assert.equal(replay.data.orderId,created.data.orderId);
    console.log('QA_SIGNED_HTTP_REAL_PG_ORDER_SNAPSHOT_BEFORE_STRIPE=PASS');

    const paymentBody={
      ...cart,orderId:created.data.orderId,
      canonicalQuoteFingerprint:created.data.canonicalQuoteFingerprint,
      canonicalCartFingerprint:created.data.canonicalCartFingerprint,
    };
    assert.equal((await send(intentRoute,jwt,{
      ...paymentBody,orderId:crypto.randomUUID(),
    })).code,409);
    assert.equal((await send(intentRoute,jwt,{
      ...paymentBody,canonicalQuoteFingerprint:'a'.repeat(64),
    })).code,409);
    assert.equal((await send(intentRoute,jwt,{
      ...paymentBody,clientMutationId:'wrong-identity',
    })).code,409);
    assert.equal((await send(intentRoute,jwt,paymentBody,'bad mutation')).code,400);
    assert.equal(providerPosts,0);
    console.log('QA_SIGNED_HTTP_INVALID_ORDER_QUOTE_MUTATION=409_NO_STRIPE');

    loseProviderResponse=true;
    const timeout=await send(intentRoute,jwt,paymentBody);
    assert.equal(timeout.code,503);
    assert.doesNotMatch(JSON.stringify(timeout.data),/QA_SIMULATED_STRIPE_RESPONSE_TIMEOUT/);
    assert.equal(fakeIntents.size,1);
    const authorized=await send(intentRoute,jwt,paymentBody);
    assert.equal(authorized.code,200,JSON.stringify(authorized.data));
    assert.equal(authorized.data.paymentIntentId,intentId);
    assert.equal(authorized.data.orderId,created.data.orderId);
    assert.equal(fakeIntents.size,1);
    assert.equal(providerPosts,2);
    const status=await send(statusRoute,jwt,{
      orderId:created.data.orderId,clientMutationId:mutation,
      paid:true,providerVerified:true,
    });
    assert.equal(status.code,200,JSON.stringify(status.data));
    assert.equal(status.data.financialStatus,'awaiting_payment');
    assert.equal(status.data.dispatchEligible,false);
    assert.equal(status.data.paymentIntentId,intentId);
    console.log('QA_SIGNED_HTTP_PROVIDER_TIMEOUT_REPLAY_ONE_INTENT=PASS');

    // Production switch cannot enable this controller or ports, even under
    // a signed and committed QA Client principal.
    const oldNodeEnv=process.env.NODE_ENV;
    try {
      process.env.NODE_ENV='production';
      assert.equal((await send(orderRoute,jwt)).code,503);
      assert.equal((await send(intentRoute,jwt,paymentBody)).code,503);
    }finally {
      if (oldNodeEnv===undefined)delete process.env.NODE_ENV;
      else process.env.NODE_ENV=oldNodeEnv;
    }
    await admin.query(
      "UPDATE public.da_native_client_admissions SET status='revoked',"+
      'revoked_at=statement_timestamp() '+
      'WHERE issuer=$1 AND subject_id=$2::uuid',[issuer,subject]);
    assert.equal((await send(orderRoute,jwt)).code,403);
    assert.equal((await send(intentRoute,jwt,paymentBody)).code,403);
    assert.equal((await send(statusRoute,jwt,{
      orderId:created.data.orderId,clientMutationId:mutation,
    })).code,403);
    assert.equal(fakeIntents.size,1);
    assert.equal(providerPosts,2);
    console.log('QA_SIGNED_HTTP_REVOKED_DB_AND_PRODUCTION=NO_PAYMENTS');
    console.log('QA_SIGNED_HTTP_PG_FIRST_E2E_SYNTHETIC=PASS');
  } finally {
    if (app) await app.close();
    await Promise.allSettled([
      admissionReader?.end(),admin.end(),commerce.end(),
      creator.end(),receipt.end(),
    ]);
  }
});
