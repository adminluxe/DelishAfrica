'use strict';
/**
 * QA-only release isolation tripwire. Production app and routes MUST NOT
 * auto-register candidate TEST merchant/courier earnings controllers.
 */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
if(process.env.GITHUB_ACTIONS!=='true'||
  process.env.QA_SYNTHETIC_ONLY!=='YES'){
  throw Error('QA_WALLET_RELEASE_ISOLATION_CI_ONLY');
}
const root=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('wallet SQL is disconnected, append-only, and no payout path exists',()=>{
  const appModule=read('src/app.module.ts');
  const walletController=read('src/client-commerce/merchant-courier-wallet.qa.controller.ts');
  const migration=read('migrations/client-commerce/20261013_009_merchant_courier_wallet_qa_only.sql');
  const walletAdapter=read('src/client-commerce/merchant-courier-wallet.pg-qa.adapter.ts');
  const financeLedgerTest=read('test/merchant-courier-wallet.pg-qa.integration.cjs');
  const all=walletController+'\n'+walletAdapter+'\n'+migration;
  assert(!appModule.includes('merchant-courier-wallet.qa.controller') && !appModule.includes('QaMerchantCourierWalletController') && !appModule.includes('QaMerchantCourierWalletPgAdapter'));
  assert(!/api\.stripe\.com|sk_live_|pk_live_|transfer_group|payouts\.create|transfers\.create/.test(all));
  assert(walletController.includes("process.env.NODE_ENV==='production'"));
  assert(walletController.includes("DA_QA_ISOLATED_WALLET_ENABLED!=='YES'"));
  assert(walletController.includes("@UseGuards(OrdersAuthGuard)"));
  assert(walletController.includes('no-store'));
  assert(!/@Post\(['"`][^'"`]*(?:withdraw|cashout|payout|transfer)/i.test(walletController));
  assert(migration.includes('CREATE TRIGGER da_qa_wallet_posting_no_mutations'));
  assert(migration.includes('CREATE TRIGGER da_qa_wallet_allocation_no_mutations'));
  assert(migration.includes('REVOKE ALL ON TABLE public.da_qa_wallet_policy'));
  assert(migration.includes('GRANT EXECUTE ON FUNCTION public.da_qa_wallet_accrue_verified_capture'));
  assert(migration.includes('QA_FIXTURE_EUR_V1'));
  assert(financeLedgerTest.includes('QA_009_STRIPE_CALLS=ZERO_REAL_PAYOUTS=ZERO'));
  console.log('QA_009_WALLET_PROD_APP_MODULE_IMPORTS=ZERO');
  console.log('QA_009_WALLET_WITHDRAW_PAYOUT_TRANSFER_ENDPOINTS=ZERO');
  console.log('QA_009_WALLET_APPEND_ONLY_AND_ROLE_REVOKES=YES');
});
