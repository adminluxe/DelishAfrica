'use strict';
const assert=require('node:assert/strict');
const q=require('./f4l-dispatch-machine-client.pg-qa.cjs');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4L_MACHINE_WORKER!=='YES'||process.getuid?.()!==1000)
 throw Error('qa_only');
const stage=process.env.QA_F4L_STAGE;
const db=q.pool('da_qa_dispatch_machine_016',process.env.QA_F4L_MACHINE_DB_PASSWORD);
const byStage={
 'refund-first':['refundFirst',/qa_f4l_order_payment_hold/],
 'refund-race':['refundConcurrent',/qa_f4l_order_payment_hold/],
 'courier-revoked':['revokedCourier',/qa_f4l_courier_roster_or_territory_denied/],
 'org-moved':['orgMove',/qa_f4l_courier_roster_or_territory_denied/],
};
async function run(){
 const token=await q.machineToken();
 if(stage==='machine-revoked'){
  const r=await q.assign(db,'machineRevoked',token);
  assert.equal(r.status,403);
 }else{
  const entry=byStage[stage];
  if(!entry)throw Error('Unknown F4L stage');
  await assert.rejects(q.assign(db,entry[0],token),entry[1]);
 }
 console.log('QA_F4L_'+stage.toUpperCase().replaceAll('-','_')+'=DENIED');
}
void run().finally(()=>db.end()).catch(e=>{
 console.error('QA_F4L_STAGE_FAILED',e.message);process.exitCode=1;
});
