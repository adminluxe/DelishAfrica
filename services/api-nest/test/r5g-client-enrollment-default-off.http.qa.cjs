'use strict';
/**
 * R5G default-OFF acceptance. Exact ClientEnrollmentController and Service
 * on an actual private Nest HTTP server. This NEVER creates an account.
 * Run only in a disposable CI runner, without external credentials.
 */
require('reflect-metadata');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const { Test }=require('@nestjs/testing');
const { ClientEnrollmentController }=require('../src/client-enrollment/client-enrollment.controller');
const { ClientEnrollmentService }=require('../src/client-enrollment/client-enrollment.service');
const { ClientEnrollmentKeycloak }=require('../src/client-enrollment/client-enrollment.keycloak');
const { ClientEnrollmentRepository }=require('../src/client-enrollment/client-enrollment.repository');
const { IdentityProofService }=require('../src/identity-proof/identity-proof.service');
const { IdentityProofController }=require('../src/identity-proof/identity-proof.controller');
const { trustedRequesterPeer }=require('../src/identity-proof/trusted-requester-peer');
const { enrollmentReadyForProduction }=require('../src/client-enrollment/client-enrollment.policy');

const ROOT=path.resolve(__dirname,'..');
let passCount=0;
function ok(label,condition) {
  assert.equal(Boolean(condition),true,'R5G_ASSERTION_FAILED_'+label);
  passCount++;
  console.log('R5G_PASS='+label);
}
function read(relative) {
  return fs.readFileSync(path.join(ROOT,relative),'utf8');
}
function never(name,calls) {
  return async () => {calls.push(name);throw Error('forbidden_external_side_effect');};
}
async function request(url,method='GET',body,headers={}) {
  const response=await fetch(url,{
    method,redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{...headers,...(body===undefined?{}:{'content-type':'application/json'})},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),
  });
  return {status:response.status,body:await response.json().catch(()=>null)};
}

