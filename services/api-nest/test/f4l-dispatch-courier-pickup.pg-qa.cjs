'use strict';
const assert=require('node:assert/strict');
const q=require('./f4l-dispatch-machine-client.pg-qa.cjs');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4I_APP_ONLY!=='YES'||process.getuid?.()!==1000
 ||process.env.QA_F4L_MACHINE_CLIENT_SECRET!==undefined
 ||process.env.QA_F4L_MACHINE_DB_PASSWORD!==undefined)
 throw Error('qa_app_role_only');
async function run(){
 const accepted=await q.courierTransition('picked','accepted');
 assert.equal(accepted.status,200);
 const pickup=await q.courierTransition('picked','picked_up');
 assert.equal(pickup.status,200);
 console.log('QA_F4L_COURIER_F4K_ATTESTED_PICKUP=PASS');
}
void run().catch(e=>{console.error('QA_F4L_COURIER_PICKUP_FAILED',e.message);
 process.exitCode=1;});
