'use strict';
// F4L protected machine worker, UID 1000, no attestor/admin/provider secret.
// True Keycloak client_credentials; true PostgreSQL 17 row locks; fake money.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {Pool}=require('pg');
const ISS='https://127.0.0.1/realms/da-wallet-partners-qa';
const CLIENT='da-f4l-dispatch-machine-qa',SCOPE='da.dispatch.assign';
const OA='a43f867f-9f42-4573-9268-dc65a164d2c2';
const OB='a43f867f-9f42-4573-9268-dc65a164d2c4';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const stage=process.env.QA_F4L_STAGE||'baseline';
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4L_MACHINE_WORKER!=='YES'
 ||process.getuid?.()!==1000
 ||process.env.NODE_EXTRA_CA_CERTS!=='/qa-tls/qa.crt'
 ||(process.env.QA_F4L_MACHINE_CLIENT_SECRET||'').length<30
 ||(process.env.QA_F4L_MACHINE_DB_PASSWORD||'').length<30
 ||process.env.QA_F4L_ATTESTOR_DB_PASSWORD!==undefined
 ||process.env.QA_INTROSPECT_CLIENT_SECRET!==undefined
 ||process.env.QA_BOOTSTRAP_ADMIN_PASSWORD!==undefined)
 throw Error('qa_f4l_worker_boundary_denied');
const users=JSON.parse(fs.readFileSync('/qa-users/users.json','utf8'));
const orders=JSON.parse(fs.readFileSync('/qa-users/f4l-orders.json','utf8'));
const sub=(role)=>JSON.parse(Buffer.from(
 users[role].access.split('.')[1],'base64url')).sub;
const makePool=(user,password,max=2)=>new Pool({
 host:'127.0.0.1',port:5432,database:'postgres',user,password,max,
 connectionTimeoutMillis:5000,statement_timeout:20000});
const machine=makePool('da_qa_dispatch_machine_016',
 process.env.QA_F4L_MACHINE_DB_PASSWORD,12);
const merchant=makePool('da_qa_merchant_commerce_app',
 process.env.QA_MERCHANT_DB_PASSWORD);
const courier=makePool('da_qa_courier_commerce_app',
 process.env.QA_COURIER_DB_PASSWORD);
