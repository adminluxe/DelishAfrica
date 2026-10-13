'use strict';
// F4L preparation requires the PREVIOUS F4K authenticated mutation service
// for Merchant accepted->ready. No superuser writes to operational state.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const http=require('node:http');
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'
 ||process.env.QA_F4I_APP_ONLY!=='YES'||process.getuid?.()!==1000
 ||process.env.QA_ATTESTOR_DB_PASSWORD!==undefined
 ||process.env.QA_BOOTSTRAP_ADMIN_PASSWORD!==undefined)
 throw Error('qa_f4l_merchant_preparation_denied');
const users=JSON.parse(fs.readFileSync('/qa-users/users.json','utf8'));
const orders=JSON.parse(fs.readFileSync('/qa-users/f4l-orders.json','utf8'));
const sock='/qa-ipc/finance-transition.sock';
async function hit(orderId,next){
 return new Promise((resolve,reject)=>{
  const req=http.request({socketPath:sock,path:'/transition',method:'POST',
   timeout:12000,headers:{'content-type':'application/json'}},res=>{
   let raw='';res.on('data',x=>raw+=x);
   res.on('end',()=>resolve({status:res.statusCode,
    body:res.statusCode===200?JSON.parse(raw):raw}));
  });
  req.once('error',reject);req.once('timeout',()=>req.destroy(Error('timeout')));
  req.end(JSON.stringify({authorization:'Bearer '+users.merchantA.access,
   orderId,next}));
 });
}
(async()=>{
 for(const [name,order] of Object.entries(orders)){
  const accept=await hit(order.orderId,'accepted');
  assert.equal(accept.status,200,'Merchant attested accepted '+name);
  if(name!=='unready'){
   const ready=await hit(order.orderId,'ready');
   assert.equal(ready.status,200,'Merchant attested ready '+name);
  }
 }
 console.log('QA_F4L_F4K_SIGNED_MERCHANT_PREP_ALL_ORDERS=PASS');
})().catch(e=>{console.error('QA_F4L_PREP_FAILED',e.message);process.exitCode=1;});
