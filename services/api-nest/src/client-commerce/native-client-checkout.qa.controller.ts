/**
 * DelishAfrica QA ONLY — isolated Nest route prototype for Client checkout.
 *
 * NOT imported into AppModule/PaymentsModule. Never register beside the real
 * PaymentsController. Requires actual NativeClientNestCommerceGuard, trusted
 * server catalog quote and PostgreSQL-first Stripe TEST creator ports.
 *
 * Do not enable in a production environment, even when this file is present.
 */
import {
  BadRequestException,
  ConflictException,
  Controller,
  Headers,
  HttpCode,
  HttpException,
  Inject,
  Post,
  Req,
  Body,
  ServiceUnavailableException,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  NativeClientNestCommerceGuard,
  NATIVE_CLIENT_ADMISSION_CONTEXT,
  type NativeClientAdmittedHttpRequest,
  type NativeClientAdmissionPrincipal,
} from '../auth/native-client-nest-commerce.guard';
import type {QaServerQuote} from './client-commerce.pg-qa.adapter';
import type {QaStripeTestCheckoutIntent} from
  './stripe-test-intent-create.pg-qa.adapter';

export const QA_NATIVE_CLIENT_CHECKOUT_PORTS =
  Symbol('QA_NATIVE_CLIENT_CHECKOUT_PORTS');

export type QaNativeClientCheckoutPorts = Readonly<{
  quoteFromServerCatalog:(untrustedBody:unknown)=>Promise<QaServerQuote>;
  createOrResumeStripeTest:(
    principal:NativeClientAdmissionPrincipal,quote:QaServerQuote,
    mutationId:string,
  )=>Promise<QaStripeTestCheckoutIntent>;
}>;

@Controller('qa-isolated/client-commerce')
export class QaIsolatedClientCommerceController {
  constructor(
    @Inject(QA_NATIVE_CLIENT_CHECKOUT_PORTS)
    private readonly ports:QaNativeClientCheckoutPorts,
  ){}

  @Post('payments/create-intent')
  @HttpCode(200)
  @UseGuards(NativeClientNestCommerceGuard)
  async createIntent(
    @Req() request:NativeClientAdmittedHttpRequest,
    @Body() untrustedBody:unknown,
    @Headers('idempotency-key') mutationHeader?:unknown,
  ) {
    if(process.env.NODE_ENV==='production' ||
       process.env.DA_QA_ISOLATED_CLIENT_COMMERCE_ENABLED!=='YES') {
      throw new ServiceUnavailableException({
        ok:false,code:'qa_checkout_route_disabled',
      });
    }
    const principal=request?.[NATIVE_CLIENT_ADMISSION_CONTEXT];
    if(!principal||principal.role!=='client'||
       principal.authSource!=='external'||principal.ownershipEligible!==true){
      throw new UnauthorizedException({
        ok:false,code:'qa_checkout_native_client_admission_required',
      });
    }
    if(typeof mutationHeader!=='string' ||
       !/^[A-Za-z0-9:_.-]{8,128}$/.test(mutationHeader)){
      throw new BadRequestException({
        ok:false,code:'qa_checkout_idempotency_key_required',
      });
    }
    if(!untrustedBody||typeof untrustedBody!=='object' ||
       Array.isArray(untrustedBody)) {
      throw new BadRequestException({
        ok:false,code:'qa_checkout_cart_object_required',
      });
    }
    const body=untrustedBody as Record<string,unknown>;
    // Existing Client sends both header and body. Neither may override
    // server-determined issuer/sub, currency, amount, order or quote.
    if(body.clientMutationId!==undefined &&
       body.clientMutationId!==mutationHeader){
      throw new ConflictException({
        ok:false,code:'qa_checkout_mutation_header_body_mismatch',
      });
    }
    let quote:QaServerQuote;
    try {
      quote=await this.ports.quoteFromServerCatalog(untrustedBody);
    }catch(error){
      if(error instanceof HttpException) throw error;
      throw new BadRequestException({
        ok:false,code:'qa_checkout_catalog_cart_denied',
      });
    }
    let intent:QaStripeTestCheckoutIntent;
    try{
      intent=await this.ports.createOrResumeStripeTest(principal,quote,mutationHeader);
    }catch{
      // Keep provider credentials, internal SQL details and the payment key
      // out of HTTP error responses. The same mutation may safely be retried.
      throw new ServiceUnavailableException({
        ok:false,code:'qa_checkout_test_payment_temporarily_unavailable',
      });
    }
    if(intent.mode!=='test'||intent.orderId.length===0||
       !/^pi_[A-Za-z0-9_]{6,120}$/.test(intent.paymentIntentId) ||
       !intent.clientSecret.startsWith(intent.paymentIntentId+'_secret_')) {
      throw new ServiceUnavailableException({
        ok:false,code:'qa_checkout_provider_response_invalid',
      });
    }
    return {
      ok:true,mode:'test' as const,provider:'stripe' as const,
      orderId:intent.orderId,
      paymentIntentId:intent.paymentIntentId,
      clientSecret:intent.clientSecret,
      publishableKey:intent.publishableKey,
      status:intent.status,
      amount:quote.totalMinor,
      currency:quote.currency.toLowerCase(),
      canonicalQuoteFingerprint:quote.quoteFingerprint,
      canonicalCartFingerprint:quote.cartFingerprint,
      replayed:intent.replayed,
    };
  }
}
