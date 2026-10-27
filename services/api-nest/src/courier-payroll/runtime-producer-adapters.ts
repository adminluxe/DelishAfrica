import type { CanonicalOrderTruth } from '../../../../packages/contracts/src/order';
import type { CourierPayrollClockEvent } from '../../../../packages/contracts/src/courier-payroll-telemetry';
import { assertCourierFairPayLabEnabled } from './lab-config';
import { InMemoryCourierPayrollLedger } from './lab-ledger-repository';

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
  ledger: InMemoryCourierPayrollLedger,
  events: CourierPayrollClockEvent[],
  env: Record<string, string | undefined> = process.env,
) {
  assertCourierFairPayLabEnabled(env);
  return ledger.appendClockEvents(events);
}
