'use strict';
const assert=require('node:assert/strict');
const q=require('./f4l-dispatch-machine-client.pg-qa.cjs');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4L_MACHINE_WORKER!=='YES'||process.getuid?.()!==1000)
 throw Error('qa_only');
const machine=q.pool('da_qa_dispatch_machine_016',process.env.QA_F4L_MACHINE_DB_PASSWORD);
const merchant=q.pool('da_qa_merchant_commerce_app',process.env.QA_MERCHANT_DB_PASSWORD);
const courier=q.pool('da_qa_courier_commerce_app',process.env.QA_COURIER_DB_PASSWORD);
async function main(){
 for(const pool of [merchant,courier,machine]){
  await assert.rejects(pool.query('SET ROLE da_qa_dispatch_owner_016'),/permission denied/i);
  await assert.rejects(pool.query('SELECT * FROM public.da_qa_dispatch_receipt_016'),/permission denied/i);
  await assert.rejects(pool.query(
   'SELECT public.da_qa_dispatch_assign_offer($1::uuid,$2::text,$3::uuid)',
   [q.orders.success.orderId,q.ISS,q.subject('courierA')]),/permission denied/i);
 }
 for(const pool of [merchant,courier]){
  await assert.rejects(pool.query(
   'SELECT public.da_qa_dispatch_assign_attested_016($1::uuid)',
   [q.orders.success.orderId]),/permission denied/i);
 }
 console.log('QA_F4L_MERCHANT_COURIER_DISPATCH_SQL_PERMISSIONS=DENIED');
}
void main().finally(()=>Promise.all([machine.end(),merchant.end(),courier.end()]))
 .catch(e=>{console.error('QA_F4L_SQL_ACL_FAILED',e.message);process.exitCode=1;});
