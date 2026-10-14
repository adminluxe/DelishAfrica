'use strict';
/**
 * P0 020 isolated PostgreSQL 17 outbox DELIVERY/RECOVERY acceptance test.
 *
 * Requires the existing single-order finality test first in the SAME
 * disposable PG17 container. Does not call any network, Keycloak, Stripe,
 * live Merchant/Courier, payout, customer API, or production worker.
 */
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {Pool} = require('pg');
const {
  QaIsolatedFinanceOutboxWorker,QaSyntheticOutboxDeliveryFailure,
} = require('/qa-built/finance-outbox-delivery.qa.worker.js');

if (process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.QA_SYNTHETIC_ONLY !== 'YES' ||
    process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED !== 'YES' ||
    process.env.NODE_ENV === 'production' ||
    process.env.QA_COMMERCE_DB_HOST !== '127.0.0.1' ||
    process.env.QA_COMMERCE_DB_NAME !== 'postgres') {
  throw Error('P0_FINANCE_DELIVERY_QA_ISOLATED_ONLY');
}
const config=user=>({
  host:'127.0.0.1',port:5432,user,database:'postgres',
  connectionTimeoutMillis:7000,query_timeout:14000,
  statement_timeout:14000,max:8,
});
const admin=new Pool(config('postgres'));
const workerA=new Pool(config('da_qa_finance_delivery_worker_020'));
const workerB=new Pool(config('da_qa_finance_delivery_worker_020'));
const consumerConn=new Pool(config('da_qa_finance_mock_consumer_020'));
const finance=new Pool(config('da_qa_stripe_finance_reconciler'));
const client=new Pool(config('da_qa_client_commerce_app'));
const sqlClaim=(pool,who,lim=1,ttl=30)=>
  pool.query('SELECT * FROM public.da_qa_delivery_claim_020($1::text,$2::integer,$3::integer)',
    [who,lim,ttl]).then(x=>x.rows);
const sqlAck=(pool,e,who,token)=>
  pool.query('SELECT public.da_qa_delivery_ack_020($1::uuid,$2::text,$3::uuid) AS ok',
    [e,who,token]).then(x=>x.rows[0]?.ok);
const sqlFail=(pool,e,who,token,code)=>
  pool.query('SELECT public.da_qa_delivery_fail_020($1::uuid,$2::text,$3::uuid,$4::text) AS state',
    [e,who,token,code]).then(x=>x.rows[0]?.state);
const audit=async()=>(
  await admin.query(
    'SELECT d.event_id,d.state,d.attempts,d.last_error_code,'+
    'd.lease_token,d.lease_owner,d.dead_at,d.delivered_at '+
    'FROM public.da_qa_financial_delivery_state_020 d ORDER BY d.event_id'
  )
).rows;
const effects=async()=>(
  await admin.query('SELECT event_id,event_kind FROM public.da_qa_mock_consumer_effects_020')
).rows;
const source=async()=>(
  await admin.query(
    'SELECT event_id,authority_id,order_id,event_kind,source_id '+
    'FROM public.da_qa_financial_outbox_018 ORDER BY recorded_at,event_id')
).rows;
const forceLeaseExpiry=async(eventId)=>{
  // Fault injection by QA postgres superuser, NEVER exposed to worker.
  const r=await admin.query(
    "UPDATE public.da_qa_financial_delivery_state_020 "+
    "SET lease_expires_at=statement_timestamp()-interval '1 second' "+
    "WHERE event_id=$1::uuid AND state='leased'",[eventId]);
  assert.equal(r.rowCount,1);
};
const forceRetryDue=async(eventId)=>{
  const r=await admin.query(
    "UPDATE public.da_qa_financial_delivery_state_020 "+
    "SET next_attempt_at=statement_timestamp()-interval '1 second' "+
    "WHERE event_id=$1::uuid AND state='pending'",[eventId]);
  assert.equal(r.rowCount,1);
};
const attemptsSeen=new Map();
const realSyntheticConsumer={
  async apply(record) {
    assert.match(record.eventId,/^[0-9a-f-]{36}$/);
    assert.match(record.orderId,/^[0-9a-f-]{36}$/);
    assert.ok(['payment_captured','financial_hold'].includes(record.eventKind));
    attemptsSeen.set(record.eventId,(attemptsSeen.get(record.eventId)||0)+1);
    const x=await consumerConn.query(
      'SELECT public.da_qa_mock_consumer_apply_020($1::uuid) AS applied',
      [record.eventId]);
    assert.equal(typeof x.rows[0].applied,'boolean');
  },
};

