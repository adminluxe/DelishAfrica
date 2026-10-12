'use strict';
const assert = require('node:assert/strict');
const { test } = require('node:test');
const crypto = require('node:crypto');
const fs = require('node:fs');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { Controller, Get, UseGuards, Req } = require('@nestjs/common');
const { NativeClientNestCommerceGuard, NATIVE_CLIENT_COMMERCE_DEPS, NATIVE_CLIENT_ADMISSION_CONTEXT } =
  require('../src/auth/native-client-nest-commerce.guard');
const { nativeClientEmailBindingHmac } =
  require('../src/auth/native-client-commerce.policy');

test('Nest HTTP admission blocks missing, invalid, pending, revoked and unavailable', async () => {
  const {privateKey, publicKey} = crypto.generateKeyPairSync('rsa', {modulusLength: 2048});
  const issuer = 'https://auth.qa.example.invalid/realms/da-client';
  const clientId = 'delishafrica-client';
  const subject = 'a63f867f-9f42-4573-9268-dc65a164d2c1';
  const email = 'qa-nest-client@example.invalid';
  const secret = 'synthetic-test-hmac-secret-' + 'z'.repeat(48);
  const now = Math.floor(Date.now()/1000);
  const jwk = {...publicKey.export({format:'jwk'}),kid:'synthetic',use:'sig',alg:'RS256'};
  const basic = {
    iss:issuer,sub:subject,azp:clientId,aud:['account',clientId],
    iat:now-10,exp:now+240,email,email_verified:true,
    realm_access:{roles:['client','default-roles-da-client']},
  };
  const sign = (changes = {}) => {
    const h = Buffer.from(JSON.stringify({alg:'RS256',kid:'synthetic',typ:'at+jwt'})).toString('base64url');
    const p = Buffer.from(JSON.stringify({...basic,...changes})).toString('base64url');
    const msg = h+'.'+p;
    return msg+'.'+crypto.sign('RSA-SHA256',Buffer.from(msg),privateKey).toString('base64url');
  };
  const ledgerPending = {
    schemaVersion:1,status:'pending',subjectId:subject,emailVerifiedSubjectId:'',
    smsVerifiedSubjectId:'',emailBindingHmac:nativeClientEmailBindingHmac(secret,email),
    smsRecipientHmac:'',providerEmailProofAccepted:false,providerSmsProofAccepted:false,
    transactionCommittedAtSeconds:0,revokedAtSeconds:null,
  };
  let ledger = {...ledgerPending}, jwksOutage = false, dbOutage = false;
  const deps = {
    issuer,clientId,audience:clientId,emailHmacSecret:secret,maxTokenLifetimeSeconds:3600,
    async loadTrustedJwks() {
      if(jwksOutage)throw Error('QA_ONLY_JWKS_OUTAGE');
      return {issuer,provenanceVerified:true,keys:[jwk]};
    },
    async readCommittedAdmission() {
      if(dbOutage)throw Error('QA_ONLY_DB_OUTAGE');
      return ledger;
    },
  };
  class QaController { check(req) { const p=req[NATIVE_CLIENT_ADMISSION_CONTEXT]; return {admitted:!!p,role:p?.role,subject:p?.subject}; } }
  Controller('qa/native')(QaController);
  const descriptor = Object.getOwnPropertyDescriptor(QaController.prototype,'check');
  Get('commerce')(QaController.prototype,'check',descriptor);
  Req()(QaController.prototype,'check',0);
  UseGuards(NativeClientNestCommerceGuard)(QaController.prototype,'check',descriptor);
  const moduleRef = await Test.createTestingModule({
    controllers:[QaController],
    providers:[NativeClientNestCommerceGuard,
      {provide:NATIVE_CLIENT_COMMERCE_DEPS,useValue:deps}],
  }).compile();
  const app = moduleRef.createNestApplication({logger:false});
  await app.listen(0,'127.0.0.1');
  const address = app.getHttpServer().address();
  const url = 'http://127.0.0.1:'+address.port+'/qa/native/commerce';
  const status = async (jwt, extra={}) => {
    const res = await fetch(url,{signal:AbortSignal.timeout(7000),
      headers:{...extra,...(jwt?{authorization:'Bearer '+jwt}:{})}});
    await res.arrayBuffer();
    return res.status;
  };
  try {
    const jwt = sign();
    assert.equal(await status(null),401);
    assert.equal(await status(null,{'x-user-id':subject,'x-role':'client'}),401);
    assert.equal(await status(jwt+'altered'),401);
    assert.equal(await status(jwt),403);
    assert.equal(await status(sign({email_verified:false})),403);
    assert.equal(await status(sign({realm_access:{roles:['client','merchant']}})),403);
    assert.equal(await status(sign({iss:'https://auth.qa.example.invalid/realms/afritaste'})),401);
    assert.equal(await status(sign({aud:'delishafrica-courier'})),401);
    assert.equal(await status(sign({exp:now-5})),401);
    ledger = {...ledgerPending,status:'approved',emailVerifiedSubjectId:subject,
      smsVerifiedSubjectId:subject,providerEmailProofAccepted:true,
      providerSmsProofAccepted:true,smsRecipientHmac:'a'.repeat(64),
      transactionCommittedAtSeconds:now-1};
    assert.equal(await status(jwt),200);
    const info=await fetch(url,{headers:{authorization:'Bearer '+jwt}});
    assert.deepEqual(await info.json(),{admitted:true,role:'client',subject});
    ledger = {...ledger,status:'revoked',revokedAtSeconds:now-1};
    assert.equal(await status(jwt),403);
    dbOutage=true;
    assert.equal(await status(jwt),503);
    dbOutage=false;
    jwksOutage=true;
    assert.equal(await status(jwt),503);
    assert(!fs.readFileSync('services/api-nest/src/app.module.ts','utf8')
      .includes('NativeClientNestCommerceGuard'));
    assert(!fs.readFileSync('services/api-nest/src/orders/orders.controller.ts','utf8')
      .includes('NativeClientNestCommerceGuard'));
    console.log('QA_REAL_NEST_HTTP=PASS_401_403_200_503');
    console.log('QA_PRODUCTION_COMMERCE_ROUTES=UNWIRED');
  } finally {
    await app.close();
  }
});
