'use strict';
/**
 * Real CatalogOrderPolicyService + QA canonical commerce adapter.
 * Synthetic catalog in memory, NO PostgreSQL, NO Stripe, NO VPS.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Module=require('node:module');
if(process.env.QA_SYNTHETIC_ONLY!=='YES') {
  throw Error('QA_CANONICAL_QUOTE_LAB_ONLY');
}
// Existing catalog imports the deployment-only PG vendor at module load.
// Never initialize it in this isolated test.
const originalLoad=Module._load;
Module._load=function(request,parent,isMain) {
  if(typeof request==='string' &&
     request.replaceAll('\\','/').endsWith('/.runtime-vendor/pg-runtime/node_modules/pg')){
    return {Pool:class BlockDbInQuoteQa {
      constructor(){throw Error('QA_UNEXPECTED_CATALOG_DATABASE_CONNECTION');}
    }};
  }
  return originalLoad.apply(this,arguments);
};
let CatalogOrderPolicyService,QaCanonicalClientQuoteAdapter;
try {
  ({CatalogOrderPolicyService}=
    require('../src/order-policy/catalog-order-policy.service'));
  ({QaCanonicalClientQuoteAdapter}=
    require('../src/client-commerce/client-commerce-canonical-quote.pg-qa.adapter'));
} finally {
  Module._load=originalLoad;
}
let lookups=0;
let enabled=true;
const catalog={
  async findPublishedBySlug(slug) {
    lookups++;
    if(slug!=='qa-restaurant'||!enabled)return null;
    return {
      slug:'qa-restaurant',status:'active',name:'Restaurant QA',
      delivery:{enabled:true,deliveryFee:390,minimumOrderAmount:1200},
      menuItems:[
        {id:'rice',name:'Jollof rice',amount:1500,category:'Menu'},
        {id:'juice',name:'Bissap',amount:400,category:'Drink'},
      ],
    };
  },
};
const policy=new CatalogOrderPolicyService(catalog);
const gateway=new QaCanonicalClientQuoteAdapter(policy);
const cart={
  partnerSlug:'qa-restaurant',restaurantId:'qa-restaurant',
  items:[{id:'rice',sku:'rice',quantity:1,amount:1,price:0.01},
         {id:'juice',sku:'juice',quantity:2,amount:1,price:0.01}],
  amount:1,total:1,currency:'xof',quoteFingerprint:'0'.repeat(64),
  cartFingerprint:'0'.repeat(64),
  metadata:{clientSubject:'pretend-admin',paid:true,
            providerVerified:true,cartAmount:'1'},
};

test('server catalog decides amount, quote, ownership and cart fingerprint',async()=>{
  const quote=await gateway.priceUntrustedCart(cart);
  assert.equal(quote.totalMinor,2690);
  assert.equal(quote.currency,'EUR');
  assert.equal(quote.merchantSlug,'qa-restaurant');
  assert.equal(quote.source,'server-canonical-catalog');
  assert.match(quote.quoteFingerprint,/^[a-f0-9]{64}$/);
  assert.match(quote.cartFingerprint,/^[a-f0-9]{64}$/);
  assert.notEqual(quote.quoteFingerprint,cart.quoteFingerprint);
  assert.notEqual(quote.cartFingerprint,cart.cartFingerprint);
  assert.equal(Object.isFrozen(quote),true);
  const same=await gateway.priceUntrustedCart({...cart,amount:0,total:0,
    metadata:{clientSubject:'other', paid:'true'}});
  assert.deepEqual(same,quote);
  console.log('QA_CANONICAL_CLIENT_MONEY_AND_METADATA=IGNORED_SERVER_REPRICED');
  const next=await gateway.priceUntrustedCart({
    ...cart,items:[{id:'rice',quantity:2},{id:'juice',quantity:2}],
  });
  assert.equal(next.totalMinor,4190);
  assert.notEqual(next.cartFingerprint,quote.cartFingerprint);
  console.log('QA_CANONICAL_ITEM_QUANTITY_CHANGE=NEW_QUOTE_AND_FINGERPRINT');
  assert.equal(lookups,3);
});
test('deny confused merchant, malformed SKU/quantity and duplicate lines',async()=>{
  const invalid=[
    {...cart,partnerSlug:'other'},
    {...cart,restaurantId:'other'},
    {...cart,items:[{id:'rice',sku:'juice',quantity:1}]},
    {...cart,items:[{id:'rice',quantity:1},{id:'rice',quantity:1}]},
    {...cart,items:[{id:'rice',quantity:0}]},
    {...cart,items:[{id:'rice',quantity:1.5}]},
    {...cart,items:[{id:'rice',quantity:'2'}]},
    {...cart,items:[]},
    {...cart,items:Array.from({length:41},(_,i)=>({id:'item'+i,quantity:1}))},
    {partnerSlug:'qa-restaurant',items:[{id:'../secrets',quantity:1}]},
    null,
  ];
  for(const payload of invalid){
    await assert.rejects(()=>gateway.priceUntrustedCart(payload));
  }
  console.log('QA_CANONICAL_CART_ADVERSARIAL_INPUTS=REJECTED');
});
test('catalog unavailable must fail closed: no static guessed price',async()=>{
  enabled=false;
  await assert.rejects(()=>gateway.priceUntrustedCart(cart));
  enabled=true;
  console.log('QA_CANONICAL_CATALOG_OUTAGE=NO_PAYMENT_INTENT');
});
test('dishonest server quote is not enough to pass database contract',async()=>{
  const badGateway=new QaCanonicalClientQuoteAdapter({
    quote:async(input)=>({
      ok:true,version:1,partnerSlug:'qa-restaurant',currency:'eur',
      partnerName:'QA',availabilityDate:'2026-10-12',availabilityDay:'lundi',
      items:[{id:'rice',sku:'rice',quantity:1,unitAmount:1500,
               lineAmount:1,name:'Rice',category:'Menu',scheduledDay:null}],
      subtotal:1,deliveryFee:390,total:391,minimumOrderAmount:0,
      quoteFingerprint:'a'.repeat(64),quotedAt:new Date().toISOString(),
    }),
  });
  await assert.rejects(()=>badGateway.priceUntrustedCart({
    partnerSlug:'qa-restaurant',items:[{id:'rice',quantity:1}],
  }),/qa_catalog_quote_line_mismatch/);
  console.log('QA_CANONICAL_INCONSISTENT_SERVER_QUOTE=REJECTED');
});
