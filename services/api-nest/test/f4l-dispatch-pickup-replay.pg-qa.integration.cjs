'use strict';
const assert=require('node:assert/strict');
const q=require('./f4l-dispatch-machine-client.pg-qa.cjs');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4L_MACHINE_WORKER!=='YES'||process.getuid?.()!==1000)
 throw Error('qa_only');
const db=q.pool('da_qa_dispatch_machine_016',process.env.QA_F4L_MACHINE_DB_PASSWORD);
async function run(){
 const token=await q.machineToken();
 const a=await q.assign(db,'picked',token);
 assert.equal(a.status,200);
 assert.equal((await q.courierTransition('picked','accepted')).status,200);
 assert.equal((await q.courierTransition('picked','picked_up')).status,200);
 await assert.rejects(q.assign(db,'picked',token),/qa_f4l_reassignment_or_picked_up_denied/);
 const c=await db.connect();
 try{
  const t=await q.ticket(c,'reassign',token);
  assert.equal(t.status,200);
  const sql='SELECT public.da_qa_dispatch_assign_attested_016($1::uuid)';
  await c.query(sql,[t.body.ticketId]);
  await assert.rejects(c.query(sql,[t.body.ticketId]),/qa_f4l_ticket_replayed_or_expired/);
 }finally{c.release();}
 console.log('QA_F4L_PICKED_UP_PROTECTED_AND_TICKET_SINGLE_USE=PASS');
}
void run().finally(()=>db.end()).catch(e=>{
 console.error('QA_F4L_PICKUP_GATE_FAILED',e.message);process.exitCode=1;
});