test('020 at-least-once leased financial outbox: concurrent claim, crash, consumer dedup, retries and DLQ',async()=>{
  try{
    assert.equal((await source()).length,2,
      'existing finality 018 must have inserted capture and refund events');
    assert.deepEqual(new Set((await source()).map(x=>x.event_kind)),
      new Set(['payment_captured','financial_hold']));
    assert.equal((await effects()).length,0);

    // No direct read/write, no application claim, no error text persistence.
    await assert.rejects(
      ()=>workerA.query('SELECT * FROM public.da_qa_financial_outbox_018'),
      /permission denied/);
    await assert.rejects(
      ()=>workerA.query('SELECT * FROM public.da_qa_financial_delivery_state_020'),
      /permission denied/);
    await assert.rejects(
      ()=>consumerConn.query('SELECT * FROM public.da_qa_financial_delivery_state_020'),
      /permission denied/);
    await assert.rejects(
      ()=>client.query('SELECT * FROM public.da_qa_delivery_claim_020($1,$2,$3)',
        ['qa-worker-clientfake',1,30]),/permission denied/);
    await assert.rejects(
      ()=>sqlClaim(workerA,'qa-worker-a01',26),/qa_delivery_claim_parameters_invalid/);
    await assert.rejects(
      ()=>sqlClaim(workerA,'unauthorized-worker',1),/qa_delivery_claim_parameters_invalid/);
    await assert.rejects(
      ()=>consumerConn.query('SELECT public.da_qa_delivery_ack_020($1,$2,$3)',
        ['00000000-0000-4000-8000-000000000001','qa-worker-a01',
         '00000000-0000-4000-8000-000000000002']),/permission denied/);
    console.log('P0_OUTBOX_020_ROLES_SEPARATED_AND_BOUNDED=PASS');

    // Two independently connected workers race for two genuine committed
    // outbox events. SKIP LOCKED + unique leased rows must avoid duplicates.
    let [one,two]=await Promise.all([
      sqlClaim(workerA,'qa-worker-a01',1),
      sqlClaim(workerB,'qa-worker-b01',1),
    ]);
    // Cold-start projection into the delivery state is also concurrent.
    // A losing transaction may see 0 rows on its first SKIP LOCKED scan.
    // It must be safe to retry; never require a false exactly-once claim.
    assert.ok(one.length+two.length>=1);
    assert.ok(one.length<=1 && two.length<=1);
    if(one.length===0)one=await sqlClaim(workerA,'qa-worker-a01',1);
    if(two.length===0)two=await sqlClaim(workerB,'qa-worker-b01',1);
    assert.equal(one.length,1);
    assert.equal(two.length,1);
    const e1=one[0],e2=two[0];
    assert.notEqual(e1.event_id,e2.event_id);
    assert.equal(e1.attempts||e1.attempt,1);
    assert.equal(e2.attempts||e2.attempt,1);
    assert.equal((await sqlClaim(workerB,'qa-worker-b01',1)).length,0);
    await assert.rejects(
      ()=>sqlAck(workerA,e1.event_id,'qa-worker-b01',e1.lease_token),
      /qa_delivery_stale_or_foreign_lease/);
    await assert.rejects(
      ()=>sqlAck(workerA,e1.event_id,'qa-worker-a01',
        '00000000-0000-4000-8000-000000000001'),
      /qa_delivery_stale_or_foreign_lease/);
    await assert.rejects(
      ()=>sqlFail(workerA,e1.event_id,'qa-worker-a01',e1.lease_token,
        'RAW_EXCEPTION_OR_CREDENTIAL_NOT_ALLOWED'),
      /qa_delivery_error_code_invalid/);
    console.log('P0_OUTBOX_020_TWO_WORKERS_SKP_LOCKED_FENCING=PASS');

    // Event 1: consumer commits an idempotent effect, then worker ACK.
    await realSyntheticConsumer.apply({
      eventId:e1.event_id,orderId:e1.order_id,
      eventKind:e1.event_kind,sourceId:e1.source_id,
    });
    assert.equal(await sqlAck(workerA,e1.event_id,'qa-worker-a01',
      e1.lease_token),true);
    assert.equal((await effects()).length,1);
    await assert.rejects(
      ()=>sqlAck(workerA,e1.event_id,'qa-worker-a01',e1.lease_token),
      /qa_delivery_stale_or_foreign_lease/);
    assert.equal((await sqlClaim(workerA,'qa-worker-a01',1)).length,0);
    console.log('P0_OUTBOX_020_FENCED_ACK_ONE_CONSUMER_EFFECT=PASS');

    // Event 2: consumer commits, but ACK is lost due to simulated crash.
    // After lease expiry, a NEW worker takes the same eventId; consumer
    // dedup protects the one downstream effect across two deliveries.
    await realSyntheticConsumer.apply({
      eventId:e2.event_id,orderId:e2.order_id,
      eventKind:e2.event_kind,sourceId:e2.source_id,
    });
    assert.equal((await effects()).length,2);
    await forceLeaseExpiry(e2.event_id);
    await assert.rejects(
      ()=>sqlAck(workerB,e2.event_id,'qa-worker-b01',e2.lease_token),
      /qa_delivery_stale_or_foreign_lease/);
    const recovering=new QaIsolatedFinanceOutboxWorker(
      workerA,realSyntheticConsumer,'qa-worker-recovery',30);
    const recovered=await recovering.processOnce(1);
    assert.deepEqual(recovered,{claimed:1,acked:1,retry:0,dead:0});
    assert.equal((await effects()).length,2);
    assert.equal(attemptsSeen.get(e2.event_id),2);
    const afterCrash=(await audit()).find(x=>x.event_id===e2.event_id);
    assert.equal(afterCrash.state,'delivered');
    assert.equal(afterCrash.attempts,2);
    assert.equal(afterCrash.lease_token,null);
    console.log('P0_OUTBOX_020_CRASH_AFTER_EFFECT_BEFORE_ACK_DEDUP=PASS');

    // Create a third legitimate financial-hold event through the EXISTING
    // restricted finance SQL port, never by writing directly to outbox 018.
    const authority=(await source())[0].authority_id;
    await finance.query(
      'SELECT * FROM public.da_qa_finance_record_hold($1::uuid,$2::text,$3::text)',
      [authority,'dp_QA020RETRYSTORM20261014','dispute']);
    const source3=await source();
    assert.equal(source3.length,3);
    const event3=source3.find(x=>x.source_id==='dp_QA020RETRYSTORM20261014');
    assert.ok(event3);
    const failingConsumer={
      async apply(){throw new QaSyntheticOutboxDeliveryFailure('consumer_timeout');},
    };
    const failingWorker=new QaIsolatedFinanceOutboxWorker(
      workerB,failingConsumer,'qa-worker-failures',20);
    for(let n=1;n<=3;n++){
      if(n>1)await forceRetryDue(event3.event_id);
      const answer=await failingWorker.processOnce(1);
      assert.equal(answer.claimed,1);
      assert.equal(answer.acked,0);
      assert.equal(answer.retry,n<3?1:0);
      assert.equal(answer.dead,n===3?1:0);
      const row=(await audit()).find(x=>x.event_id===event3.event_id);
      assert.equal(row.attempts,n);
      assert.equal(row.state,n<3?'pending':'dead');
      assert.equal(row.last_error_code,'consumer_timeout');
    }
    assert.equal((await sqlClaim(workerA,'qa-worker-a01',10)).length,0);
    assert.equal((await effects()).length,2);
    assert.equal((await source()).length,3);
    console.log('P0_OUTBOX_020_3_FAILS_RETRY_BACKOFF_TO_DLQ=PASS');

    // Fourth source event verifies a final crashed lease transitions to DLQ,
    // preventing permanent limbo when worker dies on its third attempt.
    await finance.query(
      'SELECT * FROM public.da_qa_finance_record_hold($1::uuid,$2::text,$3::text)',
      [authority,'re_QA020LASTLEASE20261014','refund']);
    const event4=(await source()).find(x=>
      x.source_id==='re_QA020LASTLEASE20261014');
    assert.ok(event4);
    let token;
    for(let n=1;n<=3;n++){
      const c=await sqlClaim(workerA,'qa-worker-expire',1,5);
      assert.equal(c.length,1);
      assert.equal(c[0].event_id,event4.event_id);
      assert.equal(c[0].attempt,n);
      token=c[0].lease_token;
      await forceLeaseExpiry(event4.event_id);
    }
    assert.equal((await sqlClaim(workerB,'qa-worker-sweeper',5)).length,0);
    const expired=(await audit()).find(x=>x.event_id===event4.event_id);
    assert.equal(expired.state,'dead');
    assert.equal(expired.attempts,3);
    assert.equal(expired.last_error_code,'lease_expired');
    assert.ok(expired.dead_at);
    await assert.rejects(
      ()=>sqlAck(workerA,event4.event_id,'qa-worker-expire',token),
      /qa_delivery_stale_or_foreign_lease/);
    assert.equal((await source()).length,4);
    assert.equal((await effects()).length,2);
    assert.equal((await audit()).filter(x=>x.state==='delivered').length,2);
    assert.equal((await audit()).filter(x=>x.state==='dead').length,2);
    console.log('P0_OUTBOX_020_THIRD_EXPIRED_LEASE_TO_DLQ_NO_LIMBO=PASS');

    // The only durable "consumer effects" are QA synthetic rows in the
    // separate mock consumer table. They are NOT Stripe, email, or payouts.
    assert.equal((await effects()).length,2);
    const states=await audit();
    assert.ok(states.every(x=>x.lease_token===null && x.lease_owner===null));
    assert.equal(states.length,4);
    console.log('P0_OUTBOX_020_AT_LEAST_ONCE_IDEMPOTENT_QA=PASS_NO_LIVE');
  }finally{
    await Promise.allSettled([
      admin.end(),workerA.end(),workerB.end(),
      consumerConn.end(),finance.end(),client.end(),
    ]);
  }
});
