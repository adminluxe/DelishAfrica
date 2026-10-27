import { equal, rejects } from 'node:assert/strict';
import { test } from 'node:test';
import type { OrchidPayCourierSettlementIntent } from './orchidpay-settlement-intent';
import { sendOrchidPayCourierShadowIntent } from './orchidpay-shadow-client';

const intent: OrchidPayCourierSettlementIntent = {
  schema_version: 'ORCHIDPAY_COURIER_SETTLEMENT_INTENT_V0.1',
  mode: 'SHADOW',
  source_system: 'DELISHAFRICA_COURIER_FAIR_PAY',
  statement_id: 'a'.repeat(64),
  courier_id: 'courier-1',
  week_key: '2026-W44',
  country_code: 'BE',
  currency: 'EUR',
  policy_id: 'BE-EMPLOYEE-POG-FAIR-PAY-LAB-v0.1',
  policy_hash: 'b'.repeat(64),
  facts_hash: 'c'.repeat(64),
  policy_validation_status: 'DRAFT',
  production_eligible: false,
  eligible_income_minor: 1800,
  governing_floor_minor: 1900,
  differential_due_minor: 100,
  gross_pay_due_minor: 1900,
  tips_minor: 500,
  expense_reimbursements_minor: 300,
  total_cash_due_minor: 2700,
  generated_at: '2026-10-27T12:30:00.000Z',
  evidence_refs: ['facts:c', 'policy:b', 'statement:a'],
  warnings: ['COUNTRY_POLICY_NOT_LEGALLY_GREEN'],
};

test('OrchidPay shadow client is a strict no-op unless enabled', async () => {
  let calls = 0;
  const result = await sendOrchidPayCourierShadowIntent(intent, {
    env: {},
    fetchImpl: async () => {
      calls += 1;
      throw new Error('must not be called');
    },
  });
  equal(result.enabled, false);
  equal(result.sent, false);
  equal(calls, 0);
});

test('OrchidPay shadow client sends only to internal settlement-intent endpoint', async () => {
  let seenUrl = '';
  let seenKey = '';
  let seenBody = '';
  const result = await sendOrchidPayCourierShadowIntent(intent, {
    env: {
      DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_ENABLED: 'true',
      DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_URL: 'http://127.0.0.1:18089/',
      DA_ORCHIDPAY_COURIER_PAYROLL_INTERNAL_KEY: 'secret-test-key',
    },
    fetchImpl: async (url, init) => {
      seenUrl = url;
      seenKey = String(init?.headers?.['X-Internal-Key'] || '');
      seenBody = String(init?.body || '');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          shadow: true,
          statement_id: intent.statement_id,
          intent_hash: 'd'.repeat(64),
          status: 'SHADOW_RECEIVED',
          idempotent_replay: false,
          production_execution: false,
        }),
      };
    },
  });

  equal(seenUrl, 'http://127.0.0.1:18089/payroll/courier/settlement-intents');
  equal(seenKey, 'secret-test-key');
  equal(JSON.parse(seenBody).statement_id, intent.statement_id);
  equal(result.enabled, true);
  equal(result.sent, true);
  equal(result.receipt?.production_execution, false);
});

test('OrchidPay shadow client refuses incomplete config and boundary breach', async () => {
  await rejects(
    () =>
      sendOrchidPayCourierShadowIntent(intent, {
        env: {
          DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_ENABLED: 'true',
        },
      }),
    /SHADOW_URL_REQUIRED/,
  );

  await rejects(
    () =>
      sendOrchidPayCourierShadowIntent(intent, {
        env: {
          DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_ENABLED: 'true',
          DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_URL: 'http://127.0.0.1:18089',
          DA_ORCHIDPAY_COURIER_PAYROLL_INTERNAL_KEY: 'secret-test-key',
        },
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            shadow: true,
            production_execution: true,
          }),
        }),
      }),
    /PRODUCTION_BOUNDARY_BREACH/,
  );
});
