/**
 * Role-bound financial QA reader. No local ledger, no price estimation.
 * Disabled in all release builds, even if an environment flag is mistakenly set.
 * Never persist financial responses or send account/tenant IDs from the device.
 */
import { daOrdersFetch } from './daOrdersApi';

type Role = 'merchant' | 'courier';
export type QaFinanceSummary = Readonly<{
  status: 'qa';
  role: Role;
  currency: 'EUR';
  accruedMinor: number;
  pendingMinor: number;
  availableMinor: number;
  heldMinor: number;
  withdrawableMinor: 0;
  payoutEnabled: false;
}>;
export type FinanceState =
  | QaFinanceSummary
  | Readonly<{status: 'unavailable'; reason: 'not_certified' | 'denied' | 'invalid_data'}>;

const EXPECTED_ROLE: Role = 'courier';
const API_RAW = process.env.EXPO_PUBLIC_API_URL || 'https://api.delishafrica.me/api/v1';
const API = API_RAW.replace(/\/+$/, '').endsWith('/api/v1')
  ? API_RAW.replace(/\/+$/, '')
  : API_RAW.replace(/\/+$/, '') + '/api/v1';

function safeMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) &&
    value >= 0 && value <= 9_000_000_000_000;
}
export function parseQaFinanceSummary(payload: unknown): FinanceState {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { status: 'unavailable', reason: 'invalid_data' };
  }
  const p = payload as Record<string, unknown>;
  if (p.ok !== true || p.mode !== 'qa_synthetic_only' ||
      p.ownerRole !== EXPECTED_ROLE || p.currency !== 'EUR' ||
      p.payoutEnabled !== false || p.withdrawableMinor !== 0 ||
      !safeMoney(p.accruedMinor) || !safeMoney(p.pendingMinor) ||
      !safeMoney(p.availableMinor) || !safeMoney(p.heldMinor) ||
      p.accruedMinor !== p.pendingMinor + p.availableMinor + p.heldMinor) {
    return { status: 'unavailable', reason: 'invalid_data' };
  }
  return Object.freeze({
    status: 'qa' as const, role: EXPECTED_ROLE, currency: 'EUR' as const,
    accruedMinor: p.accruedMinor, pendingMinor: p.pendingMinor,
    availableMinor: p.availableMinor, heldMinor: p.heldMinor,
    withdrawableMinor: 0 as const, payoutEnabled: false as const,
  });
}

export async function readFinanceForCurrentIdentity(): Promise<FinanceState> {
  // Never show fictional wallet totals in a signed Store/release build.
  if (typeof __DEV__ === 'undefined' || !__DEV__ ||
      process.env.EXPO_PUBLIC_DA_FINANCE_QA_ONLY !== 'YES') {
    return { status: 'unavailable', reason: 'not_certified' };
  }
  try {
    // daOrdersFetch validates the active external OIDC identity via the API
    // before sending Authorization. Server independently validates JWT + PG.
    const response = await daOrdersFetch(
      API + '/qa-isolated/partner-finance/v1/summary',
      { method: 'GET', headers: { Accept: 'application/json' } },
    );
    if (!response.ok) return { status: 'unavailable', reason: 'denied' };
    const data: unknown = await response.json();
    return parseQaFinanceSummary(data);
  } catch {
    return { status: 'unavailable', reason: 'denied' };
  }
}
