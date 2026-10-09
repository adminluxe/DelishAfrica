'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{
  fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,f);
const {
  GuestMerchantCoverageStrict,coverageApprovalDigest,
}=require('../src/guest-checkout/guest-merchant-coverage-strict.ts');
const input={
  partnerSlug:'thieyp',countryCode:'BE',postalCode:'1050',
  placeId:'googleplace_test001',latitude:50.83,longitude:4.37,
};
function partner({
  status='active',enabled=true,approvedByMerchant=true,
  postcode='1050',radius=7000,coverageEnabled=true,
  center={latitude:50.83,longitude:4.37},revision=1,
}={}) {
 return {id:'merchant_id_thieyp',slug:'thieyp',name:'Thieyp',status,
  delivery:{enabled,serviceAreaLabel:'Bruxelles/Ixelles',deliveryFee:290,
   guestCheckoutCoverage:{version:1,revision,enabled:coverageEnabled,
    approvedByMerchant,
    zones:[{enabled:true,code:'be-ixelles-confirmed',countryCode:'BE',
            postalCodes:[postcode],center,maxDistanceMeters:radius}]
  }}};
}
function policy(result,approved=true) {
 const calls={catalog:[],ops:[]};
 const strict=new GuestMerchantCoverageStrict(
  {async findPublishedBySlug(slug,fallback){
    calls.catalog.push({slug,fallback});return result;
  }},
  {async isApproved(payload){
    calls.ops.push(payload);return approved;
  }},
 );
 return {strict,calls};
}
test('requires published active merchant, exact area and independent Ops attestation',async()=>{
 const source=partner(),{strict,calls}=policy(source);
 const r=await strict.verifyCoverage(input);
 assert.deepEqual(r,{allowed:true,serviceAreaCode:'be-ixelles-confirmed'});
 assert.equal(calls.catalog.length,1);
 assert.deepEqual(calls.catalog[0].fallback,[]);
 assert.equal(calls.ops.length,1);
 assert.equal(calls.ops[0].coverageDigestSha256,
  coverageApprovalDigest('thieyp',source.delivery.guestCheckoutCoverage));
});
test('marketing labels and missing explicit coverage never permit payments',async()=>{
 for(const entry of [
  {...partner(),delivery:{enabled:true,serviceAreaLabel:'Bruxelles/Ixelles',deliveryFee:290}},
  {...partner(),delivery:{enabled:true,guestCheckoutCoverage:null}},
  {...partner(),delivery:{enabled:true,guestCheckoutCoverage:{version:1,zones:[]}}},
  null,
 ]) {
  const {strict,calls}=policy(entry);
  assert.equal((await strict.verifyCoverage(input)).allowed,false);
  assert.equal(calls.ops.length,0);
 }
});
test('suspended, disabled, unapproved by merchant, zone mismatch or oversized radius fail closed',async()=>{
 for(const option of [
  {status:'suspended'},{status:'draft'},{enabled:false},
  {approvedByMerchant:false},{coverageEnabled:false},{postcode:'1000'},
  {radius:99},{radius:25001},{revision:0},
 ]) {
  const {strict}=policy(partner(option));
  assert.equal((await strict.verifyCoverage(input)).allowed,false,JSON.stringify(option));
 }
});
test('postcodes do not override real merchant delivery distance',async()=>{
 const strict=policy(partner({radius:1000})).strict;
 assert.equal((await strict.verifyCoverage({...input,latitude:50.9})).allowed,false);
 assert.equal((await strict.verifyCoverage({...input,latitude:50.831})).allowed,true);
});
test('country, invalid coordinates and spoofed place ids are rejected',async()=>{
 const strict=policy(partner()).strict;
 for(const bad of [
  {countryCode:'FR'},{latitude:Infinity},{longitude:-181},
  {postalCode:'1050 OR TRUE'},{placeId:'x'}, {partnerSlug:'../thieyp'},
  {postalCode:'9999'},
 ]) assert.equal((await strict.verifyCoverage({...input,...bad})).allowed,false);
});
test('no Ops ledger entry or broken Ops registry always denies',async()=>{
 assert.equal((await policy(partner(),false).strict.verifyCoverage(input)).allowed,false);
 const service=new GuestMerchantCoverageStrict(
  {async findPublishedBySlug(){return partner();}},
  {async isApproved(){throw Error('ops_registry_down');}},
 );
 assert.equal((await service.verifyCoverage(input)).allowed,false);
});
test('Ops approval digest is bound to full merchant-specific policy revision',async()=>{
 const a=partner(),b=partner({revision:2});
 const digestA=coverageApprovalDigest('thieyp',a.delivery.guestCheckoutCoverage);
 const digestB=coverageApprovalDigest('thieyp',b.delivery.guestCheckoutCoverage);
 assert.notEqual(digestA,digestB);
 const original=new GuestMerchantCoverageStrict(
  {async findPublishedBySlug(){return b;}},
  {async isApproved({coverageDigestSha256}){return coverageDigestSha256===digestA;}},
 );
 assert.equal((await original.verifyCoverage(input)).allowed,false);
});
test('tampered center, duplicate zone, missing approvals are refused',async()=>{
 const bad=partner({center:{latitude:999,longitude:4}});
 assert.equal((await policy(bad).strict.verifyCoverage(input)).allowed,false);
 const cloned=partner();
 cloned.delivery.guestCheckoutCoverage.zones.push(
  {...cloned.delivery.guestCheckoutCoverage.zones[0]});
 assert.equal((await policy(cloned).strict.verifyCoverage(input)).allowed,false);
});
