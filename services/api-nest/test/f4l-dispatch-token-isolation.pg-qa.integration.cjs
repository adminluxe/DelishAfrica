'use strict';
const assert=require('node:assert/strict');
const q=require('./f4l-dispatch-machine-client.pg-qa.cjs');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4L_MACHINE_WORKER!=='YES'||process.getuid?.()!==1000)
 throw Error('qa_only');
const db=q.pool('da_qa_dispatch_machine_016',process.env.QA_F4L_MACHINE_DB_PASSWORD);
async function checkRejected(token){
 const conn=await db.connect();
 try{
  const r=await q.ticket(conn,'success',token);
  assert.equal(r.status,403);
 }finally{conn.release();}
}
async function run(){
 await checkRejected(q.users.merchantA.access);
 await checkRejected(q.users.courierA.access);
 const live=await q.machineToken();
 const split=live.split('.');
 const claim=JSON.parse(Buffer.from(split[1],'base64url'));
 split[1]=Buffer.from(JSON.stringify({...claim,scope:'openid'})).toString('base64url');
 await checkRejected(split.join('.'));
 console.log('QA_F4L_MACHINE_TOKEN_ISOLATION_AND_SIGNATURE=PASS');
}
void run().finally(()=>db.end()).catch(e=>{
 console.error('QA_F4L_TOKEN_CHECK_FAILED',e.message);process.exitCode=1;
});
