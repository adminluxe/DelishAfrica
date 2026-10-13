'use strict';
// Private F4L OIDC->SQL attestation service. Neither app nor worker gets
// its database password or Keycloak introspection secret. Unix socket ONLY.
const http=require('node:http');
const fs=require('node:fs');
const {Pool}=require('pg');
const {verifyMachineAuthorization}=require('./f4l-dispatch-oidc-verifier.pg-qa.cjs');
const SOCK='/qa-dispatch-ipc/dispatch-attestor.sock';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
if(process.env.GITHUB_ACTIONS!=='true'||process.env.QA_SYNTHETIC_ONLY!=='YES'||
 process.env.QA_F4L_PRIVATE_ATTESTOR!=='YES'||
 process.getuid?.()!==1002||process.env.NODE_EXTRA_CA_CERTS!=='/qa-tls/qa.crt'||
 !process.env.QA_F4L_ATTESTOR_DB_PASSWORD||
 !process.env.QA_INTROSPECT_CLIENT_SECRET||
 process.env.QA_F4L_MACHINE_CLIENT_SECRET!==undefined||
 process.env.QA_BOOTSTRAP_ADMIN_PASSWORD!==undefined)
 throw Error('qa_f4l_private_attestor_boundary_denied');
const pool=new Pool({host:'127.0.0.1',port:5432,database:'postgres',
 user:'da_qa_dispatch_attestor_016',password:process.env.QA_F4L_ATTESTOR_DB_PASSWORD,
 max:10,connectionTimeoutMillis:5000,statement_timeout:9000});
function exact(input,names){
 return input&&typeof input==='object'&&!Array.isArray(input)&&
 Object.keys(input).sort().join(',')===names.slice().sort().join(',');
}
const server=http.createServer(async(req,res)=>{
 const fail=()=>{res.writeHead(403,{'content-type':'text/plain'});res.end('qa_f4l_denied');};
 if(req.url!=='/attest'||req.method!=='POST'){fail();return;}
 let raw='';
 try{
  for await(const chunk of req){
   raw+=chunk.toString('utf8');
   if(raw.length>16000)throw Error('qa_f4l_body_too_large');
  }
  const b=JSON.parse(raw);
  if(!exact(b,['authorization','challengeId','orderId','organizationId',
   'territory','courierIssuer','courierSubject'])
   ||!UUID.test(b.challengeId||'')||!UUID.test(b.orderId||'')
   ||!UUID.test(b.organizationId||'')||!UUID.test(b.courierSubject||'')
   ||typeof b.territory!=='string'||!/^[A-Z]{2}$/.test(b.territory)
   ||typeof b.courierIssuer!=='string'||b.courierIssuer.length>200)
   throw Error('qa_f4l_invalid_body');
  const id=await verifyMachineAuthorization(
   b.authorization,process.env.QA_INTROSPECT_CLIENT_SECRET);
  const result=await pool.query(
   'SELECT public.da_qa_dispatch_attest_016('+
   '$1::uuid,$2::text,$3::uuid,$4::text,$5::uuid,$6::char(2),'+
   '$7::text,$8::uuid,$9::text,$10::uuid) AS ticket',
   [b.challengeId,id.issuer,id.subject,id.clientId,b.organizationId,
    b.territory,id.tokenDigest,b.orderId,b.courierIssuer,b.courierSubject]);
  const ticket=result.rows[0]?.ticket;
  if(!UUID.test(ticket||''))throw Error('qa_f4l_ticket_missing');
  res.writeHead(200,{'content-type':'application/json'});
  res.end(JSON.stringify({ticketId:ticket}));
 }catch(e){fail();}
});
(async()=>{
 const x=await pool.query('SELECT session_user AS login');
 if(x.rows[0]?.login!=='da_qa_dispatch_attestor_016')throw Error('qa_f4l_wrong_db_login');
 if(fs.existsSync(SOCK))throw Error('qa_f4l_stale_socket');
 await new Promise((resolve,reject)=>{
  server.once('error',reject);
  server.listen(SOCK,resolve);
 });
 fs.chmodSync(SOCK,0o660);
 console.log('QA_F4L_PRIVATE_OIDC_ATTESTOR_SOCKET=PASS');
})().catch(()=>{console.error('QA_F4L_PRIVATE_ATTESTOR_FAILED');process.exitCode=1;});
for(const s of ['SIGTERM','SIGINT'])process.once(s,()=>server.close(()=>pool.end()));
