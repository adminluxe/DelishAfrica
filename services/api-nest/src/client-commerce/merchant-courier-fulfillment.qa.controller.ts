/**
 * DelishAfrica QA ONLY — real Merchant/Courier HTTP route CONTRACT.
 *
 * NOT imported by AppModule; a transient NestJS testing module is the ONLY
 * route registration. Never mount on public API before provider TEST, verified
 * merchant memberships, courier roster, G0-G7, and production DB IAM.
 *
 * Actual OrdersAuthGuard resolves signed identity and rejects revoked Client
 * sessions. This controller adds strict external merchant/courier role checks,
 * committed membership/roster lookups and never trusts HTTP role/ownership.
 * Financial finality is read again by the PG transition function.
 */
import {
  BadRequestException, Body, Controller, ForbiddenException,
  HttpCode, Inject, Post, Req, ServiceUnavailableException,
  UnauthorizedException, UseGuards,
} from '@nestjs/common';
import { OrdersAuthGuard } from '../orders/orders.auth.guard';
import type { OrdersRequest } from '../orders/orders.access.types';
import type { DaAuthPrincipal } from '../auth/auth.types';
import type { MerchantMembershipContext } from
  '../catalog-foundation/catalog-foundation.types';
import type {
  QaRosterEvidence, QaMerchantCourierFulfillmentPgAdapter,
} from './merchant-courier-fulfillment.pg-qa.adapter';

export const QA_MERCHANT_COURIER_FULFILLMENT_PORTS =
  Symbol('QA_MERCHANT_COURIER_FULFILLMENT_PORTS');
export const QA_MERCHANT_COURIER_ADMISSION_PORTS =
  Symbol('QA_MERCHANT_COURIER_ADMISSION_PORTS');
export type QaMerchantCourierBusinessPorts=Readonly<{
  readCommittedMerchantMemberships:
    (issuer:string,subject:string)=>Promise<MerchantMembershipContext[]>;
  readCommittedCourierRoster:
    (issuer:string,subject:string)=>Promise<QaRosterEvidence|null>;
}>;
type Input=Record<string,unknown>;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISSUER=/^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;

@Controller('qa-isolated/fulfillment')
@UseGuards(OrdersAuthGuard)
export class QaMerchantCourierFulfillmentController {
  constructor(
    @Inject(QA_MERCHANT_COURIER_FULFILLMENT_PORTS)
    private readonly commerce: QaMerchantCourierFulfillmentPgAdapter,
    @Inject(QA_MERCHANT_COURIER_ADMISSION_PORTS)
    private readonly admission: QaMerchantCourierBusinessPorts,
  ) {}

  private verified(request:OrdersRequest,role:'merchant'|'courier'):
    DaAuthPrincipal {
    // Check AFTER OrdersAuthGuard: never short-circuit auth in QA.
    if(process.env.NODE_ENV==='production' ||
       process.env.DA_QA_ISOLATED_FULFILLMENT_ENABLED!=='YES'){
      throw new ServiceUnavailableException({
        ok:false,code:'qa_fulfillment_routes_disabled',
      });
    }
    const p=request?.daOrdersPrincipal;
    if(!p||p.role!==role||p.authSource!=='external'||
       p.ownershipEligible!==true||!ISSUER.test(p.issuer)||
       !UUID.test(p.subject)){
      throw new ForbiddenException({
        ok:false,code:'qa_fulfillment_verified_role_required',
      });
    }
    return p;
  }

  private body(raw:unknown):Input {
    if(!raw||typeof raw!=='object'||Array.isArray(raw)){
      throw new BadRequestException({
        ok:false,code:'qa_fulfillment_object_required',
      });
    }
    return raw as Input;
  }

  private order(raw:Input):string {
    if(typeof raw.orderId!=='string'||!UUID.test(raw.orderId)){
      throw new BadRequestException({
        ok:false,code:'qa_fulfillment_order_uuid_required',
      });
    }
    return raw.orderId;
  }

  private limit(raw:Input,defaultValue:number):number {
    const n=raw.limit===undefined?defaultValue:raw.limit;
    if(!Number.isSafeInteger(n)||typeof n!=='number'||n<1||n>50){
      throw new BadRequestException({
        ok:false,code:'qa_fulfillment_limit_invalid',
      });
    }
    return n;
  }

