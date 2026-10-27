import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import type { SealedCountryPayPolicy } from './policy-ledger';
import { assertCourierFairPayLabEnabled } from './lab-config';
import type { CourierPayrollLedgerRepository } from './courier-payroll-ledger';
import { runClockNormalizationJob } from './clock-normalization-job';
import { runWeeklyCalculationJob } from './weekly-calculation-job';

export interface LabPipelineInput {
  sealedPolicy: SealedCountryPayPolicy;
  courierId: string;
  weekKey: string;
  clockEvents: CourierPayrollClockEvent[];
  monetaryFacts: CourierPayrollFact[];
  env?: Record<string, string | undefined>;
}

export function runCourierFairPayLabPipeline(
  ledger: CourierPayrollLedgerRepository,
  input: LabPipelineInput,
) {
  assertCourierFairPayLabEnabled(input.env);

  const policyWrite = ledger.appendPolicy(input.sealedPolicy);
  const eventWrites = ledger.appendClockEvents(input.clockEvents);
  const monetaryWrites = ledger.appendFacts(input.monetaryFacts);
  const normalization = runClockNormalizationJob(
    ledger,
    input.courierId,
    input.weekKey,
    input.sealedPolicy.policy.policyId,
  );

  if (!normalization.complete) {
    return {
      finalizable: false as const,
      policyWrite,
      eventWrites,
      monetaryWrites,
      normalization,
      statement: null,
    };
  }

  const calculation = runWeeklyCalculationJob(ledger, {
    courierId: input.courierId,
    weekKey: input.weekKey,
    sealedPolicy: input.sealedPolicy,
    mode: 'LAB',
  });

  return {
    finalizable: true as const,
    policyWrite,
    eventWrites,
    monetaryWrites,
    normalization,
    statement: calculation.statement,
    statementPersistence: calculation.persistence,
  };
}
