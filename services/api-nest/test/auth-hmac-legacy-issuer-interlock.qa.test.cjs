'use strict';
/**
 * QA ONLY - real AuthService, real ExternalJwksVerifierService methods and
 * real OrdersAuthGuard / PaymentsAuthGuard classes.
 * Synthetic crypto and requests; NO server, network, Stripe or real tokens.
 * This intentionally does NOT certify integration into a deployed Nest route.
 */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {AuthService} = require('../src/auth/auth.service');
const {ExternalJwksVerifierService} = require('../src/auth/external-jwks-verifier.service');
const {OrdersAuthGuard} = require('../src/orders/orders.auth.guard');
const {PaymentsAuthGuard} = require('../src/payments/payments.auth.guard');
const {
  NativeClientNestCommerceGuard, NATIVE_CLIENT_ADMISSION_CONTEXT,
} = require('../src/auth/native-client-nest-commerce.guard');
const {nativeClientEmailBindingHmac} =
  require('../src/auth/native-client-commerce.policy');

if(process.env.QA_SYNTHETIC_ONLY !== 'YES') {
  throw Error('QA_ONLY_SYNTHETIC_INTERLOCK_NO_REAL_SERVICES');
}
const appGuardContext = req=>({
  switchToHttp:()=>({getRequest:()=>req}),
});

test('internal HS256: strong secret only, no machine-derived fallback, no external-domain forgery',async()=>{
  const keys=['NODE_ENV','DA_AUTH_SECRET','DA_AUTH_SECRET_FILE','HOSTNAME'];
  const saved=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'da-hmac-qa-'));
  const missing=path.join(tmp,'not-present');
  const rejectedVerifier={verifyToken:async()=>({ok:false,reason:'synthetic_untrusted_token'})};
  const auth=new AuthService(rejectedVerifier);
  const restore=()=>{
    for(const k of keys) {
      if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];
    }
    fs.rmSync(tmp,{recursive:true,force:true});
  };
  try {
    process.env.DA_AUTH_SECRET_FILE=missing;
    delete process.env.DA_AUTH_SECRET;
    process.env.NODE_ENV='production';
    assert.throws(()=>auth.devLogin({role:'client'}),/auth_hmac_secret_not_configured/);
    process.env.DA_AUTH_SECRET='too-short';
    assert.throws(()=>auth.devLogin({role:'client'}),/auth_hmac_secret_too_short_env/);

    process.env.DA_AUTH_SECRET='P'.repeat(48);
    const valid=auth.devLogin({role:'client'});
    assert.equal((await auth.verify({token:valid.token})).authenticated,true);

    // Even with the legitimate HMAC key, an "external" claim is forbidden
    // in internal tokens: external privilege needs RS256 issuer-pinned JWKS.
    const [h,p]=valid.token.split('.');
    const elevated=JSON.parse(Buffer.from(p,'base64url').toString('utf8'));
    elevated.authSource='external';
    const p2=Buffer.from(JSON.stringify(elevated)).toString('base64url');
    const forgedPrefix=h+'.'+p2;
    const sign=(data)=>crypto.createHmac('sha256',process.env.DA_AUTH_SECRET)
      .update(data).digest('base64url');
    assert.equal((await auth.verify({token:forgedPrefix+'.'+sign(forgedPrefix)})).authenticated,false);
    const noAlg=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url');
    const algPrefix=noAlg+'.'+p;
    assert.equal((await auth.verify({token:algPrefix+'.'+sign(algPrefix)})).authenticated,false);

    delete process.env.DA_AUTH_SECRET;
    fs.writeFileSync(path.join(tmp,'configured-hmac'), 'F'.repeat(48), {mode:0o600});
    process.env.DA_AUTH_SECRET_FILE=path.join(tmp,'configured-hmac');
    assert.equal((await auth.verify({token:auth.devLogin({role:'courier'}).token})).authenticated,true);

    delete process.env.DA_AUTH_SECRET;
    process.env.DA_AUTH_SECRET_FILE=missing;
    process.env.NODE_ENV='development';
    process.env.HOSTNAME='qa-fixed-host';
    const ephemeral=auth.devLogin({role:'client'});
    assert.equal((await auth.verify({token:ephemeral.token})).authenticated,true);
    // An attacker reproducing the old cwd/hostname SHA-256 key MUST fail.
    const historicalKey=crypto.createHash('sha256').update(path.resolve(process.cwd()))
      .update('|').update('qa-fixed-host').digest('hex');
    const [eh,ep]=ephemeral.token.split('.');
    const oldPrefix=eh+'.'+ep;
    const historicalSig=crypto.createHmac('sha256',historicalKey)
      .update(oldPrefix).digest('base64url');
    assert.equal((await auth.verify({token:oldPrefix+'.'+historicalSig})).authenticated,false);
    console.log('QA_INTERNAL_HMAC_FAIL_CLOSED=PASS');
    console.log('QA_DETERMINISTIC_HMAC_FALLBACK=REMOVED');
  } finally {restore();}
});