async function token(scope=SCOPE){
 const r=await fetch(ISS+'/protocol/openid-connect/token',{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),
  headers:{authorization:'Basic '+Buffer.from(CLIENT+':'+
   process.env.QA_F4L_MACHINE_CLIENT_SECRET).toString('base64'),
   'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'client_credentials',scope})});
 assert.equal(r.status,200,'client credentials issued by real Keycloak');
 const data=await r.json();assert.ok(data.access_token);
 return data.access_token;
}
function sock(payload){
 return new Promise((resolve,reject)=>{
  const req=http.request({socketPath:'/qa-dispatch-ipc/dispatch-attestor.sock',
   path:'/attest',method:'POST',timeout:15000,
   headers:{'content-type':'application/json'}},res=>{
   let body='';res.on('data',x=>body+=x.toString());
   res.on('end',()=>{
    try{resolve({status:res.statusCode,
     body:res.statusCode===200?JSON.parse(body):body});}
    catch(e){reject(e);}
   });
  });
  req.on('error',reject);
  req.on('timeout',()=>req.destroy(Error('qa_f4l_attestor_timeout')));
  req.end(JSON.stringify(payload));
 });
}
function params(order,access,challenge,opts={}){
 const who=opts.courier||'courierA';
 return {
  authorization:'Bearer '+access,challengeId:challenge,
  orderId:orders[order].orderId,organizationId:opts.organizationId||OA,
  territory:opts.territory||'BE',courierIssuer:ISS,
  courierSubject:sub(who),
 };
}
async function ticket(conn,order,access,opts={}){
 const q=await conn.query(
  'SELECT public.da_qa_dispatch_begin_016() AS challenge');
 assert.match(q.rows[0]?.challenge,UUID);
 return sock(params(order,access,q.rows[0].challenge,opts));
}
async function assign(order,access,opts={}){
 const conn=await machine.connect();
 try{
  const t=await ticket(conn,order,access,opts);
  if(t.status!==200)return {status:t.status,body:t.body};
  const r=await conn.query(
   'SELECT public.da_qa_dispatch_assign_attested_016($1::uuid) AS receipt',
   [t.body.ticketId]);
  return {status:200,body:r.rows[0].receipt};
 }finally{conn.release();}
}
async function success(order,access,replayed=false){
 const r=await assign(order,access);
 assert.equal(r.status,200,'OIDC + SQL assignment succeeded: '+order);
 assert.equal(r.body.mode,'qa_synthetic_only');
 assert.equal(r.body.orderId,orders[order].orderId);
 assert.equal(r.body.state,'offered');
 assert.equal(r.body.replayed,replayed);
 assert.equal(r.body.payoutEnabled,false);
 assert.equal(r.body.withdrawableMinor,0);
}
async function deniedSql(order,access,re){
 await assert.rejects(assign(order,access),re);
}
async function appDenied(){
 for(const app of [merchant,courier,machine]){
  await assert.rejects(app.query(
   'SET ROLE da_qa_dispatch_owner_016'),/permission denied/i);
  await assert.rejects(app.query(
   'SELECT * FROM public.da_qa_dispatch_receipt_016'),/permission denied/i);
  await assert.rejects(app.query(
   'SELECT public.da_qa_dispatch_assign_offer($1::uuid,$2::text,$3::uuid)',
   [orders.success.orderId,ISS,sub('courierA')]),/permission denied/i);
 }
 for(const app of [merchant,courier]){
  await assert.rejects(app.query(
   'SELECT public.da_qa_dispatch_assign_attested_016($1::uuid)',
   [orders.success.orderId]),/permission denied/i);
 }
 await assert.rejects(machine.query(
  'SELECT public.da_qa_dispatch_attest_016('+
  '$1::uuid,$2::text,$3::uuid,$4::text,$5::uuid,$6::char(2),'+
  '$7::text,$8::uuid,$9::text,$10::uuid)',
  [orders.success.orderId,ISS,sub('courierA'),CLIENT,OA,'BE',
   'a'.repeat(64),orders.success.orderId,ISS,sub('courierA')]),
  /permission denied/i);
 console.log('QA_F4L_ALL_MOBILE_AND_MACHINE_DIRECT_SQL_007=DENIED');
}
async function attackerDenied(access,order){
 const conn=await machine.connect();
 try{
  const challenge=(await conn.query(
   'SELECT public.da_qa_dispatch_begin_016() AS challenge')).rows[0].challenge;
  const r=await sock(params(order,access,challenge));
  assert.equal(r.status,403,'private attestor rejects forged/mobile token');
 }finally{conn.release();}
}
async function f4kCourier(order,next){
 return new Promise((resolve,reject)=>{
  const req=http.request({socketPath:'/qa-ipc/finance-transition.sock',
   path:'/transition',method:'POST',timeout:12000,
   headers:{'content-type':'application/json'}},res=>{
   let body='';res.on('data',x=>body+=x);
   res.on('end',()=>resolve(res.statusCode));
  });
  req.on('error',reject);
  req.end(JSON.stringify({authorization:'Bearer '+users.courierA.access,
   orderId:orders[order].orderId,next}));
 });
}
async function main(){
 const access=await token();
 if(stage==='baseline'){
  await appDenied();
  await attackerDenied(users.merchantA.access,'success');
  await attackerDenied(users.courierA.access,'success');
  await attackerDenied(await token('openid'),'success');
  const forged=access.split('.');
  const obj=JSON.parse(Buffer.from(forged[1],'base64url'));
  forged[1]=Buffer.from(JSON.stringify({...obj,sub:sub('courierA')}))
   .toString('base64url');
  await attackerDenied(forged.join('.'),'success');
  await success('success',access,false);
  await success('same',access,false);
  await success('same',access,true);
  const multiple=await Promise.all(Array.from({length:7},()=>
   assign('simultaneous',access)));
  assert.equal(multiple.filter(x=>x.status===200&&
   x.body.replayed===false).length,1,'one winner');
  assert.equal(multiple.filter(x=>x.status===200&&
   x.body.replayed===true).length,6,'six idempotent replays');
  await assert.rejects(assign('foreign',access,{courier:'courierB'}),
   /qa_f4l_courier_roster_or_territory_denied/);
  await deniedSql('unready',access,/qa_f4l_order_not_ready/);
  assert.equal((await assign('foreign',access,{
   organizationId:OB,territory:'FR'})).status,403);
  await success('picked',access,false);
  assert.equal(await f4kCourier('picked','accepted'),200);
  assert.equal(await f4kCourier('picked','picked_up'),200);
  await deniedSql('picked',access,/qa_f4l_reassignment_or_picked_up_denied/);
  const conn=await machine.connect();
  try{
   const t=await ticket(conn,'reassign',access);
   assert.equal(t.status,200);
   const sql='SELECT public.da_qa_dispatch_assign_attested_016($1::uuid)';
   await conn.query(sql,[t.body.ticketId]);
   await assert.rejects(conn.query(sql,[t.body.ticketId]),
    /qa_f4l_ticket_replayed_or_expired/);
  }finally{conn.release();}
  console.log('QA_F4L_OIDC_MOBILE_FORGED_SCOPE=DENIED');
  console.log('QA_F4L_CONCURRENT_SEVEN_OFFERS_EXACTLY_ONE_RECEIPT=PASS');
  console.log('QA_F4L_ORG_UNREADY_PICKED_UP_REASSIGN=DENIED');
  console.log('QA_F4L_IDEMPOTENT_MACHINE_OPERATION=PASS');
 }else if(stage==='reassignment'){
  await assert.rejects(assign('reassign',access,{courier:'courierB'}),
   /qa_f4l_reassignment_or_picked_up_denied/);
  console.log('QA_F4L_SAME_ORG_COURIER_REASSIGNMENT=DENIED');
 }else if(stage==='assignment-hold'){
  const conn=await machine.connect();
  let begun=false;
  try{
   const t=await ticket(conn,'assignThenRefund',access);
   assert.equal(t.status,200);
   await conn.query('BEGIN');begun=true;
   const q=await conn.query(
    'SELECT public.da_qa_dispatch_assign_attested_016($1::uuid) AS receipt',
    [t.body.ticketId]);
   assert.equal(q.rows[0].receipt.state,'offered');
   console.log('QA_F4L_ASSIGNMENT_LOCK_ACQUIRED=YES');
   await conn.query("SELECT pg_sleep(7)");
   await conn.query('COMMIT');begun=false;
   console.log('QA_F4L_ASSIGNMENT_BEFORE_REFUND_COMMITTED=PASS');
  }finally{
   if(begun)await conn.query('ROLLBACK').catch(()=>{});
   conn.release();
  }
 }else if(stage==='refund-first'){
  await deniedSql('refundFirst',access,/qa_f4l_order_payment_hold/);
  console.log('QA_F4L_REFUND_FIRST_BLOCKS_DISPATCH=PASS');
 }else if(stage==='refund-race'){
  await deniedSql('refundConcurrent',access,/qa_f4l_order_payment_hold/);
  console.log('QA_F4L_REFUND_LOCK_ORDERING_BLOCKS_DISPATCH=PASS');
 }else if(stage==='courier-revoked'){
  await deniedSql('revokedCourier',access,
   /qa_f4l_courier_roster_or_territory_denied/);
  console.log('QA_F4L_COURIER_ROSTER_REVOKED=DENIED');
 }else if(stage==='org-moved'){
  await deniedSql('orgMove',access,
   /qa_f4l_courier_roster_or_territory_denied/);
  console.log('QA_F4L_COURIER_ORGANIZATION_TERRITORY_CHANGED=DENIED');
 }else if(stage==='machine-revoked'){
  const r=await assign('machineRevoked',access);
  assert.equal(r.status,403);
  console.log('QA_F4L_MACHINE_REGISTRY_REVOKED=DENIED');
 }else throw Error('qa_f4l_stage_unsupported');
}
void main().finally(()=>Promise.all([machine.end(),merchant.end(),courier.end()]))
 .catch(e=>{console.error('QA_F4L_WORKER_STAGE_FAILED_'+stage,e.message);
  process.exitCode=1;});
