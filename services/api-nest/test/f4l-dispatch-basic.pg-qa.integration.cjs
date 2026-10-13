'use strict';
const assert=require('node:assert/strict');
const q=require('./f4l-dispatch-machine-client.pg-qa.cjs');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4L_MACHINE_WORKER!=='YES'||process.getuid?.()!==1000)
 throw Error('qa_only');
const machine=q.pool('da_qa_dispatch_machine_016',
 process.env.QA_F4L_MACHINE_DB_PASSWORD,10);
async function test(){
 const token=await q.machineToken();
 for(const name of ['success','same']){
  const result=await q.assign(machine,name,token);
  assert.equal(result.status,200);
  assert.equal(result.body.state,'offered');
  assert.equal(result.body.replayed,false);
 }
 const replay=await q.assign(machine,'same',token);
 assert.equal(replay.status,200);
 assert.equal(replay.body.replayed,true);
 const race=await Promise.all(Array.from({length:7},
  ()=>q.assign(machine,'simultaneous',token)));
 assert.equal(race.filter(x=>!x.body.replayed).length,1);
 assert.equal(race.filter(x=>x.body.replayed).length,6);
 await assert.rejects(q.assign(machine,'unready',token),
  /qa_f4l_order_not_ready/);
 await assert.rejects(q.assign(machine,'foreign',token,{courier:'courierB'}),
  /qa_f4l_courier_roster_or_territory_denied/);
 const r=await q.assign(machine,'foreign',token,
  {organizationId:q.OB,territory:'FR'});
 assert.equal(r.status,403);
 console.log('QA_F4L_MACHINE_DISPATCH_ASSIGN_AND_CONCURRENCY=PASS');
}
void test().finally(()=>machine.end()).catch(e=>{
 console.error('QA_F4L_MACHINE_ASSIGN_FAILED',e.message);process.exitCode=1;
});
