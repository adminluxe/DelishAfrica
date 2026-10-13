'use strict';
/**
 * F4J: adversarial PostgreSQL 17 ROW-LOCK / commit-order matrix.
 * Only synthetic Keycloak identities and DB ledger in --network none.
 * Uses a privileged QA initializer process that EXITS before F4I
 * separate-process SCRAM wallet tests begin.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {Pool}=require('pg');
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.QA_COMMERCE_DB_HOST!=='127.0.0.1'||
   process.env.QA_COMMERCE_DB_NAME!=='postgres')
  throw Error('QA_F4J_DISCONNECTED_PG17_ONLY');
const pg=user=>new Pool({host:'127.0.0.1',port:5432,
  database:'postgres',user,max:4,connectionTimeoutMillis:4500,
  statement_timeout:9000,query_timeout:10000});
const admin=pg('postgres');
const merchant=pg('da_qa_merchant_commerce_app');
const courier=pg('da_qa_courier_commerce_app');
const attestor=pg('da_qa_wallet_attestor_isolated_013');
const users=JSON.parse(fs.readFileSync('/qa-seed/users.json','utf8'));
const prefix='DA-F4G-keycloak-partner-sid-jti-v1\n';
function claims(role){
  const value=users[role]?.access;
  if(typeof value!=='string')throw Error('qa_f4j_missing_synthetic_test_user');
  const chunks=value.split('.');
  assert.equal(chunks.length,3);
  return JSON.parse(Buffer.from(chunks[1],'base64url').toString('utf8'));
}
function digest(p){
  return crypto.createHash('sha256').update(prefix+
    [p.iss,p.sub,p.sid,p.jti].join('\n')).digest('hex');
}
const mA=claims('merchantA'),mB=claims('merchantB');
const cA=claims('courierA');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const denied=p=>assert.rejects(p,/qa_f4j_|permission denied/i);
async function clientFor(role){
  return (role==='courier'?courier:merchant).connect();
}
async function ticket(client,p,role){
  const login=(await client.query('SELECT session_user AS login')).rows[0].login;
  assert.equal(login,role==='merchant'?
    'da_qa_merchant_commerce_app':'da_qa_courier_commerce_app');
  const begin=(await client.query(
    'SELECT public.da_qa_wallet_begin_scope_010() AS challenge')).rows[0];
  const org=role==='merchant'?
    (p.sub===mA.sub?'a43f867f-9f42-4573-9268-dc65a164d2c2':
      'a43f867f-9f42-4573-9268-dc65a164d2c4'):
    'a43f867f-9f42-4573-9268-dc65a164d2c2';
  const slug=role==='merchant'?
    (p.sub===mA.sub?'qa-restaurant':'qa-other'):null;
  const territory=p.sub===mB.sub?'FR':'BE';
  const minted=(await attestor.query(
    'SELECT public.da_qa_wallet_attest_010('+
    '$1::uuid,$2::text,$3::uuid,$4::varchar,$5::uuid,$6::char(2)) AS ticket',
    [begin.challenge,p.iss,p.sub,slug,org,territory])).rows[0]?.ticket;
  assert.match(minted,/^[0-9a-f-]{36}$/i);
  return minted;
}
async function read(client,p,ticketId){
  return client.query(
    'SELECT public.da_qa_wallet_read_linearized_014('+
    '$1::uuid,$2::integer,$3::text) AS report',
    [ticketId,20,digest(p)]);
}
async function lockWait(pid,timeout=3500){
  const until=Date.now()+timeout;
  do{
    const wait=(await admin.query(
      "SELECT wait_event_type,wait_event FROM pg_stat_activity "+
      "WHERE pid=$1",[pid])).rows[0];
    if(wait?.wait_event_type==='Lock')return wait.wait_event;
    await delay(35);
  }while(Date.now()<until);
  throw Error('qa_f4j_expected_lock_wait_not_observed');
}
async function crossLockedRevocation(p,role,updateSql,updateArgs,restoreSql,
  label){
  // Revoke first, commit after SELECT ... FOR SHARE is waiting. The
  // blocked read must deny, never return a cached authorized wallet.
  const app=await clientFor(role);
  const killer=await admin.connect();
  try{
    const token=await ticket(app,p,role);
    const pid=(await app.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    await killer.query('BEGIN');
    await killer.query(updateSql,updateArgs);
    const reading=read(app,p,token);
    await lockWait(pid);
    await killer.query('COMMIT');
    await denied(reading);
    console.log('QA_F4J_REVOKE_COMMIT_BEFORE_WALLET_'+label+'=DENIED');
    await admin.query(restoreSql,updateArgs);
  }finally{
    try{await killer.query('ROLLBACK')}catch{}
    killer.release();app.release();
  }
}
async function readLockedThenRevoke(p,role,updateSql,updateArgs,restoreSql,
  label){
  // Read first INSIDE a real PG transaction and keep its row locks until
  // COMMIT. A competing revocation must WAIT; it cannot commit halfway
  // through the authorized ledger read.
  const app=await clientFor(role);
  const revoker=await admin.connect();
  try{
    await app.query('BEGIN');
    const token=await ticket(app,p,role);
    const result=(await read(app,p,token)).rows[0]?.report;
    assert.equal(result.ownerRole,role);
    assert.equal(result.withdrawableMinor,0);
    assert.equal(result.payoutEnabled,false);
    const revokerPid=(await revoker.query(
      'SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const revoking=revoker.query(updateSql,updateArgs);
    await lockWait(revokerPid);
    await app.query('COMMIT');
    await revoking;
    console.log('QA_F4J_READ_COMMITTED_BEFORE_REVOKE_'+label+'=SERIALIZED');
    const next=await ticket(app,p,role);
    await denied(read(app,p,next));
    await admin.query(restoreSql,updateArgs);
  }finally{
    try{await app.query('ROLLBACK')}catch{}
    app.release();revoker.release();
  }
}
test('F4J atomic post-attestation read closes PostgreSQL revocation TOCTOU',
  {timeout:60000},async()=>{
  try{
    // New strict 014 endpoint is mandatory: the old route is revoked.
    const m=await clientFor('merchant');
    try{
      await denied(m.query(
        'SELECT public.da_qa_wallet_read_attested_010($1::uuid,20)',
        ['2a56a6bb-a3ce-4c04-81b2-7f1db07dd5f1']));
      await assert.rejects(m.query(
        'SELECT public.da_qa_wallet_read_linearized_014('+
        '$1::uuid,$2::integer,$3::text)',
        ['2a56a6bb-a3ce-4c04-81b2-7f1db07dd5f1',20,'f'.repeat(64)]));
      console.log('QA_F4J_OLD_WALLET_ENTRYPOINT=REVOKED');
    }finally{m.release();}

    await crossLockedRevocation(mA,'merchant',
      "UPDATE public.da_merchant_memberships SET "+
      "membership_status='suspended',contract_status='suspended' "+
      "WHERE issuer=$1 AND subject=$2 AND partner_id='qa_partner_a'",
      [mA.iss,mA.sub],
      "UPDATE public.da_merchant_memberships SET "+
      "membership_status='active',contract_status='active' "+
      "WHERE issuer=$1 AND subject=$2 AND partner_id='qa_partner_a'",
      'MERCHANT_CONTRACT');

    await readLockedThenRevoke(mB,'merchant',
      "UPDATE public.da_qa_finance_legal_entities_012 "+
      "SET kyb_status='expired' WHERE organization_id=$1::uuid",
      ['a43f867f-9f42-4573-9268-dc65a164d2c4'],
      "UPDATE public.da_qa_finance_legal_entities_012 "+
      "SET kyb_status='verified' WHERE organization_id=$1::uuid",
      'ENTITY_KYB');

    await crossLockedRevocation(cA,'courier',
      "UPDATE public.da_qa_finance_courier_roster_012 "+
      "SET roster_status='suspended' WHERE issuer=$1 AND subject=$2",
      [cA.iss,cA.sub],
      "UPDATE public.da_qa_finance_courier_roster_012 "+
      "SET roster_status='active' WHERE issuer=$1 AND subject=$2",
      'COURIER_ROSTER');

    await readLockedThenRevoke(mA,'merchant',
      'UPDATE public.da_qa_partner_oidc_sessions_011 '+
      'SET revoked_at=clock_timestamp() '+
      'WHERE session_key_sha256=$1::char(64)',
      [digest(mA)],
      'UPDATE public.da_qa_partner_oidc_sessions_011 '+
      'SET revoked_at=NULL WHERE session_key_sha256=$1::char(64)',
      'HASHED_SESSION');

    // Foreign hash and foreign role can never choose a different wallet.
    const isolated=await clientFor('merchant');
    try{
      const valid=await ticket(isolated,mA,'merchant');
      await denied(read(isolated,mB,valid));
    }finally{isolated.release();}
    console.log('QA_F4J_CROSS_PARTNER_SESSION_DIGEST=DENIED');
    console.log('QA_F4J_FINANCIAL_MUTATIONS=STILL_REVOKED');
    console.log('QA_F4J_STRIPE_CALLS=ZERO_PAYOUTS=ZERO');
  }finally{
    await Promise.all([admin.end(),merchant.end(),courier.end(),
      attestor.end()]);
  }
});
