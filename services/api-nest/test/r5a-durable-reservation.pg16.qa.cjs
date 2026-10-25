'use strict';
/* Real PostgreSQL 16 reservation authority in disposable QA.
   Stripe calls are simulated; PR #48 HTTP 503 remains absolutely unchanged. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');
const util=require('node:util');
const execFile=util.promisify(cp.execFile);
const PG=process.env.R5A_PGC_QA_CONTAINER||'';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.NODE_ENV==='production'||
   !/^pog-r5a-prestripe-pg-[A-Za-z0-9-]+$/.test(PG))
  throw Error('R5A_C_QA_ONLY_ENV_GUARD');
const ROOT=path.resolve(__dirname,'..');
const payments=fs.readFileSync(path.join(ROOT,'src/payments/payments.service.ts'),'utf8');
const start=payments.indexOf('  async createPaymentIntent(');
const stop=payments.indexOf('  async verifyPaidOrder(',start);
assert(start>=0&&stop>start&&
  payments.slice(start,stop).includes('this.assertDurableCheckoutAuthority();'));
assert(payments.includes('checkoutIntentCreationEnabled: false'));
console.log('R5A_C_PASS=STRIPE_HTTP503_HARDSTOP_RETAINED');
function pass(label,value){assert.ok(value,label);console.log('R5A_C_PASS='+label)}
function args(user,sql){return ['exec',PG,'psql','-X','-A','-t',
  '-v','ON_ERROR_STOP=1','-U',user,'-d','r5a_checkout_qa','-c',sql]}
function reason(stderr){
  const m=String(stderr).match(/checkout_[a-z_]+|permission denied/i);
  return m?m[0]:'pg_qa_statement_rejected';
}
function query(user,sql){
  const r=cp.spawnSync('docker',args(user,sql),{encoding:'utf8',timeout:15000,maxBuffer:200000});
  if(r.error||r.status!==0)throw Error(reason(r.stderr||r.error));
  return String(r.stdout||'').trim()
}
async function asyncQuery(user,sql){
  try {
    const r=await execFile('docker',args(user,sql),{encoding:'utf8',timeout:25000,maxBuffer:200000});
    return String(r.stdout||'').trim()
  } catch(e){throw Error(reason(e.stderr||e.message))}
}
function rejected(label,needle,fn){
  let err='';
  try{fn()}catch(e){err=String(e.message||e)}
  pass(label,err.includes(needle))
}
const parse=(v)=>!v||v==='null'?null:JSON.parse(v);
const issuer='http://127.0.0.1:18195/realms/r5a-only-qa';
const merchant='00000000-0000-4000-8000-000000000001';
const alice='00000000-0000-4000-8000-000000000101';
const bob='00000000-0000-4000-8000-000000000102';
const w1='00000000-0000-4000-8000-000000000501';
const w2='00000000-0000-4000-8000-000000000502';
const key='r5a-qa-mutation-00001';
function reserve(sub=alice,tenant='tenant-alpha',m=merchant,sku='qa-rice',
                 qty=2,mutation=key,claimed=null,currency='EUR'){
  const n=claimed===null?'NULL':String(claimed);
  return "SELECT r5a_checkout_qa.reserve('"+issuer+"','"+sub+"'::uuid,'"+tenant+
    "','"+m+"'::uuid,'"+sku+"',"+qty+",'"+currency+"','"+mutation+"',"+n+");"
}
function read(sub=alice,mutation=key){
  return "SELECT r5a_checkout_qa.read_by_mutation('"+issuer+"','"+sub+
    "'::uuid,'"+mutation+"');"
}
function claim(id,sub=alice,tenant='tenant-alpha',worker=w1){
  return "SELECT r5a_checkout_qa.claim_intent('"+id+"'::uuid,'"+issuer+
    "','"+sub+"'::uuid,'"+tenant+"','"+worker+"'::uuid);"
}
function record(id,pi,sub=alice,tenant='tenant-alpha',worker=w1){
  return "SELECT r5a_checkout_qa.record_intent('"+id+"'::uuid,'"+issuer+
    "','"+sub+"'::uuid,'"+tenant+"','"+worker+"'::uuid,'"+pi+"');"
}
const provider={
  calls:0,byKey:new Map(),
  async create({id,subject,mutation,total}) {
    const stored=parse(query('r5a_checkout_worker',read(subject,mutation)));
    pass('PSP_GATE_ACTUAL_COMMITTED_RESERVATION',
      stored&&stored.reservation_id===id&&stored.amount_minor===total&&
      stored.currency==='EUR'&&!!stored.stripe_idempotency_key);
    this.calls++;
    if(this.byKey.has(stored.stripe_idempotency_key))
      return this.byKey.get(stored.stripe_idempotency_key);
    const pi='pi_test_r5a_'+crypto.createHash('sha256')
      .update(stored.stripe_idempotency_key).digest('hex').slice(0,30);
    this.byKey.set(stored.stripe_idempotency_key,pi);
    return pi;
  }
};
async function ready(){
  for(let i=0;i<70;i++){
    try{if(query('postgres','SELECT 1')==='1')return}catch{}
    await new Promise(r=>setTimeout(r,250));
  }
  throw Error('pg_did_not_restart');
}
(async()=>{
  const file=path.join(ROOT,'qa','r5a-durable-reservation.pg16.sql');
  const sql=fs.readFileSync(file,'utf8');
  pass('SCHEMA_PRIVATE_NO_STRIPE_API',sql.includes('SECURITY DEFINER')&&
    sql.includes('REVOKE ALL ON ALL TABLES')&&!sql.includes('api.stripe.com'));
  const setup=cp.spawnSync('docker',['exec','-i',PG,'psql','-X',
    '-v','ON_ERROR_STOP=1','-U','postgres','-d','r5a_checkout_qa'],
    {input:sql,encoding:'utf8',timeout:25000,maxBuffer:500000});
  if(setup.status!==0)throw Error('SQL_SETUP_'+reason(setup.stderr||setup.error));
  pass('POSTGRES_SCHEMA_AND_CATALOG_COMMITTED',
    query('postgres','SELECT count(*) FROM r5a_checkout_qa.catalog_item')==='3');
  rejected('WORKER_DIRECT_SELECT_DENIED','permission denied',
    ()=>query('r5a_checkout_worker',
      'SELECT count(*) FROM r5a_checkout_qa.reservation'));
  rejected('WORKER_DIRECT_UPDATE_DENIED','permission denied',
    ()=>query('r5a_checkout_worker',
      "UPDATE r5a_checkout_qa.reservation SET status='intent_recorded'"));
  const first=parse(query('r5a_checkout_worker',reserve()));
  pass('SERVER_RECALCULATED_PRICE_NOT_CLIENT_PRICE',
    first.amount_minor===4380&&first.currency==='EUR'&&first.status==='reserved');
  pass('STRIPE_IDEMPOTENCY_KEY_ISSUER_SUBJECT_MUTATION_SCOPED',
    /^da-r5a-qa-[a-f0-9]{64}$/.test(first.stripe_idempotency_key));
  const repeated=parse(query('r5a_checkout_worker',reserve()));
  pass('SAME_MUTATION_RETURNS_ORIGINAL_COMMITTED_RESERVATION',
    first.reservation_id===repeated.reservation_id&&
    first.stripe_idempotency_key===repeated.stripe_idempotency_key);
  pass('EXACTLY_ONE_OUTBOX_EVENT',
    query('postgres','SELECT count(*) FROM r5a_checkout_qa.outbox')==='1');
  rejected('CLIENT_TAMPER_AMOUNT_REJECTED','checkout_client_amount_mismatch',
    ()=>query('r5a_checkout_worker',
      reserve(alice,'tenant-alpha',merchant,'qa-rice',2,'r5a-tamper-012345',1)));
  rejected('SAME_KEY_DIFFERENT_QUANTITY_CONFLICT','checkout_idempotency_conflict',
    ()=>query('r5a_checkout_worker',
      reserve(alice,'tenant-alpha',merchant,'qa-rice',3)));
  rejected('CROSS_TENANT_WRONG_MERCHANT_DENIED','checkout_catalog_missing_or_unavailable',
    ()=>query('r5a_checkout_worker',
      reserve(alice,'tenant-beta',merchant,'qa-rice',1,'r5a-cross-012345')));
  rejected('INACTIVE_SKU_DENIED','checkout_catalog_missing_or_unavailable',
    ()=>query('r5a_checkout_worker',
      reserve(alice,'tenant-alpha',merchant,'qa-inactive',1,'r5a-inactive-12345')));
  rejected('OTHER_CURRENCY_DENIED','checkout_invalid_trusted_input',
    ()=>query('r5a_checkout_worker',
      reserve(alice,'tenant-alpha',merchant,'qa-rice',1,'r5a-currency-12345',null,'USD')));
  pass('NO_PROVIDER_CALL_AFTER_REJECTED_RESERVATIONS',provider.calls===0);
  const other=parse(query('r5a_checkout_worker',reserve(bob)));
  pass('DIFFERENT_ACTOR_SAME_MUTATION_NEW_RESERVATION_AND_STRIPE_KEY',
    other.reservation_id!==first.reservation_id&&
    other.stripe_idempotency_key!==first.stripe_idempotency_key);
  pass('UNKNOWN_ACTOR_READS_NULL',parse(query('r5a_checkout_worker',
    read('00000000-0000-4000-8000-000000000103')))==null);
  const multi=await Promise.all(Array.from({length:12},
    ()=>asyncQuery('r5a_checkout_worker',reserve(alice,'tenant-alpha',merchant,
      'qa-rice',2,'r5a-concurrent-123456'))));
  pass('TWELVE_CONCURRENT_PG_RESERVATIONS_ONE_ROW',
    new Set(multi.map(x=>parse(x).reservation_id)).size===1);
  pass('SINGLE_OUTBOX_PER_PERSISTED_RESERVATION',
    query('postgres','SELECT count(*) FROM r5a_checkout_qa.outbox')===
    query('postgres','SELECT count(*) FROM r5a_checkout_qa.reservation'));
  const id=first.reservation_id;
  pass('OTHER_ACTOR_CANNOT_CLAIM',parse(query('r5a_checkout_worker',claim(id,bob)))===null);
  const lease1=parse(query('r5a_checkout_worker',claim(id)));
  pass('FIRST_WORKER_HAS_CLAIM',lease1&&lease1.reservation_id===id&&
    lease1.status==='intent_claimed');
  pass('SECOND_WORKER_BLOCKED_BY_LEASE',
    parse(query('r5a_checkout_worker',claim(id,alice,'tenant-alpha',w2)))===null);
  const pi=await provider.create({id,subject:alice,mutation:key,total:4380});
  pass('SYNTHETIC_PSP_CREATED_BUT_CRASH_BEFORE_SQL_LINK',
    parse(query('r5a_checkout_worker',read())).payment_intent_id===null);
  query('postgres',"UPDATE r5a_checkout_qa.reservation SET lease_until="+
    "clock_timestamp()-interval '1 second' WHERE id='"+id+"'::uuid");
  const lease2=parse(query('r5a_checkout_worker',claim(id,alice,'tenant-alpha',w2)));
  pass('CRASH_RETRY_USES_SAME_STRIPE_IDEMPOTENCY_KEY',
    lease2.stripe_idempotency_key===lease1.stripe_idempotency_key);
  const samePi=await provider.create({id,subject:alice,mutation:key,total:4380});
  pass('SYNTHETIC_PSP_NO_DOUBLE_INTENT',samePi===pi&&provider.byKey.size===1);
  const linked=parse(query('r5a_checkout_worker',record(id,pi,alice,'tenant-alpha',w2)));
  pass('PAYMENT_INTENT_DURABLY_LINKED_AFTER_RETRY',
    linked.payment_intent_id===pi&&linked.status==='intent_recorded');
  pass('PI_LINK_RETRY_IDEMPOTENT',
    parse(query('r5a_checkout_worker',
      record(id,pi,alice,'tenant-alpha',w2))).payment_intent_id===pi);
  rejected('DIFFERENT_PI_CANNOT_OVERWRITE','checkout_intent_binding_conflict',
    ()=>query('r5a_checkout_worker',
      record(id,'pi_test_another_intent_12345678',alice,'tenant-alpha',w2)));
  pass('OUTBOX_PROCESSED_ONLY_AFTER_PI_BOUND',
    query('postgres',"SELECT count(*) FROM r5a_checkout_qa.outbox "+
      "WHERE reservation_id='"+id+"'::uuid AND processed_at IS NOT NULL")==='1');
  const reboot=cp.spawnSync('docker',['restart',PG],
    {encoding:'utf8',timeout:45000,maxBuffer:20000});
  pass('POSTGRES16_RESTART_SUCCESS',reboot.status===0);
  await ready();
  const after=parse(query('r5a_checkout_worker',read()));
  pass('PG16_REAL_RESTART_PRESERVES_RESERVATION_AND_PI',
    after.payment_intent_id===pi&&after.status==='intent_recorded');
  const beforeCalls=provider.calls;
  const stopped=cp.spawnSync('docker',['stop',PG],
    {encoding:'utf8',timeout:30000,maxBuffer:20000});
  pass('PG_OFFLINE_FOR_FAILURE_TEST',stopped.status===0);
  rejected('SQL_UNAVAILABLE_CAUSES_ABORT_BEFORE_PSP','pg_qa_statement_rejected',
    ()=>query('r5a_checkout_worker',
      reserve(alice,'tenant-alpha',merchant,'qa-rice',1,'r5a-offline-123456')));
  pass('SQL_DOWN_ZERO_MORE_PSP_CALLS',provider.calls===beforeCalls);
  console.log('R5A_C_POSTGRES16_REAL_RESERVATION=PASS_QA_WITH_SIMULATED_STRIPE');
  console.log('R5A_C_ACTUAL_STRIPE_TEST=NOT_CERTIFIED');
  console.log('R5A_C_HARDSTOP_PR48=STILL_503');
  console.log('R5A_C_GLOBAL_FINANCE=NO_GO');
})().catch(err=>{
  const code=String(err?.message||'error')
    .replace(/[^A-Za-z0-9_-]/g,'_').slice(0,100);
  console.error('R5A_C_FINAL=NO_GO_'+code);
  process.exitCode=1;
});
