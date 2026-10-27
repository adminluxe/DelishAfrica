import type {
  CourierPayrollClockEvent,
  CourierPayrollClockEventType,
} from '../../../../packages/contracts/src/courier-payroll-telemetry';
import { isCourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import type {
  CourierPayrollDurationFact,
  CourierPayrollFact,
  CourierPayrollTimeFact,
  CourierPayrollTimeCategory,
} from '../../../../packages/contracts/src/courier-payroll';

export interface MissionPayrollNormalizationResult {
  complete: boolean;
  missingSignals: CourierPayrollClockEventType[];
  facts: CourierPayrollFact[];
  diagnostics: {
    merchantReadyBeforeArrivalSeconds: number | null;
    pickupDwellSeconds: number | null;
  };
}

function eventOf(
  events: CourierPayrollClockEvent[],
  type: CourierPayrollClockEventType,
): CourierPayrollClockEvent | undefined {
  return events.find((event) => event.eventType === type);
}

function secondsBetween(a: string, b: string): number {
  const millis = Date.parse(b) - Date.parse(a);
  if (millis < 0 || millis % 1000 !== 0) {
    throw new Error('COURIER_PAYROLL_TELEMETRY_TIME_ORDER_INVALID');
  }
  return millis / 1000;
}

function signedSecondsBetween(a: string, b: string): number {
  const millis = Date.parse(b) - Date.parse(a);
  if (millis % 1000 !== 0) {
    throw new Error('COURIER_PAYROLL_TELEMETRY_TIME_PRECISION_INVALID');
  }
  return millis / 1000;
}

function scopeKey(event: CourierPayrollClockEvent): string {
  return [
    event.courierId,
    event.countryCode.toUpperCase(),
    event.weekKey,
    event.policyId,
    event.missionId || '',
    event.orderId || '',
  ].join('::');
}

function assertMissionScope(events: CourierPayrollClockEvent[]): void {
  const keys = new Set(events.map(scopeKey));
  if (keys.size !== 1) {
    throw new Error('COURIER_PAYROLL_TELEMETRY_MIXED_MISSION_SCOPE');
  }
  const ids = new Set<string>();
  const eventTypes = new Set<string>();
  for (const event of events) {
    if (!isCourierPayrollClockEvent(event)) {
      throw new Error('COURIER_PAYROLL_TELEMETRY_INVALID_EVENT');
    }
    if (ids.has(event.eventId)) {
      throw new Error('COURIER_PAYROLL_TELEMETRY_DUPLICATE_EVENT');
    }
    ids.add(event.eventId);
    if (eventTypes.has(event.eventType)) {
      throw new Error('COURIER_PAYROLL_TELEMETRY_DUPLICATE_EVENT_TYPE');
    }
    eventTypes.add(event.eventType);
  }
}

function timeFact(
  base: CourierPayrollClockEvent,
  factId: string,
  category: CourierPayrollTimeCategory,
  start: CourierPayrollClockEvent,
  end: CourierPayrollClockEvent,
): CourierPayrollTimeFact | null {
  if (Date.parse(start.occurredAt) === Date.parse(end.occurredAt)) return null;
  secondsBetween(start.occurredAt, end.occurredAt);
  return {
    factId,
    kind: 'TIME',
    category,
    courierId: base.courierId,
    countryCode: base.countryCode,
    weekKey: base.weekKey,
    policyId: base.policyId,
    source: 'PAYROLL_NORMALIZER',
    recordedAt: end.occurredAt,
    orderId: base.orderId,
    missionId: base.missionId,
    merchantId: base.merchantId,
    startedAt: start.occurredAt,
    endedAt: end.occurredAt,
    evidenceRefs: [start.eventId, end.eventId],
  };
}

export function normalizeMissionPayrollTelemetry(
  events: CourierPayrollClockEvent[],
): MissionPayrollNormalizationResult {
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('COURIER_PAYROLL_TELEMETRY_EVENTS_REQUIRED');
  }
  assertMissionScope(events);

  const accepted = eventOf(events, 'MISSION_ACCEPTED');
  const arrived = eventOf(events, 'PICKUP_ARRIVED');
  const pickedUp = eventOf(events, 'PICKED_UP');
  const delivered = eventOf(events, 'DELIVERED');
  const merchantReady = eventOf(events, 'MERCHANT_READY');
  const required: CourierPayrollClockEventType[] = [
    'MISSION_ACCEPTED',
    'PICKUP_ARRIVED',
    'PICKED_UP',
    'DELIVERED',
  ];
  const missingSignals = required.filter((type) => !eventOf(events, type));

  const facts: CourierPayrollFact[] = [];
  if (accepted?.estimatedActivitySeconds != null) {
    const durationFact: CourierPayrollDurationFact = {
      factId: `${accepted.missionId || accepted.orderId}:activity-estimate`,
      kind: 'DURATION',
      category: 'ACTIVITY_GUARANTEE_ESTIMATE',
      courierId: accepted.courierId,
      countryCode: accepted.countryCode,
      weekKey: accepted.weekKey,
      policyId: accepted.policyId,
      source: 'PAYROLL_NORMALIZER',
      recordedAt: accepted.occurredAt,
      orderId: accepted.orderId,
      missionId: accepted.missionId,
      merchantId: accepted.merchantId,
      seconds: accepted.estimatedActivitySeconds,
      evidenceRefs: [accepted.eventId],
    };
    facts.push(durationFact);
  }

  if (missingSignals.length > 0) {
    return {
      complete: false,
      missingSignals,
      facts,
      diagnostics: {
        merchantReadyBeforeArrivalSeconds: null,
        pickupDwellSeconds: null,
      },
    };
  }

  const prePickup = timeFact(
    accepted!,
    `${accepted!.missionId || accepted!.orderId}:active-pre-pickup`,
    'ACTIVE_MISSION',
    accepted!,
    arrived!,
  );
  const dwell = timeFact(
    accepted!,
    `${accepted!.missionId || accepted!.orderId}:pickup-dwell`,
    'PLATFORM_CONTROLLED_WAITING',
    arrived!,
    pickedUp!,
  );
  const delivery = timeFact(
    accepted!,
    `${accepted!.missionId || accepted!.orderId}:active-delivery`,
    'ACTIVE_MISSION',
    pickedUp!,
    delivered!,
  );
  if (prePickup) facts.push(prePickup);
  if (dwell) facts.push(dwell);
  if (delivery) facts.push(delivery);

  return {
    complete: true,
    missingSignals: [],
    facts,
    diagnostics: {
      merchantReadyBeforeArrivalSeconds:
        merchantReady && arrived
          ? signedSecondsBetween(merchantReady.occurredAt, arrived.occurredAt)
          : null,
      pickupDwellSeconds:
        arrived && pickedUp
          ? secondsBetween(arrived.occurredAt, pickedUp.occurredAt)
          : null,
    },
  };
}