async function run() {
  // Reproduce the precise disabled state intended for an unapproved release.
  delete process.env.DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET;
  delete process.env.DA_CLIENT_ENROLLMENT_HMAC_SECRET;
  delete process.env.DA_CLIENT_ENROLLMENT_SECURITY_GATE;
  delete process.env.DA_CLIENT_ENROLLMENT_RECOVERY_GATE;
  delete process.env.DA_CLIENT_ENROLLMENT_AUTHZ_GATE;
  delete process.env.DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE;
  process.env.DA_CLIENT_ENROLLMENT_ENABLED='false';
  delete process.env.DATABASE_URL;

  const appModule=read('src/app.module.ts');
  const appMain=read('src/main.ts');
  const ctrl=read('src/client-enrollment/client-enrollment.controller.ts');
  const proofCtrl=read('src/identity-proof/identity-proof.controller.ts');
  const migration=read('migrations/client-enrollment/20261011_001_client_enrollment_guarded.sql');
  ok('EXACT_APP_MODULE_MOUNTS_ENROLLMENT',appModule.includes("import { ClientEnrollmentModule }") &&
     appModule.includes('    ClientEnrollmentModule,'));
  ok('EXACT_APP_MODULE_KEEPS_ORCHIDPAY',appModule.includes('OrchidpayF3Module'));
  ok('EXACT_APP_MODULE_KEEPS_CONFLUENCE',appModule.includes('ConfluenceAiModule'));
  ok('PUBLIC_PATH_MATCHES_API_V1',appMain.includes("app.setGlobalPrefix('api/v1')"));
  ok('ENROLLMENT_TRUSTS_SOCKET_NOT_HEADERS',ctrl.includes('trustedRequesterPeer(req)'));
  ok('PROOFS_USE_SAME_SAFE_ORIGIN',proofCtrl.includes('trustedRequesterPeer(req)') &&
     !proofCtrl.includes('x-forwarded-for') && !proofCtrl.includes('cf-connecting-ip'));
  ok('MIGRATION_ADDITIVE',migration.includes('CREATE TABLE IF NOT EXISTS') &&
     !/\b(DROP|TRUNCATE|DELETE FROM)\b/i.test(migration));
  ok('ENROLLMENT_DEFAULT_OFF_WITHOUT_FLAGS',enrollmentReadyForProduction(process.env)===false);
  const allButAuthorization={
    DA_CLIENT_ENROLLMENT_ENABLED:'true',DATABASE_URL:'postgresql://qa.invalid',
    DA_CLIENT_ENROLLMENT_HMAC_SECRET:'x'.repeat(40),
    DA_CLIENT_ENROLLMENT_KC_BASE_URL:'http://afritaste-keycloak:8080/',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_ID:'delishafrica-client-enrollment',
    DA_CLIENT_ENROLLMENT_KC_CLIENT_SECRET:'fixture-only',
    DA_CLIENT_ENROLLMENT_SECURITY_GATE:'APPROVED_AFTER_REVIEW',
    DA_CLIENT_ENROLLMENT_RECOVERY_GATE:'SMTP_RESET_TESTED',
    DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE:'NGINX_REALIP_ON_LOOPBACK_VERIFIED',
  };
  ok('MISSING_FGAP_NEGATIVE_GATE_FAILS_CLOSED',!enrollmentReadyForProduction(allButAuthorization));
  ok('MISSING_SMTP_RESET_GATE_FAILS_CLOSED',
      !enrollmentReadyForProduction({...allButAuthorization,
        DA_CLIENT_ENROLLMENT_RECOVERY_GATE:undefined,
        DA_CLIENT_ENROLLMENT_AUTHZ_GATE:'FGAP_NEGATIVE_TESTS_PASSED'}));
  ok('MISSING_OPERATOR_REVIEW_GATE_FAILS_CLOSED',
      !enrollmentReadyForProduction({...allButAuthorization,
        DA_CLIENT_ENROLLMENT_SECURITY_GATE:undefined,
        DA_CLIENT_ENROLLMENT_AUTHZ_GATE:'FGAP_NEGATIVE_TESTS_PASSED'}));
  ok('MISSING_HMAC_KEY_FAILS_CLOSED',
      !enrollmentReadyForProduction({...allButAuthorization,
        DA_CLIENT_ENROLLMENT_HMAC_SECRET:undefined,
        DA_CLIENT_ENROLLMENT_AUTHZ_GATE:'FGAP_NEGATIVE_TESTS_PASSED'}));
  ok('MISSING_REVIEWED_NGINX_ORIGIN_FAILS_CLOSED',
      !enrollmentReadyForProduction({...allButAuthorization,
        DA_CLIENT_ENROLLMENT_TRUSTED_INGRESS_MODE:undefined,
        DA_CLIENT_ENROLLMENT_AUTHZ_GATE:'FGAP_NEGATIVE_TESTS_PASSED'}));
  const maliciousRequest={
    ip:'192.0.2.99',
    socket:{remoteAddress:'::ffff:198.51.100.41'},
    headers:{
      'x-forwarded-for':'8.8.8.8',
      'cf-connecting-ip':'9.9.9.9',
      'x-real-ip':'10.10.10.10',
    },
  };
  ok('HEADER_SPOOF_CANNOT_CHANGE_REQUESTER',
     trustedRequesterPeer(maliciousRequest)==='ip:198.51.100.41');
  ok('IPV6_PEER_STABLE',
     trustedRequesterPeer({socket:{remoteAddress:'2001:db8::1'}})==='ip:2001:db8::1');
  // Simulate pg.Pool's idle-client error without connecting to a database.
  // The real R5D catalogue lab exposed an unhandled EventEmitter error;
  // this enrollment repository must have its own independent handler.
  const Module=require('node:module');
  const originalLoad=Module._load;
  const originalDatabase=process.env.DATABASE_URL;
  const vendorPath=path.resolve(ROOT,'.runtime-vendor/pg-runtime/node_modules/pg');
  let idleErrorListener=null;
  let unexpectedSQL=0;
  let poolClosed=false;
  class FakePool {
    on(event,listener) {
      if(event==='error') idleErrorListener=listener;
    }
    async connect() {unexpectedSQL++;throw Error('qa_mock_no_pg');}
    async query() {unexpectedSQL++;throw Error('qa_mock_no_pg');}
    async end() {poolClosed=true;}
  }
  try {
    Module._load=function(request,parent,isMain) {
      if(request===vendorPath) return {Pool:FakePool};
      return originalLoad.apply(this,arguments);
    };
    process.env.DATABASE_URL='postgresql://qa.invalid/isolated';
    const subject=new ClientEnrollmentRepository();
    const testPool=subject.connection();
    ok('PG_IDLE_ERROR_EVENT_LISTENER_INSTALLED',
       Boolean(testPool) && typeof idleErrorListener==='function');
    idleErrorListener(new Error('qa_database_restart'));
    let outageCode='';
    try {subject.connection();}
    catch(e) {outageCode=String(e?.message||'');}
    ok('PG_IDLE_ERROR_CAUSES_FAIL_CLOSED_NEXT_REQUEST',
       outageCode==='client_enrollment_database_unavailable');
    await subject.onModuleDestroy();
    ok('PG_IDLE_FAILED_POOL_CLEANUP_NO_SQL',
       poolClosed && unexpectedSQL===0);
  } finally {
    Module._load=originalLoad;
    if(originalDatabase===undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL=originalDatabase;
  }
  const calls=[];
  const identityProof={
    attest:never('PROOF_ATTEST',calls),
    start:never('PROOF_START',calls),
    check:never('PROOF_CHECK',calls),
    health:()=>({ok:true}),
  };
  const repository={
    reserve:never('POSTGRES_INSERT',calls),
    complete:never('POSTGRES_COMMIT',calls),
    flagForReview:never('POSTGRES_COMPENSATION',calls),
  };
  const keycloak={
    createClientIdentity:never('KEYCLOAK_CREATE',calls),
    activateClientIdentity:never('KEYCLOAK_ACTIVATE',calls),
    disableClientIdentity:never('KEYCLOAK_DISABLE',calls),
  };
  const module=await Test.createTestingModule({
    controllers:[ClientEnrollmentController],
    providers:[
      ClientEnrollmentService,
      {provide:IdentityProofService,useValue:identityProof},
      {provide:ClientEnrollmentRepository,useValue:repository},
      {provide:ClientEnrollmentKeycloak,useValue:keycloak},
    ],
  }).compile();
  const app=module.createNestApplication();
  app.setGlobalPrefix('api/v1');
  try {
    await app.listen(0,'127.0.0.1');
    const port=app.getHttpServer().address().port;
    const url='http://127.0.0.1:'+port+'/api/v1/client-enrollment/';
    const ready=await request(url+'readiness');
    ok('READINESS_HTTP200',ready.status===200);
    ok('READINESS_ENABLED_FALSE',ready.body?.enabled===false);
    ok('READINESS_CLIENT_ONLY',ready.body?.rolePolicy==='realm_role_client_only');
    ok('READINESS_REQUIRES_PROOFS',ready.body?.tokenPolicy==='signed_sms_and_email_required');
    ok('READINESS_NO_PAYMENTS',ready.body?.paymentAuthority==='none');
    const fakeBody={
      email:'qa-client@example.invalid',
      phone:'+32470000000',firstName:'QA',lastName:'Client',
      password:'REDACTED_NOT_A_REAL_PASSWORD',
      acceptTerms:true,requestId:'18e5265a-aaf0-4ceb-a585-43c4f79eab11',
      emailProofToken:'a'.repeat(36)+'.'+'b'.repeat(43),
      smsProofToken:'c'.repeat(36)+'.'+'d'.repeat(43),
    };
    const variants=[
      ['VALID_SHAPE',fakeBody,{}],
      ['NO_BODY',{},{}],
      ['SPOOFED_FORWARDED_HEADERS',fakeBody,maliciousRequest.headers],
      ['CLAIMED_ADMIN_ROLE',{...fakeBody,role:'admin',manageUsers:true},{}],
      ['FORGED_VERIFIED_FLAGS',{...fakeBody,emailVerified:true,smsVerified:true},{}],
    ];
    const results=await Promise.all(variants.map(([,body,headers])=>
      request(url+'register','POST',body,headers)));
    for(let i=0;i<variants.length;i++) {
      ok('REGISTER_DEFAULT_OFF_'+variants[i][0]+'_HTTP503',results[i].status===503);
      ok('REGISTER_DEFAULT_OFF_'+variants[i][0]+'_CLOSED_CODE',
         results[i].body?.code==='client_enrollment_not_ready' &&
         results[i].body?.retryable===false);
    }
    ok('ALL_FORBIDDEN_SIDES_EFFECTS_ZERO',calls.length===0);
    const other=await request(url+'unknown');
    ok('UNKNOWN_CLIENT_ENROLLMENT_ROUTE_404',other.status===404);
    const proof=new IdentityProofController(identityProof);
    // The proof and enrollment controllers must derive the same peer.
    const enroll=new ClientEnrollmentController({
      register:async (_body,peer)=>{calls.push('REGISTER_GATED_PEER:'+peer);return {ok:false};},
      readiness:()=>({enabled:false}),
    });
    const orig=identityProof.attest;
    identityProof.attest=(_body,peer)=>{calls.push('PROOF_GATED_PEER:'+peer);return {valid:false};};
    proof.attest({},maliciousRequest);
    await enroll.register({},maliciousRequest);
    ok('PROOF_AND_ENROLLMENT_IDENTICAL_PEER',
       calls.slice(-2).join('|')==='PROOF_GATED_PEER:ip:198.51.100.41|'+
                                  'REGISTER_GATED_PEER:ip:198.51.100.41');
    identityProof.attest=orig;
    ok('LOOPBACK_HTTP_ONLY',app.getHttpServer().address().address==='127.0.0.1');
    console.log('R5G_DEFAULT_OFF_HTTP_GATE=PASS_QA_TARGETED');
    console.log('R5G_PASS_COUNT='+passCount);
    console.log('R5G_REAL_IOS_ANDROID_SIGNUP=NOT_CERTIFIED');
    console.log('R5G_PRODUCTION_VPS_DEPLOYMENT=NOT_EXECUTED');
    console.log('R5G_FGAP_GLOBAL=FAIL_UNWAIVED');
    console.log('R5G_STRIPE_REAL_TEST=NOT_EXECUTED');
    console.log('R5G_NEW_STORE_RELEASE=NO_GO');
  } finally {
    await app.close();
  }
}

run().catch(e=>{
  console.error('R5G_DEFAULT_OFF_HTTP_GATE=FAIL_CLOSED');
  const message=String(e.message||e).replace(/[^A-Za-z0-9_:-]/g,'_').slice(0,130);
  console.error('R5G_FAILURE_CODE='+message);
  process.exitCode=1;
});