  private async merchantMembership(p:DaAuthPrincipal,raw:Input):
    Promise<MerchantMembershipContext>{
    if(typeof raw.merchantSlug!=='string'||!SLUG.test(raw.merchantSlug)){
      throw new BadRequestException({
        ok:false,code:'qa_fulfillment_merchant_slug_required',
      });
    }
    let records:MerchantMembershipContext[];
    try{
      records=await this.admission.readCommittedMerchantMemberships(
        p.issuer,p.subject);
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_fulfillment_merchant_membership_unavailable',
      });
    }
    if(!Array.isArray(records)){
      throw new ServiceUnavailableException({
        ok:false,code:'qa_fulfillment_merchant_membership_unavailable',
      });
    }
    const entry=records.find(x=>x?.slug===raw.merchantSlug &&
      x?.issuer===p.issuer && x?.subject===p.subject);
    if(!entry){
      throw new ForbiddenException({
        ok:false,code:'qa_fulfillment_merchant_membership_required',
      });
    }
    return entry; // adapter additionally validates active contract, KYB, role.
  }

  private async courierRoster(p:DaAuthPrincipal):Promise<QaRosterEvidence>{
    let proof:QaRosterEvidence|null;
    try{
      proof=await this.admission.readCommittedCourierRoster(
        p.issuer,p.subject);
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_fulfillment_courier_roster_unavailable',
      });
    }
    if(!proof||proof.active!==true||
       proof.source!=='committed-server-roster'||
       proof.issuer!==p.issuer||proof.subject!==p.subject){
      throw new ForbiddenException({
        ok:false,code:'qa_fulfillment_courier_registry_required',
      });
    }
    return proof;
  }

  @Post('merchant/orders/list')
  @HttpCode(200)
  async merchantInbox(@Req() request:OrdersRequest,@Body() data:unknown){
    const p=this.verified(request,'merchant');
    const b=this.body(data);
    const membership=await this.merchantMembership(p,b);
    const limit=this.limit(b,30);
    try{
      const orders=await this.commerce.merchantInbox(p,membership,limit);
      return {ok:true,mode:'test' as const,count:orders.length,orders};
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_merchant_inbox_unavailable_or_denied',
      });
    }
  }

  @Post('merchant/orders/transition')
  @HttpCode(200)
  async merchantTransition(@Req() request:OrdersRequest,@Body() data:unknown){
    const p=this.verified(request,'merchant');
    const b=this.body(data);
    const orderId=this.order(b);
    if(b.nextStatus!=='accepted'&&b.nextStatus!=='ready'){
      throw new BadRequestException({
        ok:false,code:'qa_merchant_transition_invalid',
      });
    }
    const member=await this.merchantMembership(p,b);
    try{
      const state=await this.commerce.merchantTransition(
        p,member,orderId,b.nextStatus);
      return {ok:true,mode:'test' as const,orderId,state};
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_merchant_transition_denied_or_financial_hold',
      });
    }
  }

  @Post('courier/offers/list')
  @HttpCode(200)
  async courierOffers(@Req() request:OrdersRequest,@Body() data:unknown){
    const p=this.verified(request,'courier');
    const b=this.body(data);
    const proof=await this.courierRoster(p);
    const limit=this.limit(b,20);
    try{
      const offers=await this.commerce.courierOffers(p,proof,limit);
      return {ok:true,mode:'test' as const,count:offers.length,offers};
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_courier_offers_unavailable_or_denied',
      });
    }
  }

  @Post('courier/offers/transition')
  @HttpCode(200)
  async courierTransition(@Req() request:OrdersRequest,@Body() data:unknown){
    const p=this.verified(request,'courier');
    const b=this.body(data);
    const orderId=this.order(b);
    if(b.nextStatus!=='accepted'&&b.nextStatus!=='picked_up'&&
       b.nextStatus!=='delivered'){
      throw new BadRequestException({
        ok:false,code:'qa_courier_transition_invalid',
      });
    }
    const proof=await this.courierRoster(p);
    try{
      const state=await this.commerce.courierTransition(
        p,proof,orderId,b.nextStatus);
      return {ok:true,mode:'test' as const,orderId,state};
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_courier_transition_denied_or_financial_hold',
      });
    }
  }
}
