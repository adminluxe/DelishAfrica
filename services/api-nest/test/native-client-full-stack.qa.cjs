#!/usr/bin/env node
'use strict';
// Keycloak 26.4.7: native Client-only registration experiment.
// Local synthetic realm, in a Docker --network none namespace. NO production.
// Never log SMTP links, verification tokens, credentials or response bodies.
const assert = require('node:assert/strict');
const net = require('node:net');
const crypto = require('node:crypto');
const http = require('node:http');
const { Client: PgClient, Pool: PgPool } = require('pg');
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { Controller, Get, Post, Req, Body, UseGuards } = require('@nestjs/common');
const { NativeClientNestCommerceGuard, NATIVE_CLIENT_COMMERCE_DEPS,
  NATIVE_CLIENT_ADMISSION_CONTEXT } =
  require('/qa-built/native-client-nest-commerce.guard.js');
const { QaClientCommercePgAdapter } =
  require('/qa-built/client-commerce.pg-qa.adapter.js');
const { NativeClientTrustedJwksResolver } =
  require('/qa-built/native-client-trusted-jwks.resolver.js');
const { startQaHttpsProxy } = require('./synthetic-keycloak-tls-proxy.qa.cjs');
const { verifyNativeClientJwt } = require('/qa-built/native-client-jwt-verifier.js');
const { nativeClientEmailBindingHmac, evaluateNativeClientCommerce } =
  require('/qa-built/native-client-commerce.policy.js');

