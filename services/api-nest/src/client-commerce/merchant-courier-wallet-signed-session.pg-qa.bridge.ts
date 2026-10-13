/**
 * DelishAfrica F4F — disconnected QA candidate only, never AppModule.
 *
 * This bridge starts from a raw Bearer JWT. A separate verifier must check
 * the ACTUAL RS256 signature, issuer, audience, authorized party and role.
 * Never accept a caller-supplied principal, merchantSlug or courier subject.
 * Independent session-revocation and legally committed membership/roster
 * adapters are mandatory. Their official production implementations are NOT
 * provided here; the PG17 test uses SYNTHETIC signed tokens and registries.
 *
 * IMPORTANT deployment rule: the attestor login belongs ONLY in a separate
 * trusted process, not the public mobile API. No Stripe / bank / payout.
 */
import {createHash} from 'node:crypto';
import type {DaExternalTokenVerification} from
  '../auth/external-jwks-verifier.types';

type Role='merchant'|'courier';
type QueryResult={rows:Record<string,unknown>[]};
export type QaWalletDbClient=Readonly<{
  query:(sql:string,params?:unknown[])=>Promise<QueryResult>;
  release:()=>void;
}>;
export type QaWalletDbPool=Readonly<{
  connect:()=>Promise<QaWalletDbClient>;
}>;
export type QaWalletAttestorDb=Readonly<{
  query:(sql:string,params?:unknown[])=>Promise<QueryResult>;
}>;
export type QaWalletVerifier=Readonly<{
  verifyToken:(rawJwt:string)=>Promise<DaExternalTokenVerification>;
}>;
export type QaWalletSessionProof=Readonly<{
  source:'independent-revocation-ledger';
  active:true;issuer:string;subject:string;sid:string;jti:string;
  checkedAtEpochMs:number;
}>;
export type QaWalletPartnerScope=Readonly<{
  source:'committed-wallet-registry';
  role:Role;issuer:string;subject:string;
  organizationId:string;territory:string;
  merchantSlug?:string;
  membershipRole?:string;
  membershipStatus?:string;contractStatus?:string;kybStatus?:string;
  partnerLifecycleStatus?:string;
  rosterActive?:boolean;agreementStatus?:string;kycStatus?:string;
  startsAt?:string|null;expiresAt?:string|null;revokedAt?:string|null;
}>;
export type QaWalletTrustPorts=Readonly<{
  verify:QaWalletVerifier;
  checkLiveSession:(issuer:string,subject:string,sid:string,jti:string)=>
    Promise<QaWalletSessionProof|null>;
  readMerchantWalletScopes:(issuer:string,subject:string)=>
    Promise<ReadonlyArray<QaWalletPartnerScope>>;
  readCourierWalletScope:(issuer:string,subject:string)=>
    Promise<QaWalletPartnerScope|null>;
  merchantPool:QaWalletDbPool;
  courierPool:QaWalletDbPool;
  attestor:QaWalletAttestorDb;
}>;

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG=/^[a-z0-9][a-z0-9_-]{1,119}$/;
const TERRITORY=/^[A-Z]{2}$/;
const SID=/^[A-Za-z0-9_-]{8,180}$/;
// Treat a signed Keycloak token id as an OPAQUE identifier. Bound it to
// printable URI-safe ASCII; never interpolate or log it. It is hashed before
// a parameterized PostgreSQL lookup, so '-' ':' '.' '/' and '+' are safe.
const JTI=/^[A-Za-z0-9._~:+\/-]{8,255}$/;
const JWT=/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const ISSUER=/^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/;
const ROLE_LOGIN={
  merchant:'da_qa_merchant_commerce_app',
  courier:'da_qa_courier_commerce_app',
} as const;
const ROLE_AUD={
  merchant:'delishafrica-merchant',
  courier:'delishafrica-courier',
} as const;
function deny():never{
  // No token, identity, financial information or PG error leaks into callers.
  throw Error('qa_f4f_financial_identity_denied');
}
function one(rows:Record<string,unknown>[]):Record<string,unknown>{
  if(!Array.isArray(rows)||rows.length!==1||!rows[0])deny();
  return rows[0];
}
function withinDates(s:QaWalletPartnerScope,now:number):boolean {
  if(s.revokedAt!==undefined && s.revokedAt!==null)return false;
  if(s.startsAt!==undefined && s.startsAt!==null){
    const start=Date.parse(s.startsAt);
    if(!Number.isFinite(start)||start>now)return false;
  }
  if(s.expiresAt!==undefined && s.expiresAt!==null){
    const expiry=Date.parse(s.expiresAt);
    if(!Number.isFinite(expiry)||expiry<=now)return false;
  }
  return true;
}
function amount(v:unknown):number{
  if(typeof v!=='number'&&typeof v!=='string')deny();
  if(typeof v==='string'&&!/^\d{1,15}$/.test(v))deny();
  const n=Number(v);
  if(!Number.isSafeInteger(n)||n<0)deny();
  return n;
}
function object(v:unknown):Record<string,unknown>{
  if(!v||typeof v!=='object'||Array.isArray(v))deny();
  return v as Record<string,unknown>;
}
export type QaVerifiedWalletRead=Readonly<{
  mode:'qa_synthetic_only';ownerRole:Role;
  merchantSlug:string|null;territory:string;organizationId:string;
  summary:Record<string,unknown>;
  activity:ReadonlyArray<Record<string,unknown>>;
  withdrawableMinor:0;payoutEnabled:false;
}>;

