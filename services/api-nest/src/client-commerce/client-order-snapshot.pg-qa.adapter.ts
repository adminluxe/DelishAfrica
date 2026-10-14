/**
 * DelishAfrica disconnected QA ONLY — atomic order + merchant fulfillment
 * snapshot. Never imported by AppModule or any published Expo screen.
 *
 * Client may send SKU + quantity. The actual published catalog produces all
 * prices, names, categories, delivery and fingerprints. We store the quote's
 * immutable fulfillment lines in the SAME PostgreSQL transaction that
 * reserves the durable order UUID.
 *
 * In migration 006, the database rejects any new payment authority for a
 * reserved order without this immutable snapshot. No Stripe API is called.
 */
import type {
  QaCanonicalFulfillmentSnapshot,
  QaOrderReservation,
  QaPgPool,
  QaServerQuote,
  QaVerifiedClient,
} from './client-commerce.pg-qa.adapter';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HASH=/^[a-f0-9]{64}$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const SKU=/^[A-Za-z0-9][A-Za-z0-9:_-]{0,79}$/;
const MUTATION=/^[A-Za-z0-9:_.-]{8,128}$/;
const ISSUER=/^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/;
const MONEY_MAX=100000000;

function validatedLines(
  snapshot: QaCanonicalFulfillmentSnapshot | undefined,
  expectedTotal: number,
): { subtotal: number; fee: number; json: string } {
  if(!snapshot||!Number.isSafeInteger(snapshot.subtotalMinor)||
      !Number.isSafeInteger(snapshot.deliveryFeeMinor)||
      snapshot.subtotalMinor<1||snapshot.deliveryFeeMinor<0||
      snapshot.subtotalMinor> MONEY_MAX||
      snapshot.deliveryFeeMinor> MONEY_MAX||
      snapshot.subtotalMinor+snapshot.deliveryFeeMinor!==expectedTotal||
      !Array.isArray(snapshot.lines)||snapshot.lines.length<1||
      snapshot.lines.length>40) {
    throw Error('qa_snapshot_server_canonical_money_required');
  }
  let subtotal=0;
  let count=0;
  const ids=new Set<string>();
  const lines=snapshot.lines.map(line=>{
    if(!line||typeof line!=='object'||!SKU.test(line.sku)||
        ids.has(line.sku)||typeof line.name!=='string'||
        typeof line.category!=='string'||
        line.name.length<1||line.name.length>180||
        line.category.length<1||line.category.length>90||
        /[<>\x00-\x1f]/.test(line.name+line.category)||
        !Number.isSafeInteger(line.quantity)||line.quantity<1||
        line.quantity>50||
        !Number.isSafeInteger(line.unitAmountMinor)||
        line.unitAmountMinor<1||line.unitAmountMinor>99999999||
        !Number.isSafeInteger(line.lineAmountMinor)||
        line.lineAmountMinor<1||line.lineAmountMinor>MONEY_MAX||
        line.lineAmountMinor!==line.unitAmountMinor*line.quantity) {
      throw Error('qa_snapshot_server_catalog_line_invalid');
    }
    ids.add(line.sku);
    count+=line.quantity;
    subtotal+=line.lineAmountMinor;
    if(count>100||subtotal>MONEY_MAX){
      throw Error('qa_snapshot_server_line_limits_exceeded');
    }
    // This whitelist is deliberate: prevent copying client customer details
    // or arbitrary HTTP metadata into the merchant fulfillment snapshot.
    return Object.freeze({
      sku:line.sku,name:line.name,category:line.category,
      quantity:line.quantity,
      unitAmountMinor:line.unitAmountMinor,
      lineAmountMinor:line.lineAmountMinor,
    });
  });
  if(subtotal!==snapshot.subtotalMinor){
    throw Error('qa_snapshot_server_subtotal_mismatch');
  }
  return {subtotal,fee:snapshot.deliveryFeeMinor,json:JSON.stringify(lines)};
}

export class QaCanonicalOrderSnapshotPgAdapter {
  constructor(private readonly pool: QaPgPool) {
    if(!pool||typeof pool.connect!=='function'){
      throw Error('qa_snapshot_pg_pool_required');
    }
  }

