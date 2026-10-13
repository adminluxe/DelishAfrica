'use strict';
// Private F4L integration client, synthetic Keycloak+PG17 only.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const {Pool}=require('pg');
const ISS='https://127.0.0.1/realms/da-wallet-partners-qa';
const CLIENT='da-f4l-dispatch-machine-qa';
const OA='a43f867f-9f42-4573-9268-dc65a164d2c2';
const OB='a43f867f-9f42-4573-9268-dc65a164d2c4';
const users=JSON.parse(fs.readFileSync('/qa-users/users.json','utf8'));
const orders=JSON.parse(fs.readFileSync('/qa-users/f4l-orders.json','utf8'));
const subject=name=>JSON.parse(Buffer.from(
 users[name].access.split('.')[1],'base64url')).sub;
function pool(login,password,max=4){
 return new Pool({host:'127.0.0.1',port:5432,database:'postgres',
  user:login,password,max,connectionTimeoutMillis:5000,statement_timeout:22000});
}
async function machineToken(){
 const r=await fetch(ISS+'/protocol/openid-connect/token',{
  method:'POST',redirect:'manual',signal:AbortSignal.timeout(9000),
  headers:{authorization:'Basic '+Buffer.from(CLIENT+':'+
   process.env.QA_F4L_MACHINE_CLIENT_SECRET).toString('base64'),
   'content-type':'application/x-www-form-urlencoded'},
  body:new URLSearchParams({grant_type:'client_credentials',scope:'da.dispatch.assign'})});
 assert.equal(r.status,200);
 return (await r.json()).access_token;
}
function socketCall(socket,path,payload){
 return new Promise((resolve,reject)=>{
  const req=http.request({socketPath:socket,path,method:'POST',timeout:18000,
   headers:{'content-type':'application/json'}},res=>{
   let body='';res.on('data',x=>body+=x);
   res.on('end',()=>resolve({status:res.statusCode,
    body:res.statusCode===200?JSON.parse(body):body}));
  });
  req.on('error',reject);req.on('timeout',()=>req.destroy(Error('qa_socket_timeout')));
  req.end(JSON.stringify(payload));
 });
}
const SOCK='/qa-dispatch-ipc/dispatch-attestor.sock';
function payload(order,token,challenge,opts={}){
 return {authorization:'Bearer '+token,challengeId:challenge,
  orderId:orders[order].orderId,organizationId:opts.organizationId||OA,
  territory:opts.territory||'BE',courierIssuer:ISS,
  courierSubject:subject(opts.courier||'courierA')};
}
async function ticket(conn,order,token,opts={}){
 const x=await conn.query('SELECT public.da_qa_dispatch_begin_016() AS id');
 return socketCall(SOCK,'/attest',payload(order,token,x.rows[0].id,opts));
}
async function assign(db,order,token,opts={}){
 const conn=await db.connect();
 try{
  const t=await ticket(conn,order,token,opts);
  if(t.status!==200)return t;
  const q=await conn.query(
   'SELECT public.da_qa_dispatch_assign_attested_016($1::uuid) AS data',
   [t.body.ticketId]);
  return {status:200,body:q.rows[0].data};
 }finally{conn.release();}
}
async function merchantTransition(order,next){
 return socketCall('/qa-ipc/finance-transition.sock','/transition',{
  authorization:'Bearer '+users.merchantA.access,
  orderId:orders[order].orderId,next});
}
async function courierTransition(order,next){
 return socketCall('/qa-ipc/finance-transition.sock','/transition',{
  authorization:'Bearer '+users.courierA.access,
  orderId:orders[order].orderId,next});
}
module.exports={ISS,CLIENT,OA,OB,users,orders,subject,pool,machineToken,
 socketCall,SOCK,payload,ticket,assign,merchantTransition,courierTransition};
