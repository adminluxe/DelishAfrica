'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {QAOperationsReadSource,QAOperationsPostgresSource} =
  require('../dist/atm-readonly/operations-source.qa.js');
const scope={issuer:'qa',subject:'qa-subject',merchantId:'qa-m',slug:'qa-slug',role:'admin'};
const at='2026-10-30T12:00:00.000Z';
const stock={id:'s1',merchant_id:'qa-m',name:'Riz',quantity:8,
  minimum:10,unit:'kg',supplier_id:null,updated_at:at};
const supplier={id:'v1',merchant_id:'qa-m',name:'Fournisseur QA',
  specialty:'Sec',lead_days:3,active:true,updated_at:at};
const enabled=()=>{
  process.env.NODE_ENV='test';process.env.DA_ATM_OPERATIONS_QA_ENABLED='YES';
};
const db=(rows,observed=[])=>({query:async(sql,args)=>{
  observed.push({sql,args});return {rows};
}});
test('ops source refuses to query when its independent QA flag is off',async()=>{
  process.env.NODE_ENV='test';delete process.env.DA_ATM_OPERATIONS_QA_ENABLED;
  let calls=0;
  const r=new QAOperationsReadSource({query:async()=>{calls++;return {rows:[]};}});
  await assert.rejects(r.readInventory(scope));
  assert.equal(calls,0);
});
test('production rejects both read paths before any database query',async()=>{
  process.env.NODE_ENV='production';process.env.DA_ATM_OPERATIONS_QA_ENABLED='YES';
  let calls=0;
  const r=new QAOperationsReadSource({query:async()=>{calls++;return {rows:[]};}});
  await assert.rejects(r.readInventory(scope));
  await assert.rejects(r.readSuppliers(scope));
  assert.equal(calls,0);process.env.NODE_ENV='test';
});
test('stocks are returned only under bound merchant parameter, never SQL interpolation',async()=>{
  enabled();const calls=[];
  const result=await new QAOperationsReadSource(db([stock],calls)).readInventory(scope);
  assert.equal(result.items.length,1);assert.equal(result.items[0].merchantId,'qa-m');
  assert.deepEqual(calls[0].args,['qa-m',251]);
  assert.match(calls[0].sql,/WHERE merchant_id = \$1/);
  assert.doesNotMatch(calls[0].sql,/qa-m/);
  assert.equal(result.updatedAt,at);
});
test('suppliers are returned only under bound merchant parameter',async()=>{
  enabled();const calls=[];
  const result=await new QAOperationsReadSource(db([supplier],calls)).readSuppliers(scope);
  assert.equal(result.items[0].leadDays,3);
  assert.deepEqual(calls[0].args,['qa-m',251]);
});
for(const row of [
  {...stock,merchant_id:'qa-foreign'}, {...stock,quantity:-1},
  {...stock,quantity:1.3},{...stock,unit:'barrel'},
  {...stock,updated_at:'broken'},
]){
  test('invalid or foreign inventory row must not be served',async()=>{
    enabled();
    const r=new QAOperationsReadSource(db([row]));
    await assert.rejects(r.readInventory(scope));
  });
}
for(const row of [
  {...supplier,merchant_id:'foreign'},{...supplier,lead_days:300},
  {...supplier,active:'true'}, {...supplier,specialty:''},
]){
  test('invalid or foreign supplier row must not be served',async()=>{
    enabled();
    const r=new QAOperationsReadSource(db([row]));
    await assert.rejects(r.readSuppliers(scope));
  });
}
test('duplicate ids in scoped records are refused',async()=>{
  enabled();
  await assert.rejects(new QAOperationsReadSource(db([stock,stock])).readInventory(scope));
  await assert.rejects(new QAOperationsReadSource(db([supplier,supplier])).readSuppliers(scope));
});
test('unbounded inventory page fails closed',async()=>{
  enabled();
  await assert.rejects(new QAOperationsReadSource(db(Array(251).fill(stock))).readInventory(scope));
});
test('no QA DB URI fails closed, and no connection is attempted',async()=>{
  enabled();delete process.env.DA_ATM_OPERATIONS_READONLY_DATABASE_URL;
  await assert.rejects(new QAOperationsPostgresSource().getPool());
});
test('database connector forces PostgreSQL default read-only transactions',()=>{
  const source=fs.readFileSync(require('node:path').resolve(
    __dirname,'../src/atm-readonly/operations-source.qa.ts'),'utf8');
  assert.match(source,/default_transaction_read_only=on/);
  assert.doesNotMatch(source,/client\.query\(['\"](?:INSERT|UPDATE|DELETE|TRUNCATE)/i);
});
test('QA migration is protected by a database-local safety guard and grants no DML',()=>{
  const sql=fs.readFileSync(require('node:path').resolve(
    __dirname,'../migrations/ATM_R40_QA_INVENTORY_SUPPLIERS_20261030.sql'),'utf8');
  assert.match(sql,/current_setting\('da.qa_isolated', true\)/);
  assert.match(sql,/IS DISTINCT FROM 'YES'/);
  assert.match(sql,/FOREIGN KEY \(merchant_id,supplier_id\)/);
  assert.match(sql,/REVOKE ALL .* FROM PUBLIC/);
  assert.doesNotMatch(sql,/INSERT INTO|TRUNCATE|DROP TABLE|CREATE ROLE|GRANT UPDATE|GRANT INSERT/i);
});
