import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import { InMemoryCourierPayrollLedger } from './lab-ledger-repository';
import {
  normalizeMissionPayrollTelemetry,
  normalizePaidWorkSegments,
} from './telemetry-normalizer';

const MISSION_TYPES = new Set([
  'MISSION_ACCEPTED',
  'MERCHANT_READY',
  'PICKUP_ARRIVED',
  'PICKED_UP',
  'DELIVERED',
]);

function missionKey(event: CourierPayrollClockEvent): string {
  return String(event.missionId || event.orderId || '').trim();
}

export function runClockNormalizationJob(
  ledger: InMemoryCourierPayrollLedger,
  courierId: string,
  weekKey: string,
  policyId: string,
) {
  const events = ledger.listClockEvents(courierId, weekKey, policyId);
  const missionGroups = new Map<string, CourierPayrollClockEvent[]>();

  for (const event of events.filter((item) => MISSION_TYPES.has(item.eventType))) {
    const key = missionKey(event);
    if (!key) {
      throw new Error('COURIER_PAYROLL_CLOCK_EVENT_MISSION_REQUIRED');
    }
    const bucket = missionGroups.get(key) || [];
    bucket.push(event);
    missionGroups.set(key, bucket);
  }

  const incompleteMissions: Array<{
    missionKey: string;
    missingSignals: string[];
  }> = [];
  const factAppendResults = [];

  for (const [key, bucket] of missionGroups.entries()) {
    const normalized = normalizeMissionPayrollTelemetry(bucket);
    factAppendResults.push(...ledger.appendFacts(normalized.facts));
    if (!normalized.complete) {
      incompleteMissions.push({
        missionKey: key,
        missingSignals: normalized.missingSignals,
      });
    }
  }

  const segmentResult = normalizePaidWorkSegments(events);
  factAppendResults.push(...ledger.appendFacts(segmentResult.facts));

  return {
    complete:
      incompleteMissions.length === 0 &&
      segmentResult.incompleteSegments.length === 0,
    eventCount: events.length,
    normalizedFactWrites: factAppendResults.length,
    insertedFacts: factAppendResults.filter((result) => result.inserted).length,
    idempotentFactReplays: factAppendResults.filter(
      (result) => result.idempotentReplay,
    ).length,
    incompleteMissions,
    incompleteSegments: segmentResult.incompleteSegments,
  };
}