  async reserveOrderAndSnapshot(
    principal: QaVerifiedClient,
    quote: QaServerQuote,
    mutation: string,
  ): Promise<QaOrderReservation> {
    // Fail BEFORE acquiring a connection if auth, quote, or catalog data
    // is not the typed SERVER quotation obtained from the published menu.
    if(!principal||principal.role!=='client'||
        principal.authSource!=='external'||principal.ownershipEligible!==true||
        typeof principal.issuer!=='string'||!ISSUER.test(principal.issuer)||
        typeof principal.subject!=='string'||!UUID.test(principal.subject)||
        !MUTATION.test(mutation)){
      throw Error('qa_snapshot_signed_client_required');
    }
    if(!quote||quote.source!=='server-canonical-catalog'||
        !HASH.test(quote.quoteFingerprint)||
        !HASH.test(quote.cartFingerprint)||
        !SLUG.test(quote.merchantSlug)||
        quote.currency!=='EUR'||
        !Number.isSafeInteger(quote.totalMinor)||
        quote.totalMinor<1||quote.totalMinor>MONEY_MAX){
      throw Error('qa_snapshot_server_quote_required');
    }
    const details=validatedLines(quote.fulfillment,quote.totalMinor);
    const client=await this.pool.connect();
    let inTransaction=false;
    try{
      await client.query('BEGIN');
      inTransaction=true;
      const orderResult=await client.query(
        'SELECT * FROM public.da_qa_service_reserve_order('+
        '$1::text,$2::uuid,$3::varchar,$4::char(64),'+
        '$5::char(64),$6::varchar,$7::bigint,$8::char(3))',
        [principal.issuer,principal.subject,mutation,
          quote.quoteFingerprint,quote.cartFingerprint,
          quote.merchantSlug,quote.totalMinor,quote.currency],
      );
      if(orderResult.rows.length!==1){
        throw Error('qa_snapshot_order_reservation_ambiguous');
      }
      const record=orderResult.rows[0];
      const orderId=String(record.order_id);
      const amount=Number(record.total_minor);
      if(!UUID.test(orderId)||
          String(record.issuer)!==principal.issuer||
          String(record.client_subject).toLowerCase()!==principal.subject.toLowerCase()||
          String(record.client_mutation_id)!==mutation||
          String(record.quote_fingerprint).trim()!==quote.quoteFingerprint||
          String(record.cart_fingerprint).trim()!==quote.cartFingerprint||
          String(record.merchant_slug).trim()!==quote.merchantSlug||
          String(record.currency).trim()!=='EUR'||
          amount!==quote.totalMinor||
          record.state!=='pending_payment'){
        throw Error('qa_snapshot_order_binding_mismatch');
      }
      const result=await client.query(
        'SELECT public.da_qa_service_store_order_snapshot('+
        '$1::uuid,$2::text,$3::uuid,$4::char(64),$5::char(64),'+
        '$6::varchar,$7::bigint,$8::bigint,$9::jsonb) AS order_id',
        [orderId,principal.issuer,principal.subject,
          quote.quoteFingerprint,quote.cartFingerprint,quote.merchantSlug,
          details.subtotal,details.fee,details.json],
      );
      if(result.rows.length!==1||
          String(result.rows[0].order_id).toLowerCase()!==orderId.toLowerCase()){
        throw Error('qa_snapshot_order_receipt_missing');
      }
      await client.query('COMMIT');
      inTransaction=false;
      return Object.freeze({
        orderId,issuer:principal.issuer,clientSubject:principal.subject,
        clientMutationId:mutation,quoteFingerprint:quote.quoteFingerprint,
        cartFingerprint:quote.cartFingerprint,merchantSlug:quote.merchantSlug,
        totalMinor:quote.totalMinor,currency:'EUR',state:'pending_payment',
      });
    }catch{
      if(inTransaction){
        try{await client.query('ROLLBACK');}catch{
          // Neither rollback nor uncertain connection errors can be treated
          // as a new order; callers must reconcile the same mutation later.
        }
      }
      throw Error('qa_snapshot_atomic_order_reservation_unavailable');
    }finally{
      client.release();
    }
  }
}