/** No HTTP controller; only usable in an independent QA attestor process. */
export class QaWalletVerifiedSessionBridge {
  constructor(private readonly trust:QaWalletTrustPorts,
    private readonly trustedIssuer:string){
    if(!ISSUER.test(trustedIssuer)||!trust?.verify?.verifyToken||
       !trust?.checkLiveSession||!trust?.readMerchantWalletScopes||
       !trust?.readCourierWalletScope||!trust?.merchantPool?.connect||
       !trust?.courierPool?.connect||!trust?.attestor?.query)deny();
  }

  /**
   * F4K QA-only operational mutation. The existing wallet read acts as a
   * complete independent Keycloak/introspection/SQL-authority preflight;
   * a NEW ticket is then minted for this single operation. PostgreSQL 015
   * repeats the 014 row-lock authorization during the exact same
   * transaction that changes the operational row and records the receipt.
   * No caller-provided slug, issuer, subject or courier assignment.
   */
  async transition(
    authorization:unknown,orderId:unknown,next:unknown,
  ):Promise<Readonly<{
    mode:'qa_synthetic_only';orderId:string;ownerRole:Role;state:string;
    replayed:boolean;withdrawableMinor:0;payoutEnabled:false;
  }>>{
    if(process.env.NODE_ENV==='production'||
       process.env.GITHUB_ACTIONS!=='true'||
       process.env.QA_SYNTHETIC_ONLY!=='YES'||
       process.env.QA_F4I_PRIVATE_SERVICE!=='YES'||
       process.env.QA_F4J_ATOMIC_SQL!=='YES'||
       process.env.QA_F4K_OPERATION_WRITES!=='YES')deny();
    if(typeof orderId!=='string'||!UUID.test(orderId)||
       typeof next!=='string'||
       !['accepted','ready','picked_up','delivered'].includes(next))deny();
    const scope=await this.readWallet(authorization,1);
    const raw=typeof authorization==='string'?
      authorization.match(/^Bearer ([^\s]+)$/i)?.[1]:null;
    if(!raw||!JWT.test(raw))deny();
    let v:DaExternalTokenVerification;
    try{v=await this.trust.verify.verifyToken(raw);}catch{deny();}
    if(!v.ok)deny();
    const p=v.payload,role=p.role;
    if((role!=='merchant'&&role!=='courier')||
       p.authSource!=='external'||p.iss!==this.trustedIssuer||
       !UUID.test(p.sub||'')||!SID.test(p.sid||'')||
       !JTI.test(p.jti||'')||
       role!==scope.ownerRole||
       (role==='merchant'&&!['accepted','ready'].includes(next))||
       (role==='courier'&&!['accepted','picked_up','delivered']
         .includes(next)))deny();
    const pool=role==='merchant'?this.trust.merchantPool:
      this.trust.courierPool;
    let client:QaWalletDbClient|null=null;
    try{
      client=await pool.connect();
      const login=one((await client.query(
        'SELECT session_user AS login')).rows);
      if(login.login!==ROLE_LOGIN[role])deny();
      const attestLogin=one((await this.trust.attestor.query(
        'SELECT session_user AS login')).rows);
      if(attestLogin.login!=='da_qa_wallet_attestor_isolated_013')deny();
      const challenge=one((await client.query(
        'SELECT public.da_qa_wallet_begin_scope_010() AS challenge')).rows);
      if(typeof challenge.challenge!=='string'||
         !UUID.test(challenge.challenge))deny();
      const ticket=one((await this.trust.attestor.query(
        'SELECT public.da_qa_wallet_attest_010('+
        '$1::uuid,$2::text,$3::uuid,$4::varchar,$5::uuid,$6::char(2)) AS ticket',
        [challenge.challenge,p.iss,p.sub,
          role==='merchant'?scope.merchantSlug:null,
          scope.organizationId,scope.territory])).rows);
      if(typeof ticket.ticket!=='string'||!UUID.test(ticket.ticket))deny();
      const key=createHash('sha256')
        .update('DA-F4G-keycloak-partner-sid-jti-v1\n'+
          [p.iss,p.sub,p.sid,p.jti].join('\n')).digest('hex');
      const received=one((await client.query(
        'SELECT public.da_qa_partner_transition_attested_015('+
        '$1::uuid,$2::text,$3::uuid,$4::text) AS receipt',
        [ticket.ticket,key,orderId,next])).rows);
      const receipt=object(received.receipt);
      if(receipt.mode!=='qa_synthetic_only'||
         receipt.orderId!==orderId||receipt.ownerRole!==role||
         receipt.state!==next||
         typeof receipt.replayed!=='boolean'||
         receipt.withdrawableMinor!==0||receipt.payoutEnabled!==false)deny();
      return Object.freeze({
        mode:'qa_synthetic_only' as const,orderId,ownerRole:role,
        state:next,replayed:receipt.replayed,
        withdrawableMinor:0 as const,payoutEnabled:false as const,
      });
    }catch{deny();}
    finally{if(client)client.release();}
  }

