'use strict';
const assert=require('node:assert/strict');
const {test,before,after}=require('node:test');
const {randomBytes}=require('node:crypto');
const {readFileSync}=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(
 ts.transpileModule(readFileSync(f,'utf8'),{
  fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
 }).outputText,f);
const {Pool}=require('/opt/delishafrica/monorepo/services/api-nest/.runtime-vendor/pg-runtime/node_modules/pg');
const {PublishedPartnerCoveragePolicy}=require('../src/guest-checkout/guest-published-partner-coverage.ts');
const {GuestCanonicalCheckoutStager}=require('../src/guest-checkout/guest-canonical-checkout-stager.ts');
const {GuestCheckoutLedger}=require('../src/guest-checkout/guest-checkout-ledger.ts');
const {GuestPrivateFulfillmentVault}=require('../src/guest-checkout/guest-private-fulfillment-vault.ts');
const lab=new Pool({host:'127.0.0.1',port:55438,database:'postgres',user:'afripayadmin'});
const key=randomBytes(32),encKey=randomBytes(32);
const catalogPartner={
 id:'merchant_laboratory_thieyp',slug:'thieyp',name:'Thieyp lab',
 status:'active',delivery:{enabled:true}
};
let partner=catalogPartner;
const published={async findPublishedBySlug(slug,fallback){
 assert.equal(fallback.length,0);
 return partner?.slug===slug?structuredClone(partner):null;
}};
const coverage=new PublishedPartnerCoveragePolicy(lab,published);
const query={
 partnerSlug:'thieyp',countryCode:'BE',postalCode:'1050',
 latitude:50.83,longitude:4.37,placeId:'googleplace_test001'
};
async function clear(){
 await lab.query('TRUNCATE da_guest_merchant_coverage');
 partner=structuredClone(catalogPartner);
}
async function approve(overrides={}){
 const values={
  coverage_id:'area_lab'+randomBytes(6).toString('hex'),
  partner_slug:'thieyp',service_area_code:'be-brussels-pilot',
  country_code:'BE',postal_codes:['1050','1000'],
  south_lat:50.70,north_lat:50.98,west_lng:4.20,east_lng:4.53,
  approval_status:'approved',approval_source:'ops_review',
  approved_by:'ops:approved_test',approved_at:new Date(Date.now()-86400_000),
  expires_at:new Date(Date.now()+86400_000),revision:1,...overrides,
 };
 await lab.query(
  `INSERT INTO da_guest_merchant_coverage(
     coverage_id,partner_slug,service_area_code,country_code,postal_codes,
     south_lat,north_lat,west_lng,east_lng,
     approval_status,approval_source,approved_by,approved_at,expires_at,revision)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
  Object.values(values)
 );
}
before(async()=>{
 const x=await lab.query('SELECT inet_server_port() AS p');
 assert.equal(x.rows[0].p,55438);
 const sql=readFileSync(path.resolve(__dirname,'../../../migrations/20261009_guest_merchant_coverage.sql'),'utf8');
 await lab.query(sql);
 await clear();
});
after(async()=>lab.end());
test('approved live restaurant explicitly covers a verified postal rectangle',async()=>{
 await clear();await approve();
 assert.deepEqual(await coverage.verifyCoverage(query),{
  allowed:true,serviceAreaCode:'be-brussels-pilot'
 });
});
test('no published merchant approval fails closed',async()=>{
 await clear();
 assert.equal((await coverage.verifyCoverage(query)).allowed,false);
});
test('pending, suspended, revoked and expired approval never allow delivery',async()=>{
 for(const override of [
  {approval_status:'pending',approved_by:null,approved_at:null,expires_at:null},
  {approval_status:'suspended'},
  {approval_status:'revoked'},
  {expires_at:new Date(Date.now()-3600_000),approved_at:new Date(Date.now()-7200_000)}
 ]){
  await clear();await approve(override);
  assert.equal((await coverage.verifyCoverage(query)).allowed,false);
 }
});
test('postcode, country and geographic rectangle must match approval',async()=>{
 await clear();await approve();
 for(const change of [
  {postalCode:'1150'},
  {countryCode:'FR'},
  {latitude:50.1},
  {longitude:5.1},
  {placeId:'malformed!' }
 ]){
  assert.equal((await coverage.verifyCoverage({...query,...change})).allowed,false);
 }
});
test('a different restaurant cannot reuse a partner approval',async()=>{
 await clear();await approve({partner_slug:'ricepeace'});
 assert.equal((await coverage.verifyCoverage(query)).allowed,false);
});
test('published restaurant must be active and have delivery explicitly enabled',async()=>{
 await clear();await approve();
 partner={...catalogPartner,status:'suspended'};
 assert.equal((await coverage.verifyCoverage(query)).allowed,false);
 partner={...catalogPartner,delivery:{enabled:false}};
 assert.equal((await coverage.verifyCoverage(query)).allowed,false);
 partner={...catalogPartner,delivery:{}};
 assert.equal((await coverage.verifyCoverage(query)).allowed,false);
 partner=null;
 assert.equal((await coverage.verifyCoverage(query)).allowed,false);
});
test('backend database outage is not treated as eligibility',async()=>{
 await clear();await approve();
 const faulty=new PublishedPartnerCoveragePolicy(
  {async query(){throw new Error('coverage_db_unavailable')}},
  published
 );
 await assert.rejects(faulty.verifyCoverage(query),/coverage_db_unavailable/);
});
test('end-to-end P5-A with the REAL coverage policy allows only approved merchant area',async()=>{
 await clear();await approve();
 const ledger=new GuestCheckoutLedger(lab,key);
 const vault=new GuestPrivateFulfillmentVault(
  lab,key,new Map([['dek_p5b_lab',encKey]]),'dek_p5b_lab'
 );
 const quote={
  ok:true,version:1,partnerSlug:'thieyp',partnerName:'Thieyp Pilot',
  currency:'eur',availabilityDate:'2026-10-09',availabilityDay:'vendredi',
  items:[{id:'rice001',sku:'rice001',name:'Riz test',category:'Menu',
   quantity:1,unitAmount:2190,lineAmount:2190,scheduledDay:null}],
  subtotal:2190,deliveryFee:0,total:2190,minimumOrderAmount:0,
  quoteFingerprint:'aa'.repeat(32),quotedAt:'2026-10-09T16:00:00.000Z'
 };
 const stager=new GuestCanonicalCheckoutStager(
  ledger,vault,
  {async quote(){return quote}},
  {async resolve(){
   return {
    ok:true,status:'confirmed',
    address:{placeId:query.placeId,
      formattedAddress:'12 Rue du Test, 1050 Ixelles, Belgique',
      latitude:50.83,longitude:4.37,precision:'street_number',
      deliverable:true,evidence:'google_places_new'},
    territory:{countryCode:'BE',postalCode:'1050',city:'Ixelles'},
   };
  }},
  coverage
 );
 const input={
  cart:{partnerSlug:'thieyp',items:[{id:'rice001',quantity:1}],amount:1},
  deliveryPlaceId:query.placeId,
  contact:{name:'Lab Customer',phone:'+32470000000',address:'fake',
   city:'Paris',consent:true}
 };
 const guest=await ledger.issue();
 const result=await stager.prepare(guest.token,input,'lab');
 assert.equal(result.ok,true);
 assert.equal(result.amountCents,2190);
 assert.equal(result.serviceAreaCode,'be-brussels-pilot');
 assert.equal(result.paymentAvailable,false);
 await clear();
 const second=await ledger.issue();
 await assert.rejects(stager.prepare(second.token,input,'lab'),/service_area_denied/);
});
