/**
 * DelishAfrica F4H / QA-only durable-for-the-run finance authority reader.
 * REAL catalogue membership tables, separate QA legal-entity/Courier tables.
 * No writes, no admin database credential, no public HTTP route or payout.
 * Rights come from signed issuer + subject, never a mobile merchantSlug.
 * Every SQL query is parameterized and fails closed.
 */
import type {QaWalletPartnerScope} from
  './merchant-courier-wallet-signed-session.pg-qa.bridge';

type Result={rows:Record<string,unknown>[]};
type ReadOnlyQuery={query:(sql:string,params?:unknown[])=>Promise<Result>};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISSUER=/^https:\/\/[A-Za-z0-9.-]+\/realms\/[A-Za-z0-9_-]+$/;
function timestamp(v:unknown):string|null{
  if(v===null||v===undefined)return null;
  const d=v instanceof Date?v:new Date(String(v));
  if(!Number.isFinite(d.getTime()))throw Error('qa_f4h_invalid_authority_date');
  return d.toISOString();
}
function guard(issuer:string,subject:string):void{
  if(process.env.NODE_ENV==='production'||
     process.env.GITHUB_ACTIONS!=='true'||
     process.env.QA_SYNTHETIC_ONLY!=='YES'||
     !ISSUER.test(issuer)||!UUID.test(subject)){
    throw Error('qa_f4h_authority_unavailable');
  }
}
export class QaFinanceAuthorityRegistryReader {
  constructor(private readonly reader:ReadOnlyQuery){
    if(!reader?.query)throw Error('qa_f4h_authority_unavailable');
  }
  async readMerchantWalletScopes(
    issuer:string,subject:string,
  ):Promise<QaWalletPartnerScope[]>{
    guard(issuer,subject);
    const q=await this.reader.query(
      `SELECT m.issuer,m.subject,m.membership_role,
        m.membership_status,m.contract_status,m.kyb_status,
        m.starts_at,m.expires_at,m.revoked_at,
        p.slug,p.lifecycle_status,
        b.organization_id::text AS organization_id,b.territory
       FROM public.da_merchant_memberships AS m
       INNER JOIN public.da_identity_subjects AS i
         ON i.issuer=m.issuer AND i.subject=m.subject
       INNER JOIN public.da_catalog_partners AS p
         ON p.partner_id=m.partner_id
       INNER JOIN public.da_qa_finance_partner_entities_012 AS b
         ON b.partner_id=p.partner_id
       INNER JOIN public.da_qa_finance_legal_entities_012 AS e
         ON e.organization_id=b.organization_id
        AND e.territory=b.territory
       WHERE m.issuer=$1 AND m.subject=$2
         AND i.identity_kind='merchant' AND i.identity_status='active'
         AND m.membership_role IN ('owner','admin','finance')
         AND m.membership_status='active'
         AND m.contract_status='active'
         AND m.kyb_status='verified'
         AND m.revoked_at IS NULL
         AND (m.starts_at IS NULL OR m.starts_at<=clock_timestamp())
         AND (m.expires_at IS NULL OR m.expires_at>clock_timestamp())
         AND p.lifecycle_status='published'
         AND b.revoked_at IS NULL
         AND b.valid_from<=clock_timestamp()
         AND (b.valid_until IS NULL OR b.valid_until>clock_timestamp())
         AND e.legal_status='active' AND e.kyb_status='verified'
         AND e.revoked_at IS NULL
         AND e.valid_from<=clock_timestamp()
         AND (e.valid_until IS NULL OR e.valid_until>clock_timestamp())
       ORDER BY p.slug ASC
       LIMIT 2`,
      [issuer,subject],
    );
    return q.rows.map(r=>({
      source:'committed-wallet-registry' as const,
      role:'merchant' as const,issuer:String(r.issuer),
      subject:String(r.subject),merchantSlug:String(r.slug),
      organizationId:String(r.organization_id),
      territory:String(r.territory).trim(),
      membershipRole:String(r.membership_role),
      membershipStatus:String(r.membership_status),
      contractStatus:String(r.contract_status),
      kybStatus:String(r.kyb_status),
      partnerLifecycleStatus:String(r.lifecycle_status),
      startsAt:timestamp(r.starts_at),
      expiresAt:timestamp(r.expires_at),
      revokedAt:timestamp(r.revoked_at),
    }));
  }
  async readCourierWalletScope(
    issuer:string,subject:string,
  ):Promise<QaWalletPartnerScope|null>{
    guard(issuer,subject);
    const q=await this.reader.query(
      `SELECT c.issuer,c.subject,c.organization_id::text AS organization_id,
        c.territory,c.roster_status,c.agreement_status,c.kyc_status,
        c.valid_from,c.valid_until,c.revoked_at
       FROM public.da_qa_finance_courier_roster_012 AS c
       INNER JOIN public.da_identity_subjects AS i
         ON i.issuer=c.issuer AND i.subject=c.subject
       INNER JOIN public.da_qa_finance_legal_entities_012 AS e
         ON e.organization_id=c.organization_id
        AND e.territory=c.territory
       WHERE c.issuer=$1 AND c.subject=$2
         AND i.identity_kind='courier' AND i.identity_status='active'
         AND c.roster_status='active'
         AND c.agreement_status='active'
         AND c.kyc_status='verified'
         AND c.revoked_at IS NULL
         AND c.valid_from<=clock_timestamp()
         AND (c.valid_until IS NULL OR c.valid_until>clock_timestamp())
         AND e.legal_status='active' AND e.kyb_status='verified'
         AND e.revoked_at IS NULL
         AND e.valid_from<=clock_timestamp()
         AND (e.valid_until IS NULL OR e.valid_until>clock_timestamp())
       LIMIT 2`,
      [issuer,subject],
    );
    if(q.rows.length!==1)return null;
    const r=q.rows[0];
    return {
      source:'committed-wallet-registry',role:'courier',
      issuer:String(r.issuer),subject:String(r.subject),
      organizationId:String(r.organization_id),
      territory:String(r.territory).trim(),
      rosterActive:r.roster_status==='active',
      agreementStatus:String(r.agreement_status),
      kycStatus:String(r.kyc_status),
      startsAt:timestamp(r.valid_from),
      expiresAt:timestamp(r.valid_until),
      revokedAt:timestamp(r.revoked_at),
    };
  }
}
