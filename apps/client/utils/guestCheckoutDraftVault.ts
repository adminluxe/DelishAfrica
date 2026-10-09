/**
 * DelishAfrica Client guest-order recovery — pure persistence policy.
 *
 * Contains no customer PII. Stored capability is never a permission to
 * read an order unless the server independently verifies its signature/scope.
 * Recovery of captured payments after expiry is done by the server.
 */
export const GUEST_DRAFT_KEY = 'da_guest_checkout_draft_v1';
const ORDER_RE=/^DA-G-[a-f0-9]{32}$/;
const TOKEN_RE=/^dagc1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/;
const INTENT_RE=/^pi_[A-Za-z0-9_]+$/;

export type GuestDraftStep='issued'|'quoted'|'payment_pending';
export type GuestCheckoutDraft={
  version:1;
  orderId:string;
  mutationId:string;
  token:string;
  expiresAt:string;
  createdAt:string;
  step:GuestDraftStep;
  paymentIntentId?:string;
};
export type GuestDraftRestore={
  record:GuestCheckoutDraft;
  sessionExpired:boolean;
  needsServerRecovery:boolean;
};
export type GuestDraftAdapter={
  getItemAsync(key:string):Promise<string|null>;
  setItemAsync(key:string,value:string):Promise<void>;
  deleteItemAsync(key:string):Promise<void>;
};

function validDraft(data:unknown):data is GuestCheckoutDraft {
  if(!data || typeof data!=='object'||Array.isArray(data))return false;
  const c=data as Record<string,unknown>;
  if(c.version!==1 || typeof c.orderId!=='string' || !ORDER_RE.test(c.orderId) ||
     c.mutationId!=='guest:'+c.orderId ||
     typeof c.token!=='string' || !TOKEN_RE.test(c.token) ||
     typeof c.expiresAt!=='string'||typeof c.createdAt!=='string' ||
     !['issued','quoted','payment_pending'].includes(String(c.step)))return false;
  const exp=Date.parse(c.expiresAt),created=Date.parse(c.createdAt);
  if(!Number.isFinite(exp)||!Number.isFinite(created) ||
     exp<=created || exp-created>4*60*60*1000+60000)return false;
  if(c.paymentIntentId!==undefined &&
     (typeof c.paymentIntentId!=='string'||!INTENT_RE.test(c.paymentIntentId)))return false;
  if(c.step==='payment_pending'&&!c.paymentIntentId)return false;
  if(c.step!=='payment_pending'&&c.paymentIntentId)return false;
  return true;
}
const PROGRESS:Record<GuestDraftStep,number>={issued:1,quoted:2,payment_pending:3};

export class GuestCheckoutDraftVault {
  constructor(
    private readonly adapter:GuestDraftAdapter,
    private readonly now:()=>number=Date.now,
  ) {}
  async restore():Promise<GuestDraftRestore|null> {
    let raw:string|null;
    try{raw=await this.adapter.getItemAsync(GUEST_DRAFT_KEY)}
    catch{return null}
    if(!raw)return null;
    try{
      const record:unknown=JSON.parse(raw);
      if(!validDraft(record))return null;
      const expiry=Date.parse(record.expiresAt);
      const expired=expiry<=this.now();
      // Pending payment is deliberately NOT discarded after expiry:
      // the backend must reconcile it before local cleanup.
      if(expired && record.step!=='payment_pending'){
        await this.adapter.deleteItemAsync(GUEST_DRAFT_KEY).catch(()=>undefined);
        return null;
      }
      return {record,sessionExpired:expired,needsServerRecovery:expired && record.step==='payment_pending'};
    }catch{return null}
  }
  async save(record:GuestCheckoutDraft):Promise<void> {
    if(!validDraft(record))throw new Error('guest_draft_invalid');
    if(Date.parse(record.expiresAt)<=this.now()){
      throw new Error('guest_draft_expired');
    }
    const previous=await this.restore();
    if(previous){
      if(previous.record.orderId!==record.orderId){
        throw new Error('guest_draft_finish_or_recover_current_first');
      }
      if(PROGRESS[record.step]<PROGRESS[previous.record.step]){
        throw new Error('guest_draft_state_regression_forbidden');
      }
      if(previous.record.token!==record.token ||
         previous.record.mutationId!==record.mutationId ||
         previous.record.expiresAt!==record.expiresAt){
        throw new Error('guest_draft_identity_mismatch');
      }
      if(previous.record.paymentIntentId &&
         previous.record.paymentIntentId!==record.paymentIntentId){
        throw new Error('guest_draft_payment_identity_immutable');
      }
    }
    await this.adapter.setItemAsync(GUEST_DRAFT_KEY,JSON.stringify(record));
  }
  /** Must only be called after server confirms safe final state or explicit cancellation. */
  async clear():Promise<void>{
    await this.adapter.deleteItemAsync(GUEST_DRAFT_KEY);
  }
}
