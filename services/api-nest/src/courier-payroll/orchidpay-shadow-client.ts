import type { OrchidPayCourierSettlementIntent } from './orchidpay-settlement-intent';

export const ORCHIDPAY_COURIER_SHADOW_FLAG =
  'DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_ENABLED';

export interface OrchidPayShadowReceipt {
  ok: true;
  shadow: true;
  statement_id: string;
  intent_hash: string;
  status: 'SHADOW_RECEIVED';
  idempotent_replay: boolean;
  production_execution: false;
}

export interface OrchidPayShadowSendResult {
  enabled: boolean;
  sent: boolean;
  status?: number;
  receipt?: OrchidPayShadowReceipt;
}

type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  },
) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<any>;
}>;

function enabled(env: Record<string, string | undefined>): boolean {
  return String(env[ORCHIDPAY_COURIER_SHADOW_FLAG] || '').toLowerCase() === 'true';
}

function requiredUrl(env: Record<string, string | undefined>): string {
  const raw = String(
    env.DA_ORCHIDPAY_COURIER_PAYROLL_SHADOW_URL || '',
  ).trim();
  if (!raw) throw new Error('ORCHIDPAY_COURIER_SHADOW_URL_REQUIRED');
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error('ORCHIDPAY_COURIER_SHADOW_URL_INVALID');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('ORCHIDPAY_COURIER_SHADOW_URL_INVALID');
  }
  return raw.replace(/\/+$/, '');
}

function requiredKey(env: Record<string, string | undefined>): string {
  const key = String(
    env.DA_ORCHIDPAY_COURIER_PAYROLL_INTERNAL_KEY || '',
  ).trim();
  if (!key) throw new Error('ORCHIDPAY_COURIER_SHADOW_INTERNAL_KEY_REQUIRED');
  return key;
}

export async function sendOrchidPayCourierShadowIntent(
  intent: OrchidPayCourierSettlementIntent,
  options: {
    env?: Record<string, string | undefined>;
    fetchImpl?: FetchLike;
  } = {},
): Promise<OrchidPayShadowSendResult> {
  const env = options.env || process.env;
  if (!enabled(env)) {
    return { enabled: false, sent: false };
  }

  if (intent.mode !== 'SHADOW') {
    throw new Error('ORCHIDPAY_COURIER_SHADOW_MODE_REQUIRED');
  }

  const baseUrl = requiredUrl(env);
  const internalKey = requiredKey(env);
  const fetchImpl =
    options.fetchImpl || (globalThis.fetch as unknown as FetchLike | undefined);
  if (!fetchImpl) throw new Error('ORCHIDPAY_COURIER_SHADOW_FETCH_UNAVAILABLE');

  const response = await fetchImpl(
    `${baseUrl}/payroll/courier/settlement-intents`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Internal-Key': internalKey,
      },
      body: JSON.stringify(intent),
    },
  );

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.ok !== true || payload?.shadow !== true) {
    const detail = String(
      payload?.detail || payload?.error || payload?.code || response.status,
    );
    throw new Error(`ORCHIDPAY_COURIER_SHADOW_REJECTED:${detail}`);
  }

  if (payload.production_execution !== false) {
    throw new Error('ORCHIDPAY_COURIER_SHADOW_PRODUCTION_BOUNDARY_BREACH');
  }

  return {
    enabled: true,
    sent: true,
    status: response.status,
    receipt: payload as OrchidPayShadowReceipt,
  };
}
