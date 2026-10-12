/**
 * DelishAfrica: isolated QA finance-wallet read-only HTTP endpoints.
 * NOT imported by AppModule. Requires real OIDC + server membership/roster
 * before ever switching to real financial views. No cashout or bank routing.
 * Denied (503) in NODE_ENV=production even if flag is accidentally set.
 */
import {
  BadRequestException,Body,Controller,ForbiddenException,Header,
  HttpCode,Inject,Post,Req,ServiceUnavailableException,UseGuards,
} from '@nestjs/common';
import {OrdersAuthGuard} from '../orders/orders.auth.guard';
import type {OrdersRequest} from '../orders/orders.access.types';
import type {DaAuthPrincipal} from '../auth/auth.types';
import type {MerchantMembershipContext} from
  '../catalog-foundation/catalog-foundation.types';
import {
  QA_MERCHANT_COURIER_ADMISSION_PORTS,
  type QaMerchantCourierBusinessPorts,
} from './merchant-courier-fulfillment.qa.controller';
import {QaMerchantCourierWalletPgAdapter} from
  './merchant-courier-wallet.pg-qa.adapter';

export const QA_MERCHANT_COURIER_WALLET_PORTS=
  Symbol('QA_MERCHANT_COURIER_WALLET_PORTS');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const ISSUER=/^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/;

@Controller('qa-isolated/wallet')
@UseGuards(OrdersAuthGuard)
export class QaMerchantCourierWalletController {
  constructor(
    @Inject(QA_MERCHANT_COURIER_WALLET_PORTS)
    private readonly wallet:QaMerchantCourierWalletPgAdapter,
    @Inject(QA_MERCHANT_COURIER_ADMISSION_PORTS)
    private readonly memberships:QaMerchantCourierBusinessPorts,
  ){}

  private principal(req:OrdersRequest,role:'merchant'|'courier'):
    DaAuthPrincipal{
    if(process.env.NODE_ENV==='production'||
       process.env.DA_QA_ISOLATED_WALLET_ENABLED!=='YES'){
      throw new ServiceUnavailableException({
        ok:false,code:'qa_wallet_public_routes_disabled',
      });
    }
    const p=req?.daOrdersPrincipal;
    if(!p||p.role!==role||p.authSource!=='external'||
       p.ownershipEligible!==true||!ISSUER.test(p.issuer)||
       !UUID.test(p.subject)){
      throw new ForbiddenException({
        ok:false,code:'qa_wallet_verified_partner_role_required',
      });
    }
    return p;
  }

  private input(raw:unknown,kind:'merchant'|'courier'):
    Record<string,unknown>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))
      throw new BadRequestException({
        ok:false,code:'qa_wallet_body_object_required',
      });
    const body=raw as Record<string,unknown>;
    const keys=kind==='merchant'
      ?['merchantSlug','limit']:['limit'];
    if(Object.keys(body).some(k=>!keys.includes(k))){
      throw new BadRequestException({
        ok:false,code:'qa_wallet_cannot_accept_device_money_or_identity',
      });
    }
    return body;
  }
  private limit(v:unknown,defaultValue:number):number{
    if(v===undefined)return defaultValue;
    if(typeof v!=='number'||!Number.isSafeInteger(v)||v<1||v>50){
      throw new BadRequestException({
        ok:false,code:'qa_wallet_page_limit_invalid',
      });
    }
    return v;
  }

  @Post('merchant/summary')
  @HttpCode(200)
  @Header('Cache-Control','private, no-store, max-age=0')
  async merchantSummary(@Req()req:OrdersRequest,@Body()raw:unknown){
    const p=this.principal(req,'merchant');
    const body=this.input(raw,'merchant');
    if(typeof body.merchantSlug!=='string'||!SLUG.test(body.merchantSlug)){
      throw new BadRequestException({
        ok:false,code:'qa_wallet_valid_merchant_slug_required',
      });
    }
    const limit=this.limit(body.limit,30);
    let candidates:MerchantMembershipContext[];
    try{
      candidates=await this.memberships.readCommittedMerchantMemberships(
        p.issuer,p.subject);
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_wallet_membership_service_unavailable',
      });
    }
    if(!Array.isArray(candidates)){
      throw new ServiceUnavailableException({
        ok:false,code:'qa_wallet_membership_service_unavailable',
      });
    }
    const member=candidates.find(x=>x?.slug===body.merchantSlug &&
      x?.issuer===p.issuer&&x?.subject===p.subject);
    if(!member){
      throw new ForbiddenException({
        ok:false,code:'qa_wallet_merchant_membership_required',
      });
    }
    try{
      const report=await this.wallet.merchantWallet(p,member,limit);
      return {ok:true,mode:'test' as const,
        ownerRole:'merchant' as const,merchantSlug:member.slug,
        ...report};
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_wallet_merchant_unavailable_or_unverified',
      });
    }
  }

  @Post('courier/summary')
  @HttpCode(200)
  @Header('Cache-Control','private, no-store, max-age=0')
  async courierSummary(@Req()req:OrdersRequest,@Body()raw:unknown){
    const p=this.principal(req,'courier');
    const body=this.input(raw,'courier');
    const limit=this.limit(body.limit,20);
    let proof;
    try{
      proof=await this.memberships.readCommittedCourierRoster(
        p.issuer,p.subject);
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_wallet_courier_registry_unavailable',
      });
    }
    if(!proof||proof.active!==true||
       proof.source!=='committed-server-roster'||
       proof.issuer!==p.issuer||proof.subject!==p.subject){
      throw new ForbiddenException({
        ok:false,code:'qa_wallet_courier_roster_required',
      });
    }
    try{
      const report=await this.wallet.courierWallet(p,proof,limit);
      return {ok:true,mode:'test' as const,
        ownerRole:'courier' as const,...report};
    }catch{
      throw new ServiceUnavailableException({
        ok:false,code:'qa_wallet_courier_unavailable_or_unverified',
      });
    }
  }
}
