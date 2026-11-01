/**
 * Inventory + suppliers from an independently provisioned READ-ONLY QA
 * PostgreSQL principal, never from public catalogue or synthetic screen data.
 * No schema is created here and no production database is touched.
 */
import type {ReadScope} from './atm-readonly.core';

export type QaSql = Readonly<{
  query:(sql:string,args:readonly unknown[])=>Promise<{rows:Record<string,unknown>[]}>;
}>;
const integer=(v:unknown):v is number=>typeof v==='number' &&
  Number.isSafeInteger(v) && v>=0;
const text=(v:unknown):v is string=>typeof v==='string' &&
  v.trim().length>0 && v.length<=120;
const iso=(v:unknown):string=>{
  const date=v instanceof Date?v:new Date(String(v));
  if(Number.isNaN(date.getTime()))throw Error('qa_invalid_data_timestamp');
  return date.toISOString();
};
export class QAOperationsReadSource {
  constructor(private readonly database:QaSql) {}
  private enabled() {
    if (process.env.NODE_ENV==='production' ||
        process.env.DA_ATM_OPERATIONS_QA_ENABLED!=='YES')
      throw Error('qa_operations_read_not_certified');
  }
  async readInventory(scope:ReadScope) {
    this.enabled();
    const result=await this.database.query(
      `SELECT id, merchant_id, name, quantity, minimum, unit, supplier_id, updated_at
       FROM da_atm_inventory_items_qa
       WHERE merchant_id = $1 ORDER BY id LIMIT $2`,
      [scope.merchantId,251],
    );
    if(!Array.isArray(result.rows)||result.rows.length>250)throw Error('qa_stock_page_overflow');
    const seen=new Set<string>();
    const items=result.rows.map(row=>{
      if(!text(row.id)||seen.has(row.id)||row.merchant_id!==scope.merchantId ||
         !text(row.name)||!integer(row.quantity)||!integer(row.minimum)||
         !['kg','L','piece'].includes(String(row.unit))||
         !(row.supplier_id===null||text(row.supplier_id)))
        throw Error('qa_stock_row_not_trusted');
      seen.add(row.id);
      return {id:row.id,merchantId:scope.merchantId,name:row.name,
        quantity:row.quantity,minimum:row.minimum,unit:row.unit,
        supplierId:row.supplier_id};
    });
    const latest=result.rows.reduce<string>((time,row)=>{
      const n=iso(row.updated_at);return n>time?n:time;
    },'1970-01-01T00:00:00.000Z');
    return {merchantId:scope.merchantId,updatedAt:latest,items};
  }
  async readSuppliers(scope:ReadScope) {
    this.enabled();
    const result=await this.database.query(
      `SELECT id, merchant_id, name, specialty, lead_days, active, updated_at
       FROM da_atm_suppliers_qa
       WHERE merchant_id = $1 ORDER BY id LIMIT $2`,
      [scope.merchantId,251],
    );
    if(!Array.isArray(result.rows)||result.rows.length>250)throw Error('qa_supplier_page_overflow');
    const seen=new Set<string>();
    const items=result.rows.map(row=>{
      if(!text(row.id)||seen.has(row.id)||row.merchant_id!==scope.merchantId||
         !text(row.name)||!text(row.specialty)||
         !integer(row.lead_days)||row.lead_days>120||
         typeof row.active!=='boolean')throw Error('qa_supplier_row_not_trusted');
      seen.add(row.id);
      return {id:row.id,merchantId:scope.merchantId,name:row.name,
        specialty:row.specialty,leadDays:row.lead_days,active:row.active};
    });
    const latest=result.rows.reduce<string>((time,row)=>{
      const n=iso(row.updated_at);return n>time?n:time;
    },'1970-01-01T00:00:00.000Z');
    return {merchantId:scope.merchantId,updatedAt:latest,items};
  }
}

/** Connection factory only. Requires a separate read-only QA DB login. */
export class QAOperationsPostgresSource {
  private pool?: QaSql & {end:()=>Promise<void>};
  async getPool():Promise<QaSql> {
    if(process.env.NODE_ENV==='production' ||
       process.env.DA_ATM_OPERATIONS_QA_ENABLED!=='YES')
      throw Error('qa_operations_read_not_certified');
    const url=String(process.env.DA_ATM_OPERATIONS_READONLY_DATABASE_URL||'').trim();
    if(!url || url.length>1200 || !/^postgres(ql)?:\/\//.test(url))
      throw Error('qa_operations_db_not_configured');
    if(!this.pool){
      const {Pool}=require('pg') as {Pool:new (config:Record<string,unknown>)=>QaSql&{end:()=>Promise<void>}};
      this.pool=new Pool({connectionString:url,max:2,connectionTimeoutMillis:3000,
        idleTimeoutMillis:15000,application_name:'da-atm-r40-qa-readonly',
        options:'-c default_transaction_read_only=on'});
    }
    return this.pool;
  }
  async dispose() {
    const p=this.pool;this.pool=undefined;if(p)await p.end().catch(()=>undefined);
  }
}
