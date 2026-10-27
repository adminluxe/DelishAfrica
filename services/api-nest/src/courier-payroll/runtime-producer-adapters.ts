import type { CanonicalOrderTruth } from '../../../../packages/contracts/src/order';
import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import { assertCourierFairPayLabEnabled } from './lab-config';
import type { CourierPayrollLedgerRepository } from './courier-payroll-ledger';

export interface PayrollProducerContext {
  countryCode: string;
  weekKey: string;
  policyId: string;
  courierId?: string;
  missionId?: string;
  estimatedActivitySeconds?: number;
}

function eventId(
  orderId: string,
  eventType: CourierPayrollClockEvent['eventType'],
  occurredAt: string,
): string {
  return `payroll:${orderId}:${eventType.toLowerCase()}:${occurredAt}`;
}

export function buildCanonicalOrderClockEvents(
  order: CanonicalOrderTruth,
  context: PayrollProducerContext,
): CourierPayrollClockEvent[] {
  const courierId = String(
    context.courierId || order.assignment?.courierId || '',
  ).trim();
  if (!courierId) return [];

  const base = {
    courierId,
    countryCode: context.countryCode,
    weekKey: context.weekKey,
    policyId: context.policyId,
    source: 'API_ORDER' as const,
    orderId: order.identity.id,
    missionId: context.missionId || `${order.identity.id}:delivery`,
    merchantId: order.restaurant.id,
  };
  const events: CourierPayrollClockEvent[] = [];

  if (order.timestamps.acceptedAt) {
    events.push({
      ...base,
      eventId: eventId(
        order.identity.id,
        'MISSION_ACCEPTED',
        order.timestamps.acceptedAt,
      ),
      eventType: 'MISSION_ACCEPTED',
      occurredAt: order.timestamps.acceptedAt,
      ...(context.estimatedActivitySeconds != null
        ? { estimatedActivitySeconds: context.estimatedActivitySeconds }
        : {}),
    });
  }

  if (order.timestamps.readyAt) {
    events.push({
      ...base,
      eventId: eventId(
        order.identity.id,
        'MERCHANT_READY',
        order.timestamps.readyAt,
      ),
      eventType: 'MERCHANT_READY',
      occurredAt: order.timestamps.readyAt,
    });
  }

  if (order.timestamps.pickedUpAt) {
    events.push({
      ...base,
      eventId: eventId(
        order.identity.id,
        'PICKED_UP',
        order.timestamps.pickedUpAt,
      ),
      eventType: 'PICKED_UP',
      occurredAt: order.timestamps.pickedUpAt,
    });
  }

  if (order.timestamps.deliveredAt) {
    events.push({
      ...base,
      eventId: eventId(
        order.identity.id,
        'DELIVERED',
        order.timestamps.deliveredAt,
      ),
      eventType: 'DELIVERED',
      occurredAt: order.timestamps.deliveredAt,
    });
  }

  return events.sort(
    (a, b) =>
      Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
      a.eventId.localeCompare(b.eventId),
  );
}

export function buildRuntimeOrderClockEvents(
  order: Record<string, any>,
  context: PayrollProducerContext,
): CourierPayrollClockEvent[] {
  const orderId = String(order.id || order.orderId || order.publicId || '').trim();
  const proposal = order.assignmentProposal || {};
  const courierId = String(context.courierId || proposal.courierId || '').trim();
  if (!orderId || !courierId) return [];

  const missionId = context.missionId || `${orderId}:delivery`;
  const base = {
    courierId,
    countryCode: context.countryCode,
    weekKey: context.weekKey,
    policyId: context.policyId,
    orderId,
    missionId,
    merchantId: String(
      order.restaurantId || order.partnerSlug || order.merchantSlug || '',
    ).trim() || undefined,
  };

  const candidates: Array<{
    eventType: CourierPayrollClockEvent['eventType'];
    occurredAt: unknown;
    source: CourierPayrollClockEvent['source'];
    estimatedActivitySeconds?: number;
  }> = [
    {
      eventType: 'MISSION_ACCEPTED',
      occurredAt: proposal.acceptedAt,
      source: 'API_ORDER',
      ...(context.estimatedActivitySeconds != null
        ? { estimatedActivitySeconds: context.estimatedActivitySeconds }
        : {}),
    },
    {
      eventType: 'MERCHANT_READY',
      occurredAt: order.readyAt,
      source: 'API_ORDER',
    },
    {
      eventType: 'PICKUP_ARRIVED',
      occurredAt: order.courierArrivedPickupAt,
      source: 'COURIER_APP',
    },
    {
      eventType: 'PICKED_UP',
      occurredAt: order.pickedUpAt,
      source: 'API_ORDER',
    },
    {
      eventType: 'DELIVERED',
      occurredAt: order.deliveredAt,
      source: 'API_ORDER',
    },
  ];

  return candidates
    .filter(
      (candidate) =>
        typeof candidate.occurredAt === 'string' &&
        Number.isFinite(Date.parse(candidate.occurredAt)),
    )
    .map((candidate) => ({
      ...base,
      eventId: eventId(orderId, candidate.eventType, String(candidate.occurredAt)),
      eventType: candidate.eventType,
      source: candidate.source,
      occurredAt: String(candidate.occurredAt),
      ...(candidate.estimatedActivitySeconds != null
        ? { estimatedActivitySeconds: candidate.estimatedActivitySeconds }
        : {}),
    }))
    .sort(
      (a, b) =>
        Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
        a.eventId.localeCompare(b.eventId),
    );
}

