import type { ISODateTime } from "./order";
import type { CourierPayrollFactSource } from "./courier-payroll";

export type CourierPayrollClockEventType =
  | "MISSION_ACCEPTED"
  | "MERCHANT_READY"
  | "PICKUP_ARRIVED"
  | "PICKED_UP"
  | "DELIVERED"
  | "REPOSITION_STARTED"
  | "REPOSITION_ENDED"
  | "OTHER_PAID_STARTED"
  | "OTHER_PAID_ENDED";

export interface CourierPayrollClockEvent {
  eventId: string;
  eventType: CourierPayrollClockEventType;
  courierId: string;
  countryCode: string;
  weekKey: string;
  policyId: string;
  source: CourierPayrollFactSource;
  occurredAt: ISODateTime;
  orderId?: string;
  missionId?: string;
  merchantId?: string;
  segmentId?: string;
  estimatedActivitySeconds?: number;
  evidenceRefs?: string[];
}

export function isCourierPayrollClockEvent(
  value: unknown,
): value is CourierPayrollClockEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as Partial<CourierPayrollClockEvent>;
  const allowed: CourierPayrollClockEventType[] = [
    "MISSION_ACCEPTED",
    "MERCHANT_READY",
    "PICKUP_ARRIVED",
    "PICKED_UP",
    "DELIVERED",
    "REPOSITION_STARTED",
    "REPOSITION_ENDED",
    "OTHER_PAID_STARTED",
    "OTHER_PAID_ENDED",
  ];
  if (
    !event.eventId ||
    !event.courierId ||
    !event.countryCode ||
    !event.weekKey ||
    !event.policyId ||
    !event.source ||
    !event.eventType ||
    !allowed.includes(event.eventType)
  ) {
    return false;
  }
  if (!event.occurredAt || !Number.isFinite(Date.parse(event.occurredAt))) {
    return false;
  }
  if (
    event.estimatedActivitySeconds != null &&
    (!Number.isSafeInteger(event.estimatedActivitySeconds) ||
      event.estimatedActivitySeconds < 0)
  ) {
    return false;
  }
  return true;
}
