'use strict';
/**
 * DelishAfrica F4E / QA 010. REAL disconnected PG17, SYNTHETIC identities.
 * Requires migrations 001..010 and 009 Node fixture first.
 * DO NOT connect to production, Stripe, Keycloak, network, or a real PSP.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');

if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1'||
   process.env.QA_COMMERCE_DB_NAME!=='postgres'){
  throw Error('QA_010_DISCONNECTED_POSTGRES_ONLY');
}
const settings={host:'127.0.0.1',port:5432,database:'postgres',
  connectionTimeoutMillis:5000,statement_timeout:8000,query_timeout:8000};
const db=(user)=>new Pool({...settings,user,max:4});
const admin=db('postgres');
const attestor=db('da_qa_wallet_attestor_010');
const merchantPool=db('da_qa_merchant_commerce_app');
const courierPool=db('da_qa_courier_commerce_app');
const mIssuer='https://qa.example.invalid/realms/da-merchant';
const cIssuer='https://qa.example.invalid/realms/da-courier';
const mA='b63f867f-9f42-4573-9268-dc65a164d2c2';
const mB='b63f867f-9f42-4573-9268-dc65a164d2c4';
const cA='c63f867f-9f42-4573-9268-dc65a164d2c3';
const cB='c63f867f-9f42-4573-9268-dc65a164d2c4';
const orgA='a43f867f-9f42-4573-9268-dc65a164d2c2';
const orgB='a43f867f-9f42-4573-9268-dc65a164d2c4';

const attest=async(challenge,issuer,subject,slug,org,territory)=>
  (await attestor.query(
    'SELECT public.da_qa_wallet_attest_010('+
    '$1::uuid,$2::text,$3::uuid,$4::varchar,$5::uuid,$6::char(2)) AS ticket',
    [challenge,issuer,subject,slug,org,territory])).rows[0].ticket;
const challenge=async(client)=>
  (await client.query(
    'SELECT public.da_qa_wallet_begin_scope_010() AS challenge'
  )).rows[0].challenge;
const read=async(client,ticket,limit=20)=>
  (await client.query(
    'SELECT public.da_qa_wallet_read_attested_010('+
    '$1::uuid,$2::integer) AS report',[ticket,limit]
  )).rows[0].report;

async function sqlDenied(promise,re){
  await assert.rejects(promise,(e)=>{
    assert.match(String(e?.message),re);
    return true;
  });
}
async function seed(){
  await admin.query(
    "INSERT INTO public.da_qa_wallet_policy("+
    "policy_id,merchant_slug,currency,merchant_fee_bps,courier_delivery_bps)"+
    " VALUES ('QA_OTHER_EUR_V1','qa-other','EUR',2000,10000)");
  await admin.query(
    "INSERT INTO public.da_qa_wallet_slug_owner_010("+
    "merchant_slug,organization_id,territory)"+
    " VALUES('qa-restaurant',$1::uuid,'BE'),('qa-other',$2::uuid,'FR')",
    [orgA,orgB]);
  await admin.query(
    "INSERT INTO public.da_qa_wallet_merchant_scope_010("+
    "issuer,subject,merchant_slug,organization_id,territory,"+
    "membership_status,contract_status,kyb_status,partner_state,valid_from)"+
    " VALUES($1,$2::uuid,'qa-restaurant',$3::uuid,'BE',"+
    "'active','active','verified','published',now()-interval '1 day'),"+
    "($1,$4::uuid,'qa-other',$5::uuid,'FR',"+
    "'active','active','verified','published',now()-interval '1 day')",
    [mIssuer,mA,orgA,mB,orgB]);
  await admin.query(
    "INSERT INTO public.da_qa_wallet_courier_scope_010("+
    "issuer,subject,organization_id,territory,"+
    "roster_active,agreement_status,kyc_status,valid_from)"+
    " VALUES($1,$2::uuid,$3::uuid,'BE',true,'active','verified',now()-interval '1 day'),"+
    "($1,$4::uuid,$5::uuid,'FR',true,'active','verified',now()-interval '1 day'),"+
    "($6,$2::uuid,$5::uuid,'FR',true,'active','verified',now()-interval '1 day')",
    [cIssuer,cA,orgA,cB,orgB,'https://qa.other.invalid/realms/da-courier']);
}

test('F4E 010: backend-bound SQL wallet scope denies interpartner identity spoofing',async()=>{
  let merchant;
  let courier;
  let merchantOther;
  let courierOther;
  try{
    await seed();
    merchant=await merchantPool.connect();
    courier=await courierPool.connect();
    merchantOther=await merchantPool.connect();
    courierOther=await courierPool.connect();

    const ledger=await admin.query(
      "SELECT count(*)::int AS n FROM public.da_qa_wallet_allocation "+
      "WHERE merchant_slug='qa-restaurant'");
    assert.equal(ledger.rows[0].n,1,'requires prior 009 captured QA journal');

    const owners=await admin.query(
      "SELECT rolname,rolcanlogin,rolsuper,rolcreaterole "+
      "FROM pg_catalog.pg_roles WHERE rolname IN("+
      "'da_qa_wallet_read_owner_010','da_qa_wallet_write_owner_010')");
    assert.equal(owners.rows.length,2);
    for(const owner of owners.rows){
      assert.equal(owner.rolcanlogin,false);
      assert.equal(owner.rolsuper,false);
      assert.equal(owner.rolcreaterole,false);
    }
    console.log('QA_010_SQL_OWNERS=NOLOGIN_NON_SUPERUSER');

    for(const [pool0,signature] of [
      [merchantPool,"public.da_qa_wallet_merchant_summary(character varying)"],
      [merchantPool,"public.da_qa_wallet_merchant_activity(character varying,integer)"],
      [courierPool,"public.da_qa_wallet_courier_summary(text,uuid)"],
      [courierPool,"public.da_qa_wallet_courier_activity(text,uuid,integer)"],
      [merchantPool,"public.da_qa_merchant_transition(uuid,character varying,text)"],
      [courierPool,"public.da_qa_courier_transition(uuid,text,uuid,text)"],
    ]){
      const check=await pool0.query(
        'SELECT pg_catalog.has_function_privilege(current_user,$1,$2) AS allowed',
        [signature,'EXECUTE']);
      assert.equal(check.rows[0].allowed,false,signature);
    }
    await sqlDenied(
      merchant.query('SELECT * FROM public.da_qa_wallet_allocation'),
      /permission denied/i);
    await sqlDenied(
      courier.query('SELECT * FROM public.da_qa_wallet_ticket_010'),
      /permission denied/i);
    await sqlDenied(
      merchant.query('SELECT public.da_qa_wallet_attest_010('+
        'NULL::uuid,NULL::text,NULL::uuid,NULL::varchar,NULL::uuid,NULL::char(2))'),
      /permission denied/i);
    console.log('QA_010_OLD_IDENTITY_PARAMETERS_AND_DIRECT_LEDGER=DENIED');

    const chA=await challenge(merchant);
    await sqlDenied(read(merchant,chA),/ticket_expired_or_replayed/i);
    await sqlDenied(attest(chA,mIssuer,mA,'qa-other',orgB,'FR'),
      /qa_scope_registry_denied/i);
    await sqlDenied(attest(chA,mIssuer,mA,'qa-restaurant',orgB,'BE'),
      /qa_scope_registry_denied/i);
    await sqlDenied(attest(chA,mIssuer,mA,'qa-restaurant',orgA,'FR'),
      /qa_scope_registry_denied/i);
    await sqlDenied(attest(chA,'https://qa.other.invalid/realms/da-merchant',
      mA,'qa-restaurant',orgA,'BE'),/qa_scope_registry_denied/i);
    await sqlDenied(attest(chA,mIssuer,mA,null,orgA,'BE'),
      /qa_scope_merchant_invalid/i);
    const ticketA=await attest(chA,mIssuer,mA,'qa-restaurant',orgA,'BE');

    await sqlDenied(read(merchantOther,ticketA),/qa_scope_postgres_session_mismatch/i);
    await sqlDenied(read(courier,ticketA),/qa_scope_postgres_session_mismatch/i);
    const walletA=await read(merchant,ticketA);
    assert.equal(walletA.ownerRole,'merchant');
    assert.equal(walletA.merchantSlug,'qa-restaurant');
    assert.equal(walletA.territory,'BE');
    assert.equal(walletA.summary.accrued_minor,1840);
    assert.equal(walletA.summary.held_minor,1840);
    assert.equal(walletA.summary.withdrawable_minor,0);
    assert.equal(walletA.summary.payout_enabled,false);
    assert.equal(walletA.activity.length,1);
    await sqlDenied(read(merchant,ticketA),/qa_scope_ticket_expired_or_replayed/i);
    console.log('QA_010_MERCHANT_A=1840_HELD_PRIVATE_ONE_SHOT');

    const chB=await challenge(merchantOther);
    const ticketB=await attest(chB,mIssuer,mB,'qa-other',orgB,'FR');
    const walletB=await read(merchantOther,ticketB);
    assert.equal(walletB.summary.accrued_minor,0);
    assert.equal(walletB.summary.order_count,0);
    assert.deepEqual(walletB.activity,[]);
    console.log('QA_010_MERCHANT_B_CANNOT_READ_A_OR_CROSS_TERRITORY=PASS');

    const chC=await challenge(courier);
    await sqlDenied(attest(chC,cIssuer,cA,'qa-restaurant',orgA,'BE'),
      /qa_scope_courier_cannot_choose_merchant/i);
    await sqlDenied(attest(chC,cIssuer,cB,null,orgA,'BE'),
      /qa_scope_registry_denied/i);
    const ticketC=await attest(chC,cIssuer,cA,null,orgA,'BE');
    await sqlDenied(read(courierOther,ticketC),/qa_scope_postgres_session_mismatch/i);
    const walletC=await read(courier,ticketC);
    assert.equal(walletC.ownerRole,'courier');
    assert.equal(walletC.summary.accrued_minor,390);
    assert.equal(walletC.summary.held_minor,390);
    assert.equal(walletC.summary.withdrawable_minor,0);
    assert.equal(walletC.summary.payout_enabled,false);
    assert.equal(walletC.activity.length,1);
    await sqlDenied(read(courier,ticketC),/qa_scope_ticket_expired_or_replayed/i);

    const chForeign=await challenge(courierOther);
    const ticketForeign=await attest(chForeign,
      'https://qa.other.invalid/realms/da-courier',cA,null,orgB,'FR');
    const foreign=await read(courierOther,ticketForeign);
    assert.equal(foreign.summary.accrued_minor,0);
    assert.deepEqual(foreign.activity,[]);
    console.log('QA_010_COURIER_REALM_SEPARATION_AND_SESSION_BOUND=PASS');

    const chRevoked=await challenge(merchant);
    const revokedTicket=await attest(chRevoked,mIssuer,mA,'qa-restaurant',orgA,'BE');
    await admin.query(
      "UPDATE public.da_qa_wallet_merchant_scope_010 SET kyb_status='expired'"+
      " WHERE issuer=$1 AND subject=$2::uuid",[mIssuer,mA]);
    await sqlDenied(read(merchant,revokedTicket),/qa_scope_merchant_revoked/i);
    await sqlDenied(attest(await challenge(merchant),mIssuer,mA,'qa-restaurant',
      orgA,'BE'),/qa_scope_registry_denied/i);
    console.log('QA_010_KYB_REVOCATION_AFTER_TICKET=DENIED');

    const chRevokedCourier=await challenge(courier);
    const revokedCourier=await attest(chRevokedCourier,cIssuer,cA,null,orgA,'BE');
    await admin.query(
      "UPDATE public.da_qa_wallet_courier_scope_010 SET roster_active=false"+
      " WHERE issuer=$1 AND subject=$2::uuid",[cIssuer,cA]);
    await sqlDenied(read(courier,revokedCourier),/qa_scope_courier_revoked/i);
    console.log('QA_010_COURIER_ROSTER_REVOCATION_AFTER_TICKET=DENIED');

    assert.equal(walletA.payoutEnabled,false);
    assert.equal(walletC.payoutEnabled,false);
    assert.equal(walletA.withdrawableMinor,0);
    assert.equal(walletC.withdrawableMinor,0);
    console.log('QA_010_STRIPE_CALLS=ZERO_PAYOUTS=ZERO');
  }finally{
    for(const client of [merchant,courier,merchantOther,courierOther]){
      if(client)client.release();
    }
    await Promise.all([admin.end(),attestor.end(),merchantPool.end(),courierPool.end()]);
  }
});