export interface PickupArrivalInput extends PayrollProducerContext {
  orderId: string;
  merchantId?: string;
  occurredAt: string;
  courierId: string;
  missionId: string;
}

export function buildCourierPickupArrivalEvent(
  input: PickupArrivalInput,
): CourierPayrollClockEvent {
  return {
    eventId: eventId(input.orderId, 'PICKUP_ARRIVED', input.occurredAt),
    eventType: 'PICKUP_ARRIVED',
    courierId: input.courierId,
    countryCode: input.countryCode,
    weekKey: input.weekKey,
    policyId: input.policyId,
    source: 'COURIER_APP',
    occurredAt: input.occurredAt,
    orderId: input.orderId,
    missionId: input.missionId,
    merchantId: input.merchantId,
  };
}

export function recordLabClockEvents(
  ledger: CourierPayrollLedgerRepository,
  events: CourierPayrollClockEvent[],
  env: Record<string, string | undefined> = process.env,
) {
  assertCourierFairPayLabEnabled(env);
  return ledger.appendClockEvents(events);
}


export type ExplicitPaidSegmentFamily = 'REPOSITION' | 'OTHER_PAID';
export type ExplicitPaidSegmentBoundary = 'STARTED' | 'ENDED';

export interface ExplicitPaidSegmentEventInput {
  family: ExplicitPaidSegmentFamily;
  boundary: ExplicitPaidSegmentBoundary;
  courierId: string;
  countryCode: string;
  weekKey: string;
  policyId: string;
  segmentId: string;
  occurredAt: string;
  source?: CourierPayrollClockEvent['source'];
  missionId?: string;
  orderId?: string;
  evidenceRefs?: string[];
}

export function buildExplicitPaidSegmentEvent(
  input: ExplicitPaidSegmentEventInput,
): CourierPayrollClockEvent {
  const courierId = String(input.courierId || '').trim();
  const countryCode = String(input.countryCode || '').trim().toUpperCase();
  const weekKey = String(input.weekKey || '').trim();
  const policyId = String(input.policyId || '').trim();
  const segmentId = String(input.segmentId || '').trim();
  const occurredAt = String(input.occurredAt || '').trim();
  if (
    !courierId ||
    !countryCode ||
    !weekKey ||
    !policyId ||
    !segmentId ||
    !occurredAt ||
    !Number.isFinite(Date.parse(occurredAt))
  ) {
    throw new Error('COURIER_PAYROLL_EXPLICIT_SEGMENT_INPUT_INVALID');
  }
  const eventType = `${input.family}_${input.boundary}` as
    CourierPayrollClockEvent['eventType'];
  return {
    eventId: [
      'payroll-segment',
      policyId,
      courierId,
      segmentId,
      eventType.toLowerCase(),
      occurredAt,
    ].join(':'),
    eventType,
    courierId,
    countryCode,
    weekKey,
    policyId,
    source: input.source || 'OPS',
    occurredAt,
    segmentId,
    ...(input.missionId ? { missionId: String(input.missionId).trim() } : {}),
    ...(input.orderId ? { orderId: String(input.orderId).trim() } : {}),
    ...(Array.isArray(input.evidenceRefs)
      ? {
          evidenceRefs: Array.from(
            new Set(
              input.evidenceRefs
                .map((value) => String(value || '').trim())
                .filter(Boolean),
            ),
          ).sort(),
        }
      : {}),
  };
}