test('real legacy guard classes: isolate Merchant/Courier and reject separate native Client issuer',async()=>{
  const {privateKey,publicKey}=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
  const oldIssuer='https://id.qa.invalid/realms/afritaste';
  const nativeIssuer='https://id.qa.invalid/realms/da-native-client';
  const now=Math.floor(Date.now()/1000);
  const issuerVerifier=Object.create(ExternalJwksVerifierService.prototype);
  issuerVerifier.config={
    issuer:oldIssuer,audience:'delishafrica-merchant',
    merchantRealmRoles:['merchant'],merchantClientRoles:['merchant'],
    clockSkewSeconds:5,
  };
  issuerVerifier.keys=new Map([['qa-shared-kid',{
    kid:'qa-shared-kid',alg:'RS256',key:publicKey,
  }]]);
  issuerVerifier.ready=true;
  issuerVerifier.refreshKeys=async()=>{throw Error('QA_JWKS_NETWORK_FORBIDDEN');};
  const auth=new AuthService(issuerVerifier);
  const orders=new OrdersAuthGuard(auth);
  const payments=new PaymentsAuthGuard(auth);
  const sign=(claims)=>{
    const header=Buffer.from(JSON.stringify({
      alg:'RS256',kid:'qa-shared-kid',typ:'at+jwt',
    })).toString('base64url');
    const payload=Buffer.from(JSON.stringify(claims)).toString('base64url');
    const data=header+'.'+payload;
    return data+'.'+crypto.sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');
  };
  const base={
    iss:oldIssuer,iat:now-10,exp:now+180,
    sub:'a63f867f-9f42-4573-9268-dc65a164d2c1',
    email:'qa-user@example.invalid',email_verified:true,
  };
  const denied=async(call,code,label)=>{
    await assert.rejects(call,(e)=>e && typeof e.getStatus==='function' &&
      e.getStatus()===code,label);
  };
  for(const role of ['merchant','courier']) {
    const aud=role==='merchant'?'delishafrica-merchant':'delishafrica-courier';
    const token=sign({...base,aud:['account',aud],azp:aud,
      realm_access:{roles:[role]}});
    const req={headers:{authorization:'Bearer '+token}};
    assert.equal(await orders.canActivate(appGuardContext(req)),true);
    assert.equal(req.daOrdersPrincipal.role,role);
    assert.equal(req.daOrdersPrincipal.issuer,oldIssuer);
    await denied(()=>payments.canActivate(appGuardContext({
      headers:{authorization:'Bearer '+token},
    })),403,'non-client payment prohibited');
  }

  // Same signing key AND kid in this synthetic test is deliberate:
  // strict issuer isolation, not only a different cryptographic key,
  // must reject the native realm in the old AuthService.
  const subject='a63f867f-9f42-4573-9268-dc65a164d2c1';
  const email='buyer@example.invalid';
  const nativeClaims={
    ...base,iss:nativeIssuer,sub:subject,email,
    aud:['account','delishafrica-client'],azp:'delishafrica-client',
    realm_access:{roles:['client','default-roles-da-native-client']},
  };
  const nativeToken=sign(nativeClaims);
  const request={headers:{authorization:'Bearer '+nativeToken}};
  await denied(()=>orders.canActivate(appGuardContext(request)),401,
    'native token must not fall through legacy order guard');
  await denied(()=>payments.canActivate(appGuardContext(request)),401,
    'native token must not fall through legacy payment guard');
  assert.equal(request.daOrdersPrincipal,undefined);
  assert.equal(request.daPaymentsPrincipal,undefined);

  const emailHmacSecret='synthetic-email-hmac-'+('k'.repeat(48));
  const admitted={
    schemaVersion:1,status:'approved',subjectId:subject,
    emailVerifiedSubjectId:subject,smsVerifiedSubjectId:subject,
    emailBindingHmac:nativeClientEmailBindingHmac(emailHmacSecret,email),
    smsRecipientHmac:'a'.repeat(64),
    providerSmsProofAccepted:true,providerEmailProofAccepted:true,
    transactionCommittedAtSeconds:now-5,revokedAtSeconds:null,
  };
  const native=new NativeClientNestCommerceGuard({
    issuer:nativeIssuer,clientId:'delishafrica-client',
    audience:'delishafrica-client',emailHmacSecret,
    maxTokenLifetimeSeconds:3600,
    async loadTrustedJwks(){return {
      issuer:nativeIssuer,provenanceVerified:true,
      keys:[{...publicKey.export({format:'jwk'}),
        kid:'qa-shared-kid',use:'sig',alg:'RS256'}],
    };},
    async readCommittedAdmission(issuer,sub){
      assert.equal(issuer,nativeIssuer);assert.equal(sub,subject);
      return admitted;
    },
  });
  assert.equal(await native.canActivate(appGuardContext(request)),true);
  assert.equal(request[NATIVE_CLIENT_ADMISSION_CONTEXT].role,'client');
  await denied(()=>orders.canActivate(appGuardContext(request)),401,
    'existing legacy guard still blocks native, safe but not bridged');
  assert.equal(request.daOrdersPrincipal,undefined);
  console.log('QA_REAL_LEGACY_AUTH_GUARDS_SYNTHETIC_KEYS=PASS');
  console.log('QA_SEPARATE_NATIVE_REALM_LEGACY_BRIDGE=NO_GO_NOT_WIRED');
  console.log('QA_STRIPE_CALLS=ZERO');
});
