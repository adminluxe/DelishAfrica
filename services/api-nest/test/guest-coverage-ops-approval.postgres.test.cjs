'use strict';
const assert=require('node:assert/strict');
const {test,before,after}=require('node:test');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{
 fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,f);
const {Pool}=require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const {coverageApprovalDigest,GuestMerchantCoverageStrict}=
 require('../src/guest-checkout/guest-merchant-coverage-strict.ts');
const {PostgresGuestCoverageOpsApprovals}=
 require('../src/guest-checkout/guest-coverage-ops-approval-pg.ts');
const db=new Pool({host:'127.0.0.1',port:55441,user:'afripayadmin',database:'postgres'});
const coverage={
 version:1,revision:1,enabled:true,approvedByMerchant:true,
 zones:[{
  enabled:true,code:'be-ixelles-confirmed',countryCode:'BE',
  postalCodes:['1050'],center:{latitude:50.83,longitude:4.37},
  maxDistanceMeters:1500,
 }],
};
const published={id:'id_thieyp',slug:'thieyp',name:'Thieyp',
 status:'active',delivery:{enabled:true,guestCheckoutCoverage:coverage}};
const input={partnerSlug:'thieyp',countryCode:'BE',postalCode:'1050',
 placeId:'googleplace_test001',latitude:50.83,longitude:4.37};
const digest=coverageApprovalDigest('thieyp',coverage);
const approval=new PostgresGuestCoverageOpsApprovals(db);
const strict=new GuestMerchantCoverageStrict({
 async findPublishedBySlug(){return published;},
},approval);
before(async()=>{
 const port=(await db.query('SELECT inet_server_port() AS p')).rows[0].p;
 assert.equal(port,55441);
 const sql=readFileSync(path.join(__dirname,
  '../../../migrations/20261009_guest_coverage_ops_approvals.sql'),'utf8');
 await db.query(sql);
 await db.query('TRUNCATE da_guest_coverage_ops_approvals');
});
after(async()=>db.end());

test('without independent Ops record published merchant coverage is denied',async()=>{
 assert.equal((await strict.verifyCoverage(input)).allowed,false);
 assert.equal(await approval.isApproved({partnerSlug:'thieyp',coverageDigestSha256:digest}),false);
});
test('explicit ops approval for exact digest enables area',async()=>{
 await db.query(
  `INSERT INTO da_guest_coverage_ops_approvals
      (partner_slug,coverage_sha256,approved_by_ops_subject,expires_at)
    VALUES($1,$2,$3,now()+interval '1 day')`,
  ['thieyp',digest,'ops_test_verified'],
 );
 assert.equal((await strict.verifyCoverage(input)).allowed,true);
 assert.equal((await approval.isApproved({partnerSlug:'thieyp',coverageDigestSha256:digest})),true);
});
test('changed merchant area or revision invalidates historical Ops approval',async()=>{
 const modified={
  ...coverage,revision:2,zones:coverage.zones.map(z=>({...z,maxDistanceMeters:2000})),
 };
 const drift={...published,delivery:{
  ...published.delivery,guestCheckoutCoverage:modified,
 }};
 const current=new GuestMerchantCoverageStrict({
  async findPublishedBySlug(){return drift;},
 },approval);
 assert.equal((await current.verifyCoverage(input)).allowed,false);
});
test('Ops revocation and expiration both deny even if merchant claims approved',async()=>{
 await db.query(
  `UPDATE da_guest_coverage_ops_approvals
       SET revoked_at=now()
     WHERE partner_slug=$1 AND coverage_sha256=$2`,
  ['thieyp',digest],
 );
 assert.equal((await strict.verifyCoverage(input)).allowed,false);
 await db.query(
  `UPDATE da_guest_coverage_ops_approvals
      SET revoked_at=NULL, approved_at=now()-interval '2 days',
          expires_at=now()-interval '1 day'
     WHERE partner_slug=$1 AND coverage_sha256=$2`,
  ['thieyp',digest],
 );
 assert.equal((await strict.verifyCoverage(input)).allowed,false);
});
test('PG reader does not provide a write path and rejects malformed digest',async()=>{
 assert.equal(typeof approval.createApproval,'undefined');
 assert.equal(typeof approval.revokeApproval,'undefined');
 assert.equal(await approval.isApproved({partnerSlug:'../thieyp',coverageDigestSha256:digest}),false);
 assert.equal(await approval.isApproved({partnerSlug:'thieyp',coverageDigestSha256:'abc'}),false);
});
