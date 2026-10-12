/**
 * DelishAfrica disconnected QA candidate — canonical menu quote boundary.
 *
 * The mobile may provide merchant identity and SKU/quantity ONLY.
 * All prices, discounts, delivery costs, item names, dates and fingerprints
 * are produced from a trusted server-side CatalogOrderPolicyService.
 *
 * NOT registered in AppModule, NOT production wired.
 */
import { createHash } from 'node:crypto';
import type { CanonicalOrderQuote } from
  '../order-policy/catalog-order-policy.service';
import type { QaServerQuote } from './client-commerce.pg-qa.adapter';

type Obj=Record<string,unknown>;
export interface QaPublishedCatalogQuoter {
  quote(input: Record<string,unknown>):Promise<CanonicalOrderQuote>;
}
function obj(v:unknown):Obj|null {
  return v!==null && typeof v==='object' && !Array.isArray(v)
    ?v as Obj:null;
}
function str(v:unknown):string {
  return typeof v==='string'?v.trim():'';
}
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const SKU=/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;
const HEX64=/^[a-f0-9]{64}$/;

export class QaCanonicalClientQuoteAdapter {
  constructor(private readonly publishedCatalog:QaPublishedCatalogQuoter) {
    if(!publishedCatalog || typeof publishedCatalog.quote!=='function') {
      throw Error('qa_catalog_server_quote_provider_required');
    }
  }

  async priceUntrustedCart(body:unknown):Promise<QaServerQuote> {
    const input=obj(body);
    if(!input) throw Error('qa_cart_json_object_required');
    // Keep compatibility with the existing Client checkout without using any
    // client-supplied totals, amounts, quote fingerprints or metadata.
    const partnerSlug=str(input.partnerSlug).toLowerCase();
    if(!SLUG.test(partnerSlug)) throw Error('qa_cart_partner_slug_invalid');
    const restaurant=str(input.restaurantId).toLowerCase();
    if(restaurant && restaurant!==partnerSlug) {
      throw Error('qa_cart_conflicting_partner_identity');
    }
    if(!Array.isArray(input.items) || input.items.length<1||
       input.items.length>40) {
      throw Error('qa_cart_items_count_invalid');
    }
    const identifiers=new Set<string>();
    let combinedQuantity=0;
    const items=input.items.map((raw)=>{
      const item=obj(raw);
      if(!item) throw Error('qa_cart_item_object_required');
      const id=str(item.id), sku=str(item.sku);
      if(id && sku && id!==sku) throw Error('qa_cart_item_id_conflict');
      const actual=id||sku;
      if(!SKU.test(actual)||identifiers.has(actual)) {
        throw Error('qa_cart_sku_invalid_or_duplicate');
      }
      const quantity=item.quantity;
      if(typeof quantity!=='number'||!Number.isSafeInteger(quantity)||
         quantity<1||quantity>50) {
        throw Error('qa_cart_quantity_invalid');
      }
      identifiers.add(actual);
      combinedQuantity+=quantity;
      if(combinedQuantity>100) throw Error('qa_cart_total_quantity_excessive');
      return Object.freeze({id:actual,quantity});
    });

    // The ACTUAL policy performs the published-menu lookup, availability,
    // delivery-fee and minimum-order calculation, never the phone.
    const quote=await this.publishedCatalog.quote({
      partnerSlug,items,
    });
    if(quote?.ok!==true||quote.version!==1 ||
       quote.partnerSlug!==partnerSlug||quote.currency!=='eur' ||
       !Array.isArray(quote.items)||quote.items.length!==items.length||
       !HEX64.test(str(quote.quoteFingerprint))||
       !/^\d{4}-\d{2}-\d{2}$/.test(str(quote.availabilityDate))||
       !Number.isSafeInteger(quote.subtotal)||quote.subtotal<0||
       !Number.isSafeInteger(quote.deliveryFee)||quote.deliveryFee<0||
       !Number.isSafeInteger(quote.total)||quote.total<1||
       quote.total>100000000||quote.subtotal+quote.deliveryFee!==quote.total||
       !Number.isSafeInteger(quote.minimumOrderAmount) ||
       quote.minimumOrderAmount<0||quote.minimumOrderAmount>quote.total) {
      throw Error('qa_catalog_quote_inconsistent');
    }
    let actualSubtotal=0;
    for(let i=0;i<items.length;i++){
      const row=quote.items[i];
      if(row.id!==items[i].id||row.quantity!==items[i].quantity||
         row.sku!==items[i].id ||
         !Number.isSafeInteger(row.unitAmount)||row.unitAmount<1||
         !Number.isSafeInteger(row.lineAmount)||
         row.lineAmount!==row.unitAmount*row.quantity) {
        throw Error('qa_catalog_quote_line_mismatch');
      }
      actualSubtotal+=row.lineAmount;
    }
    if(actualSubtotal!==quote.subtotal)
      throw Error('qa_catalog_subtotal_inconsistent');

    const cartFingerprint=createHash('sha256').update(JSON.stringify({
      version:1,partnerSlug,availabilityDate:quote.availabilityDate,
      items,
    })).digest('hex');
    return Object.freeze({
      source:'server-canonical-catalog' as const,
      quoteFingerprint:quote.quoteFingerprint,
      cartFingerprint,
      merchantSlug:partnerSlug,
      totalMinor:quote.total,
      currency:'EUR',
    });
  }
}