  async readWallet(
    authorization:unknown,limit=20,
  ):Promise<QaVerifiedWalletRead>{
    if(process.env.NODE_ENV==='production'||
       process.env.GITHUB_ACTIONS!=='true'||
       process.env.QA_SYNTHETIC_ONLY!=='YES')deny();
    if(typeof authorization!=='string'||authorization.length>11000||
       !/^Bearer\s/i.test(authorization))deny();
    const token=authorization.match(/^Bearer ([^\s]+)$/i)?.[1];
    if(!token||!JWT.test(token)||!Number.isSafeInteger(limit)||
       limit<1||limit>50)deny();

    // Only this verifier's cryptographically authenticated JWT claims are
    // usable. Neither device-provided identity nor internal dev-login works.
    let verified:DaExternalTokenVerification;
    try{verified=await this.trust.verify.verifyToken(token);}catch{deny();}
    if(!verified.ok)deny();
    const p=verified.payload;
    const role=p.role;
    const now=Date.now();
    const seconds=Math.floor(now/1000);
    if((role!=='merchant'&&role!=='courier')||
       p.authSource!=='external'||p.iss!==this.trustedIssuer||
       !UUID.test(p.sub||'')||p.azp!==ROLE_AUD[role]||
       !SID.test(p.sid||'')||!JTI.test(p.jti||'')||
       !Number.isSafeInteger(p.exp)||!Number.isSafeInteger(p.iat)||
       p.iat>seconds+30||p.exp<=seconds||
       p.exp-p.iat>900||p.exp-seconds>900)deny();

    const aud=typeof p.aud==='string'?[p.aud]:p.aud;
    if(!Array.isArray(aud)||!aud.includes(ROLE_AUD[role])||
       aud.some(x=>x!=='account'&&x!==ROLE_AUD[role]))deny();

    let live:QaWalletSessionProof|null;
    try{
      live=await this.trust.checkLiveSession(
        p.iss,p.sub,p.sid as string,p.jti as string);
    }catch{deny();}
    if(!live||live.source!=='independent-revocation-ledger'||
       live.active!==true||live.issuer!==p.iss||
       live.subject!==p.sub||live.sid!==p.sid||live.jti!==p.jti||
       !Number.isSafeInteger(live.checkedAtEpochMs)||
       live.checkedAtEpochMs>now+1000||
       now-live.checkedAtEpochMs>5000)deny();

    let s:QaWalletPartnerScope|null=null;
    try{
      if(role==='merchant'){
        const candidates=await this.trust.readMerchantWalletScopes(p.iss,p.sub);
        if(!Array.isArray(candidates)||candidates.length!==1)deny();
        s=candidates[0];
      }else{
        s=await this.trust.readCourierWalletScope(p.iss,p.sub);
      }
    }catch{deny();}
    if(!s||s.source!=='committed-wallet-registry'||s.role!==role||
       s.issuer!==p.iss||s.subject!==p.sub||
       !UUID.test(s.organizationId||'')||
       !TERRITORY.test(s.territory||'')||
       !withinDates(s,now))deny();
    if(role==='merchant'){
      if(!SLUG.test(s.merchantSlug||'')||
         !['owner','admin','finance'].includes(s.membershipRole||'')||
         s.membershipStatus!=='active'||
         s.contractStatus!=='active'||s.kybStatus!=='verified'||
         s.partnerLifecycleStatus!=='published')deny();
    }else{
      if(s.merchantSlug!==undefined||
         s.rosterActive!==true||s.agreementStatus!=='active'||
         s.kycStatus!=='verified')deny();
    }

    const pool=role==='merchant'?this.trust.merchantPool:
      this.trust.courierPool;
    let client:QaWalletDbClient|null=null;
    try{
      client=await pool.connect();
      const login=one((await client.query(
        'SELECT session_user AS login')).rows);
      if(login.login!==ROLE_LOGIN[role])deny();
      const attestLogin=one((await this.trust.attestor.query(
        'SELECT session_user AS login')).rows);
      const requiredAttestorLogin=process.env.QA_F4I_PRIVATE_SERVICE==='YES'?
        'da_qa_wallet_attestor_isolated_013':'da_qa_wallet_attestor_010';
      if(attestLogin.login!==requiredAttestorLogin)deny();
      const challenge=one((await client.query(
        'SELECT public.da_qa_wallet_begin_scope_010() AS challenge')).rows);
      if(typeof challenge.challenge!=='string'||
         !UUID.test(challenge.challenge))deny();
      const ticket=one((await this.trust.attestor.query(
        'SELECT public.da_qa_wallet_attest_010('+
        '$1::uuid,$2::text,$3::uuid,$4::varchar,$5::uuid,$6::char(2)) AS ticket',
        [challenge.challenge,p.iss,p.sub,
          role==='merchant'?s.merchantSlug:null,
          s.organizationId,s.territory])).rows);
      if(typeof ticket.ticket!=='string'||!UUID.test(ticket.ticket))deny();
      const f4j=process.env.QA_F4J_ATOMIC_SQL==='YES';
      if(f4j && process.env.QA_F4I_PRIVATE_SERVICE!=='YES')deny();
      const readSql=f4j?
        'SELECT public.da_qa_wallet_read_linearized_014('+
          '$1::uuid,$2::integer,$3::text) AS report':
        'SELECT public.da_qa_wallet_read_attested_010('+
          '$1::uuid,$2::integer) AS report';
      const sessionHash=f4j?createHash('sha256')
        .update('DA-F4G-keycloak-partner-sid-jti-v1\n'+
          [p.iss,p.sub,p.sid,p.jti].join('\n')).digest('hex'):null;
      const row=one((await client.query(readSql,
        f4j?[ticket.ticket,limit,sessionHash]:
          [ticket.ticket,limit])).rows);
      const report=object(row.report);
      const summary=object(report.summary);
      const items=report.activity;
      if(report.mode!=='qa_synthetic_only'||
         report.ownerRole!==role||
         report.merchantSlug!==(role==='merchant'?s.merchantSlug:null)||
         report.organizationId!==s.organizationId||
         report.territory!==s.territory||
         report.withdrawableMinor!==0||
         report.payoutEnabled!==false||
         !Array.isArray(items)||items.length>limit||
         items.some(v=>!v||typeof v!=='object'||Array.isArray(v))||
         String(summary.currency).trim()!=='EUR'||
         summary.payout_enabled!==false||
         amount(summary.withdrawable_minor)!==0||
         amount(summary.accrued_minor)!==
           amount(summary.pending_minor)+
           amount(summary.available_minor)+amount(summary.held_minor)
      )deny();
      return Object.freeze({
        mode:'qa_synthetic_only' as const,ownerRole:role,
        merchantSlug:role==='merchant'?s.merchantSlug as string:null,
        territory:s.territory,organizationId:s.organizationId,
        summary:Object.freeze({...summary}),
        activity:Object.freeze((items as Record<string,unknown>[])
          .map(v=>Object.freeze({...v}))),
        withdrawableMinor:0 as const,payoutEnabled:false as const,
      });
    }catch{deny();}
    finally{if(client)client.release();}
  }
}
