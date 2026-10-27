import type { ISODateTime } from "./order";

export type CourierPayrollFactSource =
  | "API_ORDER"
  | "COURIER_APP"
  | "MERCHANT_APP"
  | "OPS"
  | "PAYMENTS"
  | "PAYROLL_NORMALIZER";

export type CourierPayrollTimeCategory =
  | "ACTIVE_MISSION"
  | "PLATFORM_CONTROLLED_WAITING"
  | "REQUIRED_REPOSITION"
  | "OTHER_PAID"
  | "EXCLUDED";

export type CourierPayrollMoneyCategory =
  | "ELIGIBLE_INCOME"
  | "TIP"
  | "EXPENSE_REIMBURSEMENT";

export type CourierPayrollDurationCategory = "ACTIVITY_GUARANTEE_ESTIMATE";

export interface CourierPayrollFactCorrection {
  reasonCode: string;
  reason: string;
  approvedAt: ISODateTime;
  approvedBy: string;
}

export interface CourierPayrollFactBase {
  factId: string;
  courierId: string;
  countryCode: string;
  weekKey: string;
  policyId: string;
  source: CourierPayrollFactSource;
  recordedAt: ISODateTime;
  orderId?: string;
  missionId?: string;
  merchantId?: string;
  evidenceRefs?: string[];
  supersedesFactId?: string;
  correction?: CourierPayrollFactCorrection;
}

export interface CourierPayrollTimeFact extends CourierPayrollFactBase {
  kind: "TIME";
  category: CourierPayrollTimeCategory;
  startedAt: ISODateTime;
  endedAt: ISODateTime;
}

export interface CourierPayrollMoneyFact extends CourierPayrollFactBase {
  kind: "MONEY";
  category: CourierPayrollMoneyCategory;
  amountMinor: number;
  currency: string;
}

export interface CourierPayrollDurationFact extends CourierPayrollFactBase {
  kind: "DURATION";
  category: CourierPayrollDurationCategory;
  seconds: number;
}

export type CourierPayrollFact =
  | CourierPayrollTimeFact
  | CourierPayrollMoneyFact
  | CourierPayrollDurationFact;

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function validIsoDateTime(value: unknown): boolean {
  const raw = text(value);
  if (!raw) return false;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed);
}

function validCorrection(fact: Partial<CourierPayrollFactBase>): boolean {
  const supersedes = text(fact.supersedesFactId);
  const correction = fact.correction;
  if (!supersedes && !correction) return true;
  if (!supersedes || !correction || supersedes === text(fact.factId)) return false;
  if (
    !text(correction.reasonCode) ||
    !text(correction.reason) ||
    !text(correction.approvedBy) ||
    !validIsoDateTime(correction.approvedAt)
  ) {
    return false;
  }
  return Array.isArray(fact.evidenceRefs) && fact.evidenceRefs.some((ref) => text(ref));
}

function validBase(fact: Partial<CourierPayrollFactBase>): boolean {
  return Boolean(
    text(fact.factId) &&
      text(fact.courierId) &&
      text(fact.countryCode) &&
      text(fact.weekKey) &&
      text(fact.policyId) &&
      text(fact.source) &&
      validIsoDateTime(fact.recordedAt) &&
      validCorrection(fact),
  );
}

export function isCourierPayrollFact(
  value: unknown,
): value is CourierPayrollFact {
  if (!value || typeof value !== "object") return false;
  const fact = value as Partial<CourierPayrollFact>;
  if (!validBase(fact)) return false;

  if (fact.kind === "TIME") {
    const time = fact as Partial<CourierPayrollTimeFact>;
    if (
      ![
        "ACTIVE_MISSION",
        "PLATFORM_CONTROLLED_WAITING",
        "REQUIRED_REPOSITION",
        "OTHER_PAID",
        "EXCLUDED",
      ].includes(String(time.category))
    ) {
      return false;
    }
    if (!validIsoDateTime(time.startedAt) || !validIsoDateTime(time.endedAt)) {
      return false;
    }
    return Date.parse(String(time.endedAt)) > Date.parse(String(time.startedAt));
  }

  if (fact.kind === "MONEY") {
    const money = fact as Partial<CourierPayrollMoneyFact>;
    if (
      !["ELIGIBLE_INCOME", "TIP", "EXPENSE_REIMBURSEMENT"].includes(
        String(money.category),
      )
    ) {
      return false;
    }
    return (
      Number.isSafeInteger(money.amountMinor) &&
      Number(money.amountMinor) >= 0 &&
      Boolean(text(money.currency))
    );
  }

  if (fact.kind === "DURATION") {
    const duration = fact as Partial<CourierPayrollDurationFact>;
    return (
      duration.category === "ACTIVITY_GUARANTEE_ESTIMATE" &&
      Number.isSafeInteger(duration.seconds) &&
      Number(duration.seconds) >= 0
    );
  }

  return false;
}

export function assertCourierPayrollFact(
  value: unknown,
): asserts value is CourierPayrollFact {
  if (!isCourierPayrollFact(value)) {
    throw new Error("COURIER_PAYROLL_INVALID_FACT");
  }
}
