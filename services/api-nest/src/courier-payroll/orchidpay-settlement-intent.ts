import type { CourierWeeklyStatement } from './weekly-statement';
import {
  assertSealedPolicyIntegrity,
  type SealedCountryPayPolicy,
} from './policy-ledger';

export const ORCHIDPAY_COURIER_SETTLEMENT_INTENT_VERSION =
  'ORCHIDPAY_COURIER_SETTLEMENT_INTENT_V0.1';

export interface OrchidPayCourierSettlementIntent {
  schema_version: typeof ORCHIDPAY_COURIER_SETTLEMENT_INTENT_VERSION;
  mode: 'SHADOW';
  source_system: 'DELISHAFRICA_COURIER_FAIR_PAY';
  statement_id: string;
  courier_id: string;
  week_key: string;
  country_code: string;
  currency: string;
  policy_id: string;
  policy_hash: string;
  facts_hash: string;
  policy_validation_status: 'DRAFT' | 'LEGAL_REVIEW' | 'GREEN';
  production_eligible: boolean;
  eligible_income_minor: number;
  governing_floor_minor: number;
  differential_due_minor: number;
  gross_pay_due_minor: number;
  tips_minor: number;
  expense_reimbursements_minor: number;
  total_cash_due_minor: number;
  generated_at: string;
  evidence_refs: string[];
  warnings: string[];
}

function assertIsoWithTimezone(value: string): void {
  if (
    !Number.isFinite(Date.parse(value)) ||
    !/(Z|[+-]\d{2}:\d{2})$/i.test(value)
  ) {
    throw new Error('ORCHIDPAY_COURIER_SETTLEMENT_GENERATED_AT_INVALID');
  }
}

export function buildOrchidPayCourierSettlementIntent(
  statement: CourierWeeklyStatement,
  sealedPolicy: SealedCountryPayPolicy,
  generatedAt: string,
): OrchidPayCourierSettlementIntent {
  assertSealedPolicyIntegrity(sealedPolicy);
  assertIsoWithTimezone(generatedAt);

  if (
    statement.policyId !== sealedPolicy.policy.policyId ||
    statement.policyHash !== sealedPolicy.policyHash
  ) {
    throw new Error('ORCHIDPAY_COURIER_SETTLEMENT_POLICY_MISMATCH');
  }
  if (
    statement.countryCode.toUpperCase() !==
      sealedPolicy.policy.countryCode.toUpperCase() ||
    statement.currency.toUpperCase() !==
      sealedPolicy.policy.currency.toUpperCase()
  ) {
    throw new Error('ORCHIDPAY_COURIER_SETTLEMENT_SCOPE_MISMATCH');
  }

  const computation = statement.computation;
  if (
    computation.totalCashDueCents !==
    computation.grossPayDueCents +
      computation.tipsPassThroughCents +
      computation.expenseReimbursementsCents
  ) {
    throw new Error('ORCHIDPAY_COURIER_SETTLEMENT_TOTAL_MISMATCH');
  }
  if (computation.grossPayDueCents < computation.governingFloorCents) {
    throw new Error('ORCHIDPAY_COURIER_SETTLEMENT_FLOOR_VIOLATION');
  }

  return {
    schema_version: ORCHIDPAY_COURIER_SETTLEMENT_INTENT_VERSION,
    mode: 'SHADOW',
    source_system: 'DELISHAFRICA_COURIER_FAIR_PAY',
    statement_id: statement.statementId,
    courier_id: statement.courierId,
    week_key: statement.weekKey,
    country_code: statement.countryCode.toUpperCase(),
    currency: statement.currency.toUpperCase(),
    policy_id: statement.policyId,
    policy_hash: statement.policyHash,
    facts_hash: statement.factsHash,
    policy_validation_status: sealedPolicy.policy.validationStatus,
    production_eligible: computation.productionEligible,
    eligible_income_minor: computation.eligibleIncomeCents,
    governing_floor_minor: computation.governingFloorCents,
    differential_due_minor: computation.differentialDueCents,
    gross_pay_due_minor: computation.grossPayDueCents,
    tips_minor: computation.tipsPassThroughCents,
    expense_reimbursements_minor: computation.expenseReimbursementsCents,
    total_cash_due_minor: computation.totalCashDueCents,
    generated_at: generatedAt,
    evidence_refs: [
      `facts:${statement.factsHash}`,
      `policy:${statement.policyHash}`,
      `statement:${statement.statementId}`,
    ].sort(),
    warnings: Array.from(new Set(statement.warnings)).sort(),
  };
}
