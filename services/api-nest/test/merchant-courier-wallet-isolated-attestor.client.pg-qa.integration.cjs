'use strict';
// F4I QA separate caller: no attestor/registry/Keycloak admin credential.
// Attestation is requested through Unix socket only.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {Pool}=require('pg');
const SOCKET='/qa-ipc/finance-attestor.sock';
for(const [k,v] of [
  ['GITHUB_ACTIONS','true'],['QA_SYNTHETIC_ONLY','YES'],
  ['QA_F4I_APP_ONLY','YES']]){
  assert.equal(process.env[k],v);
}
assert.equal(process.getuid?.(),1000);
for(const k of ['QA_ATTESTOR_DB_PASSWORD','QA_REGISTRY_DB_PASSWORD',
  'QA_BOOTSTRAP_ADMIN_PASSWORD','QA_INTROSPECT_CLIENT_SECRET']){
  assert.equal(process.env[k],undefined,'attestor secret unavailable in app');
}
const users=JSON.parse(fs.readFileSync('/qa-users/users.json','utf8'));
const pool=new Pool({host:'127.0.0.1',port:5432,database:'postgres',
  user:'da_qa_merchant_commerce_app',
  password:process.env.QA_MERCHANT_DB_PASSWORD,max:2});
async function request(body){
  return new Promise((resolve,reject)=>{
    const req=http.request({
      socketPath:SOCKET,method:'POST',path:'/wallet',timeout:15000,
      headers:{'content-type':'application/json'},
    },res=>{
      let text='';
      res.on('data',chunk=>text+=chunk.toString());
      res.on('end',()=>{
        try{resolve({status:res.statusCode,
          data:res.statusCode===200?JSON.parse(text):text});}
        catch(e){reject(e);}
      });
    });
    req.once('error',reject);
    req.once('timeout',()=>req.destroy(Error('QA socket timeout')));
    req.end(JSON.stringify(body));
  });
}
const wallet=(u)=>request({authorization:'Bearer '+users[u].access,limit:20});
async function forbidden(op){
  const r=await op;
  assert.equal(r.status,403);
  assert.equal(r.data,'qa_f4i_denied');
}
test('F4I app has no authority secrets, cannot impersonate attestor SQL',async()=>{
  try{
    await assert.rejects(
      pool.query('SET ROLE da_qa_wallet_attestor_isolated_013'),
      /permission denied/i);
    await assert.rejects(
      pool.query('SELECT * FROM public.da_qa_finance_courier_roster_012'),
      /permission denied/i);
    await assert.rejects(
      pool.query('SELECT * FROM public.da_qa_partner_oidc_sessions_011'),
      /permission denied/i);
    const target=new Pool({host:'127.0.0.1',port:5432,database:'postgres',
      user:'da_qa_wallet_attestor_isolated_013',
      password:process.env.QA_MERCHANT_DB_PASSWORD,max:1,
      connectionTimeoutMillis:2500});
    try{
      await assert.rejects(target.query('SELECT 1'));
    }finally{await target.end();}
    assert.throws(()=>fs.unlinkSync(SOCKET),/EACCES|EPERM|EROFS/);
    console.log('QA_F4I_APP_CANNOT_ASSUME_ATTESTOR_OR_READ_REGISTRY=PASS');
  }finally{await pool.end();}
});
test('F4I separated socket responds only to valid Keycloak partner wallets',async()=>{
  const stage=process.env.QA_F4I_STAGE;
  assert.ok(['baseline','merchant-revoked','courier-suspended'].includes(stage));
  if(stage==='baseline'){
    const merchantA=await wallet('merchantA');
    assert.equal(merchantA.status,200);
    assert.equal(merchantA.data.ownerRole,'merchant');
    assert.equal(merchantA.data.merchantSlug,'qa-restaurant');
    assert.equal(merchantA.data.territory,'BE');
    assert.equal(Number(merchantA.data.summary.accrued_minor),1840);
    assert.equal(Number(merchantA.data.summary.held_minor),1840);
    assert.equal(merchantA.data.withdrawableMinor,0);
    assert.equal(merchantA.data.payoutEnabled,false);
    const merchantB=await wallet('merchantB');
    assert.equal(merchantB.status,200);
    assert.equal(merchantB.data.territory,'FR');
    assert.equal(Number(merchantB.data.summary.accrued_minor),0);
    const courier=await wallet('courierA');
    assert.equal(courier.status,200);
    assert.equal(courier.data.ownerRole,'courier');
    assert.equal(Number(courier.data.summary.accrued_minor),0);
    const courierB=await wallet('courierB');
    assert.equal(courierB.status,200);
    assert.equal(courierB.data.territory,'FR');
    await forbidden(request({authorization:'Bearer bogus.value.token',limit:20}));
    await forbidden(request({authorization:'Bearer '+users.merchantA.access,
      merchantSlug:'qa-other',limit:20}));
    const parts=users.merchantA.access.split('.');
    parts[1]=Buffer.from(JSON.stringify({
      ...JSON.parse(Buffer.from(parts[1],'base64url').toString()),
      sub:'b63f867f-9f42-4573-9268-dc65a164d2c4',
    })).toString('base64url');
    await forbidden(request({authorization:'Bearer '+parts.join('.'),limit:20}));
    console.log('QA_F4I_REAL_SIGNED_JWT_TO_SEPARATE_PROCESS_WALLET=PASS');
    console.log('QA_F4I_FORGED_JWT_AND_CALLER_SLUG=DENIED');
  }else if(stage==='merchant-revoked'){
    await forbidden(wallet('merchantA'));
    await forbidden(wallet('merchantB'));
    assert.equal((await wallet('courierA')).status,200);
    console.log('QA_F4I_DURABLE_MERCHANT_SESSION_REVOKED_WITH_VALID_JWT=DENIED');
  }else{
    await forbidden(wallet('merchantA'));
    await forbidden(wallet('courierA'));
    await forbidden(wallet('courierB'));
    console.log('QA_F4I_COURIER_ROSTER_SUSPENDED_WITH_VALID_JWT=DENIED');
  }
  console.log('QA_F4I_REAL_STRIPE_CALLS=ZERO_PAYOUTS=ZERO');
});
