'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {readFileSync}=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(readFileSync(f,'utf8'),{
  fileName:f,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021}
}).outputText,f);
const {GuestMerchantCoverageStrict}=require('../src/guest-checkout/guest-merchant-coverage-strict.ts');

const input={
  partnerSlug:'thieyp',countryCode:'BE',postalCode:'1050',
  placeId:'googleplace_test001',latitude:50.8300,longitude:4.3700,
};
function partner({
  status='active', enabled=true, approvedByMerchant=true,
  approvedByOps=true, postcode='1050', radius=7000,
  center={latitude:50.8300,longitude:4.3700},coverageEnabled=true,
}={}) {
 return {id:'merchant_id_thieyp',slug:'thieyp',name:'Thieyp',
   status,delivery:{enabled,deliveryFee:290,
     serviceAreaLabel:'Bruxelles/Ixelles',
     guestCheckoutCoverage:{
       version:1,enabled:coverageEnabled,approvedByMerchant,approvedByOps,
       zones:[{code:'be-ixelles-confirmed',countryCode:'BE',postalCodes:[postcode],
               center,maxDistanceMeters:radius,enabled:true}]
     }}};
}
function policy(result) {
 const calls=[];
 const service={async findPublishedBySlug(slug,fallback){
   calls.push({slug,fallback});
   return result;
 }};
 return {strict:new GuestMerchantCoverageStrict(service),calls};
}
test('only explicitly merchant AND ops approved published coverage authorizes delivery',async()=>{
 const {strict,calls}=policy(partner());
 const r=await strict.verifyCoverage(input);
 assert.deepEqual(r,{allowed:true,serviceAreaCode:'be-ixelles-confirmed'});
 assert.equal(calls.length,1);
 assert.equal(calls[0].slug,'thieyp');
 assert.deepEqual(calls[0].fallback,[]);
});
test('marketing label, postal code or delivery fee without coverage never grants access',async()=>{
 for (const missing of [
   {...partner(),delivery:{enabled:true,serviceAreaLabel:'Bruxelles / Ixelles',deliveryFee:290}},
   {...partner(),delivery:{enabled:true,guestCheckoutCoverage:null}},
   {...partner(),delivery:{enabled:true,guestCheckoutCoverage:{version:1,enabled:true,zones:[]}}},
   null,
 ]) {
  assert.equal((await policy(missing).strict.verifyCoverage(input)).allowed,false);
 }
});
test('merchant status, configuration or approvals refuse untrusted fulfilment',async()=>{
 for (const variant of [
   {status:'suspended'},{status:'draft'},{enabled:false},
   {approvedByMerchant:false},{approvedByOps:false},{coverageEnabled:false},
   {postcode:'1000'},{radius:99},{radius:25001}
 ]) {
  assert.equal((await policy(partner(variant)).strict.verifyCoverage(input)).allowed,false,JSON.stringify(variant));
 }
});
test('being in the same postcode does not bypass the merchant geofence radius',async()=>{
 const strict=policy(partner({radius:1000})).strict;
 assert.equal((await strict.verifyCoverage({...input,latitude:50.9000,longitude:4.3700})).allowed,false);
 assert.equal((await strict.verifyCoverage({...input,latitude:50.8310,longitude:4.3710})).allowed,true);
});
test('country, invalid coordinates, spoofed ids and code injection all fail closed',async()=>{
 const strict=policy(partner()).strict;
 for (const bad of [
   {countryCode:'FR'},{latitude:Infinity},{longitude:-181},
   {postalCode:'1050 OR TRUE'},{placeId:'x'},{partnerSlug:'../thieyp'},
   {postalCode:'9999'},
 ]) {
   assert.equal((await strict.verifyCoverage({...input,...bad})).allowed,false,JSON.stringify(bad));
 }
});
test('broken config cannot accidentally authorize payment',async()=>{
 const bad=partner();
 bad.delivery.guestCheckoutCoverage.zones=[
  {code:'be-ixelles-confirmed',countryCode:'BE',postalCodes:['1050'],center:{latitude:999,longitude:4},maxDistanceMeters:20000,enabled:true}
 ];
 assert.equal((await policy(bad).strict.verifyCoverage(input)).allowed,false);
 bad.delivery.guestCheckoutCoverage.approvedByOps=false;
 assert.equal((await policy(bad).strict.verifyCoverage(input)).allowed,false);
});
