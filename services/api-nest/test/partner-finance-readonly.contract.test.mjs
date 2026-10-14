/**
 * P0 Merchant/Courier money-contract regression.
 * Runs with: node --experimental-strip-types --test
 * No Keycloak/Stripe/PG/production network; files copied into disposable tmp.
 * Integration with REAL sources is a separate release gate, NOT claimed here.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT=path.resolve(import.meta.dirname,'../../..');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'da-wallet-contract-'));
after(()=>fs.rmSync(temp,{recursive:true,force:true}));

async function contract(role) {
  const file=path.join(ROOT,'apps',role,'utils','daFinanceReadOnly.ts');
  const source=fs.readFileSync(file,'utf8');
  const marker="import { daOrdersFetch } from './daOrdersApi';";
  assert.equal(source.split(marker).length-1,1,'exactly one OIDC helper import');
  assert.match(source,/!__DEV__/,'cannot show amounts in signed release build');
  assert.match(source,/EXPO_PUBLIC_DA_FINANCE_QA_ONLY/,'explicit synthetic QA opt-in');
  assert.match(source,/qa-isolated\/partner-finance\/v1\/summary/);
  assert.match(source,/daOrdersFetch\(/,'must use authenticated Orders wrapper');
  const safe=source.replace(marker,
    "const daOrdersFetch = async () => { throw Error('network forbidden in unit test'); };");
  const target=path.join(temp,role+'.ts');
  fs.writeFileSync(target,safe,{mode:0o600});
  return (await import(pathToFileURL(target).href)).parseQaFinanceSummary;
}

for (const role of ['merchant','courier']) {
  test('QA financial contract '+role+' is fail-closed',async()=>{
    const parse=await contract(role);
    const good={ok:true,mode:'qa_synthetic_only',ownerRole:role,
      currency:'EUR',accruedMinor:10000,pendingMinor:1500,
      availableMinor:8500,heldMinor:0,withdrawableMinor:0,
      payoutEnabled:false};
    assert.equal(parse(good).status,'qa');
    const bad=[
      {...good,ownerRole:role==='merchant'?'courier':'merchant'},
      {...good,mode:'live'},
      {...good,payoutEnabled:true},
      {...good,withdrawableMinor:1},
      {...good,currency:'USD'},
      {...good,accruedMinor:999},
      {...good,pendingMinor:-1},
      {...good,availableMinor:'8500'},
      {...good,heldMinor:Number.NaN},
      null,
    ];
    for(const candidate of bad)assert.equal(parse(candidate).status,'unavailable');
  });
}

test('QA-only server remains absent from production AppModule',()=>{
  const app=fs.readFileSync(path.join(ROOT,
    'services/api-nest/src/app.module.ts'),'utf8');
  assert.doesNotMatch(app,/PartnerFinanceReadonlyQaController|FINANCE_READONLY_QA_PORT/);
  const controller=fs.readFileSync(path.join(ROOT,
    'services/api-nest/src/client-commerce/partner-finance-readonly.qa.controller.ts'),'utf8');
  assert.match(controller,/NODE_ENV === 'production'/);
  assert.match(controller,/GITHUB_ACTIONS !== 'true'/);
  assert.match(controller,/QA_SYNTHETIC_ONLY !== 'YES'/);
  assert.match(controller,/readWallet\(raw, 20\)/);
  assert.match(controller,/payoutEnabled !== false/);
  assert.match(controller,/private, no-store/);
  assert.doesNotMatch(controller,/@Post\(|@Put\(|@Patch\(|@Delete\(|stripe\.|sk_live_|DROP TABLE|TRUNCATE/);
});
