import type { PayrollExecutionMode } from './courier-payroll.types';
import type { SealedCountryPayPolicy } from './policy-ledger';
import { InMemoryCourierPayrollLedger } from './lab-ledger-repository';
import { buildCourierWeeklyStatement } from './weekly-statement';

export interface WeeklyCalculationJobInput {
  courierId: string;
  weekKey: string;
  sealedPolicy: SealedCountryPayPolicy;
  mode?: PayrollExecutionMode;
}

export function runWeeklyCalculationJob(
  ledger: InMemoryCourierPayrollLedger,
  input: WeeklyCalculationJobInput,
) {
  ledger.appendPolicy(input.sealedPolicy);
  const facts = ledger.listFacts(
    input.courierId,
    input.weekKey,
    input.sealedPolicy.policy.policyId,
  );
  if (facts.length === 0) {
    throw new Error('COURIER_PAYROLL_WEEKLY_JOB_NO_FACTS');
  }

  const statement = buildCourierWeeklyStatement(
    facts,
    input.sealedPolicy,
    input.mode ?? 'LAB',
  );
  const persistence = ledger.appendStatement(statement);

  return {
    statement,
    persistence,
  };
}
