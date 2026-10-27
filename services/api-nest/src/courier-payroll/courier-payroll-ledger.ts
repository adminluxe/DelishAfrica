import type { CourierPayrollFact } from '../../../../packages/contracts/src/courier-payroll';
import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import type { CourierWeeklyStatement } from './weekly-statement';
import type { SealedCountryPayPolicy } from './policy-ledger';

export interface AppendResult {
  inserted: boolean;
  idempotentReplay: boolean;
}

export interface CourierPayrollLedgerRepository {
  appendPolicy(policy: SealedCountryPayPolicy): AppendResult;
  appendClockEvent(event: CourierPayrollClockEvent): AppendResult;
  appendClockEvents(events: CourierPayrollClockEvent[]): AppendResult[];
  appendFact(fact: CourierPayrollFact): AppendResult;
  appendFacts(facts: CourierPayrollFact[]): AppendResult[];
  appendStatement(statement: CourierWeeklyStatement): AppendResult;

  getPolicy(policyId: string): SealedCountryPayPolicy | null;
  getStatement(statementId: string): CourierWeeklyStatement | null;
  listStatements(
    courierId: string,
    weekKey?: string,
    policyId?: string,
  ): CourierWeeklyStatement[];

  listClockEvents(
    courierId: string,
    weekKey: string,
    policyId: string,
  ): CourierPayrollClockEvent[];

  listFacts(
    courierId: string,
    weekKey: string,
    policyId: string,
  ): CourierPayrollFact[];

  counts(): {
    clockEvents: number;
    policies: number;
    facts: number;
    statements: number;
  };
}