export interface PaidWorkSegmentNormalizationResult {
  complete: boolean;
  incompleteSegments: string[];
  facts: CourierPayrollTimeFact[];
}

export function normalizePaidWorkSegments(
  events: CourierPayrollClockEvent[],
): PaidWorkSegmentNormalizationResult {
  const segmentEvents = events.filter((event) =>
    [
      'REPOSITION_STARTED',
      'REPOSITION_ENDED',
      'OTHER_PAID_STARTED',
      'OTHER_PAID_ENDED',
    ].includes(event.eventType),
  );

  for (const event of segmentEvents) {
    if (!isCourierPayrollClockEvent(event)) {
      throw new Error('COURIER_PAYROLL_TELEMETRY_INVALID_EVENT');
    }
    if (!event.segmentId) {
      throw new Error('COURIER_PAYROLL_TELEMETRY_SEGMENT_ID_REQUIRED');
    }
  }

  const groups = new Map<string, CourierPayrollClockEvent[]>();
  for (const event of segmentEvents) {
    const family = event.eventType.startsWith('REPOSITION')
      ? 'REPOSITION'
      : 'OTHER_PAID';
    const key = [
      event.courierId,
      event.countryCode.toUpperCase(),
      event.weekKey,
      event.policyId,
      family,
      event.segmentId,
    ].join('::');
    const bucket = groups.get(key) || [];
    bucket.push(event);
    groups.set(key, bucket);
  }

  const facts: CourierPayrollTimeFact[] = [];
  const incompleteSegments: string[] = [];

  for (const bucket of groups.values()) {
    const start = bucket.find((event) => event.eventType.endsWith('_STARTED'));
    const end = bucket.find((event) => event.eventType.endsWith('_ENDED'));
    const segmentId = bucket[0].segmentId!;

    if (!start || !end) {
      incompleteSegments.push(segmentId);
      continue;
    }
    if (bucket.length !== 2) {
      throw new Error('COURIER_PAYROLL_TELEMETRY_SEGMENT_DUPLICATE');
    }

    const category: CourierPayrollTimeCategory =
      start.eventType === 'REPOSITION_STARTED'
        ? 'REQUIRED_REPOSITION'
        : 'OTHER_PAID';
    const fact = timeFact(
      start,
      `${segmentId}:${category.toLowerCase()}`,
      category,
      start,
      end,
    );
    if (fact) facts.push(fact);
  }

  return {
    complete: incompleteSegments.length === 0,
    incompleteSegments: incompleteSegments.sort(),
    facts,
  };
}
