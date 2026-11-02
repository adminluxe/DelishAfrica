const {test}=require('node:test'),assert=require('node:assert/strict');
const {loader}=require('./hf33-test-loader.cjs');
const core=loader().load('packages/contracts/src/orderRead.ts');
test('Invalid or rejected responses cannot become a successfully empty service',()=>{
 for(const value of [null,{}, {ok:false,orders:[]},{ok:true,data:{}},{orders:[{}]},{orders:[{id:'A'},{id:'A'}]}])assert.throws(()=>core.readOrderList(value));
 assert.equal(core.readOrderList({ok:true,orders:[]}).length,0);
 assert.equal(core.readOrderList({ok:true,data:{orders:[{publicId:'A'}]}})[0].publicId,'A');
});
test('Expired account and forbidden venue access have separate recovery actions',()=>{
 assert.equal(core.orderReadFailure({status:401}),'auth_required');
 assert.equal(core.orderReadFailure({status:403}),'forbidden');
 assert.equal(core.orderReadFailure({status:503}),'unavailable');
 assert.equal(core.orderReadFailure(new Error('merchant_identity_changed')),'unavailable');
});
test('Money units are explicit across the 100 boundary and free orders remain zero',()=>{
 const label=n=>core.orderMoneyLabel({totalMinor:n,currency:'EUR'});
 assert.match(label(99),/0,99/);assert.match(label(100),/1,00/);assert.match(label(101),/1,01/);
 assert.match(label(6900),/69,00/);assert.match(label(0),/0,00/);
 assert.match(core.orderMoneyLabel({totalEUR:690}),/690,00/);
 assert.match(core.orderMoneyLabel({pricing:{total:{amountMinor:6900,currency:'EUR'}}}),/69,00/);
 assert.match(core.orderMoneyLabel({totalMinor:6900,currency:'XOF'}),/6.?900/);
 for(const o of [{total:69},{amount:6900},{totalMinor:6900},{totalMinor:1.5,currency:'EUR'},{totalMinor:-1,currency:'EUR'},{totalMinor:5,currency:'ZZZ'}])assert.equal(core.orderMoneyLabel(o),'—');
});
test('Canonical empty allergy arrays cannot erase legacy warnings',()=>{
 const s=core.orderSafety({canonical:{safety:{allergenFlags:[]}},allergenFlags:['arachide'],customer:{dietaryTags:['sans gluten'],foodSafetyNote:'Contact requis'}});
 assert.deepEqual([...s.allergens],['arachide']);assert.equal(s.urgent,true);assert.match(s.note,/Contact requis/);
});
test('Backend canonical projection preserves allergy and acknowledgement evidence',()=>{
 const api=loader().load('services/api-nest/src/orders/orders.canonical.response.ts');
 const out=api.exposeCanonicalGetResponse({ok:true,order:{id:'SYNTHETIC',allergenFlags:['arachide'],customer:{dietaryTags:['sans gluten']},safety:{requiresMerchantAcknowledgement:true},items:[{name:'Synthetic',allergens:['lait']}]}});
 assert.deepEqual([...out.canonical.safety.allergenFlags],['arachide']);
 assert.deepEqual([...out.canonical.safety.dietaryTags],['sans gluten']);
 assert.equal(out.canonical.safety.requiresMerchantAcknowledgement,true);
 assert.deepEqual([...out.canonical.items[0].allergens],['lait']);
});
