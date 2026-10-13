'use strict';
// F4K QA unprivileged APP cannot mint tickets. It requests only an
// operational transition against a dedicated private socket. Test partner
// JWTs and orders are synthetic, signed by a real disposable Keycloak.
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const http=require('node:http');
const {Pool}=require('pg');
const socket='/qa-ipc/finance-transition.sock';
if(process.env.GITHUB_ACTIONS!=='true'||
   process.env.QA_SYNTHETIC_ONLY!=='YES'||
   process.env.QA_F4I_APP_ONLY!=='YES'||
   process.getuid?.()!==1000)throw Error('qa_f4k_synthetic_only');
for(const x of ['QA_ATTESTOR_DB_PASSWORD','QA_REGISTRY_DB_PASSWORD',
  'QA_INTROSPECT_CLIENT_SECRET','QA_BOOTSTRAP_ADMIN_PASSWORD',
  'KC_BOOTSTRAP_ADMIN_PASSWORD','QA_CLIENT_DB_PASSWORD'])
  assert.equal(process.env[x],undefined);
const stage=process.env.QA_F4K_STAGE;
assert.ok(['merchant','courier','held','revoked'].includes(stage));
const users=JSON.parse(fs.readFileSync('/qa-users/users.json','utf8'));
const orders=JSON.parse(fs.readFileSync('/qa-users/f4k-orders.json','utf8'));
const client=new Pool({host:'127.0.0.1',database:'postgres',port:5432,
  user:'da_qa_merchant_commerce_app',
  password:process.env.QA_MERCHANT_DB_PASSWORD,max:1,
  connectionTimeoutMillis:3500,statement_timeout:6500});
function hit(role,order,next,extra={}){
  const access=users[role]?.access;
  return new Promise((resolve,reject)=>{
    const req=http.request({socketPath:socket,path:'/transition',
      method:'POST',timeout:16000,
      headers:{'content-type':'application/json'}},res=>{
      let data='';
      res.on('data',x=>data+=x.toString('utf8'));
      res.on('end',()=>{
        try{resolve({status:res.statusCode,
          body:res.statusCode===200?JSON.parse(data):data});}
        catch(e){reject(e);}
      });
    });
    req.once('error',reject);
    req.once('timeout',()=>req.destroy(Error('f4k_socket_timeout')));
    req.end(JSON.stringify({
      authorization:'Bearer '+access,
      orderId:order,next,...extra,
    }));
  });
}
async function allowed(role,order,next,replayed){
  const r=await hit(role,order,next);
  assert.equal(r.status,200,role+' '+next+' must pass');
  assert.equal(r.body.ownerRole,role.startsWith('merchant')?
    'merchant':'courier');
  assert.equal(r.body.orderId,order);
  assert.equal(r.body.state,next);
  assert.equal(r.body.replayed,replayed);
  assert.equal(r.body.withdrawableMinor,0);
  assert.equal(r.body.payoutEnabled,false);
}
async function denied(role,order,next,extra={}){
  const r=await hit(role,order,next,extra);
  assert.equal(r.status,403,role+' '+next+' must fail closed');
  assert.equal(r.body,'qa_f4k_denied');
}
test('F4K mutation-only separate process and unprivileged client',async()=>{
  try{
    await assert.rejects(client.query(
      'SET ROLE da_qa_fulfillment_writer_015'),/permission denied/i);
    await assert.rejects(client.query(
      'SELECT * FROM public.da_qa_fulfillment_receipt_015'),
      /permission denied/i);
    await assert.rejects(client.query(
      'SELECT public.da_qa_merchant_transition('+
      '$1::uuid,$2::varchar,$3::text)',
      [orders.deliver.orderId,'qa-restaurant','accepted']),
      /permission denied/i);
    await assert.rejects(client.query(
      'SELECT public.da_qa_dispatch_assign_offer('+
      '$1::uuid,$2::text,$3::uuid)',
      [orders.deliver.orderId,
        'https://127.0.0.1/realms/da-wallet-partners-qa',
        'a43f867f-9f42-4573-9268-dc65a164d2c2']),
      /permission denied/i);
    console.log('QA_F4K_APP_CANNOT_ASSUME_WRITER_OR_CALL_007=PASS');
  }finally{await client.end();}
});
test('F4K signed transitions and cross-partner protections',async()=>{
  const delivery=orders.deliver.orderId,held=orders.refund.orderId;
  if(stage==='merchant'){
    await denied('merchantB',delivery,'accepted');
    await denied('courierA',delivery,'accepted');
    await denied('merchantA',delivery,'picked_up');
    await denied('merchantA',delivery,'accepted',
      {merchantSlug:'qa-other'});
    const original=users.merchantA.access;
    const parts=original.split('.');
    const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());
    parts[1]=Buffer.from(JSON.stringify({
      ...payload,sub:'b63f867f-9f42-4573-9268-dc65a164d2c4',
    })).toString('base64url');
    const token=users.merchantA.access;
    users.merchantA.access=parts.join('.');
    try{await denied('merchantA',delivery,'accepted')}
    finally{users.merchantA.access=token;}
    await allowed('merchantA',delivery,'accepted',false);
    await allowed('merchantA',delivery,'accepted',true);
    await allowed('merchantA',delivery,'ready',false);
    await allowed('merchantA',held,'accepted',false);
    await allowed('merchantA',held,'ready',false);
    console.log('QA_F4K_SIGNED_MERCHANT_ACCEPT_READY_IDEMPOTENT=PASS');
    console.log('QA_F4K_FOREIGN_MERCHANT_AND_FORGED_JWT=DENIED');
  }else if(stage==='courier'){
    await denied('courierB',delivery,'accepted');
    await denied('merchantA',delivery,'delivered');
    await denied('courierA',delivery,'delivered');
    await allowed('courierA',delivery,'accepted',false);
    await allowed('courierA',delivery,'picked_up',false);
    await allowed('courierA',delivery,'delivered',false);
    await allowed('courierA',delivery,'delivered',true);
    await allowed('courierA',held,'accepted',false);
    await denied('courierA',held,'delivered');
    console.log('QA_F4K_SIGNED_COURIER_ACCEPT_PICKUP_DELIVER_IDEMPOTENT=PASS');
    console.log('QA_F4K_FOREIGN_COURIER_AND_SKIP_STAGE=DENIED');
  }else if(stage==='held'){
    await denied('courierA',held,'picked_up');
    await denied('merchantA',held,'ready');
    console.log('QA_F4K_REFUND_HOLD_BLOCKS_PICKUP_AND_MERCHANT=PASS');
  }else{
    await denied('merchantA',delivery,'ready');
    await denied('courierA',delivery,'delivered');
    console.log('QA_F4K_REVOKED_CONTRACT_ROSTER_VALID_JWT=DENIED');
  }
  console.log('QA_F4K_REAL_FUNDS_AND_PAYOUTS=ZERO');
});
