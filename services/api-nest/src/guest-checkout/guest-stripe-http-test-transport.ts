import type {
  GuestIntentParams, GuestIntentTransport, GuestTransportIntent,
} from './guest-stripe-intent-reservation';

/**
 * P5-E Stripe HTTP TEST ONLY adapter. Never instantiate from a public Nest
 * controller. No card data, refunds, live keys or customer PII.
 *
 * This supplies the P5-C create/get/cancel contract using the documented
 * Stripe REST API; external test-account connectivity has NOT yet been proven.
 */
type FetchProvider=(url:string,init:RequestInit)=>Promise<Response>;
const ID=/^pi_[A-Za-z0-9_]{8,192}$/;
const IDEMPOTENCY=/^[A-Za-z0-9:_-]{16,255}$/;
const BASE='https://api.stripe.com/v1/payment_intents';

function exactMetadata(data:unknown):Record<string,string> {
  if(!data || typeof data!=='object' || Array.isArray(data))
    throw new Error('guest_stripe_test_invalid_metadata');
  const output:Record<string,string>={};
  const entries=Object.entries(data as Record<string,unknown>);
  if(entries.length<1 || entries.length>15)
    throw new Error('guest_stripe_test_invalid_metadata');
  for(const [key,value] of entries) {
    if(!/^[A-Za-z][A-Za-z0-9_]{1,65}$/.test(key) ||
       typeof value!=='string' ||
       value.length>400 ||
       /[\r\n]/.test(value)) {
      throw new Error('guest_stripe_test_invalid_metadata');
    }
    output[key]=value;
  }
  return output;
}

export class GuestStripeHttpTestTransport implements GuestIntentTransport {
  readonly mode='test' as const;

  constructor(
    private readonly secret:string,
    private readonly timeoutMs=8000,
    private readonly http:FetchProvider=fetch,
  ) {
    if(!/^(sk|rk)_test_[A-Za-z0-9]+$/.test(secret) ||
       timeoutMs<250 || timeoutMs>15000 ||
       !Number.isInteger(timeoutMs) || typeof http!=='function')
      throw new Error('guest_stripe_test_credentials_invalid');
  }

  private assertEnabled():void {
    if(process.env.NODE_ENV==='production' ||
       process.env.DA_GUEST_STRIPE_TEST_ONLY!=='1')
      throw new Error('guest_stripe_test_http_disabled');
  }

  private async request(
    suffix:string,
    method:'GET'|'POST',
    body?:URLSearchParams,
    idempotencyKey?:string,
  ):Promise<GuestTransportIntent> {
    this.assertEnabled();
    // URL and suffix come exclusively from strict server-side constants/IDs,
    // never from a client-controlled hostname or payment URL.
    if(suffix!=='' && !/^\/pi_[A-Za-z0-9_]{8,192}(\/cancel)?$/.test(suffix))
      throw new Error('guest_stripe_test_path_invalid');
    if(idempotencyKey && !IDEMPOTENCY.test(idempotencyKey))
      throw new Error('guest_stripe_test_idempotency_invalid');

    const headers:Record<string,string>={
      Authorization:'Bearer '+this.secret,
      Accept:'application/json',
    };
    if(method==='POST')headers['Content-Type']='application/x-www-form-urlencoded';
    if(idempotencyKey)headers['Idempotency-Key']=idempotencyKey;

    let response:Response;
    try {
      response=await this.http(BASE+suffix,{
        method,headers,
        ...(body ? {body:body.toString()} : {}),
        signal:AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      // Never include a URL containing IDs, auth headers, Stripe error body
      // or customer data in logs or returned errors.
      throw new Error('guest_stripe_test_provider_network_uncertain');
    }
    if(!response || !response.ok) {
      // A 4xx/5xx is still an uncertain POST outcome, including timeouts.
      throw new Error('guest_stripe_test_provider_rejected');
    }
    let decoded:unknown;
    try {
      decoded=await response.json();
    } catch {
      throw new Error('guest_stripe_test_provider_invalid_json');
    }
    const data=decoded as Record<string,unknown>;
    if(!data || data.object!=='payment_intent' ||
       typeof data.id!=='string' || !ID.test(data.id) ||
       typeof data.amount!=='number' || !Number.isSafeInteger(data.amount) ||
       typeof data.currency!=='string' ||
       data.livemode!==false ||
       typeof data.status!=='string' ||
       !/^[a-z][a-z0-9_]{2,79}$/.test(data.status) ||
       !data.metadata || typeof data.metadata!=='object' ||
       Array.isArray(data.metadata))
      throw new Error('guest_stripe_test_provider_invalid_intent');

    const secret=data.client_secret;
    if(secret!=null &&
       (typeof secret!=='string' || !secret.startsWith(data.id+'_secret_')))
      throw new Error('guest_stripe_test_provider_invalid_secret');
    return {
      id:data.id,amount:data.amount,currency:data.currency,
      status:data.status,livemode:false,
      clientSecret:typeof secret==='string'?secret:'',
      metadata:exactMetadata(data.metadata),
    };
  }

  async createIntent(params:GuestIntentParams):Promise<GuestTransportIntent> {
    this.assertEnabled();
    if(!params || !/^DA-G-[a-f0-9]{32}$/.test(params.orderId) ||
       !Number.isSafeInteger(params.amount) || params.amount<50 ||
       params.amount>100_000_000 || params.currency!=='eur' ||
       params.idempotencyKey!=='da-gc-pi-v1:'+params.orderId)
      throw new Error('guest_stripe_test_order_invalid');

    const metadata=exactMetadata(params.metadata);
    if(metadata.orderId!==params.orderId ||
       metadata.source!=='delishafrica-guest-checkout' ||
       metadata.clientIssuer!=='urn:delishafrica:guest-checkout:v1' ||
       !/^[a-f0-9]{64}$/.test(metadata.quoteFingerprint||''))
      throw new Error('guest_stripe_test_metadata_untrusted');

    const form=new URLSearchParams({
      amount:String(params.amount),
      currency:'eur',
      capture_method:'automatic',
    });
    form.append('payment_method_types[]','card');
    for(const [key,value] of Object.entries(metadata))
      form.append('metadata['+key+']',value);
    return this.request('','POST',form,params.idempotencyKey);
  }

  async getIntent(intentId:string):Promise<GuestTransportIntent> {
    if(!ID.test(intentId))throw new Error('guest_stripe_test_id_invalid');
    return this.request('/'+intentId,'GET');
  }

  async cancelIntent(intentId:string):Promise<GuestTransportIntent> {
    if(!ID.test(intentId))throw new Error('guest_stripe_test_id_invalid');
    const form=new URLSearchParams({cancellation_reason:'abandoned'});
    return this.request(
      '/'+intentId+'/cancel','POST',form,
      'da-gc-cancel-v1:'+intentId,
    );
  }
}