const ROOT = 'https://127.0.0.1';
const REALM = 'da-native-client-qa';
const OTHER = 'da-business-qa';
const CLIENT_ID = 'delishafrica-native-qa';
const EMAIL = 'test-customer-' + crypto.randomBytes(5).toString('hex') + '@example.invalid';
const PASSWORD = 'SyntheticOnly!' + crypto.randomBytes(12).toString('hex');
const ADMIN_PASSWORD = process.env.QA_BOOTSTRAP_ADMIN_PASSWORD;
const say = (label, message) => console.log('QA_' + label + '=' + message);
const check = (ok, label) => {
  if (!ok) throw Error('gate_' + label);
  say('PASS', label);
};
if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
    process.env.QA_KEYCLOAK_ORIGIN !== ROOT ||
    !ADMIN_PASSWORD ||
    process.env.QA_HTTPS_ORIGIN !== ROOT ||
    process.env.NODE_EXTRA_CA_CERTS !== '/qa-tls/qa.crt' ||
    process.env.QA_PG_HOST !== '127.0.0.1' ||
    !/^[a-f0-9]{64}$/.test(process.env.QA_COMMERCE_HMAC_KEY||'')) {
  console.error('QA_FAIL=DISPOSABLE_LOCAL_CI_GUARD_REQUIRED');
  process.exit(2);
}
async function token(realm, data) {
  const response = await fetch(ROOT + '/realms/' + realm +
    '/protocol/openid-connect/token', {
      method:'POST', redirect:'manual', signal:AbortSignal.timeout(18000),
      headers: {'content-type':'application/x-www-form-urlencoded'},
      body: new URLSearchParams(data),
    });
  check(response.status === 200, 'fake_admin_token_http_200');
  const json = await response.json();
  check(typeof json.access_token === 'string', 'fake_admin_token_returned');
  return json.access_token;
}
async function admin(method, path, bearer, body) {
  check(path === '/admin/realms' || path.startsWith('/admin/realms/'), 'admin_path_local');
  const res = await fetch(ROOT + path, {
    method, redirect:'manual', signal:AbortSignal.timeout(18000),
    headers: {authorization:'Bearer '+bearer,
      ...(body === undefined ? {} : {'content-type':'application/json'})},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json().catch(()=>undefined) : undefined;
  if (!ct.includes('json')) await res.arrayBuffer();
  return {code:res.status, data};
}
function expected(actual, code, label) {
  if (actual.code !== code) {
    say('FAIL', label + '_http_' + actual.code + '_expected_' + code);
    throw Error(label);
  }
  say('PASS', label + '_http_' + code);
}
function htmlDecode(s) {
  return s.replace(/&amp;/g,'&').replace(/&quot;/g,'"')
    .replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
}
function capture(html, pattern, name) {
  const result = html.match(pattern);
  if (!result) throw Error('missing_html_' + name);
  return htmlDecode(result[1]);
}
// Minimal cookie jar: every network request remains bound to synthetic ROOT.
class Browser {
  constructor() { this.jar=new Map(); }
  async request(url, opts={}) {
    const parsed = new URL(url, ROOT);
    check(parsed.origin === ROOT, 'browser_local_origin_only');
    const cookie = [...this.jar.entries()].map(([k,v])=>k+'='+v).join('; ');
    const r=await fetch(parsed, {
      ...opts, redirect:'manual', signal:AbortSignal.timeout(18000),
      headers:{ ...(cookie ? {cookie} : {}), ...(opts.headers||{}) },
    });
    for(const raw of r.headers.getSetCookie()){
      const part=raw.split(';')[0];
      const ix=part.indexOf('=');
      if(ix>0){
        const name=part.slice(0,ix),value=part.slice(ix+1);
        if(value) this.jar.set(name,value); else this.jar.delete(name);
      }
    }
    const body=await r.text(); // never logged
    return { status:r.status, location:r.headers.get('location'), body };
  }
}
function smtpSink() {
  const accepted=[];
  const server=net.createServer(socket=>{
    socket.setEncoding('utf8');
    socket.write('220 qa.local ESMTP synthetic-only\r\n');
    let buf='',data='',inData=false;
    socket.on('data',chunk=>{
      buf+=chunk;
      let pos;
      while ((pos=buf.indexOf('\n'))>=0) {
        const raw=buf.slice(0,pos+1);buf=buf.slice(pos+1);
        const line=raw.replace(/\r?\n$/,'');
        if(inData){
          if(line==='.') {
            accepted.push(data);
            data='';inData=false;
            socket.write('250 2.0.0 QA message accepted\r\n');
          } else data+=line+'\n';
          continue;
        }
        const cmd=line.split(' ')[0].toUpperCase();
        if(cmd==='EHLO'||cmd==='HELO')socket.write('250-qa.local\r\n250 SIZE 10485760\r\n');
        else if(cmd==='MAIL'||cmd==='RCPT'||cmd==='RSET'||cmd==='NOOP')socket.write('250 2.1.0 OK\r\n');
        else if(cmd==='DATA'){inData=true;data='';socket.write('354 End data with <CR><LF>.<CR><LF>\r\n');}
        else if(cmd==='QUIT'){socket.write('221 Bye\r\n');socket.end();}
        else socket.write('502 Command not recognized\r\n');
      }
    });
  });
  return {accepted,server};
}
async function run() {
  say('MODE','NATIVE_CLIENT_OIDC_PKCE_SYNTHETIC_NO_EGRESS');
  const proxy = await startQaHttpsProxy();
  const sink=smtpSink();
  let pg = null;
  let commercePool = null;
  let nestApp = null;
  let commerceServer = null;
  let smsServer = null;
  await new Promise((resolve,reject)=>sink.server.once('error',reject)
    .listen(2525,'127.0.0.1',resolve));
  say('PASS','local_fake_smtp_sink_ready');
  try {
    const master=await token('master',{
      client_id:'admin-cli',grant_type:'password',
      username:'qa_admin',password:ADMIN_PASSWORD,
    });
    expected(await admin('POST','/admin/realms',master,{
      realm:REALM,enabled:true,registrationAllowed:true,
      registrationEmailAsUsername:true,loginWithEmailAllowed:true,
      verifyEmail:true,resetPasswordAllowed:true,duplicateEmailsAllowed:false,
      smtpServer:{host:'127.0.0.1',port:'2525',
        from:'no-reply@example.invalid',auth:'false',ssl:'false',starttls:'false'},
    }),201,'create_client_only_realm');
    expected(await admin('POST','/admin/realms',master,{
      realm:OTHER,enabled:true,registrationAllowed:false,verifyEmail:false,
    }),201,'create_business_realm_registration_disabled');
    const settings=await admin('GET','/admin/realms/'+REALM,master);
    expected(settings,200,'read_synthetic_realm');
    check(settings.data.registrationAllowed===true,'synthetic_client_registration_on');
    check(settings.data.verifyEmail===true,'synthetic_email_verification_required');
    const otherSettings=await admin('GET','/admin/realms/'+OTHER,master);
    expected(otherSettings,200,'read_separate_business_realm');
    check(otherSettings.data.registrationAllowed===false,'business_native_registration_off');
    for(const role of ['client','merchant','courier','ops']) {
      expected(await admin('POST','/admin/realms/'+REALM+'/roles',master,{
        name:role,description:'SYNTHETIC TEST ONLY',
      }),201,'fake_role_'+role);
    }
    const clientRole=await admin('GET','/admin/realms/'+REALM+'/roles/client',master);
    expected(clientRole,200,'read_client_role_for_default');
    const defaults='default-roles-'+REALM;
    expected(await admin('POST','/admin/realms/'+REALM+
      '/roles/'+defaults+'/composites',master,[clientRole.data]),204,
      'default_role_composite_client_only');
    const def=await admin('GET','/admin/realms/'+REALM+
      '/roles/'+defaults+'/composites/realm',master);
    expected(def,200,'read_realm_default_composites');
    const roleNames=new Set((def.data||[]).map(x=>x.name));
    check(roleNames.has('client'),'native_signup_receives_client_default_role');
    check(!['merchant','courier','ops','realm-admin'].some(x=>roleNames.has(x)),
      'no_elevated_default_roles');
    expected(await admin('POST','/admin/realms/'+REALM+'/clients',master,{
      clientId:CLIENT_ID,enabled:true,publicClient:true,
      standardFlowEnabled:true,directAccessGrantsEnabled:false,
      serviceAccountsEnabled:false,fullScopeAllowed:false,
      redirectUris:[ROOT+'/callback'],
      webOrigins:[],
      attributes:{'pkce.code.challenge.method':'S256'},
    }),201,'create_public_oidc_client_pkce_s256');
    // Restrict JWT-visible realm roles to the explicit Client role.
    const clients=await admin('GET','/admin/realms/'+REALM+
      '/clients?clientId='+encodeURIComponent(CLIENT_ID),master);
    expected(clients,200,'lookup_oidc_client_scope');
    const oidcClient=clients.data?.find(v=>v.clientId===CLIENT_ID);
    check(typeof oidcClient?.id==='string','oidc_client_id_for_scope');
    expected(await admin('POST','/admin/realms/'+REALM+'/clients/'+
      oidcClient.id+'/scope-mappings/realm',master,[clientRole.data]),204,
      'explicit_oidc_client_realm_scope_client_only');
    expected(await admin('POST','/admin/realms/'+REALM+
      '/clients/'+oidcClient.id+'/protocol-mappers/models',master,{
      name:'qa-client-audience',protocol:'openid-connect',
      protocolMapper:'oidc-audience-mapper',consentRequired:false,
      config:{'included.client.audience':CLIENT_ID,'access.token.claim':'true',
        'id.token.claim':'false'},
    }),201,'map_exact_client_audience_into_real_access_token');
    const browser=new Browser();
    const verifier=crypto.randomBytes(32).toString('base64url');
    const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
    const url=ROOT+'/realms/'+REALM+'/protocol/openid-connect/auth?'+
      new URLSearchParams({client_id:CLIENT_ID,
        response_type:'code',scope:'openid email profile',
        redirect_uri:ROOT+'/callback',
        state:crypto.randomBytes(16).toString('hex'),
        nonce:crypto.randomBytes(16).toString('hex'),
        code_challenge:challenge,code_challenge_method:'S256'}).toString();
    const expectedState=new URL(url).searchParams.get('state');
    const expectedNonce=new URL(url).searchParams.get('nonce');
    const initial=await browser.request(url);
    check(initial.status===200,'native_oidc_login_http_200');
    const registrationUrl=capture(initial.body,
      /id="kc-registration"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"/i,
      'native_registration_link');
    const page=await browser.request(registrationUrl);
    check(page.status===200,'native_registration_form_http_200');
    const action=capture(page.body,
      /<form[^>]*id="kc-register-form"[^>]*action="([^"]+)"/i,
      'native_form_action');
    const params=new URLSearchParams({
      firstName:'Synthetic',lastName:'Customer',email:EMAIL,
      password:PASSWORD,'password-confirm':PASSWORD,
      role:'merchant','user.attributes.role':'merchant',
    });
    // Keycloak's default registration flow can carry hidden form fields.
    const hidden=page.body.match(/<input[^>]*type="hidden"[^>]*>/gi)||[];
    for(const tag of hidden){
      const name=tag.match(/\bname="([^"]+)"/i)?.[1];
      const value=tag.match(/\bvalue="([^"]*)"/i)?.[1]||'';
      if(name && !params.has(name))params.set(htmlDecode(name),htmlDecode(value));
    }
    const posted=await browser.request(action,{
      method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
      body:params.toString(),
    });
    say('NATIVE_FORM_SUBMIT_HTTP',posted.status);
    // Keycloak completes the email-verification required action only after
    // following the registration redirect within this same synthetic realm.
    let step=posted;
    for(let n=0;n<6 && step.location;n++){
      const next=new URL(step.location, ROOT);
      check(next.origin===ROOT,'native_redirect_does_not_leave_local_keycloak');
      if(next.pathname==='/callback') throw Error('oauth_callback_before_email_proof_forbidden');
      step=await browser.request(next.href);
      say('NATIVE_REDIRECT_STEP_'+(n+1)+'_HTTP',step.status);
    }
    const users=await admin('GET','/admin/realms/'+REALM+
      '/users?email='+encodeURIComponent(EMAIL)+'&exact=true',master);
    expected(users,200,'query_synthetic_new_user');
    const customer=(users.data||[]).find(x=>x.email===EMAIL);
    check(Boolean(customer?.id),'native_signup_created_only_fake_customer');
    check(customer.emailVerified===false,
      'native_new_customer_pending_email_verification');
    const mappings=await admin('GET','/admin/realms/'+REALM+
      '/users/'+customer.id+'/role-mappings/realm/composite',master);
    expected(mappings,200,'read_native_new_customer_effective_roles');
    const current=new Set((mappings.data||[]).map(x=>x.name));
    check(current.has('client'),'native_user_has_client_role');
    check(!['merchant','courier','ops','realm-admin','admin'].some(r=>current.has(r)),
      'forged_registration_role_did_not_escalate');
    // SMTP delivery may occur asynchronously after registration/redirect.
    for(let attempts=0;attempts<30 && sink.accepted.length===0;attempts++){
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    say('FAKE_SMTP_CAPTURE_COUNT',sink.accepted.length);
    check(sink.accepted.length>=1,'verification_email_captured_in_local_fake_sink');
    check(sink.accepted.every(s=>s.includes(EMAIL)),'all_qa_mail_local_fake_recipient_only');
    // Extract a synthetic local verification link only in process memory.
    // Never log, commit, expose, or forward action tokens. No external email.
    const rawMail=sink.accepted.join('\n').replace(/=\r?\n/g,'')
      .replace(/=([0-9A-F]{2})/gi,(_,hex)=>String.fromCharCode(parseInt(hex,16)))
      .replace(/&amp;/g,'&');
    const matched=[...rawMail.matchAll(/https?:\/\/[^\s<>"']+/g)]
      .map(match=>match[0].replace(/[),.;]+$/,''))
      .filter(value=>{
        try {
          const u=new URL(value);
          return u.origin===ROOT &&
            u.pathname.startsWith('/realms/'+REALM+'/login-actions/action-token');
        }catch{return false;}
      });
    check(matched.length>0,'local_email_verification_link_present');
    const verificationLink=matched[0];
    check(new URL(verificationLink).origin===ROOT,'verification_link_local_origin_only');
    const click=await browser.request(verificationLink);
    say('SYNTHETIC_VERIFY_EMAIL_CLICK_HTTP',click.status);
    let follow=click;
    let callback=null;
    for(let n=0;n<5 && follow.location;n++){
      const u=new URL(follow.location,ROOT);
      check(u.origin===ROOT,'verification_redirect_stays_local');
      if(u.pathname==='/callback'){callback=u;break;}
      follow=await browser.request(u.href);
      say('SYNTHETIC_VERIFY_REDIRECT_HTTP_'+(n+1),follow.status);
    }
    let verified=false;
    for(let i=0;i<10;i++){
      const state=await admin('GET','/admin/realms/'+REALM+
        '/users/'+customer.id,master);
      expected(state,200,'read_synthetic_user_verification_state');
      if(state.data?.emailVerified===true){verified=true;break;}
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    check(verified,'clicked_email_link_verifies_synthetic_user');
    const afterRoles=await admin('GET','/admin/realms/'+REALM+
      '/users/'+customer.id+'/role-mappings/realm/composite',master);
    expected(afterRoles,200,'roles_after_email_verification');
    const afterSet=new Set((afterRoles.data||[]).map(x=>x.name));
    check(afterSet.has('client'),'verified_user_keeps_only_client_business_role');
    check(!['merchant','courier','ops','realm-admin','admin']
      .some(role=>afterSet.has(role)),'verified_user_no_privilege_escalation');
    check(callback instanceof URL,'oauth_callback_after_verified_email');
    check(callback.searchParams.get('state')===expectedState,'oidc_state_bound_to_original_session');
    const authorizationCode=callback.searchParams.get('code');
    check(typeof authorizationCode==='string'&&authorizationCode.length>16,
      'oidc_authorization_code_issued_after_email_proof');
    const tokenEndpoint=ROOT+'/realms/'+REALM+'/protocol/openid-connect/token';
    const payload={grant_type:'authorization_code',client_id:CLIENT_ID,
      code:authorizationCode,redirect_uri:ROOT+'/callback',code_verifier:verifier};
    const tokenResponse=await fetch(tokenEndpoint,{
      method:'POST',redirect:'manual',signal:AbortSignal.timeout(18000),
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(payload),
    });
    check(tokenResponse.status===200,'pkce_s256_real_code_exchange_http_200');
    const tokens=await tokenResponse.json(); // never logged
    check(typeof tokens.id_token==='string' &&
      typeof tokens.access_token==='string','real_keycloak_signed_jwts_received');
    // Verify both JWT signatures against JWKS from THIS synthetic issuer.
    const keysResponse=await fetch(ROOT+'/realms/'+REALM+
      '/protocol/openid-connect/certs',{signal:AbortSignal.timeout(18000)});
    check(keysResponse.status===200,'local_jwks_endpoint_http_200');
    const jwks=await keysResponse.json();
    function verifiedClaims(jwt,label){
      const parts=jwt.split('.');
      check(parts.length===3,'jwt_three_segments_'+label);
      const head=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
      const claim=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'));
      check(head.alg==='RS256' && typeof head.kid==='string',
        'jwt_rs256_header_'+label);
      const key=jwks.keys?.find(x=>x.kid===head.kid && x.kty==='RSA');
      check(Boolean(key),'jwt_known_key_'+label);
      const pub=crypto.createPublicKey({key,format:'jwk'});
      check(crypto.verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),
        pub,Buffer.from(parts[2],'base64url')),'jwt_real_signature_'+label);
      check(claim.iss===ROOT+'/realms/'+REALM,'jwt_isolated_issuer_'+label);
      const now=Math.floor(Date.now()/1000);
      check(Number.isInteger(claim.exp)&&claim.exp>now,'jwt_future_exp_'+label);
      check(Number.isInteger(claim.iat)&&claim.iat<=now+60,'jwt_sane_iat_'+label);
      check(claim.sub===customer.id,'jwt_subject_matches_fake_customer_'+label);
      return claim;
    }
    const idClaims=verifiedClaims(tokens.id_token,'id');
    const accessClaims=verifiedClaims(tokens.access_token,'access');
    const audiences=typeof idClaims.aud==='string'?[idClaims.aud]:idClaims.aud;
    check(Array.isArray(audiences)&&audiences.includes(CLIENT_ID),
      'oidc_id_token_correct_client_audience');
    check(idClaims.email_verified===true,'oidc_id_token_verified_email_proven');
    check(idClaims.nonce===expectedNonce,'oidc_nonce_matches_original_request');
    check(accessClaims.azp===CLIENT_ID,'access_token_authorized_party');
    const realmAccess=accessClaims.realm_access?.roles || [];
    check(realmAccess.includes('client'),'access_token_client_role_present');
    check(!realmAccess.some(x=>['merchant','courier','ops','realm-admin','admin'].includes(x)),
      'access_token_no_privileged_realm_role');
    const replay=await fetch(tokenEndpoint,{
      method:'POST',redirect:'manual',signal:AbortSignal.timeout(18000),
      headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams(payload),
    });
    check(replay.status===400,'authorization_code_replay_rejected_http_400');
    await replay.arrayBuffer(); // avoid logging token endpoint response

    // Unlike previous component tests, the JWT BELOW is the actual access
    // token from Keycloak after native sign-up, email and PKCE. It is never
    // printed, written to disk, sent off-container or given to a fake signer.
    const realJwt = tokens.access_token;
    const issuer = ROOT+'/realms/'+REALM;
    const trust = {
      issuer, audience:CLIENT_ID, clientId:CLIENT_ID,
      nowSeconds:Math.floor(Date.now()/1000), maxTokenLifetimeSeconds:3600,
    };
    const pinned = { issuer, provenanceVerified:true, keys:jwks.keys };
    // The issuer-specific JWKS must come from exact trusted HTTPS discovery.
    const discovery = await fetch(issuer+'/.well-known/openid-configuration',
      {signal:AbortSignal.timeout(18000)});
    check(discovery.status===200,'issuer_https_discovery_tls_verified');
    const config = await discovery.json();
    check(config.issuer===issuer,'openid_issuer_exact_configured_match');
    check(config.jwks_uri===issuer+'/protocol/openid-connect/certs',
      'jwks_uri_exact_issuer_bound');
    const verifiedAccess=verifyNativeClientJwt(realJwt,pinned,trust);
    check(verifiedAccess.ok===true,'actual_keycloak_access_jwt_passes_DA_RSA_issuer_verifier');
    check(verifiedAccess.evidence.claims.email===EMAIL,
      'actual_access_token_email_claim_bound_to_client');
    check(verifiedAccess.evidence.claims.email_verified===true,
      'actual_access_token_verified_email_claim');
    check(verifiedAccess.evidence.claims.aud?.includes(CLIENT_ID),
      'actual_access_token_correct_explicit_audience');

    pg = new PgClient({host:'127.0.0.1',port:5432,user:'postgres',
      database:'postgres',connectionTimeoutMillis:12000,
      statement_timeout:12000,query_timeout:12000});
    await pg.connect();
    check((await pg.query('SELECT 1 AS ok')).rows[0].ok===1,
      'same_network_ephemeral_postgresql_connection');
    commercePool=new PgPool({host:'127.0.0.1',port:5432,user:'postgres',
      database:'postgres',max:8,connectionTimeoutMillis:10000,
      statement_timeout:12000,query_timeout:12000});
    const clientCommerceAdapter=new QaClientCommercePgAdapter(
      commercePool,process.env.QA_COMMERCE_HMAC_KEY);
    // The canonical quote below is generated server-side in QA; body.quote,
    // price, role, subject or issuer can never override these values.
    const qaCanonicalQuote=Object.freeze({
      source:'server-canonical-catalog',
      quoteFingerprint:'a'.repeat(64),
      cartFingerprint:'b'.repeat(64),
      merchantSlug:'qa-merchant',totalMinor:1200,currency:'EUR',
    });
    const emailSecret=process.env.QA_EMAIL_HMAC_SECRET;
    check(typeof emailSecret==='string' && emailSecret.length>=64,
      'ephemeral_hmac_secret_present');
    const emailHash=nativeClientEmailBindingHmac(emailSecret,EMAIL);
    const phoneHash=crypto.createHmac('sha256',emailSecret)
      .update('qa-only-synthetic-sms-number-v1\0+999000000000')
      .digest('hex');
    await pg.query('INSERT INTO public.da_native_client_admissions '+
      '(issuer,subject_id,email_binding_hmac) VALUES ($1,$2,$3)',
      [issuer,customer.id,emailHash]);

    const policyTrust={issuer,clientId:CLIENT_ID,audience:CLIENT_ID,
      emailHmacSecret:emailSecret,nowSeconds:0};
    commerceServer=http.createServer(async(req,res)=>{
      if(req.method!=='GET'||req.url!=='/qa/commerce/check'){
        res.writeHead(404);res.end();return;
      }
      const header=req.headers.authorization||'';
      if(!header.startsWith('Bearer ')||header.length>33000){
        res.writeHead(401);res.end();return;
      }
      try {
        const now=Math.floor(Date.now()/1000);
        const v=verifyNativeClientJwt(header.slice(7),pinned,
          {...trust,nowSeconds:now});
        if(!v.ok){res.writeHead(401);res.end();return;}
        const result=await pg.query(
          'SELECT * FROM public.da_native_client_admissions '+
          'WHERE issuer=$1 AND subject_id=$2 LIMIT 1',
          [issuer,v.evidence.claims.sub],
        );
        const row=result.rows[0];
        const ledger=row?{
          schemaVersion:row.version,status:row.status,subjectId:row.subject_id,
          emailBindingHmac:row.email_binding_hmac.trim(),
          smsRecipientHmac:row.sms_recipient_hmac?.trim()||'',
          smsVerifiedSubjectId:row.sms_provider_verified?row.subject_id:'',
          emailVerifiedSubjectId:row.email_server_verified?row.subject_id:'',
          providerSmsProofAccepted:row.sms_provider_verified===true,
          providerEmailProofAccepted:row.email_server_verified===true,
          transactionCommittedAtSeconds:row.committed_at?
            Math.floor(new Date(row.committed_at).getTime()/1000):0,
          revokedAtSeconds:row.revoked_at?
            Math.floor(new Date(row.revoked_at).getTime()/1000):null,
        }:null;
        const denial=evaluateNativeClientCommerce(v.evidence,ledger,
          {...policyTrust,nowSeconds:now});
        res.writeHead(denial?403:200,{'cache-control':'no-store'});
        res.end();
      }catch{
        res.writeHead(503);res.end();
      }
    });
    await new Promise((resolve,reject)=>
      commerceServer.once('error',reject).listen(19601,'127.0.0.1',resolve));
    // Second, completely separate HTTP admission path using the ACTUAL NestJS
    // guard implementation with the SAME real Keycloak access token and SAME
    // committed PostgreSQL record. No Nest production route is imported.
    let mockJwksDown=false, mockDbDown=false;
    const trustedResolver=new NativeClientTrustedJwksResolver(issuer);
    check(trustedResolver.issuer===issuer,'server_configured_client_issuer');
    let invalidIssuerBlocked=false;
    try{new NativeClientTrustedJwksResolver('http://127.0.0.1/realms/wrong')}
    catch{invalidIssuerBlocked=true}
    check(invalidIssuerBlocked,'jwks_client_http_downgrade_rejected');
    class QaNestController {
      check() { return {admitted:true,scenario:'synthetic-only'}; }
      async reserve(request,body={}) {
        const approved=request[NATIVE_CLIENT_ADMISSION_CONTEXT];
        if(!approved)throw Error('qa_guard_identity_context_missing');
        const order=await clientCommerceAdapter.reserveOrder(
          approved,qaCanonicalQuote,body.clientMutationId);
        const payment=await clientCommerceAdapter.reserveTestPayment(
          approved,order.orderId);
        return {ok:true,orderId:order.orderId,totalMinor:order.totalMinor,
          issuer:order.issuer,clientSubject:order.clientSubject,
          stripeIdempotencyKey:payment.stripeIdempotencyKey,
          stripeMode:payment.stripeMode,paymentState:payment.state};
      }
    }
    Controller('qa/native')(QaNestController);
    const nestDescriptor=Object.getOwnPropertyDescriptor(
      QaNestController.prototype,'check');
    Get('commerce')(QaNestController.prototype,'check',nestDescriptor);
    UseGuards(NativeClientNestCommerceGuard)(
      QaNestController.prototype,'check',nestDescriptor);
    const reserveDescriptor=Object.getOwnPropertyDescriptor(
      QaNestController.prototype,'reserve');
    Post('reserve')(QaNestController.prototype,'reserve',reserveDescriptor);
    Req()(QaNestController.prototype,'reserve',0);
    Body()(QaNestController.prototype,'reserve',1);
    UseGuards(NativeClientNestCommerceGuard)(
      QaNestController.prototype,'reserve',reserveDescriptor);
    const nestedDeps={
      issuer,clientId:CLIENT_ID,audience:CLIENT_ID,
      emailHmacSecret:emailSecret,maxTokenLifetimeSeconds:3600,
      async loadTrustedJwks(){
        if(mockJwksDown)throw Error('qa_forced_jwks_outage');
        try { return await trustedResolver.loadTrustedJwks(); }
        catch (error) {
          // QA only: report fixed resolver error code, never URL/token/JWK body.
          say('TRUSTED_JWKS_REJECT_REASON',
            String(error?.message||'unknown').replace(/[^A-Za-z0-9_-]/g,'_').slice(0,90));
          throw error;
        }
      },
      async readCommittedAdmission(readIssuer,subjectId){
        if(mockDbDown)throw Error('qa_forced_pg_outage');
        if(readIssuer!==issuer)throw Error('qa_cross_realm_query_blocked');
        const result=await pg.query(
          'SELECT * FROM public.da_native_client_admissions '+
          'WHERE issuer=$1 AND subject_id=$2 LIMIT 1',
          [readIssuer,subjectId]);
        const row=result.rows[0];
        if(!row)return null;
        return {
          schemaVersion:row.version,status:row.status,subjectId:row.subject_id,
          emailBindingHmac:row.email_binding_hmac.trim(),
          smsRecipientHmac:row.sms_recipient_hmac?.trim()||'',
          smsVerifiedSubjectId:row.sms_provider_verified?row.subject_id:'',
          emailVerifiedSubjectId:row.email_server_verified?row.subject_id:'',
          providerSmsProofAccepted:row.sms_provider_verified===true,
          providerEmailProofAccepted:row.email_server_verified===true,
          transactionCommittedAtSeconds:row.committed_at?
            Math.floor(new Date(row.committed_at).getTime()/1000):0,
          revokedAtSeconds:row.revoked_at?
            Math.floor(new Date(row.revoked_at).getTime()/1000):null,
        };
      },
    };
    const nestModule=await Test.createTestingModule({
      controllers:[QaNestController],
      providers:[NativeClientNestCommerceGuard,
        {provide:NATIVE_CLIENT_COMMERCE_DEPS,useValue:nestedDeps}],
    }).compile();
    nestApp=nestModule.createNestApplication({logger:false});
    await nestApp.listen(19603,'127.0.0.1');
    const checkNest=async(token,status,label)=>{
      const res=await fetch('http://127.0.0.1:19603/qa/native/commerce',{
        signal:AbortSignal.timeout(18000),
        headers:token?{authorization:'Bearer '+token}:{},
      });
      if(res.status!==status)say('NEST_EXPECTED_ACTUAL_HTTP',label+'_'+status+'_'+res.status);
      check(res.status===status,label+'_http_'+status);
      await res.arrayBuffer();
    };
    await checkNest('',401,'nestjs_keycloak_missing_bearer_denied');
    await checkNest(realJwt+'tamper',401,'nestjs_actual_keycloak_jwt_tamper_denied');
    await checkNest(realJwt,403,'nestjs_actual_keycloak_jwt_pending_sms_denied');
    const qaMutation='native-full-stack-qa-mutation-001';
    const hostileClientBody={
      clientMutationId:qaMutation,issuer:'https://attacker.example.invalid/realms/other',
      subject:crypto.randomUUID(),role:'ops',
      totalMinor:1,currency:'USD',
      quote:{source:'mobile-body',totalMinor:1,quoteFingerprint:'c'.repeat(64)},
    };
    const reserveNest=async(token,body,expectedStatus,label)=>{
      const res=await fetch('http://127.0.0.1:19603/qa/native/reserve',{
        method:'POST',signal:AbortSignal.timeout(18000),
        headers:{'content-type':'application/json',
          ...(token?{authorization:'Bearer '+token}:{})},
        body:JSON.stringify(body),
      });
      if(res.status!==expectedStatus)
        say('NEST_RESERVATION_STATUS_DIAGNOSTIC',
          label+'_'+expectedStatus+'_'+res.status);
      check(res.status===expectedStatus,label+'_http_'+expectedStatus);
      const payload=res.status===201?await res.json():null;
      if(!payload)await res.arrayBuffer();
      return payload;
    };
    await reserveNest('',hostileClientBody,401,
      'nestjs_pg_commerce_no_token_no_order');
    await reserveNest(realJwt+'tamper',hostileClientBody,401,
      'nestjs_pg_commerce_tampered_token_no_order');
    await reserveNest(realJwt,hostileClientBody,403,
      'nestjs_pg_commerce_unapproved_sms_no_order');
    check((await pg.query('SELECT count(*)::int AS n FROM '+
      'public.da_client_commerce_orders_qa')).rows[0].n===0,
      'nestjs_pg_commerce_denied_requests_zero_db_orders');

    const checkCommerce=async(token,expectedStatus,label)=>{
      const res=await fetch('http://127.0.0.1:19601/qa/commerce/check',{
        method:'GET',signal:AbortSignal.timeout(18000),
        headers:token?{authorization:'Bearer '+token}:{},
      });
      check(res.status===expectedStatus,label+'_http_'+expectedStatus);
      await res.arrayBuffer();
    };
    await checkCommerce('',401,'commerce_missing_auth_rejected');
    await checkCommerce(realJwt+'invalid',401,'commerce_tampered_keycloak_jwt_rejected');
    await checkCommerce(realJwt,403,'commerce_pending_sms_ledger_rejected');
    // Mock provider is on localhost inside the same disconnected namespace.
    // Real SMS messages, phone numbers and providers are never contacted.
    const otp=crypto.randomInt(100000,999999).toString();
    const nonce=crypto.randomBytes(18).toString('hex');
    const used=new Set();
    smsServer=http.createServer((req,res)=>{
      if(req.method!=='POST'||req.url!=='/qa/mock-sms/confirm'){
        res.writeHead(404);res.end();return;
      }
      const chunks=[];
      req.on('data',part=>{
        chunks.push(part);
        if(Buffer.concat(chunks).length>1024)req.destroy();
      });
      req.on('end',()=>{
        let payload=null;
        try{payload=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{}
        if(!payload||payload.subject!==customer.id||payload.recipient!==phoneHash){
          res.writeHead(403);res.end();return;
        }
        if(used.has(nonce)){res.writeHead(409);res.end();return;}
        if(payload.otp!==otp){res.writeHead(403);res.end();return;}
        used.add(nonce);
        const proof=crypto.createHmac('sha256',emailSecret)
          .update('ephemeral-sms-provider-receipt-v1\0'+nonce)
          .digest('hex');
        res.writeHead(200,{'content-type':'application/json'});
        res.end(JSON.stringify({proof}));
      });
    });
    await new Promise((resolve,reject)=>
      smsServer.once('error',reject).listen(19602,'127.0.0.1',resolve));
    const verifySms=async(code,subject,recipient)=>{
      const res=await fetch('http://127.0.0.1:19602/qa/mock-sms/confirm',{
        method:'POST',signal:AbortSignal.timeout(18000),
        headers:{'content-type':'application/json'},
        body:JSON.stringify({otp:code,subject,recipient}),
      });
      const data=res.status===200?await res.json():null;
      return {status:res.status,data};
    };
    check((await verifySms('000000',customer.id,phoneHash)).status===403,
      'mock_sms_invalid_otp_rejected');
    check((await verifySms(otp,crypto.randomUUID(),phoneHash)).status===403,
      'mock_sms_cross_subject_rejected');
    check((await verifySms(otp,customer.id,'f'.repeat(64))).status===403,
      'mock_sms_wrong_recipient_rejected');
    await checkCommerce(realJwt,403,'commerce_no_sms_after_failed_challenges');
    const smsProof=await verifySms(otp,customer.id,phoneHash);
    check(smsProof.status===200 && /^[0-9a-f]{64}$/.test(smsProof.data.proof),
      'mock_sms_one_time_provider_proof_issued');
    check((await verifySms(otp,customer.id,phoneHash)).status===409,
      'mock_sms_proof_replay_rejected');
    await pg.query(
      'UPDATE public.da_native_client_admissions SET status=$1, '+
      'email_server_verified=true,sms_provider_verified=true,'+
      'email_verified_at=statement_timestamp(), '+
      'sms_verified_at=statement_timestamp(), '+
      'sms_recipient_hmac=$2,sms_provider_proof_hmac=$3, '+
      'committed_at=statement_timestamp() WHERE issuer=$4 AND subject_id=$5',
      ['approved',phoneHash,smsProof.data.proof,issuer,customer.id],
    );
    await checkCommerce(realJwt,200,
      'commerce_approved_only_after_verified_real_oidc_and_real_pg_commit');
    await checkNest(realJwt,200,
      'nestjs_real_keycloak_jwt_real_pg_after_mock_sms_admitted');
    const firstCommerce=await reserveNest(realJwt,hostileClientBody,201,
      'nestjs_real_keycloak_guard_actual_pg_order_payment_reserved');
    const replayCommerce=await reserveNest(realJwt,hostileClientBody,201,
      'nestjs_real_keycloak_guard_replayed_same_commerce_operation');
    check(firstCommerce.orderId===replayCommerce.orderId &&
      firstCommerce.stripeIdempotencyKey===replayCommerce.stripeIdempotencyKey,
      'actual_keycloak_verified_identity_sql_commerce_idempotency_same_provider_key');
    check(firstCommerce.totalMinor===1200 &&
      firstCommerce.clientSubject===customer.id &&
      firstCommerce.issuer===issuer &&
      firstCommerce.stripeMode==='test' &&
      firstCommerce.paymentState==='reserved',
      'request_body_cannot_spoof_signed_identity_price_or_stripe_mode');
    const financialRecord=await pg.query(
      'SELECT o.total_minor,o.client_subject,o.issuer, '+
      'COUNT(p.authority_id)::int AS payments FROM '+
      'public.da_client_commerce_orders_qa o '+
      'INNER JOIN public.da_client_commerce_payment_authority_qa p '+
      'ON p.order_id=o.order_id WHERE o.order_id=$1 '+
      'GROUP BY o.total_minor,o.client_subject,o.issuer',
      [firstCommerce.orderId]);
    check(financialRecord.rows.length===1 &&
      String(financialRecord.rows[0].total_minor)==='1200' &&
      financialRecord.rows[0].client_subject===customer.id &&
      financialRecord.rows[0].payments===1,
      'same_real_keycloak_subject_exactly_one_postgresql_order_and_payment_authority');
    say('NATIVE_KEYCLOAK_NEST_PG_COMMERCE',
      'PASS_SIGNED_CLIENT_JWT_GUARD_SYMBOL_SQL_ORDER_AND_ONE_STRIPE_TEST_RESERVATION');
    const resolverSnapshot=await trustedResolver.loadTrustedJwks();
    check(resolverSnapshot.provenanceVerified===true &&
      resolverSnapshot.issuer===issuer &&
      resolverSnapshot.keys.length>0,
      'production_candidate_jwks_resolver_real_https_verified_and_cached');
    const other=crypto.randomUUID();
    const duplicate=await pg.query(
      'INSERT INTO public.da_native_client_admissions '+
      '(issuer,subject_id,email_binding_hmac) VALUES ($1,$2,$3) RETURNING subject_id',
      [issuer,other,nativeClientEmailBindingHmac(emailSecret,
        'second-client@example.invalid')],
    );
    check(duplicate.rowCount===1,'second_synthetic_subject_pending');
    let replayProofRejected=false;
    try {
      await pg.query(
        'UPDATE public.da_native_client_admissions SET status=$1,'+
        'email_server_verified=true,sms_provider_verified=true,'+
        'email_verified_at=statement_timestamp(),'+
        'sms_verified_at=statement_timestamp(),'+
        'sms_recipient_hmac=$2,sms_provider_proof_hmac=$3,'+
        'committed_at=statement_timestamp() WHERE issuer=$4 AND subject_id=$5',
        ['approved',phoneHash,smsProof.data.proof,issuer,other],
      );
    }catch(e){replayProofRejected=e.code==='23505';}
    check(replayProofRejected,'same_mock_provider_proof_other_subject_pg_unique_rejected');
    await pg.query('UPDATE public.da_native_client_admissions '+
      'SET status=$1,revoked_at=statement_timestamp() '+
      'WHERE issuer=$2 AND subject_id=$3',
      ['revoked',issuer,customer.id]);
    await checkCommerce(realJwt,403,'commerce_revoked_subject_http_403');
    await checkNest(realJwt,403,'nestjs_real_keycloak_jwt_revoked_pg_denied');
    await reserveNest(realJwt,{clientMutationId:'qa-after-revocation-002'},
      403,'nestjs_commerce_revoked_client_no_new_order_or_payment');
    check((await pg.query('SELECT count(*)::int AS n FROM '+
      'public.da_client_commerce_orders_qa')).rows[0].n===1,
      'nestjs_revoked_client_does_not_create_any_new_orders');
    mockDbDown=true;
    await checkNest(realJwt,503,'nestjs_pg_unavailable_fail_closed');
    mockDbDown=false;
    mockJwksDown=true;
    await checkNest(realJwt,503,'nestjs_jwks_unavailable_fail_closed');
    mockJwksDown=false;
    say('NATIVE_NEST_KEYCLOAK_PG_QA',
      'PASS_REAL_KEYCLOAK_SIGNED_JWT_REAL_NEST_GUARD_REAL_PG_MOCK_SMS');
    let unRevokeRejected=false;
    try{
      await pg.query('UPDATE public.da_native_client_admissions '+
        'SET status=$1,revoked_at=NULL WHERE issuer=$2 AND subject_id=$3',
        ['approved',issuer,customer.id]);
    }catch(e){unRevokeRejected=e.message==='native_revoked_identity_cannot_reactivate';}
    check(unRevokeRejected,'revocation_is_monotonic_in_real_pg');
    say('NATIVE_FULL_STACK_QA',
      'PASS_REAL_KEYCLOAK_JWT_TLS_REAL_POSTGRES_FAKE_SMS_HTTP');
    say('SMS_PROVIDER','LOCAL_MOCK_ONLY_NO_LIVE_SMS');
    say('MOBILE_APP_AND_COMMERCE_ROUTES','NOT_WIRED_NO_GO');

    say('SYNTHETIC_OIDC_PKCE_RESULT','REAL_SIGNED_JWTS_EMAIL_VERIFIED_CLIENT_ONLY');
    say('REAL_DEVICE_SMTP_SMS_LEDGER','NOT_TESTED_PUBLIC_GO_FORBIDDEN');
    say('NATIVE_EMAIL_VERIFICATION_RESULT','REAL_ACTION_TOKEN_CONFIRMED_IN_SYNTHETIC_QA');
    say('REAL_EMAIL_DELIVERY','NOT_TESTED_ONLY_LOCAL_FAKE_SMTP');
    say('REAL_SMS_ATTESTATION','NOT_TESTED');
    say('PUBLIC_CLIENT_ENROLLMENT','NO_GO_NO_SMS_LEDGER_QA_DEVICE');
    say('NATIVE_REGISTRATION_RESULT','PASS_UNVERIFIED_CLIENT_ONLY_SYNTHETIC');
    say('SMTP_RESULT','LOCAL_ONLY_NO_EXTERNAL_DELIVERY');
    say('PUBLIC_CLIENT_ENROLLMENT','NO_GO_NO_SMS_LEDGER_QA_DEVICE');
  } finally {
    await new Promise(resolve=>sink.server.close(resolve));
    if(commerceServer){
      commerceServer.closeAllConnections();
      await new Promise(resolve=>commerceServer.close(resolve));
    }
    if(smsServer){
      smsServer.closeAllConnections();
      await new Promise(resolve=>smsServer.close(resolve));
    }
    if(nestApp)await nestApp.close();
    if(commercePool)await commercePool.end();
    if(pg)await pg.end();
    await proxy.close();
  }
}
run().catch(e=>{
  console.error('QA_NATIVE_RESULT=NO_GO_'+String(e.message||'unknown')
    .replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100));
  process.exitCode=1;
});
